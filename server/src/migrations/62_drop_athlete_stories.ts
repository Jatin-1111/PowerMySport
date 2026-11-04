import "dotenv/config";
import mongoose from "mongoose";

/**
 * Migration 62: drop `athletestories`.
 *
 * The athlete stories feature is gone: its route, the story generation in the
 * scraper, the model and every client type are deleted, and nothing displayed the
 * stories any more. The rows were all written by a grounded Gemini search that the
 * public `GET /api/pathways/stories` triggered whenever a sport had none. That search
 * was asked to write a first-person `quote` and a `parentNote` "from a parent's
 * perspective" for each real, named athlete: invented first-person text attributed to
 * real people, which this product does not publish.
 *
 * On 2026-10-21 production held 108 rows, every one marked `isAiGenerated`, 32 with no
 * source URL at all, and 3 filed under a sport slug that does not exist.
 *
 * GUARD: the migration refuses to drop the collection if any row is NOT marked
 * `isAiGenerated`. A row a person wrote or curated is real content and needs a look
 * before anything is removed. The dry run prints the same check.
 *
 * Like migrations 50, 51, 55, 57 to 61 this does not import a model, so running it on
 * a laptop creates no collection or index in production.
 *
 * USAGE: invoke ts-node directly (PowerShell strips `--` from `npm run`).
 *
 *   npx ts-node src/migrations/62_drop_athlete_stories.ts
 *   npx ts-node src/migrations/62_drop_athlete_stories.ts --apply
 *
 * Dropping a collection cannot be undone. Re-running is idempotent.
 */

type Db = mongoose.mongo.Db;

interface Options {
  apply?: boolean;
}

const COLLECTION = "athletestories";

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

  const stories = db.collection(COLLECTION);
  const total = await stories.countDocuments({});
  const notGenerated = await stories.countDocuments({ isAiGenerated: { $ne: true } });
  console.log(`[drop]   ${COLLECTION}: ${total} row(s)`);
  console.log(`[check]  ${notGenerated} row(s) are not marked AI-generated`);

  if (notGenerated > 0) {
    console.log("Stop: some rows were not generated. Look at them before dropping anything.");
    if (apply) throw new Error("Refusing to drop athletestories: it holds non-generated rows");
    return;
  }

  if (apply) {
    await stories.drop();
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
      console.error("Migration 62 failed:", error);
      process.exit(1);
    });
}
