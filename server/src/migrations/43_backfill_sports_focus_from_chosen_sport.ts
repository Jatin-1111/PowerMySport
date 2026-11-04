import "dotenv/config";
import mongoose from "mongoose";
import { Player } from "../client/models/Player";

/**
 * Migration 43: put every dependent's `chosenSport` into their `sportsFocus`.
 *
 * ── The drift ──
 *
 * Two fields record what a child plays. `chosenSport` is the sport the parent
 * committed to on the assessment results page; `sportsFocus` is the list the
 * rest of the product actually reads — the profile modal's Sports selector
 * binds to it, and the profile-completion scorer counts it.
 *
 * The wizard only ever filled `sportsFocus` from `answers.priorSports`, the
 * sports a child ALREADY played. That is empty for exactly the beginners the
 * assessment exists to serve, so a parent who finished it and picked badminton
 * ended up with `chosenSport: "Badminton"` and `sportsFocus: []`.
 *
 * What that looked like: a dashboard card reading "10 yrs · Badminton" with a
 * green "Sport chosen" tick and a "Badminton roadmap" button, sitting above a
 * 90% completion ring and a button asking them to "Add their sport" — and a
 * profile modal whose Sports field was blank.
 *
 * `recordFindSportChoice` now writes both fields, so no NEW row can drift. This
 * closes the ones already written.
 *
 * ── What it does not touch ──
 *
 * Rows where `chosenSport` is unset, and rows where the sport is already in
 * `sportsFocus`. `$addToSet` means a child who listed other sports keeps them —
 * the chosen sport joins the list rather than replacing it.
 *
 * Idempotent: a second run matches nothing.
 *
 * USAGE
 *   npm run migrate:sports-focus                 # dry run (default)
 *   npm run migrate:sports-focus -- --apply      # write
 *   npm run migrate:sports-focus -- --down       # reports; see `down`
 */

interface Options {
  apply?: boolean;
}

export const up = async (options: Options = {}) => {
  const apply = Boolean(options.apply);
  console.log(
    `Starting migration 43: backfill sportsFocus from chosenSport (${apply ? "APPLY" : "DRY RUN"})...`
  );

  const candidates = await Player.find({
    type: "DEPENDENT",
    chosenSport: { $exists: true, $nin: [null, ""] },
  })
    .select("_id name chosenSport sportsFocus")
    .lean<Array<{ _id: mongoose.Types.ObjectId; chosenSport?: string; sportsFocus?: string[] }>>();

  console.log(`  scanned ${candidates.length} dependent(s) with a chosen sport.`);

  const drifted = candidates.filter((row) => {
    const chosen = (row.chosenSport || "").trim();
    if (!chosen) return false;
    // Case-insensitive: "Badminton" already in the list must not be re-added as
    // "badminton", which would show a parent the same sport twice.
    return !(row.sportsFocus || []).some(
      (sport) => sport.trim().toLowerCase() === chosen.toLowerCase()
    );
  });

  if (drifted.length === 0) {
    console.log("  every chosen sport is already in sportsFocus — nothing to do.");
    return;
  }

  const emptyBefore = drifted.filter((row) => !(row.sportsFocus || []).length).length;
  console.log(`  found ${drifted.length} dependent(s) to update:`);
  console.log(`    ${emptyBefore} with no sportsFocus at all (the 90%-and-stuck case)`);
  console.log(`    ${drifted.length - emptyBefore} with other sports listed but not this one`);

  if (!apply) {
    console.log("Dry run complete — re-run with --apply.");
    return;
  }

  let updated = 0;
  for (const row of drifted) {
    const chosen = (row.chosenSport || "").trim();
    const result = await Player.updateOne({ _id: row._id }, { $addToSet: { sportsFocus: chosen } });
    updated += result.modifiedCount;
  }

  console.log(`  updated ${updated} dependent(s).`);
  console.log("Migration 43 complete.");
};

export const down = async () => {
  console.log("Migration 43 is not reversible.");
  console.log(
    "  `sportsFocus` is a list several flows write to, and nothing records which\n" +
      "  entry this migration added. Removing every sport that equals `chosenSport`\n" +
      "  would also delete entries a parent chose by hand, so `down` does nothing."
  );
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
    .then(() => (isDown ? down() : up(options)))
    .then(() => mongoose.disconnect())
    .then(() => process.exit(0))
    .catch((error: unknown) => {
      console.error("Migration 43 failed:", error);
      process.exit(1);
    });
}
