import "dotenv/config";
import mongoose from "mongoose";

/**
 * Migration 72: create the indexes for `devicepushtokens`.
 *
 * The deployed server has `autoIndex` off, so it never creates these itself:
 *
 *   • `token_1`      UNIQUE. One row per phone, so a second sign-in on the same phone moves the
 *     token to the new account instead of duplicating it, and a push is never sent twice to a phone.
 *   • `userId_1`     finds every phone an account should be notified on.
 *   • `lastSeenAt_1` TTL, 120 days. The app registers on each launch, so a phone that has not opened
 *     it for that long is dropped. Without it, abandoned devices are sent to for ever.
 *
 * Purely additive: nothing existing is read or changed, and the collection is empty until the
 * mobile app starts registering devices. Run it BEFORE the code that writes them is deployed.
 *
 * Like migrations 51, 67 and 68 it does NOT import the model. Importing a model with `autoIndex`
 * on creates its indexes in whatever database the connection points at, and a local run keys that
 * off NODE_ENV, so a dry run would write to production. The index definitions are repeated below
 * and pinned against the model by a test.
 *
 * USAGE: invoke ts-node directly (PowerShell strips `--` from `npm run`).
 *
 *   npx ts-node src/migrations/72_device_push_token_indexes.ts
 *   npx ts-node src/migrations/72_device_push_token_indexes.ts --apply
 *   npx ts-node src/migrations/72_device_push_token_indexes.ts --down --apply
 *
 * Re-running is idempotent; every line reads `[skip]` once done.
 */

type Db = mongoose.mongo.Db;

interface Options {
  apply?: boolean;
}

const COLLECTION = "devicepushtokens";

export const DEVICE_PUSH_TOKEN_INDEXES: Array<{
  name: string;
  key: Record<string, 1 | -1>;
  options: { unique?: true; expireAfterSeconds?: number };
}> = [
  { name: "token_1", key: { token: 1 }, options: { unique: true } },
  { name: "userId_1", key: { userId: 1 }, options: {} },
  {
    name: "lastSeenAt_1",
    key: { lastSeenAt: 1 },
    options: { expireAfterSeconds: 60 * 60 * 24 * 120 },
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

  for (const spec of DEVICE_PUSH_TOKEN_INDEXES) {
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

  for (const spec of DEVICE_PUSH_TOKEN_INDEXES) {
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
      console.error("Migration 72 failed:", error);
      process.exit(1);
    });
}
