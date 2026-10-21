import "dotenv/config";
import mongoose from "mongoose";
import { RETENTION_DAYS } from "./55_assistant_chat_session_retention";

/**
 * Migration 63: expire the guidance follow-up chats and the roadmap chats after the same
 * retention period as the site assistant's chats (migration 55).
 *
 * Decided 2026-10-21: every chat store keeps a conversation for RETENTION_DAYS (180) after
 * its last message. A guidance chat is also removed when its submission or child is
 * deleted; this adds the time limit that was missing. The guidance SUBMISSIONS themselves
 * are deliberately not expired: they are the report a parent comes back to, and they
 * already go when the child or the account is deleted.
 *
 * Like migration 55, this is a migration and not an index on the model, and it does not
 * import the models: the deployed server has `autoIndex` off and a laptop has it on, so an
 * index on the model would start deleting production chats the moment a script imported it.
 *
 * Creating an index starts deleting every chat whose last message is older than the
 * period, within about a minute, and it cannot be undone. The dry run says how many.
 *
 * USAGE (invoke ts-node directly; PowerShell strips `--` from `npm run`):
 *
 *   npx ts-node src/migrations/63_chat_retention_guidance_and_roadmap.ts
 *   npx ts-node src/migrations/63_chat_retention_guidance_and_roadmap.ts --apply
 *   npx ts-node src/migrations/63_chat_retention_guidance_and_roadmap.ts --down --apply
 */

type Db = mongoose.mongo.Db;

interface Options {
  apply?: boolean;
}

export const COLLECTIONS = ["guidancechatsessions", "roadmapchatsessions"];
export const INDEX_NAME = "updatedAt_1";

const DAY_MS = 24 * 60 * 60 * 1000;

const updatedAtIndex = async (db: Db, collection: string) => {
  const exists =
    (await db.listCollections({ name: collection }, { nameOnly: true }).toArray()).length > 0;
  if (!exists) return null;
  const indexes = await db.collection(collection).indexes();
  return indexes.find((index) => index.name === INDEX_NAME) ?? null;
};

export const up = async (
  options: Options = {},
  db: Db = mongoose.connection.db as unknown as Db
): Promise<void> => {
  const { apply = false } = options;
  const cutoff = new Date(Date.now() - RETENTION_DAYS * DAY_MS);

  for (const collection of COLLECTIONS) {
    const existing = await updatedAtIndex(db, collection);
    if (existing && existing.expireAfterSeconds === RETENTION_DAYS * 24 * 60 * 60) {
      console.log(
        `[skip]   ${collection}: ${INDEX_NAME} already expires after ${RETENTION_DAYS} days`
      );
      continue;
    }
    if (existing) {
      // An index of that name exists with another (or no) expiry. Changing it silently
      // could shorten retention, so stop and say so.
      console.log(
        `[conflict] ${collection}: ${INDEX_NAME} exists with expireAfterSeconds=${existing.expireAfterSeconds ?? "none"}; not touched`
      );
      continue;
    }
    const wouldDelete = await db
      .collection(collection)
      .countDocuments({ updatedAt: { $lt: cutoff } });
    console.log(
      `[create] ${collection}: ${INDEX_NAME} expireAfterSeconds=${RETENTION_DAYS * 24 * 60 * 60} ` +
        `(${wouldDelete} chat(s) older than ${RETENTION_DAYS} days would be deleted)`
    );
    if (apply) {
      await db
        .collection(collection)
        .createIndex(
          { updatedAt: 1 },
          { name: INDEX_NAME, expireAfterSeconds: RETENTION_DAYS * 24 * 60 * 60 }
        );
    }
  }
  console.log(apply ? "Done." : "Dry run complete. Re-run with --apply.");
};

export const down = async (
  options: Options = {},
  db: Db = mongoose.connection.db as unknown as Db
): Promise<void> => {
  const { apply = false } = options;
  for (const collection of COLLECTIONS) {
    const existing = await updatedAtIndex(db, collection);
    if (!existing || existing.expireAfterSeconds === undefined) {
      console.log(`[skip]   ${collection}: no expiring ${INDEX_NAME}`);
      continue;
    }
    console.log(`[drop]   ${collection}: ${INDEX_NAME}`);
    if (apply) await db.collection(collection).dropIndex(INDEX_NAME);
  }
  console.log(apply ? "Revert complete." : "Dry run complete. Re-run with --down --apply.");
};

if (require.main === module) {
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
      console.error("Migration 63 failed:", error);
      process.exit(1);
    });
}
