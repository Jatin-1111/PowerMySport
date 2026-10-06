import type { mongo } from "mongoose";
import { AitaCalendarSource, monthUrl } from "./AitaCalendarSource";
import { classifyLevel, type FactSheet, type MonthRow } from "./calendarParser";
import {
  planIngest,
  planRetirements,
  type IngestPlan,
  type RetirementPlan,
  type StoredEdition,
} from "./calendarIngest";

/**
 * One sweep of AITA's calendar into the stored tennis editions: read, plan, write.
 *
 * The same code runs from `scripts/ingestAitaCalendar.ts` by hand and from the
 * scheduler (`utils/aitaCalendarScheduler.ts`), so what was reported is what the
 * schedule does. Every decision is in the pure `planIngest` and `planRetirements`;
 * this file is the part that touches the network and the database.
 *
 * Takes a raw `Db` and no Mongoose model on purpose. A script that imports a model
 * creates its collection and indexes in the one production database (server/CLAUDE.md),
 * and the raw driver has no such side effect.
 *
 * ── What it will not do ─────────────────────────────────────────────────────
 * Anything is written only when `apply` is true. A month page that cannot be read
 * fails the whole sweep before any decision is made: a partial picture of the
 * calendar is exactly the one in which a missing month looks like cancelled events.
 * It refuses to write when the database has too little room left, because past the
 * quota the cluster stops accepting writes for every collection, bookings included.
 */

/** Mongoose bundles its own driver, so its `Db` type is the one a live connection returns. */
type Db = mongo.Db;

const COLLECTION = "tournamenteditions";

/** The cluster's logical limit on the free tier. */
const QUOTA_BYTES = 512 * 1024 * 1024;
/** A sweep needs well under a megabyte; this is a margin, not an estimate. */
const MIN_HEADROOM_BYTES = 4 * 1024 * 1024;

export interface SyncOptions {
  apply: boolean;
  /** Months read, counting this one. AITA lists two to three ahead, so 5 has spare. */
  months?: number;
  /** Fact sheets are read for ladder events starting within this many days. */
  sheetDays?: number;
  now?: Date;
  /** Called with the rows about to be changed, before the first write. Throwing aborts. */
  backup?: (rows: unknown[]) => Promise<void> | void;
  /** Called after a sweep that wrote something, so cached pages are not stale. */
  onWritten?: () => void;
}

export interface SyncReport {
  applied: boolean;
  monthsRead: Array<{ month: string; events: number }>;
  plan: IngestPlan;
  retirements: RetirementPlan;
  sheetsRead: number;
  sheetFailures: string[];
  written: { updated: number; created: number; cancelled: number; failed: string[] };
  /** Room left under the quota, read only when writing. */
  headroomBytes: number | null;
}

