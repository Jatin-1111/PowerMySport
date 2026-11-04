import "dotenv/config";
import mongoose from "mongoose";

/**
 * Migration 59: remove plan check-ins and pathway profiles whose child no longer exists.
 *
 * Deleting a child used to remove only the profile, the ranking link and the
 * season plan. The check-ins, their queued emails and the pathway profile stayed
 * behind. Deletion now cleans all of them (see `deleteDependent`), but rows left
 * by deletions before that change remain. This removes them.
 *
 * A row is an orphan when it names a `dependentId` and no `players` document has
 * that id. Rows with no `dependentId` (a plan for the parent themselves) are never
 * touched. Queued `PLAN_CHECKIN` emails still PENDING for an orphan check-in are
 * removed with it; emails already sent are kept as history.
 *
 * Like migrations 50, 51, 55, 57 and 58 this does not import the models, so
 * running it on a laptop creates no collection or index in production.
 *
 * USAGE: invoke ts-node directly (PowerShell strips `--` from `npm run`).
 *
 *   npx ts-node src/migrations/59_remove_orphaned_child_records.ts
 *   npx ts-node src/migrations/59_remove_orphaned_child_records.ts --apply
 *
 * Without --apply it only prints counts. Deleting cannot be undone. Re-running is
 * idempotent.
 */

type Db = mongoose.mongo.Db;

interface Options {
  apply?: boolean;
}

const hasChild = { dependentId: { $exists: true, $ne: null } };

const orphansOf = async (db: Db, collection: string) => {
  const existing = new Set(
    (
      await db
        .collection("players")
        .find({}, { projection: { _id: 1 } })
        .toArray()
    ).map((player) => String(player._id))
  );
  const rows = await db
    .collection(collection)
    .find(hasChild, { projection: { dependentId: 1, status: 1 } })
    .toArray();
  return rows.filter((row) => !existing.has(String(row.dependentId)));
};

export const up = async (
  options: Options = {},
  db: Db = mongoose.connection.db as unknown as Db
): Promise<void> => {
  const { apply = false } = options;

  const checkIns = await orphansOf(db, "plancheckins");
  const byStatus: Record<string, number> = {};
  for (const row of checkIns) byStatus[row.status ?? "?"] = (byStatus[row.status ?? "?"] ?? 0) + 1;
  const checkInIds = checkIns.map((row) => String(row._id));
  const pendingEmail = {
    type: "PLAN_CHECKIN",
    status: "PENDING",
    "data.checkInId": { $in: checkInIds },
  };
  const pendingEmails = checkInIds.length
    ? await db.collection("schedulednotifications").countDocuments(pendingEmail)
    : 0;
  const profiles = await orphansOf(db, "userpathwayprofiles");

  console.log(`[orphan] plan check-ins: ${checkIns.length} ${JSON.stringify(byStatus)}`);
  console.log(`[orphan] queued check-in emails still pending: ${pendingEmails}`);
  console.log(`[orphan] pathway profiles: ${profiles.length}`);

  if (apply) {
    if (checkIns.length) {
      await db.collection("schedulednotifications").deleteMany(pendingEmail);
      await db.collection("plancheckins").deleteMany({ _id: { $in: checkIns.map((r) => r._id) } });
    }
    if (profiles.length) {
      await db
        .collection("userpathwayprofiles")
        .deleteMany({ _id: { $in: profiles.map((r) => r._id) } });
    }
  }
  console.log(apply ? "Done." : "Dry run complete. Re-run with --apply.");
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
      console.error("Migration 59 failed:", error);
      process.exit(1);
    });
}
