import "dotenv/config";
import mongoose from "mongoose";

/**
 * Migration 53: refile existing plan check-in notifications from BOOKING to PLAN.
 *
 * Until now the scheduler filed every reminder it did not recognise as a
 * BOOKING_REMINDER / BOOKING in-app notification, so "How's Badminton going?"
 * check-in nudges are stored under a booking type and category and render with a
 * "Booking" badge. New ones are written as PLAN_CHECKIN / PLAN; this fixes the
 * ones already delivered.
 *
 * A check-in notification is recognised by `data.checkInId`, which only the
 * PLAN_CHECKIN scheduler path sets, so a genuine booking reminder is never
 * touched. Idempotent: once refiled, a row no longer matches.
 *
 * Raw collection, no model import (see migration 50: importing a model with
 * autoIndex on creates its indexes in whatever database the connection points
 * at). This migration changes no indexes.
 *
 * Deploy ordering: run BEFORE merging. The Notification schema's category enum
 * gains "PLAN" in the same change, and the deployed server only accepts it after
 * the deploy, so running first is harmless: the raw update bypasses validation.
 *
 * USAGE — invoke ts-node directly, not through `npm run x -- --apply`.
 *
 *   npx ts-node src/migrations/53_refile_plan_checkin_notifications.ts
 *   npx ts-node src/migrations/53_refile_plan_checkin_notifications.ts --apply
 *   npx ts-node src/migrations/53_refile_plan_checkin_notifications.ts --down --apply
 */

type Db = mongoose.mongo.Db;

interface Options {
  apply?: boolean;
}

const FROM = { type: "BOOKING_REMINDER", category: "BOOKING" };
const TO = { type: "PLAN_CHECKIN", category: "PLAN" };

const refile = async (db: Db, from: typeof FROM, to: typeof TO, apply: boolean) => {
  const filter = { ...from, "data.checkInId": { $exists: true } };
  const collection = db.collection("notifications");
  const count = await collection.countDocuments(filter);
  console.log(
    `  ${count} notification(s) ${apply ? "refiling" : "to refile"}: ${from.category} → ${to.category}`
  );
  if (apply && count > 0) await collection.updateMany(filter, { $set: to });
};

export const up = async (
  options: Options = {},
  db: Db = mongoose.connection.db as unknown as Db
) => {
  const apply = Boolean(options.apply);
  console.log(`Starting migration 53: refile plan check-ins (${apply ? "APPLY" : "DRY RUN"})...`);
  await refile(db, FROM, TO, apply);
  console.log(apply ? "Migration 53 complete." : "Dry run complete — re-run with --apply.");
};

export const down = async (
  options: Options = {},
  db: Db = mongoose.connection.db as unknown as Db
) => {
  const apply = Boolean(options.apply);
  console.log(`Reverting migration 53 (${apply ? "APPLY" : "DRY RUN"})...`);
  await refile(db, TO, FROM, apply);
  console.log(apply ? "Revert complete." : "Dry run complete — re-run with --down --apply.");
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
    .connect(uri, { autoIndex: false, autoCreate: false })
    .then(async () => {
      console.log(`Target database: ${mongoose.connection.name} on ${mongoose.connection.host}`);
      await (isDown ? down(options) : up(options));
    })
    .then(() => mongoose.disconnect())
    .then(() => process.exit(0))
    .catch((error: unknown) => {
      console.error("Migration 53 failed:", error);
      process.exit(1);
    });
}
