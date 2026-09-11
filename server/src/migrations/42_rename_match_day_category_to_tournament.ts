import "dotenv/config";
import mongoose from "mongoose";
import { Experience } from "../community/models/Experience";

/**
 * Migration 42: rename the experience category `match-day` to `tournament`.
 *
 * A copy change first renamed only the label, leaving the stored slug saying
 * `match-day` while the UI said "Tournament". This finishes the job so the
 * data, the server allowlist and the composer all use one word.
 *
 * Must run BEFORE the code that renames the allowlist is deployed. `category`
 * is a Mongoose `enum`, so a document still holding `match-day` once the enum
 * has moved on fails validation the next time anything calls `.save()` on it —
 * which is what editing a post does. Migrating first means the enum is only
 * ever tightened onto data that already complies.
 *
 * The reverse direction is handled in code rather than here: the server keeps a
 * `match-day` alias (see CATEGORY_ALIASES) so a browser on a cached copy of the
 * old composer still files posts correctly instead of silently landing them in
 * "general", which is where an unrecognised category goes.
 *
 * Idempotent: matches only documents that still carry the old slug.
 *
 * REVERSIBLE. `down` puts `match-day` back.
 *
 * USAGE
 *   npm run migrate:tournament-category              # dry run (default)
 *   npm run migrate:tournament-category -- --apply   # rename
 *   npm run migrate:tournament-category -- --down    # revert
 */

const OLD = "match-day";
const NEW = "tournament";

interface Options {
  apply?: boolean;
}

export const up = async (options: Options = {}) => {
  const apply = Boolean(options.apply);
  console.log(
    `Starting migration 42: ${OLD} -> ${NEW} experience category (${apply ? "APPLY" : "DRY RUN"})...`
  );

  // Bypasses the model so the read is not filtered by the enum the app layer
  // has already moved on from.
  const collection = Experience.collection;
  const count = await collection.countDocuments({ category: OLD });
  console.log(`  ${count} experience(s) still categorised "${OLD}".`);

  if (count === 0) {
    console.log("  nothing to do.");
    return;
  }

  const sample = await collection
    .find({ category: OLD }, { projection: { title: 1, status: 1 } })
    .limit(10)
    .toArray();
  for (const doc of sample) {
    console.log(`    ${doc._id}  ${doc.status}  ${String(doc.title || "(untitled)").slice(0, 40)}`);
  }

  if (!apply) {
    console.log(
      `Dry run complete — ${count} document(s) would become "${NEW}". Re-run with --apply.`
    );
    return;
  }

  const result = await collection.updateMany({ category: OLD }, { $set: { category: NEW } });
  console.log(`  updated ${result.modifiedCount} document(s).`);

  const left = await collection.countDocuments({ category: OLD });
  console.log(
    left === 0 ? "  none left on the old slug." : `  WARNING: ${left} still on "${OLD}".`
  );
  console.log("Migration 42 complete.");
};

export const down = async () => {
  console.log(`Reverting migration 42: ${NEW} -> ${OLD}...`);
  const result = await Experience.collection.updateMany(
    { category: NEW },
    { $set: { category: OLD } }
  );
  console.log(`  reverted ${result.modifiedCount} document(s).`);
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
      console.error("Migration 42 failed:", error);
      process.exit(1);
    });
}
