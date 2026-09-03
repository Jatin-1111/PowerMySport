import "dotenv/config";
import mongoose from "mongoose";
import { Booking } from "../client/models/Booking";

/**
 * Migration 23: Split the legacy PENDING_CONFIRMATION status into
 * AWAITING_PAYMENT and AWAITING_PROVIDER.
 *
 * PENDING_CONFIRMATION meant two different things depending on whether
 * `paymentConfirmedAt` was set — "nobody has paid yet" versus "paid, waiting on
 * the provider". Those now have their own states, and `paymentConfirmedAt` is
 * exactly the discriminator that tells the existing rows apart, so no guessing
 * is required.
 *
 *   paymentConfirmedAt set     -> AWAITING_PROVIDER
 *   paymentConfirmedAt absent  -> AWAITING_PAYMENT
 *
 * This runs through the raw collection deliberately. The model no longer
 * accepts PENDING_CONFIRMATION in its status enum, so loading these documents
 * through Mongoose and saving them would fail validation on the very value
 * this migration exists to remove.
 *
 * Fully reversible: down() folds both states back into PENDING_CONFIRMATION,
 * which is lossless because paymentConfirmedAt still distinguishes them.
 *
 * USAGE
 *   npm run migrate:split-pending                # dry run (default)
 *   npm run migrate:split-pending -- --apply     # write
 *   npm run migrate:split-pending -- --down --apply
 */

const LEGACY_STATUS = "PENDING_CONFIRMATION";

export const up = async (options: { apply?: boolean } = {}) => {
  const apply = Boolean(options.apply);

  console.log(`Starting migration 23: split ${LEGACY_STATUS} (${apply ? "APPLY" : "DRY RUN"})...`);

  const collection = Booking.collection;

  const toProvider = await collection.countDocuments({
    status: LEGACY_STATUS,
    paymentConfirmedAt: { $exists: true, $ne: null },
  });
  const toPayment = await collection.countDocuments({
    status: LEGACY_STATUS,
    $or: [{ paymentConfirmedAt: { $exists: false } }, { paymentConfirmedAt: null }],
  });

  console.log(`  -> AWAITING_PROVIDER (paid)   : ${toProvider}`);
  console.log(`  -> AWAITING_PAYMENT  (unpaid) : ${toPayment}`);

  let modified = 0;

  if (apply && toProvider + toPayment > 0) {
    const paidResult = await collection.updateMany(
      {
        status: LEGACY_STATUS,
        paymentConfirmedAt: { $exists: true, $ne: null },
      },
      { $set: { status: "AWAITING_PROVIDER" } }
    );
    const unpaidResult = await collection.updateMany(
      {
        status: LEGACY_STATUS,
        $or: [{ paymentConfirmedAt: { $exists: false } }, { paymentConfirmedAt: null }],
      },
      { $set: { status: "AWAITING_PAYMENT" } }
    );
    modified = (paidResult.modifiedCount ?? 0) + (unpaidResult.modifiedCount ?? 0);
  }

  const remaining = await collection.countDocuments({ status: LEGACY_STATUS });

  console.log();
  console.log("-".repeat(60));
  console.log(`Total to migrate      : ${toProvider + toPayment}`);
  if (apply) console.log(`Modified              : ${modified}`);
  console.log(`Still ${LEGACY_STATUS} : ${remaining}`);
  console.log("-".repeat(60));

  if (!apply) {
    console.log();
    console.log("Dry run — nothing was written. Re-run with --apply to commit.");
  }

  console.log();
  console.log("Migration 23 completed.");

  return { toProvider, toPayment, modified, remaining };
};

export const down = async (options: { apply?: boolean } = {}) => {
  const apply = Boolean(options.apply);

  console.log(`Rolling back migration 23 (${apply ? "APPLY" : "DRY RUN"})...`);

  const collection = Booking.collection;
  const affected = await collection.countDocuments({
    status: { $in: ["AWAITING_PAYMENT", "AWAITING_PROVIDER"] },
  });
  console.log(`${affected} booking(s) would fold back to ${LEGACY_STATUS}.`);

  if (apply) {
    const result = await collection.updateMany(
      { status: { $in: ["AWAITING_PAYMENT", "AWAITING_PROVIDER"] } },
      { $set: { status: LEGACY_STATUS } }
    );
    console.log(`Reverted ${result.modifiedCount} booking(s).`);
    console.log(
      "Note: the model's status enum no longer contains PENDING_CONFIRMATION, " +
        "so the code change must be reverted too or these rows will fail " +
        "validation on their next save."
    );
  } else {
    console.log("Dry run — nothing was written.");
  }

  console.log("Rollback completed.");
};

// Run if executed directly
if (require.main === module) {
  const MONGODB_URI =
    process.env.MONGO_URI || process.env.MONGODB_URI || "mongodb://localhost:27017/powermysport";

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
