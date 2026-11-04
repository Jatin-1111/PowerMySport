import "dotenv/config";
import mongoose from "mongoose";

/**
 * Migration 70: create the indexes for the child sporting-history collections.
 *
 *   childevents              the timeline, one stored result per played tournament, owner lookup
 *   childacademicprofiles    one profile per child, owner lookup
 *   childvideos              a child's clips, the sweep for unfinished uploads, owner lookup
 *   childshares              the public lookup by token hash (UNIQUE), a child's links, a TTL that
 *                            removes a link after its retention period, owner lookup
 *   contactrequests          per-link count, deletes by child and owner, a 90-day TTL
 *
 * The deployed server has `autoIndex` off, so it never creates these itself. Purely additive:
 * nothing existing is read or changed, and every collection is empty until the feature is used.
 * Run it BEFORE the code that writes to them is deployed.
 *
 * Like migrations 51, 67 and 68 it does NOT import the models. Importing a model with `autoIndex`
 * on creates its indexes in whatever database the connection points at, and a local run keys that
 * off NODE_ENV, so a dry run would write to production. The index definitions are repeated below
 * and pinned against the models by a test.
 *
 * USAGE: invoke ts-node directly (PowerShell strips `--` from `npm run`).
 *
 *   npx ts-node src/migrations/70_child_history_indexes.ts
 *   npx ts-node src/migrations/70_child_history_indexes.ts --apply
 *   npx ts-node src/migrations/70_child_history_indexes.ts --down --apply
 *
 * Re-running is idempotent; every line reads `[skip]` once done.
 */

type Db = mongoose.mongo.Db;

interface Options {
  apply?: boolean;
}

interface IndexSpec {
  collection: string;
  name: string;
  key: Record<string, 1 | -1>;
  options: {
    unique?: true;
    expireAfterSeconds?: number;
    partialFilterExpression?: Record<string, unknown>;
  };
}

const NINETY_DAYS = 60 * 60 * 24 * 90;

export const CHILD_HISTORY_INDEXES: IndexSpec[] = [
  {
    collection: "childevents",
    name: "childId_1_occurredOn_-1",
    key: { childId: 1, occurredOn: -1 },
    options: {},
  },
  {
    collection: "childevents",
    name: "childId_1_editionSlug_1",
    key: { childId: 1, editionSlug: 1 },
    options: { unique: true, partialFilterExpression: { editionSlug: { $type: "string" } } },
  },
  { collection: "childevents", name: "userId_1", key: { userId: 1 }, options: {} },

  {
    collection: "childacademicprofiles",
    name: "childId_1",
    key: { childId: 1 },
    options: { unique: true },
  },
  { collection: "childacademicprofiles", name: "userId_1", key: { userId: 1 }, options: {} },

  {
    collection: "childvideos",
    name: "childId_1_createdAt_-1",
    key: { childId: 1, createdAt: -1 },
    options: {},
  },
  {
    collection: "childvideos",
    name: "status_1_createdAt_1",
    key: { status: 1, createdAt: 1 },
    options: {},
  },
  { collection: "childvideos", name: "userId_1", key: { userId: 1 }, options: {} },

  {
    collection: "childshares",
    name: "tokenHash_1",
    key: { tokenHash: 1 },
    options: { unique: true },
  },
  {
    collection: "childshares",
    name: "childId_1_createdAt_-1",
    key: { childId: 1, createdAt: -1 },
    options: {},
  },
  {
    collection: "childshares",
    name: "purgeAt_1",
    key: { purgeAt: 1 },
    options: { expireAfterSeconds: 0 },
  },
  { collection: "childshares", name: "userId_1", key: { userId: 1 }, options: {} },

  {
    collection: "contactrequests",
    name: "shareId_1_createdAt_-1",
    key: { shareId: 1, createdAt: -1 },
    options: {},
  },
  { collection: "contactrequests", name: "childId_1", key: { childId: 1 }, options: {} },
  { collection: "contactrequests", name: "userId_1", key: { userId: 1 }, options: {} },
  {
    collection: "contactrequests",
    name: "createdAt_1",
    key: { createdAt: 1 },
    options: { expireAfterSeconds: NINETY_DAYS },
  },
];

const liveIndexNames = async (db: Db, collection: string): Promise<Set<string>> => {
  const exists =
    (await db.listCollections({ name: collection }, { nameOnly: true }).toArray()).length > 0;
  if (!exists) return new Set();
  const indexes = await db.collection(collection).indexes();
  return new Set(indexes.map((i) => i.name as string));
};

export const up = async (
  options: Options = {},
  db: Db = mongoose.connection.db as unknown as Db
): Promise<void> => {
  const { apply = false } = options;
  const live = new Map<string, Set<string>>();

  for (const spec of CHILD_HISTORY_INDEXES) {
    if (!live.has(spec.collection))
      live.set(spec.collection, await liveIndexNames(db, spec.collection));
    if (live.get(spec.collection)!.has(spec.name)) {
      console.log(`[skip]   ${spec.collection}.${spec.name} already present`);
      continue;
    }
    console.log(`[create] ${spec.collection}.${spec.name} ${JSON.stringify(spec.options)}`);
    if (apply) {
      await db
        .collection(spec.collection)
        .createIndex(spec.key, { name: spec.name, ...spec.options });
    }
  }
  console.log(apply ? "Done." : "Dry run complete. Re-run with --apply.");
};

export const down = async (
  options: Options = {},
  db: Db = mongoose.connection.db as unknown as Db
): Promise<void> => {
  const { apply = false } = options;
  const live = new Map<string, Set<string>>();

  for (const spec of CHILD_HISTORY_INDEXES) {
    if (!live.has(spec.collection))
      live.set(spec.collection, await liveIndexNames(db, spec.collection));
    if (!live.get(spec.collection)!.has(spec.name)) {
      console.log(`[skip]   ${spec.collection}.${spec.name} not present`);
      continue;
    }
    console.log(`[drop]   ${spec.collection}.${spec.name}`);
    if (apply) await db.collection(spec.collection).dropIndex(spec.name);
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
      console.error("Migration 70 failed:", error);
      process.exit(1);
    });
}
