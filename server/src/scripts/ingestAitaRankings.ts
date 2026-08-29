/**
 * Manual driver for the AITA ranking mirror. The scheduler runs the same
 * service on its own (see utils/aitaRankingScheduler.ts); this is for backfills
 * and for working out why a snapshot was quarantined.
 *
 *   Check the tripwire, change nothing:
 *     npx ts-node src/scripts/ingestAitaRankings.ts --poll
 *
 *   Ingest the current list for all twelve live combos:
 *     npx ts-node src/scripts/ingestAitaRankings.ts --sweep
 *
 *   One list:
 *     npx ts-node src/scripts/ingestAitaRankings.ts --one --category=Boys --subcategory=U-14 --date=2026-07-27
 *
 *   Historical backfill, all twelve live combos. Resumable — already-published
 *   dates are skipped with no request, so an interrupted run costs nothing to
 *   restart. Budget ~8 minutes per combo per 12 months of history:
 *     npx ts-node src/scripts/ingestAitaRankings.ts --backfill --all --since=2025-08-01
 *
 *   Historical backfill for one combo:
 *     npx ts-node src/scripts/ingestAitaRankings.ts --backfill --category=Boys --subcategory=U-14 --limit=20
 *
 *   Parse a saved ranking page off disk, no network or database — the fastest
 *   way to see what a quarantined list actually contains. Feed it either a
 *   `ranking-view` page saved from a browser or an archived `.html` from S3:
 *     npx ts-node src/scripts/ingestAitaRankings.ts --file=./some-ranking.html
 *
 *   Fill in the points composition for the newest published list of each combo.
 *   Needed after a deploy, and the repair for a snapshot published before the
 *   sampling stage existed — an ordinary sweep short-circuits on the content hash
 *   and never reaches it. Skips lists already sampled unless --force.
 *   Budget ~13 minutes for all twelve:
 *     npx ts-node src/scripts/ingestAitaRankings.ts --sample-composition
 *
 *   Freshness, from the database alone (what the public endpoint answers):
 *     npx ts-node src/scripts/ingestAitaRankings.ts --health
 *
 *   Freshness, compared against what AITA currently offers — the honest check,
 *   and the one the daily scheduler job runs:
 *     npx ts-node src/scripts/ingestAitaRankings.ts --health --check-source
 */

import "dotenv/config";
import { readFileSync } from "node:fs";
import mongoose from "mongoose";
import { AitaRankingIngestService } from "../shared/services/aita/AitaRankingIngestService";
import { parseRankingList } from "../shared/services/aita/rankingListParser";
import { AITA_CATEGORIES, AitaCategory, LIVE_COMBOS } from "../shared/services/aita/types";

const args = new Map<string, string>();
const flags = new Set<string>();
for (const raw of process.argv.slice(2)) {
  const match = raw.match(/^--([^=]+)(?:=(.*))?$/);
  if (!match?.[1]) continue;
  if (match[2] === undefined) flags.add(match[1]);
  else args.set(match[1], match[2]);
}

const MONGO_URI = process.env.MONGO_URI || process.env.DATABASE_URL || "";

async function withDatabase<T>(fn: () => Promise<T>): Promise<T> {
  if (!MONGO_URI) {
    console.error("MONGO_URI not set in .env");
    process.exit(1);
  }
  await mongoose.connect(MONGO_URI);
  try {
    return await fn();
  } finally {
    await mongoose.disconnect();
  }
}

function requireCombo(): { category: AitaCategory; subcategory: string } {
  const category = args.get("category") ?? "";
  const subcategory = args.get("subcategory") ?? "";
  if (!AITA_CATEGORIES.includes(category as AitaCategory) || !subcategory) {
    console.error(
      `--category must be one of ${AITA_CATEGORIES.join(", ")} and --subcategory is required`,
    );
    process.exit(1);
  }
  return { category: category as AitaCategory, subcategory };
}

/** Prints one outcome per line so a long backfill stays readable. */
function report(
  outcome: {
    category: string;
    subcategory: string;
    asOnDate: string;
    status: string;
    rowCount?: number;
    reason?: string;
  },
  prefix = "",
): void {
  const icon =
    outcome.status === "published"
      ? "✅"
      : outcome.status === "unchanged"
        ? "➖"
        : outcome.status === "quarantined"
          ? "🟡"
          : outcome.status === "no-document"
            ? "⚪"
            : "❌";
  const rows = outcome.rowCount === undefined ? "" : ` ${outcome.rowCount} rows`;
  const why = outcome.reason ? ` — ${outcome.reason}` : "";
  console.log(
    `${prefix}${icon} ${outcome.category}/${outcome.subcategory} ${outcome.asOnDate} ` +
      `${outcome.status}${rows}${why}`,
  );
}

