import "dotenv/config";
import mongoose from "mongoose";

/**
 * Migration 60: drop `userpathwayprofiles`.
 *
 * The roadmap profile feature is gone: its route, controller, model and client
 * service are deleted, and nothing in the client, admin, community or mobile apps
 * ever called it. Its GET created a row on a miss, which is how the rows exist at
 * all. On 2026-10-21 every one of the 19 rows in production held nothing but the
 * schema defaults (`currentLevel` 0, no completed steps, empty saved items,
 * applications and reminders), so no parent's work is in here.
 *
 * The dry run prints the row count and how many of those rows hold anything
 * beyond the defaults. If that second number is not zero, STOP and look before
 * applying: it would mean the feature was used after all.
 *
 * Like migrations 50, 51, 55, 57, 58 and 59 this does not import a model, so
 * running it on a laptop creates no collection or index in production.
 *
 * USAGE: invoke ts-node directly (PowerShell strips `--` from `npm run`).
 *
 *   npx ts-node src/migrations/60_drop_user_pathway_profiles.ts
 *   npx ts-node src/migrations/60_drop_user_pathway_profiles.ts --apply
 *
 * Dropping a collection cannot be undone. Re-running is idempotent.
 */

type Db = mongoose.mongo.Db;

interface Options {
  apply?: boolean;
}

const COLLECTION = "userpathwayprofiles";

/** True when a row holds nothing the schema did not put there itself. */
export const isUntouchedDefault = (row: Record<string, any>): boolean => {
  const progress = row.progress ?? {};
  const atStart = (progress.currentLevel ?? 0) === 0;
  const noSteps = Object.keys(progress.completedSteps ?? {}).length === 0;
  const empty = (key: string) => !Array.isArray(row[key]) || row[key].length === 0;
  return atStart && noSteps && empty("savedItems") && empty("applications") && empty("reminders");
};

export const up = async (
  options: Options = {},
  db: Db = mongoose.connection.db as unknown as Db
): Promise<void> => {
  const { apply = false } = options;

  const exists =
    (await db.listCollections({ name: COLLECTION }, { nameOnly: true }).toArray()).length > 0;
  if (!exists) {
    console.log(`[skip]   ${COLLECTION} is already gone`);
    return;
  }

  const rows = await db.collection(COLLECTION).find({}).toArray();
  const used = rows.filter((row) => !isUntouchedDefault(row)).length;
  console.log(`[drop]   ${COLLECTION}: ${rows.length} row(s)`);
  console.log(`[check]  ${used} row(s) hold anything beyond the schema defaults`);

  if (used > 0 && !apply) {
    console.log("Stop: some rows were actually used. Look at them before applying.");
  }

  if (apply) {
    await db.collection(COLLECTION).drop();
    console.log("Done.");
    return;
  }
  console.log("Dry run complete. Re-run with --apply.");
};

if (require.main === module) {
  const argv = process.argv.slice(2);
  const options: Options = { apply: argv.includes("--apply") };

  const uri = process.env.MONGO_URI || process.env.MONGODB_URI;
  if (!uri) {
    console.error("MONGO_URI is not set");
    process.exit(1);
  }

  void mongoose
    .connect(uri, { autoIndex: false, autoCreate: false })
    .then(async () => {
      console.log(`Target database: ${mongoose.connection.name} on ${mongoose.connection.host}`);
      await up(options);
    })
    .then(() => mongoose.disconnect())
    .then(() => process.exit(0))
    .catch((error: unknown) => {
      console.error("Migration 60 failed:", error);
      process.exit(1);
    });
}
