import { createHash } from "node:crypto";
import { RankingEntry } from "../../models/RankingEntry";
import { RankingSnapshot, RankingSnapshotDocument } from "../../models/RankingSnapshot";
import { s3Service } from "../S3Service";
import { AitaRankingSource, aitaRankingSource } from "./AitaRankingSource";
import { parseRankingPdf } from "./rankingPdfParser";
import { recomputeSnapshotInsights } from "./recomputeSnapshotInsights";
import { resolveStateCode } from "./stateCodes";
import { AitaCategory, LIVE_COMBOS, ParseResult, SENTINEL_COMBO } from "./types";
import { log as __rootLog } from "../../../utils/logger";
const logger = __rootLog.child("aitaRankingIngest");

/**
 * Orchestrates discover -> fetch -> archive -> parse -> validate -> publish for
 * AITA rankings.
 *
 * Two ideas do most of the work here.
 *
 * **Content hash is identity.** AITA reissues corrected PDFs under the same
 * as-on date, and the date dropdown cannot show that. So a snapshot is keyed by
 * (combo, date, sha256): re-running an unchanged list is a no-op, and a
 * corrected file lands as a new version with the old one demoted rather than
 * overwriting rows that were already published.
 *
 * **Nothing publishes itself past a doubt.** A list whose row count has moved
 * more than a quarter since the last published one, or whose printed "As on"
 * line disagrees with the date we asked for, or where unmapped state codes are
 * widespread rather than isolated, is quarantined for review instead of going
 * live. The failure mode this guards against is not a crash — it is a
 * plausible-looking wrong ranking, which is the one thing that would cost us a
 * parent's trust permanently.
 *
 * The thresholds are deliberately proportional, not absolute. Being strict
 * about a single odd cell would have thrown away a whole 567-row list over one
 * typo, which fails parents in a different direction.
 */

const isDev = process.env.NODE_ENV !== "production";
const log = {
  // Dev-only chatter: keep it off the prod stream, but route it through the
  // real logger so it carries the namespace and request id like everything else.
  info: (message: string, ...rest: unknown[]) => {
    if (isDev) logger.info(message, ...rest);
  },
  warn: (message: string, ...rest: unknown[]) => logger.warn(message, ...rest),
  error: (message: string, ...rest: unknown[]) => logger.error(message, ...rest),
};

/** A published list moving more than this against the previous one is suspect. */
const ROW_COUNT_DEVIATION_LIMIT = 0.25;
/** Above this share of rows carrying an unmapped state code, assume a misparse. */
const UNKNOWN_STATE_RATE_LIMIT = 0.02;
/** Entries are written in chunks so a 1,600-row list is not one giant command. */
const ENTRY_CHUNK_SIZE = 500;
/** Past this, the scheduler's health check starts complaining. */
export const STALENESS_ALERT_DAYS = 21;

export type IngestStatus =
  | "published"
  | "quarantined"
  | "unchanged"
  | "no-document"
  | "failed";

export interface IngestOutcome {
  category: string;
  subcategory: string;
  asOnDate: string;
  status: IngestStatus;
  rowCount?: number;
  snapshotId?: string;
  reason?: string;
}

export interface SweepReport {
  startedAt: Date;
  finishedAt: Date;
  outcomes: IngestOutcome[];
  published: number;
  quarantined: number;
  failed: number;
}

export class AitaRankingIngestService {
  constructor(private source: AitaRankingSource = aitaRankingSource) {}

  /**
   * The hourly tripwire. Two small requests against one combo, compared with
   * what we have stored — deliberately never touches a PDF, because the point
   * is to be cheap enough to run every hour against someone else's small box.
   */
  async pollSentinel(): Promise<{
    hasNewWork: boolean;
    sourceLatest: string | null;
    storedLatest: string | null;
  }> {
    const { category, subcategory } = SENTINEL_COMBO;
    const sourceLatest = await this.source.latestDate(category, subcategory);
    const stored = await RankingSnapshot.findOne({
      category,
      subcategory,
      status: "published",
    })
      .sort({ asOnDate: -1 })
      .select("asOnDate")
      .lean();

    const storedLatest = stored?.asOnDate ? toIsoDate(stored.asOnDate) : null;
    return {
      hasNewWork: Boolean(sourceLatest && sourceLatest !== storedLatest),
      sourceLatest,
      storedLatest,
    };
  }

