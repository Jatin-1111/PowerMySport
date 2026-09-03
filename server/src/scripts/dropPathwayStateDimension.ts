/**
 * Clean up what's left of the pathway state dimension in Mongo.
 *
 *   npx tsx -r dotenv/config src/scripts/dropPathwayStateDimension.ts --dry
 *   npx tsx -r dotenv/config src/scripts/dropPathwayStateDimension.ts
 *
 * The code no longer reads or writes `stateSlug` — this only removes the residue
 * the application can't clear on its own:
 *
 *   1. the `stateSlug` field still stored on existing guide documents, and
 *   2. the old `{ sportSlug, stateSlug }` unique index. Mongoose creates the new
 *      `{ sportSlug }` unique index on boot but never drops a superseded one.
 *
 * Neither is harmful. With every `stateSlug` null or absent, the old compound
 * index enforces exactly what the new one does, so nothing breaks if this is
 * never run — it is tidying, not a fix.
 *
 * REFUSES TO RUN if any document has a non-null `stateSlug`: that would be a real
 * state-specific guide, and deleting its scope would silently turn it into the
 * national pathway for that sport. Dry run first — this database is the live one.
 */

import mongoose from "mongoose";

const OLD_INDEX = "sportSlug_1_stateSlug_1";

async function main(): Promise<void> {
  const dryRun = process.argv.includes("--dry");
  const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
  if (!uri) throw new Error("MONGODB_URI is not set.");

  await mongoose.connect(uri);
  try {
    const collection = mongoose.connection.collection("pathwayguides");

    const stateScoped = await collection
      .find({ stateSlug: { $nin: [null, undefined] } })
      .project({ sportSlug: 1, stateSlug: 1, status: 1 })
      .toArray();

    if (stateScoped.length > 0) {
      console.error(`Refusing to run: ${stateScoped.length} guide(s) still have a state.`);
      for (const doc of stateScoped) {
        console.error(`  ${doc.sportSlug} · ${doc.stateSlug} · ${doc.status}`);
      }
      console.error(
        "Decide what happens to each one first — deleting the field would " +
          "promote it to that sport's only pathway."
      );
      process.exitCode = 1;
      return;
    }

    const withField = await collection.countDocuments({
      stateSlug: { $exists: true },
    });
    const indexes = await collection.indexes();
    const hasOldIndex = indexes.some((index) => index.name === OLD_INDEX);

    console.log(`Documents carrying stateSlug: ${withField}`);
    console.log(`Old ${OLD_INDEX} index present: ${hasOldIndex}`);

    if (dryRun) {
      console.log("\n--dry: nothing written.");
      return;
    }

    // Index first. Unsetting the field while the compound unique index still
    // exists is safe (missing keys index as null, and they are all null), but
    // dropping the index first keeps the two steps independent if one fails.
    if (hasOldIndex) {
      await collection.dropIndex(OLD_INDEX);
      console.log(`Dropped ${OLD_INDEX}.`);
    }

    if (withField > 0) {
      const result = await collection.updateMany(
        { stateSlug: { $exists: true } },
        { $unset: { stateSlug: "" } }
      );
      console.log(`Cleared stateSlug from ${result.modifiedCount} document(s).`);
    }

    console.log("\nDone.");
  } finally {
    await mongoose.disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
