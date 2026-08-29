import { createHash } from "node:crypto";
import { RankingEntry } from "../../models/RankingEntry";
import { RankingSnapshot, RankingSnapshotDocument } from "../../models/RankingSnapshot";
import { s3Service } from "../S3Service";
import { gzipSync } from "node:zlib";
import { AitaRankingSource, aitaRankingSource, isoDateToWid } from "./AitaRankingSource";
import { parseRankingList } from "./rankingListParser";
import { recomputeSnapshotInsights } from "./recomputeSnapshotInsights";
import { sampleBandComposition } from "./sampleBandComposition";
import { resolveStateCode, resolveZoneId } from "./stateCodes";
import {
  AitaCategory,
  AITA_LISTS,
  AitaList,
  listForCombo,
  ParseResult,
} from "./types";
import { log as __rootLog } from "../../../utils/logger";
const logger = __rootLog.child("aitaRankingIngest");

/**
 * Orchestrates discover -> fetch -> archive -> parse -> validate -> publish for
 * AITA rankings.
 *
 * Two ideas do most of the work here, and both survived the August 2026 move off
 * WordPress unchanged — only the transport beneath them was rewritten.
 *
 * **Content hash is identity.** AITA reissues corrected lists under the same
 * as-on date, and the week list cannot show that. So a snapshot is keyed by
 * (combo, date, sha256): re-running an unchanged list is a no-op, and a
 * corrected one lands as a new version with the old one demoted rather than
 * overwriting rows that were already published. The hash is now taken over the
 * source HTML rather than PDF bytes; the old cheap ETag pre-check is gone,
 * because these pages are generated per request and their validators change
 * every time.
 *
 * **Nothing publishes itself past a doubt.** A list whose row count has moved
 * more than a quarter since the last published one, or which the server says is
 * a different week or a different list from the one requested, or where unmapped
 * state codes are widespread rather than isolated, is quarantined for review
 * instead of going live. The failure mode this guards against is not a crash —
 * it is a plausible-looking wrong ranking, which is the one thing that would
 * cost us a parent's trust permanently.
 *
 * A third idea was added *because* of the cutover. **A total blank is an alert,
 * not an outcome.** For three weeks every sweep reported twelve polite
 * "no-document" results while the site had moved, because a 404 body parsed into
 * an empty list of dates. `sweepLiveCombos` now throws when nothing at all
 * lands, and `pollSentinel` throws rather than reporting "up to date" when it
 * cannot reach the source.
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
/**
 * Fallback ceiling on the age of the newest list we hold, used **only** when the
 * source's own latest week could not be read.
 *
 * Raised from 21 to 35 with the 2026-08-29 rework. AITA's upload lag runs to 19
 * days and its intervals are often 14, so 21 days fired on a pipeline that was
 * completely current. 35 clears two missed fortnightly cycles with slack, which
 * is the least it can be and still mean something. When the source *can* be read,
 * `behindSource` answers the question properly and this is not consulted.
 */
export const STALENESS_ALERT_DAYS = 35;
/**
 * Deliberately absent: a time-based grace on being behind.
 *
 * The first attempt put one here and it could never fire. The only interval this
 * service can compute is the gap between the two *as-on dates*, and since AITA
 * publishes weekly that gap is always at least seven days the moment a new week
 * appears — so any grace shorter than a week was dead code and any grace longer
 * than a week defeated the point.
 *
 * What a grace actually needs is "how long have we been behind", which requires
 * knowing when the newer week showed up. Nothing here knows that: AITA's upload
 * lag is 12 to 19 days, so the as-on date says nothing about when it became
 * available. So this service reports being behind as a **fact**, and the
 * scheduler — which does have memory across runs — decides when it becomes an
 * error. See `aitaRankingScheduler.ts`.
 */
/**
 * The earliest year the new platform's week filter offers. A backfill with no
 * `--since` starts here rather than guessing at a date that does not exist.
 *
 * Reaching further back than our current Aug 2025 floor is *possible* now, but
 * it is not free: rows cost a measured 436 B all-in on a shared-tier Atlas
 * cluster that also holds real user accounts. Extending the archive is a
 * capacity decision, not a flag.
 */