  /**
   * Ingests the newest list for every live combo.
   *
   * The sentinel says "something moved"; this decides what. It runs all twelve
   * because the combos do not always publish together — their snapshot counts
   * differ by a couple of weeks across the history, so trusting the sentinel to
   * speak for the rest would quietly skip lists.
   */
  async sweepLiveCombos(): Promise<SweepReport> {
    const startedAt = new Date();
    const outcomes: IngestOutcome[] = [];

    for (const { category, subcategory } of LIVE_COMBOS) {
      try {
        const latest = await this.source.latestDate(category, subcategory);
        if (!latest) {
          outcomes.push({
            category,
            subcategory,
            asOnDate: "",
            status: "no-document",
            reason: "Source lists no dates for this combination",
          });
          continue;
        }
        outcomes.push(await this.ingestOne(category, subcategory, latest));
      } catch (error) {
        outcomes.push({
          category,
          subcategory,
          asOnDate: "",
          status: "failed",
          reason: error instanceof Error ? error.message : String(error),
        });
      }
    }

    const report: SweepReport = {
      startedAt,
      finishedAt: new Date(),
      outcomes,
      published: outcomes.filter((o) => o.status === "published").length,
      quarantined: outcomes.filter((o) => o.status === "quarantined").length,
      failed: outcomes.filter((o) => o.status === "failed").length,
    };
    log.info(
      `[aita-rankings] sweep done: ${report.published} published, ` +
        `${report.quarantined} quarantined, ${report.failed} failed`,
    );
    return report;
  }

  /** One (combo, date). Safe to re-run: unchanged bytes are a no-op. */
  async ingestOne(
    category: AitaCategory,
    subcategory: string,
    asOnDate: string,
  ): Promise<IngestOutcome> {
    const base = { category, subcategory, asOnDate };

    const discovered = await this.source.resolveSnapshot(category, subcategory, asOnDate);
    if (!discovered) {
      return { ...base, status: "no-document", reason: "No PDF link on the result page" };
    }

    // If this date is already published, ask the server whether the file moved
    // before spending a download on it.
    const published = await RankingSnapshot.findOne({
      category,
      subcategory,
      asOnDate: new Date(asOnDate),
      status: "published",
    })
      .sort({ version: -1 })
      .lean();

    if (published) {
      try {
        const head = await this.source.headPdf(discovered.pdfUrl);
        const sameEtag = head.etag && head.etag === published.sourceEtag;
        const sameModified =
          head.lastModified && head.lastModified === published.sourceLastModified;
        const sameSize = head.byteSize && head.byteSize === published.byteSize;
        if (sameEtag || (sameModified && sameSize)) {
          return { ...base, status: "unchanged", snapshotId: String(published._id) };
        }
      } catch {
        // HEAD is an optimisation. If it fails, fall through and fetch.
      }
    }

    const fetched = await this.source.fetchPdf(discovered.pdfUrl);
    const contentHash = createHash("sha256").update(fetched.buffer).digest("hex");

    const existing = await RankingSnapshot.findOne({
      category,
      subcategory,
      asOnDate: new Date(asOnDate),
      contentHash,
    }).lean();
    if (existing && existing.status === "published") {
      return { ...base, status: "unchanged", snapshotId: String(existing._id) };
    }

    const priorVersions = await RankingSnapshot.countDocuments({
      category,
      subcategory,
      asOnDate: new Date(asOnDate),
    });

    const snapshot: RankingSnapshotDocument = await RankingSnapshot.findOneAndUpdate(
      { category, subcategory, asOnDate: new Date(asOnDate), contentHash },
      {
        $set: {
          sportSlug: "tennis",
          federationCode: "AITA",
          pdfUrl: discovered.pdfUrl,
          sourceUrl: discovered.sourceUrl,
          byteSize: fetched.byteSize,
          status: "archived",
          fetchedAt: new Date(),
          ...(fetched.etag ? { sourceEtag: fetched.etag } : {}),
          ...(fetched.lastModified ? { sourceLastModified: fetched.lastModified } : {}),
        },
        $setOnInsert: { version: existing ? existing.version : priorVersions + 1 },
      },
      { new: true, upsert: true, setDefaultsOnInsert: true },
    );

    // Archive before parsing, so a parser bug never costs us the source bytes.
    // Best-effort on purpose: local dev has no AWS credentials and should still
    // be able to run an ingest end to end.
    const s3Key = buildS3Key(category, subcategory, asOnDate, contentHash);
    try {
      await s3Service.putDocumentBuffer(s3Key, fetched.buffer, "application/pdf");
      await applyToSnapshot(snapshot, { s3Key });
    } catch (error) {
      log.warn(
        `[aita-rankings] archive failed for ${s3Key} — continuing without it:`,
        error instanceof Error ? error.message : error,
      );
    }

    let parsed: ParseResult;
    try {
      parsed = await parseRankingPdf(fetched.buffer);
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      await this.markFailed(snapshot, reason);
      return { ...base, status: "failed", reason, snapshotId: String(snapshot._id) };
    }

    await applyToSnapshot(snapshot, {
      pageCount: parsed.pageCount,
      rowCount: parsed.rows.length,
      columns: parsed.columns,
      diagnostics: parsed.diagnostics,
      parsedAt: new Date(),
      status: "parsed",
    });

    const objection = await this.validate(parsed, category, subcategory, asOnDate);
    if (objection) {
      await applyToSnapshot(snapshot, {
        status: "quarantined",
        failureReason: objection,
      });
      log.warn(
        `[aita-rankings] quarantined ${category}/${subcategory} ${asOnDate}: ${objection}`,
      );
      return {
        ...base,
        status: "quarantined",
        reason: objection,
        rowCount: parsed.rows.length,
        snapshotId: String(snapshot._id),
      };
    }

    await this.publish(snapshot, parsed);
    return {
      ...base,
      status: "published",
      rowCount: parsed.rows.length,
      snapshotId: String(snapshot._id),
    };
  }

