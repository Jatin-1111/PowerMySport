import "dotenv/config";
import mongoose from "mongoose";
import { TournamentEdition } from "../shared/models/TournamentEdition";

/**
 * Migration 47: record which federation's calendar each existing edition came
 * from.
 *
 * ── Why ────────────────────────────────────────────────────────────────────
 * TournamentEdition was keyed by sport alone, so every federation page in a
 * sport served the same list. Tennis has four federation pages (AITA, ITF, ATP,
 * UTR) and only AITA's calendar has ever been sourced — so UTR's page listed
 * AITA ranking events directly beneath its own key fact that UTR results earn
 * no AITA ranking. The approval path now stamps `federationSlug` on every
 * edition it writes; this is the same attribution applied to the rows already
 * on the calendar.
 *
 * ── How the owner is decided ───────────────────────────────────────────────
 * By sport, because exactly one calendar has been sourced per sport: AITA for
 * tennis, AICF for chess, BAI for badminton. That is a claim about where we
 * read the data, which is checkable — the dry run prints the distinct source
 * hosts per sport, and if a sport shows a host that is not its federation's,
 * this map is wrong and must be corrected before applying.
 *
 * An ITF- or ATF-sanctioned event printed on AITA's calendar is attributed to
 * AITA here, and deliberately so: AITA's calendar is the source we actually
 * read. Attributing it to ITF would put it on a page whose calendar nobody has
 * sourced, which is the exact fiction this migration exists to end.
 *
 * ── Safety ─────────────────────────────────────────────────────────────────
 * Writes one short string to rows that lack it and creates no index. Rows that
 * already carry the right owner are skipped, so a re-run is a no-op.
 *
 * USAGE
 *   npx ts-node src/migrations/47_attribute_editions_to_federation.ts
 *   npx ts-node src/migrations/47_attribute_editions_to_federation.ts --apply
 *   npx ts-node src/migrations/47_attribute_editions_to_federation.ts --down --apply
 *
 * Not `npm run migrate:... -- --apply`: PowerShell eats the first bare `--`,
 * npm takes the flag for itself, and this reports a dry run having changed
 * nothing.
 */

interface Options {
  apply?: boolean;
}

/** The federation whose calendar each sport's editions were read from. */
const SOURCE_FEDERATION: Record<string, string> = {
  tennis: "aita",
  chess: "aicf",
  badminton: "bai",
};

const hostOf = (url: string): string => {
  try {
    return new URL(url).host;
  } catch {
    return url || "(none)";
  }
};

export const up = async (options: Options = {}) => {
  const apply = Boolean(options.apply);
  console.log(
    `Migration 47: attribute editions to their federation (${apply ? "APPLY" : "DRY RUN"})`
  );

  const rows = await TournamentEdition.find({}).select("sportSlug federationSlug sourceUrl").lean();
  console.log(`  ${rows.length} edition(s) total\n`);

  const bySport = new Map<string, { rows: number; hosts: Map<string, number> }>();
  for (const row of rows) {
    let entry = bySport.get(row.sportSlug);
    if (!entry) {
      entry = { rows: 0, hosts: new Map() };
      bySport.set(row.sportSlug, entry);
    }
    entry.rows += 1;
    const host = hostOf(row.sourceUrl);
    entry.hosts.set(host, (entry.hosts.get(host) ?? 0) + 1);
  }

  // Printed so the mapping above can be checked rather than trusted: a host
  // that does not belong to the named federation means this map is wrong.
  const unmapped: string[] = [];
  for (const [sport, entry] of [...bySport.entries()].sort()) {
    const owner = SOURCE_FEDERATION[sport];
    console.log(
      `  ${sport} — ${entry.rows} edition(s) -> ${owner ?? "NO MAPPING, will be skipped"}`
    );
    for (const [host, count] of [...entry.hosts.entries()].sort((a, b) => b[1] - a[1])) {
      console.log(`      ${String(count).padStart(4)}  ${host}`);
    }
    if (!owner) unmapped.push(sport);
  }
  if (unmapped.length > 0) {
    console.log(
      `\n  No federation mapped for: ${unmapped.join(", ")}. Those rows keep no owner, which ` +
        `means their federation pages show nothing — add them above if that is wrong.`
    );
  }

  const operations = rows
    .filter((row) => {
      const owner = SOURCE_FEDERATION[row.sportSlug];
      return !!owner && row.federationSlug !== owner;
    })
    .map((row) => ({
      updateOne: {
        filter: { _id: row._id },
        update: { $set: { federationSlug: SOURCE_FEDERATION[row.sportSlug] } },
      },
    }));

  console.log(`\n  ${operations.length} row(s) need updating`);
  if (!apply) {
    console.log("Dry run complete — re-run with --apply.");
    return;
  }
  if (operations.length > 0) {
    const result = await TournamentEdition.bulkWrite(operations, { ordered: false });
    console.log(`  modified ${result.modifiedCount}`);
  }
  console.log("Migration 47 complete.");
};

export const down = async (options: Options = {}) => {
  const apply = Boolean(options.apply);
  console.log(`Reverting migration 47 (${apply ? "APPLY" : "DRY RUN"})`);

  const filter = { federationSlug: { $exists: true } };
  const count = await TournamentEdition.countDocuments(filter);
  console.log(`  ${count} attributed edition(s) would be cleared`);
  console.log("  Note: every federation calendar page goes empty until this is re-applied.");
  if (!apply) {
    console.log("Dry run complete — re-run with --down --apply.");
    return;
  }
  const result = await TournamentEdition.updateMany(filter, { $unset: { federationSlug: "" } });
  console.log(`  cleared ${result.modifiedCount}`);
};

const isDirectRun = require.main === module;

if (isDirectRun) {
  const argv = process.argv.slice(2);
  const options: Options = { apply: argv.includes("--apply") };
  const isDown = argv.includes("--down");

  const uri = process.env.MONGO_URI || process.env.MONGODB_URI;
  if (!uri) {
    console.error("MONGO_URI is not set");
    process.exit(1);
  }

  void mongoose
    .connect(uri)
    .then(() => (isDown ? down(options) : up(options)))
    .then(() => mongoose.disconnect())
    .then(() => process.exit(0))
    .catch(async (error: unknown) => {
      console.error("Migration 47 failed:", error);
      await mongoose.disconnect().catch(() => undefined);
      process.exit(1);
    });
}
