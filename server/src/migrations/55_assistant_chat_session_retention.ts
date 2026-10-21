import "dotenv/config";
import mongoose from "mongoose";

/**
 * Migration 55: expire the site assistant's chats after a retention period.
 *
 * `assistantchatsessions` kept every chat for ever, unlike WhatsApp
 * conversations (90 days). A chat can hold a child's age, sport and goals, so
 * the retention promise made elsewhere (a child's details are not kept for ever)
 * was not enforced for the web assistant. This adds a TTL index on `updatedAt`.
 *
 * It is a migration and NOT an index on the model on purpose. The deployed
 * server has `autoIndex` off, and a local script or dev server has it on: an
 * index declared on the model would be created in whatever database the
 * connection points at, so merely importing the model on a laptop would start
 * deleting production chats. This file does not import the model, for the
 * same reason as migrations 50 and 51.
 *
 * DECIDED 2026-10-21: RETENTION_DAYS is 180, for this chat store and the other two
 * (migration 63). Creating the index starts deleting every chat whose last message is
 * older than that, within about a minute, and it cannot be undone. The dry run counts them.
 *
 * USAGE: invoke ts-node directly (PowerShell strips `--` from `npm run`).
 *
 *   npx ts-node src/migrations/55_assistant_chat_session_retention.ts
 *   npx ts-node src/migrations/55_assistant_chat_session_retention.ts --apply
 *   npx ts-node src/migrations/55_assistant_chat_session_retention.ts --down --apply
 *
 * The dry run also counts how many chats the index would delete. Re-running is
 * idempotent.
 */

type Db = mongoose.mongo.Db;

interface Options {
  apply?: boolean;
}

const COLLECTION = "assistantchatsessions";
export const RETENTION_DAYS = 180;
export const INDEX_NAME = "updatedAt_1";

const hasIndex = async (db: Db): Promise<boolean> => {
  const exists =
    (await db.listCollections({ name: COLLECTION }, { nameOnly: true }).toArray()).length > 0;
  if (!exists) return false;
  const indexes = await db.collection(COLLECTION).indexes();
  return indexes.some((index) => index.name === INDEX_NAME);
};

export const up = async (
  options: Options = {},
  db: Db = mongoose.connection.db as unknown as Db
): Promise<void> => {
  const { apply = false } = options;

  if (await hasIndex(db)) {
    console.log(`[skip]   ${INDEX_NAME} already present`);
    return;
  }

  const cutoff = new Date(Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000);
  const wouldDelete = await db
    .collection(COLLECTION)
    .countDocuments({ updatedAt: { $lt: cutoff } });
  console.log(
    `[create] ${INDEX_NAME} expireAfterSeconds=${RETENTION_DAYS * 24 * 60 * 60} ` +
      `(${wouldDelete} chat(s) older than ${RETENTION_DAYS} days would be deleted)`
  );
  if (apply) {
    await db
      .collection(COLLECTION)
      .createIndex(
        { updatedAt: 1 },
        { name: INDEX_NAME, expireAfterSeconds: RETENTION_DAYS * 24 * 60 * 60 }
      );
  }
  console.log(apply ? "Done." : "Dry run complete. Re-run with --apply.");
};

export const down = async (
  options: Options = {},
  db: Db = mongoose.connection.db as unknown as Db
): Promise<void> => {
  const { apply = false } = options;
  if (!(await hasIndex(db))) {
    console.log(`[skip]   ${INDEX_NAME} not present`);
    return;
  }
  console.log(`[drop]   ${INDEX_NAME}`);
  if (apply) await db.collection(COLLECTION).dropIndex(INDEX_NAME);
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
      console.error("Migration 55 failed:", error);
      process.exit(1);
    });
}