  /**
   * Walks a combo's whole history, oldest first. Separate from the sweep on
   * purpose — it is a one-time job of roughly 250 requests per combo and has no
   * business running on a schedule.
   */
  async backfillCombo(
    category: AitaCategory,
    subcategory: string,
    options: {
      limit?: number;
      since?: string;
      /** Skip dates already published, with no request at all. */
      skipExisting?: boolean;
      onProgress?: (done: number, total: number, outcome: IngestOutcome) => void;
    } = {},
  ): Promise<IngestOutcome[]> {
    const dates = await this.source.listDates(category, subcategory);
    let chosen = dates
      .filter((d) => !options.since || d >= options.since)
      .sort() // oldest first, so `isLatest` ends up on the newest naturally
      .slice(0, options.limit ?? dates.length);

    // Resuming a half-finished backfill would otherwise re-pay two requests per
    // date to conclude "unchanged". Historical lists do not get revised — only
    // the current week's does — so for a backfill, already-published is enough.
    if (options.skipExisting) {
      const held = await RankingSnapshot.find({
        category,
        subcategory,
        status: "published",
      })
        .select("asOnDate")
        .lean();
      const heldDates = new Set(held.map((s) => toIsoDate(s.asOnDate)));
      const before = chosen.length;
      chosen = chosen.filter((d) => !heldDates.has(d));
      if (before !== chosen.length) {
        log.info(
          `[aita-rankings] ${category}/${subcategory}: skipping ${before - chosen.length} already held`,
        );
      }
    }

    const outcomes: IngestOutcome[] = [];
    for (const date of chosen) {
      let outcome: IngestOutcome;
      try {
        outcome = await this.ingestOne(category, subcategory, date);
      } catch (error) {
        outcome = {
          category,
          subcategory,
          asOnDate: date,
          status: "failed",
          reason: error instanceof Error ? error.message : String(error),
        };
      }
      outcomes.push(outcome);
      options.onProgress?.(outcomes.length, chosen.length, outcome);
    }
    return outcomes;
  }

