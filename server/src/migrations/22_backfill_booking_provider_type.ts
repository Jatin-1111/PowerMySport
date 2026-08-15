import "dotenv/config";
import mongoose from "mongoose";
import { Booking, deriveBookingProviderType } from "../client/models/Booking";

/**
 * Migration 22: Backfill `Booking.providerType` on existing documents.
 *
 * The field is derived by a pre-validate hook, so any booking that gets saved
 * heals itself. But most of these documents are in terminal states and will
 * never be saved again, and a query like `{ providerType: "ACADEMY" }` simply
 * misses them until the field exists. This fills it in.
 *
 * Unlike migrations 20 and 21 this one IS safely reversible — providerType is
 * purely derived from ids that are still present, so `down()` can unset it and
 * `up()` can recreate it exactly.
 *
 * USAGE
 *   npm run migrate:provider-type                # dry run (default)
 *   npm run migrate:provider-type -- --apply     # write
 *   npm run migrate:provider-type -- --down      # unset the field again
 */

export const up = async (options: { apply?: boolean } = {}) => {
  const apply = Boolean(options.apply);

  console.log(
    `Starting migration 22: backfill Booking.providerType (${apply ? "APPLY" : "DRY RUN"})...`,
  );

  const bookings = await Booking.find({ providerType: { $exists: false } })
    .select("_id venueId coachId academyId")
    .lean();

  console.log(`Found ${bookings.length} booking(s) without providerType.`);

  const counts: Record<string, number> = {};
  const operations: mongoose.AnyBulkWriteOperation[] = [];

  for (const booking of bookings) {
    const providerType = deriveBookingProviderType(booking);
    counts[providerType] = (counts[providerType] ?? 0) + 1;

    operations.push({
      updateOne: {
        filter: { _id: booking._id },
        update: { $set: { providerType } },
      },
    });
  }

  let modified = 0;
  if (apply && operations.length > 0) {
    // Written through the raw collection: going via the model would run the
    // full document validators against legacy rows that may predate other
    // required fields, and this migration has no business failing on those.
    const result = await Booking.collection.bulkWrite(operations as never[], {
      ordered: false,
    });
    modified = result.modifiedCount ?? 0;
  }

  console.log();
  console.log("-".repeat(60));
  console.log(`To backfill : ${operations.length}`);
  for (const [type, count] of Object.entries(counts).sort()) {
    console.log(`  ${type.padEnd(8)}: ${count}`);
  }
  if (apply) console.log(`Modified    : ${modified}`);
  console.log("-".repeat(60));

  if (!apply) {
    console.log();
    console.log("Dry run — nothing was written. Re-run with --apply to commit.");
  }

  console.log();
  console.log("Migration 22 completed.");

  return { planned: operations.length, counts, modified };
};

export const down = async (options: { apply?: boolean } = {}) => {
  const apply = Boolean(options.apply);

  console.log(
    `Rolling back migration 22 (${apply ? "APPLY" : "DRY RUN"})...`,
  );

  const affected = await Booking.countDocuments({
    providerType: { $exists: true },
  });
  console.log(`${affected} booking(s) currently carry providerType.`);

  if (apply) {
    const result = await Booking.collection.updateMany(
      { providerType: { $exists: true } },
      { $unset: { providerType: "" } },
    );
    console.log(`Unset providerType on ${result.modifiedCount} booking(s).`);
    console.log(
      "Note: the model still declares providerType required and derives it on " +
        "save, so new and re-saved bookings will get it back. A full rollback " +
        "also requires reverting the model change.",
    );
  } else {
    console.log("Dry run — nothing was written.");
  }

  console.log("Rollback completed.");
};

// Run if executed directly
if (require.main === module) {
  const MONGODB_URI =
    process.env.MONGO_URI ||
    process.env.MONGODB_URI ||
    "mongodb://localhost:27017/powermysport";

  const apply = process.argv.includes("--apply");
  const rollback = process.argv.includes("--down");

  mongoose
    .connect(MONGODB_URI)
    .then(async () => {
      console.log("Connected to MongoDB");
      if (rollback) {
        await down({ apply });
      } else {
        await up({ apply });
      }
    })
    .then(() => mongoose.disconnect())
    .then(() => process.exit(0))
    .catch((error) => {
      console.error("Migration failed:", error);
      process.exit(1);
    });
}
