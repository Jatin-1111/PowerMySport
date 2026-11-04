/**
 * READ-ONLY comparison of AITA's live tournament calendar with the editions stored
 * for tennis. It writes nothing, anywhere: there is no --apply flag, and the
 * database is opened with the raw driver and `find()` only.
 *
 *   npx ts-node src/scripts/aitaCalendarDryRun.ts            # this month and the next 5
 *   npx ts-node src/scripts/aitaCalendarDryRun.ts --months 3
 *
 * (Not `npm run x -- --months 3`: PowerShell strips the `--`.)
 *
 * It answers the question the ingestion plan (docs/planner-aita-calendar-plan.md)
 * depends on, before anything is built on it: of what AITA lists, how much do we
 * already hold, how much is missing, and how many stored upcoming rows no longer
 * correspond to anything AITA lists.
 *
 * Deliberately does NOT import the Mongoose models. Loading a model against the
 * only database there is would create its indexes in production (see
 * server/CLAUDE.md), and a dry run must not write even that.
 *
 * Matching is by what a parent would call the same event: the same level, the same
 * city and a start date within a few days. The stored rows carry placeholder
 * Monday start dates from the old calendar, so exact-date matching would call
 * everything missing.
 */

import "dotenv/config";
import mongoose from "mongoose";
import { AitaCalendarSource } from "../shared/services/aita/AitaCalendarSource";
import { classifyLevel, type MonthRow } from "../shared/services/aita/calendarParser";

const MONGO_URI = process.env.MONGO_URI || process.env.DATABASE_URL || "";
if (!MONGO_URI) {
  console.error("MONGO_URI not set in .env");
  process.exit(1);
}

/** A stored start date this close to AITA's counts as the same event. */
const MATCH_WINDOW_DAYS = 5;
const DAY_MS = 24 * 60 * 60 * 1000;

const monthsArg = process.argv.indexOf("--months");
const MONTHS =
  monthsArg !== -1 ? Math.max(1, Math.min(12, Number(process.argv[monthsArg + 1]) || 6)) : 6;

interface Stored {
  _id: unknown;
  name: string;
  startDate: Date;
  city?: string | null;
  state?: string | null;
  ladder?: string | null;
  kind?: string | null;
  lastCheckedAt?: Date | null;
}

const norm = (value: string | null | undefined): string =>
  String(value ?? "")
    .toLowerCase()
    .replace(/[^a-z]/g, "");

const iso = (d: Date): string => d.toISOString().slice(0, 10);

function sameEvent(row: MonthRow, stored: Stored): boolean {
  const level = classifyLevel(row.levelText);
  if (
    level.kind === "junior-ladder"
      ? stored.ladder !== level.ladder
      : stored.kind === "junior-ladder"
  ) {
    return false;
  }
  const place = norm(row.city) || norm(row.state);
  const storedPlace = norm(stored.city) || norm(stored.state);
  if (!place || place !== storedPlace) return false;
  const gap = Math.abs(
    new Date(`${row.startDate}T00:00:00Z`).getTime() - stored.startDate.getTime()
  );
  return gap <= MATCH_WINDOW_DAYS * DAY_MS;
}

async function main(): Promise<void> {
  const today = new Date();
  const todayIso = iso(today);

  // ── AITA ────────────────────────────────────────────────────────────────
  const source = new AitaCalendarSource();
  const seen = new Map<string, MonthRow>();
  for (let i = 0; i < MONTHS; i += 1) {
    const at = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() + i, 1));
    const { rows } = await source.fetchMonth(at.getUTCFullYear(), at.getUTCMonth() + 1);
    console.log(
      `AITA ${at.getUTCFullYear()}-${String(at.getUTCMonth() + 1).padStart(2, "0")}: ${rows.length} events`
    );
    // An event spanning a month end is listed in both, so key by AITA's own id.
    for (const row of rows) if (row.endDate >= todayIso) seen.set(row.externalId, row);
  }
  const upcoming = [...seen.values()].sort((a, b) => a.startDate.localeCompare(b.startDate));
  const ladderRows = upcoming.filter((r) => classifyLevel(r.levelText).kind === "junior-ladder");

  // ── Stored ──────────────────────────────────────────────────────────────
  await mongoose.connect(MONGO_URI, { autoIndex: false, serverSelectionTimeoutMS: 15000 });
  const stored = (await mongoose.connection
    .db!.collection("tournamenteditions")
    .find(
      {
        sportSlug: "tennis",
        startDate: { $gte: new Date(`${todayIso}T00:00:00Z`) },
        mergedInto: { $exists: false },
      },
      {
        projection: {
          name: 1,
          startDate: 1,
          city: 1,
          state: 1,
          ladder: 1,
          kind: 1,
          lastCheckedAt: 1,
        },
      }
    )
    .toArray()) as unknown as Stored[];
  await mongoose.disconnect();

  // ── Compare ─────────────────────────────────────────────────────────────
  const claimed = new Set<unknown>();
  const missing: MonthRow[] = [];
  let matched = 0;
  for (const row of upcoming) {
    const hit = stored.find((s) => !claimed.has(s._id) && sameEvent(row, s));
    if (hit) {
      claimed.add(hit._id);
      matched += 1;
    } else missing.push(row);
  }
  const orphans = stored.filter((s) => !claimed.has(s._id));
  const lastChecked = stored.reduce<Date | null>(
    (latest, s) =>
      s.lastCheckedAt && (!latest || s.lastCheckedAt > latest) ? s.lastCheckedAt : latest,
    null
  );

  console.log("\n── Summary (from " + todayIso + ") ──");
  console.log(
    `AITA lists, still to be played:   ${upcoming.length} (${ladderRows.length} on the junior ladder)`
  );
  console.log(`Stored, upcoming, not merged:     ${stored.length}`);
  console.log(`AITA events we already hold:      ${matched}`);
  console.log(`AITA events we do NOT hold:       ${missing.length}  <- would be created`);
  console.log(`Stored rows AITA no longer lists: ${orphans.length}  <- would be retired or merged`);
  console.log(
    `Most recent lastCheckedAt:        ${lastChecked ? lastChecked.toISOString() : "none"}`
  );

  console.log("\nWould create (first 25):");
  for (const m of missing.slice(0, 25)) {
    console.log(
      `  ${m.startDate}  ${(m.levelText ?? "?").padEnd(30)} ${m.city ?? "-"}, ${m.state ?? "-"}  [${m.externalId}]`
    );
  }
  console.log("\nStored rows with no AITA counterpart (first 25):");
  for (const o of orphans
    .slice(0, 25)
    .sort((a, b) => a.startDate.getTime() - b.startDate.getTime())) {
    console.log(
      `  ${iso(o.startDate)}  ${(o.ladder ?? o.kind ?? "?").padEnd(22)} ${o.city ?? "-"}, ${o.state ?? "-"}  ${o.name.slice(0, 40)}`
    );
  }
  console.log("\nNothing was written.");
}

main().catch((error) => {
  console.error("failed:", error instanceof Error ? error.message.slice(0, 300) : error);
  process.exit(1);
});