  /**
   * How long since anything was published. The real failure mode of a pipeline
   * against someone else's site is not an exception — it is six quiet weeks of
   * "no change" because a URL moved.
   */
  async getHealth(): Promise<{
    latestAsOnDate: string | null;
    daysSincePublish: number | null;
    stale: boolean;
    quarantinedCount: number;
  }> {
    const latest = await RankingSnapshot.findOne({ status: "published" })
      .sort({ asOnDate: -1 })
      .select("asOnDate")
      .lean();
    const quarantinedCount = await RankingSnapshot.countDocuments({
      status: "quarantined",
    });

    if (!latest?.asOnDate) {
      return { latestAsOnDate: null, daysSincePublish: null, stale: true, quarantinedCount };
    }
    const days = Math.floor(
      (Date.now() - new Date(latest.asOnDate).getTime()) / 86_400_000,
    );
    return {
      latestAsOnDate: toIsoDate(latest.asOnDate),
      daysSincePublish: days,
      stale: days > STALENESS_ALERT_DAYS,
      quarantinedCount,
    };
  }

  /** Returns a reason to quarantine, or null to publish. */
  private async validate(
    parsed: ParseResult,
    category: string,
    subcategory: string,
    asOnDate: string,
  ): Promise<string | null> {
    if (parsed.rows.length === 0) return "Parsed zero rows";
    if (parsed.diagnostics.malformedRows > 0) {
      return `${parsed.diagnostics.malformedRows} malformed rows`;
    }
    // An unmapped state code is usually AITA's own typo in a single cell —
    // "PD" appears exactly once in a 567-row Men's Doubles list that also uses
    // "PY" correctly. Losing 567 rankings over one cell is the worse trade, so
    // those rows publish without a canonical state (they simply do not appear
    // in state filters) and only a systemic rate quarantines the list.
    const unknownRate = parsed.diagnostics.unknownStateRows / parsed.rows.length;
    if (unknownRate > UNKNOWN_STATE_RATE_LIMIT) {
      return (
        `${parsed.diagnostics.unknownStateRows} of ${parsed.rows.length} rows have an ` +
        `unmapped state code (${parsed.diagnostics.unknownStateCodes.join(", ")}) — ` +
        `likely a misparse rather than a typo`
      );
    }
    if (!asOnLabelAgrees(parsed.asOnLabel, asOnDate)) {
      return `PDF is printed "${parsed.asOnLabel}" but was listed under ${asOnDate}`;
    }

    // Baseline is the immediately preceding snapshot by date, whatever its
    // status. Using the most recent *published* one instead meant that once a
    // week was quarantined the baseline froze, so a single legitimate
    // step-change quarantined every week after it too — twelve in a row, from
    // one real event.
    const previous = await RankingSnapshot.findOne({
      category,
      subcategory,
      status: { $in: ["published", "quarantined"] },
      asOnDate: { $lt: new Date(asOnDate) },
    })
      .sort({ asOnDate: -1 })
      .select("rowCount asOnDate")
      .lean();

    if (previous?.rowCount) {
      const deviation =
        Math.abs(parsed.rows.length - previous.rowCount) / previous.rowCount;
      if (deviation > ROW_COUNT_DEVIATION_LIMIT) {
        // Age-group lists empty out every January as players age up — the
        // Boys U-12 list went 1,126 -> 668 between 31 Dec 2025 and 12 Jan 2026,
        // a real 41% drop with nothing wrong about it. Flagging it every year
        // on eight lists would train everyone to wave quarantines through,
        // which costs more than it protects.
        if (isAgeGroupRollover(subcategory, previous.asOnDate, asOnDate)) {
          parsed.diagnostics.warnings.push(
            `Row count moved ${(deviation * 100).toFixed(0)}% across the new year ` +
              `(${previous.rowCount} -> ${parsed.rows.length}) — expected age-group rollover`,
          );
          return null;
        }
        return (
          `Row count moved ${(deviation * 100).toFixed(0)}% against ` +
          `${toIsoDate(previous.asOnDate)} (${previous.rowCount} -> ${parsed.rows.length})`
        );
      }
    }
    return null;
  }

