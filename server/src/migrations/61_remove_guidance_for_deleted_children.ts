import "dotenv/config";
import mongoose from "mongoose";

/**
 * Migration 61: remove guidance submissions whose child no longer exists.
 *
 * A guidance submission stores the questionnaire it was built from: the child's age
 * and gender and the parent's own question. Deleting a child now removes their
 * submissions and the follow-up chats on them (see `deleteDependent`), but
 * submissions from deletions before that change remain. Migration 59 cleaned the
 * check-ins and pathway profiles those deletions left; this cleans the submissions.
 *
 * A submission is an orphan when `request.dependent_id` is set and no `players`
 * document has that id. Submissions with no child (a plan for "my child" without
 * picking a profile, or a guest) are never touched. The chat sessions on an
 * orphan are removed with it.
 *
 * SEPARATE, AND NOT TOUCHED HERE: submissions owned by users who no longer exist.
 * On 2026-10-21 that was 43 of 86 submissions in production, most with no child
 * link at all. The dry run prints that count so it stays visible. Removing them is
 * a different decision (it is account deletion, not child deletion) and needs its
 * own migration and your say.
 *
 * Like migrations 50, 51, 55, 57, 58 and 59 this does not import a model, so running
 * it on a laptop creates no collection or index in production.
 *
 * USAGE: invoke ts-node directly (PowerShell strips `--` from `npm run`).
 *
 *   npx ts-node src/migrations/61_remove_guidance_for_deleted_children.ts
 *   npx ts-node src/migrations/61_remove_guidance_for_deleted_children.ts --apply
 *
 * Without --apply it only prints counts. Deleting cannot be undone. Re-running is
 * idempotent.
 */

type Db = mongoose.mongo.Db;

interface Options {
  apply?: boolean;
}

const SUBMISSIONS = "guidancesubmissions";
const CHATS = "guidancechatsessions";

const hasChild = { "request.dependent_id": { $exists: true, $ne: null } };

export const up = async (
  options: Options = {},
  db: Db = mongoose.connection.db as unknown as Db
): Promise<void> => {
  const { apply = false } = options;

  const existing = new Set(
    (
      await db
        .collection("players")
        .find({}, { projection: { _id: 1 } })
        .toArray()
    ).map((player) => String(player._id))
  );
  const withChild = await db
    .collection(SUBMISSIONS)
    .find(hasChild, { projection: { "request.dependent_id": 1 } })
    .toArray();
  const orphans = withChild.filter((row) => !existing.has(String(row.request?.dependent_id)));
  const ids = orphans.map((row) => row._id);

  const chats = ids.length
    ? await db.collection(CHATS).countDocuments({ submissionId: { $in: ids } })
    : 0;

  console.log(`[orphan] guidance submissions naming a deleted child: ${orphans.length}`);
  console.log(`[orphan] follow-up chats on them: ${chats}`);

  // Information only. Not touched by this migration.
  const users = new Set(
    (
      await db
        .collection("users")
        .find({}, { projection: { _id: 1 } })
        .toArray()
    ).map((user) => String(user._id))
  );
  const owned = await db
    .collection(SUBMISSIONS)
    .find({ userId: { $exists: true, $ne: null } }, { projection: { userId: 1 } })
    .toArray();
  const ownerGone = owned.filter((row) => !users.has(String(row.userId))).length;
  console.log(
    `[info]   ${ownerGone} submission(s) belong to users that no longer exist (NOT touched here)`
  );

  if (apply && ids.length) {
    await db.collection(CHATS).deleteMany({ submissionId: { $in: ids } });
    await db.collection(SUBMISSIONS).deleteMany({ _id: { $in: ids } });
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
      console.error("Migration 61 failed:", error);
      process.exit(1);
    });
}
