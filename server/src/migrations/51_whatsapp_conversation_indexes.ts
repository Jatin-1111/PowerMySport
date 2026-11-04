import "dotenv/config";
import mongoose from "mongoose";

/**
 * Migration 51: create the indexes for `whatsappconversations`.
 *
 * The deployed server has `autoIndex` off, so it never creates these itself:
 *
 *   • `phoneHash_1`  UNIQUE. Without it two messages arriving together for a new
 *     number can each upsert a conversation, and the parent ends up with two.
 *   • `updatedAt_1`  TTL, 90 days. Without it the retention promise in the model
 *     (a child's details are not kept forever) is not enforced by anything.
 *
 * Doing this by hand also keeps the collection from being created implicitly.
 * It does NOT import the WhatsAppConversation model, for the same reason as
 * migration 50: importing a model with `autoIndex` on creates its indexes in
 * whatever database the connection points at, and a local run keys that off
 * NODE_ENV, so a dry run would write to production. The index definitions are
 * repeated below and pinned against the model by a test.
 *
 * Deploy ordering: run this BEFORE enabling WHATSAPP_ASSISTANT. Creating an
 * index on a collection that does not exist yet creates the empty collection
 * (a few KB; Atlas is at its quota, so check headroom first).
 *
 * USAGE — invoke ts-node directly (PowerShell strips `--` from `npm run`).
 *
 *   npx ts-node src/migrations/51_whatsapp_conversation_indexes.ts
 *   npx ts-node src/migrations/51_whatsapp_conversation_indexes.ts --apply
 *   npx ts-node src/migrations/51_whatsapp_conversation_indexes.ts --down --apply
 *
 * Re-running is idempotent; every line reads `[skip]` once done.
 */

type Db = mongoose.mongo.Db;

interface Options {
  apply?: boolean;
}

const COLLECTION = "whatsappconversations";

export const WHATSAPP_CONVERSATION_INDEXES: Array<{
  name: string;
  key: Record<string, 1>;
  options: { unique?: true; expireAfterSeconds?: number };
}> = [
  { name: "phoneHash_1", key: { phoneHash: 1 }, options: { unique: true } },
  {
    name: "updatedAt_1",
    key: { updatedAt: 1 },
    options: { expireAfterSeconds: 60 * 60 * 24 * 90 },
  },
];

const liveIndexNames = async (db: Db): Promise<Set<string>> => {
  const exists =
    (await db.listCollections({ name: COLLECTION }, { nameOnly: true }).toArray()).length > 0;
  if (!exists) return new Set();
  const indexes = await db.collection(COLLECTION).indexes();
  return new Set(indexes.map((i) => i.name as string));
};

export const up = async (
  options: Options = {},
  db: Db = mongoose.connection.db as unknown as Db
): Promise<void> => {
  const { apply = false } = options;
  const live = await liveIndexNames(db);

  for (const spec of WHATSAPP_CONVERSATION_INDEXES) {
    if (live.has(spec.name)) {
      console.log(`[skip]   ${spec.name} already present`);
      continue;
    }
    console.log(`[create] ${spec.name} ${JSON.stringify(spec.options)}`);
    if (apply)
      await db.collection(COLLECTION).createIndex(spec.key, { name: spec.name, ...spec.options });
  }
  console.log(apply ? "Done." : "Dry run complete — re-run with --apply.");
};

export const down = async (
  options: Options = {},
  db: Db = mongoose.connection.db as unknown as Db
): Promise<void> => {
  const { apply = false } = options;
  const live = await liveIndexNames(db);

  for (const spec of WHATSAPP_CONVERSATION_INDEXES) {
    if (!live.has(spec.name)) {
      console.log(`[skip]   ${spec.name} not present`);
      continue;
    }
    console.log(`[drop]   ${spec.name}`);
    if (apply) await db.collection(COLLECTION).dropIndex(spec.name);
  }
  console.log(apply ? "Revert complete." : "Dry run complete — re-run with --down --apply.");
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
      console.error("Migration 51 failed:", error);
      process.exit(1);
    });
}