  /** Writes the rows and promotes the snapshot, demoting whatever it replaces. */
  private async publish(
    snapshot: RankingSnapshotDocument,
    parsed: ParseResult,
  ): Promise<void> {
    const newestPublished = await RankingSnapshot.findOne({
      category: snapshot.category,
      subcategory: snapshot.subcategory,
      status: "published",
    })
      .sort({ asOnDate: -1 })
      .select("asOnDate")
      .lean();

    // A backfilled older list must not steal `isLatest` from a newer one.
    const becomesLatest =
      !newestPublished?.asOnDate ||
      new Date(snapshot.asOnDate).getTime() >= new Date(newestPublished.asOnDate).getTime();

    const operations = parsed.rows.map((row) => {
      // `fullName` comes from the parser because some lists print one
      // `NAME OF PLAYER` column and leave the given/family pair empty.
      const fullName = row.fullName;
      const state = row.stateCode ? resolveStateCode(row.stateCode) : null;
      return {
        updateOne: {
          filter: { snapshot: snapshot._id, regNo: row.regNo },
          update: {
            $set: {
              sportSlug: snapshot.sportSlug,
              federationCode: snapshot.federationCode,
              category: snapshot.category,
              subcategory: snapshot.subcategory,
              asOnDate: snapshot.asOnDate,
              isLatest: becomesLatest,
              rank: row.rank,
              givenName: row.givenName,
              familyName: row.familyName,
              fullName,
              nameSearch: fullName.toLowerCase(),
              points: row.points,
              totalPoints: row.totalPoints,
              ...(row.dob
                ? { dob: row.dob, birthYear: row.dob.getUTCFullYear() }
                : {}),
              ...(row.stateCode ? { stateCode: row.stateCode } : {}),
              ...(state ? { state } : {}),
            },
          },
          upsert: true,
        },
      };
    });

    for (let i = 0; i < operations.length; i += ENTRY_CHUNK_SIZE) {
      await RankingEntry.bulkWrite(operations.slice(i, i + ENTRY_CHUNK_SIZE), {
        ordered: false,
      });
    }

    if (becomesLatest) {
      await RankingEntry.updateMany(
        {
          category: snapshot.category,
          subcategory: snapshot.subcategory,
          isLatest: true,
          snapshot: { $ne: snapshot._id },
        },
        { $set: { isLatest: false } },
      );
      await RankingSnapshot.updateMany(
        {
          category: snapshot.category,
          subcategory: snapshot.subcategory,
          isLatestForCombo: true,
          _id: { $ne: snapshot._id },
        },
        { $set: { isLatestForCombo: false } },
      );
    }

    // Derived analytics — movement against last week, state ranks, benchmark
    // tiers, state distribution, points-by-source bands. Computed here rather
    // than per request because every public read wants all of it.
    //
    // Known limitation: this measures against whatever the preceding published
    // list is *right now*. Backfilling an older week after newer ones are live
    // leaves those newer weeks comparing against the wrong baseline, so the
    // backfill migration exists to re-run a combo's whole chain in date order.
    // A forward-only sweep never hits that, because it only ever adds the
    // newest list.
    try {
      await recomputeSnapshotInsights(snapshot._id);
    } catch (error) {
      // The rows are already correct and published; analytics are additive. A
      // failure here must not turn a good ingest into a failed one.
      log.warn(
        `[aita-rankings] insight computation failed for ${snapshot.category}/` +
          `${snapshot.subcategory} ${toIsoDate(snapshot.asOnDate)}:`,
        error instanceof Error ? error.message : error,
      );
    }

    await applyToSnapshot(snapshot, {
      status: "published",
      isLatestForCombo: becomesLatest,
      publishedAt: new Date(),
    });
  }

  private async markFailed(
    snapshot: RankingSnapshotDocument,
    reason: string,
  ): Promise<void> {
    await applyToSnapshot(snapshot, { status: "failed", failureReason: reason });
    log.error(
      `[aita-rankings] parse failed for ${snapshot.category}/${snapshot.subcategory}: ${reason}`,
    );
  }
}

/**
 * True when a big row-count move sits across a calendar-year boundary on an
 * age-bracketed list (`U-12`, `U-14`, …). Those brackets are defined by birth
 * year, so every 1 January a cohort ages out of one list and into the next and
 * the smaller list loses a large share of its players in a single week. It is
 * the one predictable step-change in this data.
 *
 * Open-age lists (Singles/Doubles) have no such boundary and are not exempted.
 */
