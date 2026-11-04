import "dotenv/config";
import mongoose from "mongoose";

/**
 * Migration 67: create the indexes for `whatsappnotes`.
 *
 * The deployed server has `autoIndex` off, so it never creates these itself:
 *
 *   • `phoneHash_1`  UNIQUE. Without it two messages arriving together for a new
 *     number can each upsert a note, and the parent ends up with two.
 *   • `updatedAt_1`  TTL, 12 months. Without it the retention promise in the model
 *     (a child's details are not kept forever) is not enforced by anything.
 *
 * Purely additive: nothing existing is read or changed, and the collection is empty until
 * the assistant starts saving notes. Run it BEFORE the code that writes notes is deployed.
 *
 * Like migration 51 it does NOT import the WhatsAppNote model. Importing a model with
 * `autoIndex` on creates its indexes in whatever database the connection points at, and a
 * local run keys that off NODE_ENV, so a dry run would write to production. The index
 * definitions are repeated below and pinned against the model by a test.
 *
 * Creating an index on a collection that does not exist yet creates the empty collection
 * (a few KB).
 *
 * USAGE: invoke ts-node directly (PowerShell strips `--` from `npm run`).
 *
 *   npx ts-node src/migrations/67_whatsapp_note_indexes.ts
 *   npx ts-node src/migrations/67_whatsapp_note_indexes.ts --apply
 *   npx ts-node src/migrations/67_whatsapp_note_indexes.ts --down --apply
 *
 * Re-running is idempotent; every line reads `[skip]` once done.
 */

type Db = mongoose.mongo.Db;

interface Options {
  apply?: boolean;
}

const COLLECTION = "whatsappnotes";

export const WHATSAPP_NOTE_INDEXES: Array<{
  name: string;
  key: Record<string, 1>;
  options: { unique?: true; expireAfterSeconds?: number };
}> = [
  { name: "phoneHash_1", key: { phoneHash: 1 }, options: { unique: true } },
  {
    name: "updatedAt_1",
    key: { updatedAt: 1 },
    options: { expireAfterSeconds: 60 * 60 * 24 * 365 },
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

  for (const spec of WHATSAPP_NOTE_INDEXES) {
    if (live.has(spec.name)) {
      console.log(`[skip]   ${spec.name} already present`);
      continue;
    }
    console.log(`[create] ${spec.name} ${JSON.stringify(spec.options)}`);
    if (apply)
      await db.collection(COLLECTION).createIndex(spec.key, { name: spec.name, ...spec.options });
  }
  console.log(apply ? "Done." : "Dry run complete. Re-run with --apply.");
};

export const down = async (
  options: Options = {},
  db: Db = mongoose.connection.db as unknown as Db
): Promise<void> => {
  const { apply = false } = options;
  const live = await liveIndexNames(db);

  for (const spec of WHATSAPP_NOTE_INDEXES) {
    if (!live.has(spec.name)) {
      console.log(`[skip]   ${spec.name} not present`);
      continue;
    }
    console.log(`[drop]   ${spec.name}`);
    if (apply) await db.collection(COLLECTION).dropIndex(spec.name);
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
      console.error("Migration 67 failed:", error);
      process.exit(1);
    });
}