export async function syncAitaCalendar(
  deps: { db: Db; source?: AitaCalendarSource },
  options: SyncOptions
): Promise<SyncReport> {
  const now = options.now ?? new Date();
  const todayIso = now.toISOString().slice(0, 10);
  const months = Math.max(1, Math.min(12, options.months ?? 5));
  const sheetDays = Math.max(0, options.sheetDays ?? 120);
  const source = deps.source ?? new AitaCalendarSource();

  // ── Read AITA. Any month failing ends the sweep. ────────────────────────
  const rows: MonthRow[] = [];
  const monthOf = new Map<string, string>();
  const monthsRead: SyncReport["monthsRead"] = [];
  let rangeEnd = todayIso;
  for (let i = 0; i < months; i += 1) {
    const at = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + i, 1));
    const { sourceUrl, rows: got } = await source.fetchMonth(
      at.getUTCFullYear(),
      at.getUTCMonth() + 1
    );
    monthsRead.push({ month: at.toISOString().slice(0, 7), events: got.length });
    rangeEnd = new Date(Date.UTC(at.getUTCFullYear(), at.getUTCMonth() + 1, 0))
      .toISOString()
      .slice(0, 10);
    for (const row of got) {
      rows.push(row);
      if (!monthOf.has(row.externalId)) monthOf.set(row.externalId, sourceUrl);
    }
  }
  const seenIds = new Set(rows.map((r) => r.externalId));

  const horizon = new Date(now.getTime() + sheetDays * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);
  const wantSheets = [...new Map(rows.map((r) => [r.externalId, r])).values()].filter(
    (r) =>
      r.endDate >= todayIso &&
      r.startDate <= horizon &&
      classifyLevel(r.levelText).kind === "junior-ladder"
  );
  const sheets = new Map<string, FactSheet>();
  const sheetFailures: string[] = [];
  for (const row of wantSheets) {
    try {
      sheets.set(row.externalId, await source.fetchFactSheet(row.factSheetUrl));
    } catch (error) {
      sheetFailures.push(
        `${row.externalId}: ${error instanceof Error ? error.message.slice(0, 120) : String(error)}`
      );
    }
  }

  // ── Read what is stored ─────────────────────────────────────────────────
  const col = deps.db.collection(COLLECTION);
  const stored = (await col
    .find(
      { sportSlug: "tennis", mergedInto: { $exists: false } },
      {
        projection: {
          name: 1,
          slug: 1,
          startDate: 1,
          city: 1,
          state: 1,
          ladder: 1,
          kind: 1,
          externalId: 1,
          status: 1,
          lastCheckedAt: 1,
          officialDetailsSource: 1,
        },
      }
    )
    .toArray()) as unknown as StoredEdition[];
  const takenSlugs = new Set(
    (await col.find({ slug: { $exists: true } }, { projection: { slug: 1 } }).toArray()).map((d) =>
      String(d.slug)
    )
  );

  const plan = planIngest({
    rows,
    sheets,
    stored,
    takenSlugs,
    sourceUrlFor: (row) =>
      monthOf.get(row.externalId) ?? monthUrl(now.getUTCFullYear(), now.getUTCMonth() + 1),
    now,
  });
  const retirements = planRetirements({
    stored,
    seenIds,
    rangeStart: todayIso,
    rangeEnd,
    now,
  });

  const report: SyncReport = {
    applied: false,
    monthsRead,
    plan,
    retirements,
    sheetsRead: sheets.size,
    sheetFailures,
    written: { updated: 0, created: 0, cancelled: 0, failed: [] },
    headroomBytes: null,
  };
  if (!options.apply) return report;

  // ── Write ───────────────────────────────────────────────────────────────
  if (retirements.refused) {
    throw new Error(`Calendar sweep refused, nothing written: ${retirements.refused}`);
  }
  const stats = await deps.db.stats();
  report.headroomBytes = QUOTA_BYTES - (stats.dataSize + stats.indexSize);
  if (report.headroomBytes < MIN_HEADROOM_BYTES) {
    throw new Error(
      `Calendar sweep refused, nothing written: ${(report.headroomBytes / 1048576).toFixed(1)} MiB left of the ` +
        "512 MiB quota, and past it every write on the cluster fails"
    );
  }

  const touched = [...plan.updates.map((u) => u.id), ...retirements.cancel.map((s) => s._id)];
  if (options.backup && touched.length > 0) {
    const before = await col.find({ _id: { $in: touched as never[] } }).toArray();
    await options.backup(before);
  }

  for (const u of plan.updates) {
    try {
      const res = await col.updateOne({ _id: u.id as never }, { $set: u.set });
      report.written.updated += res.modifiedCount;
    } catch (error) {
      report.written.failed.push(
        `update ${u.name}: ${error instanceof Error ? error.message.slice(0, 160) : error}`
      );
    }
  }
  for (const c of plan.creates) {
    try {
      await col.insertOne(c.doc as never);
      report.written.created += 1;
    } catch (error) {
      report.written.failed.push(
        `create ${c.doc.name}: ${error instanceof Error ? error.message.slice(0, 160) : error}`
      );
    }
  }
  for (const row of retirements.cancel) {
    try {
      const res = await col.updateOne(
        { _id: row._id as never, status: { $ne: "cancelled" } },
        { $set: { status: "cancelled", updatedAt: now } }
      );
      report.written.cancelled += res.modifiedCount;
    } catch (error) {
      report.written.failed.push(
        `cancel ${row.name}: ${error instanceof Error ? error.message.slice(0, 160) : error}`
      );
    }
  }

  report.applied = true;
  if (report.written.updated + report.written.created + report.written.cancelled > 0)
    options.onWritten?.();
  return report;
}