async function main(): Promise<void> {
  // Local-file parse needs neither network nor database.
  const file = args.get("file");
  if (file) {
    const parsed = parseRankingList(readFileSync(file, "utf8"));
    console.log(`rows        ${parsed.rows.length}`);
    console.log(`served week ${parsed.sourceWeekof ?? "(not echoed)"}`);
    console.log(`served list ${parsed.sourceCategory ?? "(not echoed)"}`);
    console.log(`columns     ${parsed.columns.join(" | ")}`);
    console.log(`diagnostics ${JSON.stringify(parsed.diagnostics, null, 2)}`);
    console.log(`first row   ${JSON.stringify(parsed.rows[0])}`);
    console.log(`last row    ${JSON.stringify(parsed.rows[parsed.rows.length - 1])}`);
    return;
  }

  const service = new AitaRankingIngestService();

  if (flags.has("sample-composition")) {
    await withDatabase(async () => {
      const results = await service.sampleLatestComposition({
        force: flags.has("force"),
        ...(args.has("per-band")
          ? { perBand: Number.parseInt(args.get("per-band")!, 10) }
          : {}),
      });
      for (const r of results) {
        const icon =
          r.status === "sampled" ? "✅" : r.status === "already-sampled" ? "➖" : "❌";
        const extra =
          r.status === "sampled"
            ? ` ${r.fetched} players` +
              (r.unreconciled ? `, ${r.unreconciled} excluded as unreconciled` : "")
            : r.status === "already-sampled"
              ? ` ${r.fetched} already sampled`
              : r.reason
                ? ` — ${r.reason}`
                : "";
        console.log(
          `${icon} ${r.category}/${r.subcategory} ${r.asOnDate} ${r.status}${extra}`,
        );
      }
      const sampled = results.filter((r) => r.status === "sampled").length;
      console.log(`
${sampled} of ${results.length} lists sampled`);
    });
    return;
  }

  if (flags.has("poll")) {
    await withDatabase(async () => {
      const result = await service.pollSentinel();
      console.log(
        `source latest ${result.sourceLatest ?? "none"}, ` +
          `stored latest ${result.storedLatest ?? "none"} — ` +
          (result.hasNewWork ? "NEW WORK" : "up to date"),
      );
    });
    return;
  }

  if (flags.has("health")) {
    await withDatabase(async () => {
      // `--check-source` costs one small request and is what turns "our newest
      // list is 19 days old" into "we hold everything AITA offers". Off by
      // default so `--health` stays a pure database read, matching the public
      // endpoint.
      const checkSource = flags.has("check-source");
      console.log(JSON.stringify(await service.getHealth({ checkSource }), null, 2));
    });
    return;
  }

  if (flags.has("backfill") && flags.has("all")) {
    const since = args.get("since");
    await withDatabase(async () => {
      const startedAt = Date.now();
      const totals = { published: 0, unchanged: 0, quarantined: 0, failed: 0 };
      for (const [index, combo] of LIVE_COMBOS.entries()) {
        console.log(
          `\n── [${index + 1}/${LIVE_COMBOS.length}] ${combo.category}/${combo.subcategory} ` +
            `${since ? `since ${since}` : "(full history)"} ──`,
        );
        const options: Parameters<typeof service.backfillCombo>[2] = {
          // Resumable by default: an interrupted run costs nothing to restart,
          // which matters when the whole job is measured in hours.
          skipExisting: !flags.has("no-skip"),
          onProgress: (done, total, outcome) => report(outcome, `[${done}/${total}] `),
        };
        if (since) options.since = since;

        const outcomes = await service.backfillCombo(
          combo.category,
          combo.subcategory,
          options,
        );
        for (const outcome of outcomes) {
          if (outcome.status in totals) {
            totals[outcome.status as keyof typeof totals]++;
          }
        }
      }
      const minutes = Math.round((Date.now() - startedAt) / 60000);
      console.log(
        `\n══ Backfill complete in ${minutes} min: ${totals.published} published, ` +
          `${totals.unchanged} unchanged, ${totals.quarantined} quarantined, ` +
          `${totals.failed} failed ══`,
      );
    });
    return;
  }

  if (flags.has("backfill")) {
    const { category, subcategory } = requireCombo();
    await withDatabase(async () => {
      const options: Parameters<typeof service.backfillCombo>[2] = {
        skipExisting: !flags.has("no-skip"),
        onProgress: (done, total, outcome) => {
          report(outcome, `[${done}/${total}] `);
        },
      };
      const limit = args.get("limit");
      const since = args.get("since");
      if (limit) options.limit = Number.parseInt(limit, 10);
      if (since) options.since = since;

      console.log(`Backfilling ${category}/${subcategory}…`);
      const outcomes = await service.backfillCombo(category, subcategory, options);
      console.log(
        `\nDone: ${outcomes.filter((o) => o.status === "published").length} published, ` +
          `${outcomes.filter((o) => o.status === "unchanged").length} unchanged, ` +
          `${outcomes.filter((o) => o.status === "quarantined").length} quarantined, ` +
          `${outcomes.filter((o) => o.status === "failed").length} failed`,
      );
    });
    return;
  }

  if (flags.has("one")) {
    const { category, subcategory } = requireCombo();
    const date = args.get("date") ?? "";
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      console.error("--date=YYYY-MM-DD is required for --one");
      process.exit(1);
    }
    await withDatabase(async () => {
      report(await service.ingestOne(category, subcategory, date));
    });
    return;
  }

  // Default: sweep.
  await withDatabase(async () => {
    console.log("Sweeping the twelve live combos…");
    const sweep = await service.sweepLiveCombos();
    sweep.outcomes.forEach((outcome) => report(outcome));
    console.log(
      `\nDone in ${Math.round((sweep.finishedAt.getTime() - sweep.startedAt.getTime()) / 1000)}s: ` +
        `${sweep.published} published, ${sweep.quarantined} quarantined, ${sweep.failed} failed`,
    );
  });
}

main().catch((error) => {
  console.error("Ingest failed:", error);
  process.exit(1);
});