const EARLIEST_BACKFILL_YEAR = 2024;

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
  /**
   * Set by `AITA_SKIP_COMPOSITION_SAMPLE=true`.
   *
   * The sampling stage is ~13 minutes of rate-limited requests across a full
   * sweep, which is right in production and tedious when running an ingest
   * locally to check something else. It is the only part of the pipeline with an
   * off switch, because it is the only part whose absence degrades a panel
   * rather than breaking the data.
   */
  private readonly skipComposition =
    process.env.AITA_SKIP_COMPOSITION_SAMPLE === "true";

  constructor(private source: AitaRankingSource = aitaRankingSource) {}

  /**
   * The hourly tripwire: one ~3 KB JSON call, compared with what we have stored.
   *
   * Better than the sentinel combo it replaces, on both counts. It is cheaper
   * (one request, no session to establish) and it is no longer a *proxy* — the
   * old version watched Boys U-18 and inferred the other eleven lists from it,
   * because the source only published dates per combination. The week list is
   * global, so this now speaks for every list directly.
   *
   * It throws rather than returning "nothing new" if the source is unreachable
   * or refuses us. That distinction is the whole lesson of the August 2026
   * cutover: for three weeks the old sentinel reported no new work every hour,
   * because a 404 body parsed into an empty list of dates.
   */
  async pollSentinel(): Promise<{
    hasNewWork: boolean;
    sourceLatest: string | null;
    storedLatest: string | null;
  }> {
    const week = await this.source.latestWeek();
    const stored = await RankingSnapshot.findOne({ status: "published" })
      .sort({ asOnDate: -1 })
      .select("asOnDate")
      .lean();

    const sourceLatest = week?.asOnDate ?? null;
    const storedLatest = stored?.asOnDate ? toIsoDate(stored.asOnDate) : null;
    return {
      hasNewWork: Boolean(sourceLatest && sourceLatest !== storedLatest),
      sourceLatest,
      storedLatest,
    };
  }

  /**
   * Ingests the newest published week across all twelve lists.
   *
   * Still runs all twelve rather than trusting the sentinel to speak for them:
   * the week list is global now, but whether a *particular* list has rows for
   * that week is not, and the old site's combos regularly published out of step.
   *
   * A total failure is an alert, not an outcome. Twelve consecutive
   * `no-document` results is what the cutover looked like from the inside, and
   * it was indistinguishable from a quiet week — so the whole sweep now fails
   * loudly if nothing landed at all, and `getHealth` no longer carries that
   * burden alone.
   */
  async sweepLiveCombos(): Promise<SweepReport> {
    const startedAt = new Date();
    const outcomes: IngestOutcome[] = [];

    // One call, before the loop: every list is filed under the same week ids, so
    // asking twelve times would be twelve times the requests for one answer.
    const week = await this.source.latestWeek();
    if (!week) {
      throw new Error(
        "AITA published no ranking weeks for this year or last — the source is " +
          "unreachable or the week list has moved.",
      );
    }

    for (const list of AITA_LISTS) {
      const { category, subcategory } = list;
      try {
        outcomes.push(await this.ingestOne(category, subcategory, week.asOnDate));
      } catch (error) {
        outcomes.push({
          category,
          subcategory,
          asOnDate: week.asOnDate,
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

    const landed = outcomes.filter(
      (o) => o.status === "published" || o.status === "unchanged",
    ).length;
    if (landed === 0) {
      throw new Error(
        `AITA sweep for ${week.asOnDate} landed nothing across all ` +
          `${outcomes.length} lists — treating as a source break rather than a ` +
          `quiet week. First reason: ${outcomes[0]?.reason ?? "none given"}`,
      );
    }
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

    const list = listForCombo(category, subcategory);
    if (!list) {
      return {
        ...base,
        status: "no-document",
        reason: `${category}/${subcategory} has no equivalent list on the new platform`,
      };
    }

    const wid = isoDateToWid(asOnDate);
    const discovered = await this.source.resolveSnapshot(list, {
      wid,
      asOnDate,
      label: asOnDate,
    });

    // There is no cheap "did it move?" probe any more. The old flow could HEAD a
    // static PDF and compare ETag / Last-Modified; these pages are generated per
    // request, so their validators change every time and mean nothing. Identity
    // is therefore the hash of the *parsed content*, computed after the fetch —
    // which costs one request more per already-published week and is the honest
    // price of the source no longer serving files.
    const fetched = await this.source.fetchList(list, wid);
    const contentHash = createHash("sha256").update(fetched.html).digest("hex");

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
          // `pdfUrl` keeps its name so archived snapshots stay uniform, but it
          // now points at the human-readable list page — which is also the right
          // provenance link for the public "source" attribution.
          pdfUrl: discovered.sourceUrl,
          sourceUrl: discovered.sourceUrl,
          byteSize: fetched.byteSize,
          status: "archived",
          fetchedAt: new Date(),
        },
        $setOnInsert: { version: existing ? existing.version : priorVersions + 1 },
      },
      { new: true, upsert: true, setDefaultsOnInsert: true },
    );

    // Archive before parsing, so a parser bug never costs us the source bytes.
    // Best-effort on purpose: local dev has no AWS credentials and should still
    // be able to run an ingest end to end.
    //
    // The archived artefact is now the source HTML, gzipped — roughly 4 MB of
    // markup compressing to a few hundred KB. Deliberately not the platform's
    // own PDF export: that is regenerated per request and carries *fewer* fields
    // than the page (truncated names, country instead of state, no breakdown),
    // so archiving it would preserve less than we parsed.
    const s3Key = buildS3Key(category, subcategory, asOnDate, contentHash);
    try {
      await s3Service.putDocumentBuffer(
        s3Key,
        gzipSync(Buffer.from(fetched.html, "utf8")),
        "application/gzip",
      );
      await applyToSnapshot(snapshot, { s3Key });
    } catch (error) {
      log.warn(
        `[aita-rankings] archive failed for ${s3Key} — continuing without it:`,
        error instanceof Error ? error.message : error,
      );
    }

    let parsed: ParseResult;
    try {
      parsed = parseRankingList(fetched.html, {
        requestedPageSize: this.source.listPageSize,
      });
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      await this.markFailed(snapshot, reason);
      return { ...base, status: "failed", reason, snapshotId: String(snapshot._id) };
    }

    await applyToSnapshot(snapshot, {
      rowCount: parsed.rows.length,
      columns: parsed.columns,
      diagnostics: parsed.diagnostics,
      parsedAt: new Date(),
      status: "parsed",
    });

    const objection = await this.validate(parsed, list, wid, asOnDate);
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

    // ── Points composition, after the list is already live ────────────────────
    // The source prints only a total per row and puts the component breakdown
    // behind one request per player, so a bounded sample of each band is fetched
    // and the insights are recomputed on top of it. That is minutes of requests
    // against tens of seconds for the list itself, which is exactly why it runs
    // here rather than before the publish: the ranking is served the moment it is
    // correct, and the chart fills in behind it.
    //
    // Best-effort on purpose. A failed sample means the composition panel stays
    // hidden — the rows, ranks, movement, benchmarks and state analytics are all
    // already published and none of them depend on it.
    if (!this.skipComposition) {
      try {
        await sampleBandComposition(snapshot._id, list, wid, { source: this.source });
        await recomputeSnapshotInsights(snapshot._id);
      } catch (error) {
        log.warn(
          `[aita-rankings] composition sampling failed for ${list.code} ${asOnDate} — ` +
            `list is published without it:`,
          error instanceof Error ? error.message : error,
        );
      }
    }

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
    // Weeks are global on the new platform rather than per combination, so the
    // year range is what has to be walked. The filter offers 2024 onward; asking
    // for a year AITA has nothing for is a cheap empty list, not an error.
    const sinceYear = options.since
      ? Number.parseInt(options.since.slice(0, 4), 10)
      : EARLIEST_BACKFILL_YEAR;
    const thisYear = new Date().getUTCFullYear();
    const dates: string[] = [];
    for (let year = sinceYear; year <= thisYear; year++) {
      const weeks = await this.source.listWeeks(year);
      dates.push(...weeks.map((w) => w.asOnDate));
    }

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
   * Whether the mirror is behind, and why.
   *
   * ── What this measured before, and why it was the wrong thing ─────────────────
   * The original version compared the newest as-on date we hold against today and
   * called it stale past three weeks. That conflates two unrelated facts, because
   * **AITA's own upload lag is routinely 12 to 19 days** and its publication
   * intervals are often 14 days rather than 7. On 2026-08-29 the pipeline was
   * completely current — all twelve lists at the newest week AITA offers — and
   * reported `daysSincePublish: 19` against a threshold of 21. It would have
   * raised a stale alert two days later while nothing at all was wrong.
   *
   * An alarm that fires when the pipeline is healthy is worse than no alarm: it
   * trains everyone to ignore it, which is exactly how the August 2026 cutover
   * went unnoticed for three weeks.
   *
   * ── What it measures now ──────────────────────────────────────────────────────
   * The honest question is not "how old is the newest list?" but **"is there a
   * week AITA has published that we do not hold?"** — the one thing that is our
   * fault. `pollSentinel` already answers it, so `checkSource` reuses the same
   * single cheap call.
   *
   * `checkSource` is opt-in because `GET /api/rankings/health` is public. Making
   * the default reach out to AITA would let anyone drive our scraper, so the
   * public endpoint answers from the database alone and the daily scheduler job
   * is what pays for the comparison.
   *
   * With no source information the date ceiling is all that is left, so it stays
   * as a fallback — raised to a figure that clears two missed fortnightly cycles
   * rather than tripping on one slow upload.
   */
  async getHealth(options: { checkSource?: boolean } = {}): Promise<{
    latestAsOnDate: string | null;
    /**
     * Days since the newest list we hold was *dated*. Reported because it is a
     * fair thing for a reader to know, but it is AITA's lag as much as ours —
     * deliberately not the alarm.
     */
    daysSincePublish: number | null;
    /** The newest week AITA offers. Null unless `checkSource` was asked for. */
    sourceLatestAsOnDate: string | null;
    /** True when AITA has a week we do not hold. Null when unknown. */
    behindSource: boolean | null;
    stale: boolean;
    /** Why `stale` is set, for the log line and the admin view. */
    staleReason: string | null;
    quarantinedCount: number;
  }> {
    const latest = await RankingSnapshot.findOne({ status: "published" })
      .sort({ asOnDate: -1 })
      .select("asOnDate")
      .lean();
    const quarantinedCount = await RankingSnapshot.countDocuments({
      status: "quarantined",
    });

    let sourceLatestAsOnDate: string | null = null;
    if (options.checkSource) {
      try {
        sourceLatestAsOnDate = (await this.source.latestWeek())?.asOnDate ?? null;
      } catch {
        // Unreachable is its own alarm, raised by the scheduler's failure streak
        // within about three hours. Not this function's job to duplicate it, and
        // not a reason to withhold the rest of the answer.
        sourceLatestAsOnDate = null;
      }
    }

    const latestAsOnDate = latest?.asOnDate ? toIsoDate(latest.asOnDate) : null;

    if (!latestAsOnDate) {
      return {
        latestAsOnDate: null,
        daysSincePublish: null,
        sourceLatestAsOnDate,
        behindSource: sourceLatestAsOnDate === null ? null : true,
        stale: true,
        staleReason: "No published snapshot at all",
        quarantinedCount,
      };
    }

    return {
      latestAsOnDate,
      sourceLatestAsOnDate,
      ...assessStaleness(latestAsOnDate, sourceLatestAsOnDate),
      quarantinedCount,
    };
  }

  /**
   * Fills in the points composition for lists that are already published.
   *
   * ── Why this exists separately from the ingest ────────────────────────────────
   * `ingestOne` returns `unchanged` for a week it already holds, and returns it
   * *before* the sampling stage — correctly, since re-fetching an unchanged list
   * should be a no-op. But that leaves one gap with no way through it: a snapshot
   * published before sampling existed, or one whose sampling stage failed, can
   * never acquire a composition, because every later sweep short-circuits on the
   * content hash.
   *
   * That is not hypothetical. The twelve lists live on 2026-08-29 were published
   * by an ingest that ran minutes before the sampling stage was written, so all
   * twelve had an empty composition and no sweep would ever have fixed them.
   *
   * Skips lists that already have sampled rows unless `force` is set, so it is
   * safe to run repeatedly and cheap when there is nothing to do.
   */
  async sampleLatestComposition(
    options: { force?: boolean; perBand?: number } = {},
  ): Promise<
    Array<{
      category: string;
      subcategory: string;
      asOnDate: string;
      status: "sampled" | "already-sampled" | "no-snapshot" | "failed";
      fetched?: number;
      unreconciled?: number;
      reason?: string;
    }>
  > {
    const results: Awaited<ReturnType<typeof this.sampleLatestComposition>> = [];

    for (const list of AITA_LISTS) {
      const snapshot = await RankingSnapshot.findOne({
        category: list.category,
        subcategory: list.subcategory,
        status: "published",
      })
        .sort({ asOnDate: -1 })
        .select("_id asOnDate")
        .lean();

      const base = { category: list.category, subcategory: list.subcategory };
      if (!snapshot) {
        results.push({ ...base, asOnDate: "", status: "no-snapshot" });
        continue;
      }
      const asOnDate = toIsoDate(snapshot.asOnDate);

      if (!options.force) {
        const already = await RankingEntry.countDocuments({
          snapshot: snapshot._id,
          pointsSampled: true,
        });
        if (already > 0) {
          results.push({ ...base, asOnDate, status: "already-sampled", fetched: already });
          continue;
        }
      }

      try {
        const report = await sampleBandComposition(
          snapshot._id,
          list,
          isoDateToWid(asOnDate),
          options.perBand === undefined
            ? { source: this.source }
            : { source: this.source, perBand: options.perBand },
        );
        await recomputeSnapshotInsights(snapshot._id);
        results.push({
          ...base,
          asOnDate,
          status: "sampled",
          fetched: report.fetched,
          unreconciled: report.unreconciled,
        });
      } catch (error) {
        results.push({
          ...base,
          asOnDate,
          status: "failed",
          reason: error instanceof Error ? error.message : String(error),
        });
      }
    }

    return results;
  }

  /** Returns a reason to quarantine, or null to publish. */
  private async validate(
    parsed: ParseResult,
    list: AitaList,
    wid: number,
    asOnDate: string,
  ): Promise<string | null> {
    const { category, subcategory } = list;
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
    // The page echoes back which week and which list the server actually served.
    // This replaces the old printed-"As on"-line cross-check and is strictly
    // stronger: it reads the server's own idea of what it returned rather than a
    // label a human typed, so a request that silently fell back to a default
    // list — the one way a whole week could be filed under the wrong date — is
    // caught. It also cannot reproduce the zero-padded-day false positives that
    // quarantined nine good lists in the first backfill, because it compares
    // integers.
    //
    // Absent echoes pass: this is corroboration, not the source of truth, and an
    // inline-script rename should not stop an otherwise good ingest.
    if (parsed.sourceWeekof !== null && parsed.sourceWeekof !== wid) {
      return (
        `Page served week ${parsed.sourceWeekof} but ${wid} (${asOnDate}) was ` +
        `requested — the source substituted a different week`
      );
    }
    if (
      parsed.sourceCategory !== null &&
      parsed.sourceCategory.toUpperCase() !== list.code
    ) {
      return (
        `Page served list "${parsed.sourceCategory}" but "${list.code}" was ` +
        `requested — the source substituted a different list`
      );
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
      // `fullName` comes from the parser because the source prints one name
      // field and gives no reliable way to split it.
      const fullName = row.fullName;
      const state = row.stateCode ? resolveStateCode(row.stateCode) : null;
      const zoneId = row.stateCode ? resolveZoneId(row.stateCode) : null;
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
              // The source publishes year of birth only now, which closed our
              // DPDP exposure upstream: there is no exact date of birth of a
              // minor to hold in the first place. `dob` stays `select: false` on
              // the model for the rows we already archived.
              ...(row.birthYear ? { birthYear: row.birthYear } : {}),
              ...(row.stateCode ? { stateCode: row.stateCode } : {}),
              ...(state ? { state } : {}),
              ...(zoneId ? { zoneId } : {}),
              // The join key for AITA's own profile and breakdown endpoints.
              ...(row.playerKey ? { playerKey: row.playerKey } : {}),
              ...(row.tournamentsPlayed !== null
                ? { tournamentsPlayed: row.tournamentsPlayed }
                : {}),
              ...(row.wtnSingles !== null ? { wtnSingles: row.wtnSingles } : {}),
              ...(row.wtnDoubles !== null ? { wtnDoubles: row.wtnDoubles } : {}),
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

/** `rankings/aita/boys/u-14/2026-07-27_a1b2c3d4.html.gz` */
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
  return `rankings/aita/${safe(category)}/${safe(subcategory)}/${asOnDate}_${contentHash.slice(0, 8)}.html.gz`;
}

function toIsoDate(value: Date | string): string {
  return new Date(value).toISOString().slice(0, 10);
}

/**
 * Decides whether the mirror is behind, from dates alone.
 *
 * Pure and exported so the arithmetic can be pinned without a database — the
 * whole point of this rework is that the *decision* was wrong, not the plumbing,
 * and a wrong decision here either cries wolf or stays silent for three weeks.
 */
export function assessStaleness(
  latestAsOnDate: string,
  sourceLatestAsOnDate: string | null,
  today: Date = new Date(),
): {
  daysSincePublish: number;
  behindSource: boolean | null;
  stale: boolean;
  staleReason: string | null;
} {
  const daysSincePublish = daysBetween(latestAsOnDate, today);
  const behindSource =
    sourceLatestAsOnDate === null ? null : sourceLatestAsOnDate > latestAsOnDate;

  // Behind the source is the fault worth naming: it is the one state that is
  // ours rather than AITA's. How loudly to say so is the scheduler's call, since
  // only it can tell a week that appeared an hour ago from one missed for days.
  if (behindSource === true) {
    return {
      daysSincePublish,
      behindSource,
      stale: true,
      staleReason:
        `AITA has published ${sourceLatestAsOnDate} but the newest list held is ` +
        `${latestAsOnDate} — ${daysBetween(latestAsOnDate, sourceLatestAsOnDate!)} ` +
        `days of listings behind the source`,
    };
  }

  // Level with the source, or no comparison available. Only in the second case
  // does the age of our newest list mean anything on its own — when we *know* we
  // match the source, its age is AITA's lag and not a fault at all.
  if (behindSource === null && daysSincePublish > STALENESS_ALERT_DAYS) {
    return {
      daysSincePublish,
      behindSource,
      stale: true,
      staleReason:
        `Newest list held is ${latestAsOnDate}, ${daysSincePublish} days old, and ` +
        `the source's own latest week could not be read`,
    };
  }

  return { daysSincePublish, behindSource, stale: false, staleReason: null };
}

/**
 * Whole days from `from` to `to`, both read as calendar dates at UTC midnight.
 *
 * Anchoring to midnight rather than subtracting timestamps matters here: an
 * as-on date is a date, not an instant, and comparing it against `Date.now()`
 * makes the answer drift by one depending on the time of day the check runs.
 */
function daysBetween(from: Date | string, to: Date | string): number {
  const day = (v: Date | string) => Date.parse(`${toIsoDate(v)}T00:00:00Z`);
  return Math.round((day(to) - day(from)) / 86_400_000);
}