export function isAgeGroupRollover(
  subcategory: string,
  previousDate: Date | string,
  asOnDate: string,
): boolean {
  if (!/^U-\d+$/i.test(subcategory.trim())) return false;
  const previousYear = new Date(previousDate).getUTCFullYear();
  const currentYear = Number.parseInt(asOnDate.slice(0, 4), 10);
  return Number.isFinite(currentYear) && currentYear > previousYear;
}

/**
 * Writes a state transition onto a snapshot atomically and mirrors it onto the
 * in-memory document.
 *
 * Deliberately not `doc.save()`. Mongoose guards saves with the `__v` version
 * key, so a hydrated document written three times across one ingest throws
 * VersionError the moment anything else touches the row — which is exactly what
 * happened when a stopped backfill left an orphaned process racing a new one on
 * the same dates. These writes are last-writer-wins field updates on disjoint
 * fields, so optimistic concurrency buys nothing and only invents failures.
 */
async function applyToSnapshot(
  snapshot: RankingSnapshotDocument,
  changes: Record<string, unknown>,
): Promise<void> {
  await RankingSnapshot.updateOne({ _id: snapshot._id }, { $set: changes });
  Object.assign(snapshot, changes);
}

/** `rankings/aita/boys/u-14/2026-07-27_a1b2c3d4.pdf` */
function buildS3Key(
  category: string,
  subcategory: string,
  asOnDate: string,
  contentHash: string,
): string {
  const safe = (value: string) =>
    value
      .toLowerCase()
      .replace(/\+/g, "plus")
      .replace(/[^a-z0-9-]+/g, "-")
      .replace(/^-|-$/g, "");
  return `rankings/aita/${safe(category)}/${safe(subcategory)}/${asOnDate}_${contentHash.slice(0, 8)}.pdf`;
}

function toIsoDate(value: Date | string): string {
  return new Date(value).toISOString().slice(0, 10);
}

/**
 * Cross-checks the "As on 27th July, 2026" line against the date the dropdown
 * filed the PDF under. A mismatch means AITA has mis-filed a list — rare, but
 * it would silently attribute a whole week's rankings to the wrong date.
 *
 * Absent or unreadable labels pass: some older lists do not print one, and this
 * is a corroborating check rather than the source of truth.
 */
export function asOnLabelAgrees(label: string | null, asOnDate: string): boolean {
  if (!label) return true;
  const [year, month, day] = asOnDate.split("-").map((n) => Number.parseInt(n, 10));
  if (!year || !month || !day) return true;

  const months = "january february march april may june july august september october november december".split(" ");
  const monthName = months[month - 1];
  if (!monthName) return true;

  const lower = label.toLowerCase();

  // Parse the parts out and compare numerically rather than pattern-matching
  // the date back into the string. The string form varies more than it looks:
  // days carry an ordinal suffix and are sometimes zero-padded ("02nd Feb ,
  // 2026", "27th July, 2026"), months appear full or abbreviated, and the
  // spacing around the comma is inconsistent. An earlier version matched the
  // day with a leading non-digit boundary and so rejected every zero-padded
  // single-digit day — quarantining nine perfectly good lists in one 26-week
  // backfill before this was caught.
  const dayMatch = lower.match(/(\d{1,2})\s*(?:st|nd|rd|th)\b/);
  const yearMatch = lower.match(/\b(\d{4})\b/);
  const hasMonth = lower.includes(monthName) || lower.includes(monthName.slice(0, 3));

  // Nothing recognisable at all: this is a corroborating check, not the source
  // of truth, so an unparseable label must not block a publish.
  if (!dayMatch && !yearMatch && !hasMonth) return true;

  const labelDay = dayMatch?.[1] ? Number.parseInt(dayMatch[1], 10) : null;
  const labelYear = yearMatch?.[1] ? Number.parseInt(yearMatch[1], 10) : null;
  if (labelDay !== null && labelDay !== day) return false;
  if (labelYear !== null && labelYear !== year) return false;
  return hasMonth;
}
