import "dotenv/config";
import mongoose from "mongoose";

/**
 * Migration 69: the two indexes the admin enquiries screen reads by, on `whatsappenquiries`.
 *
 *   • `followUpStatus_1_lastMessageAt_-1`  the list, newest first, and its "needs follow-up" filter.
 *   • `createdAt_-1`                       the CSV export, newest first.
 *
 * Purely additive. The deployed server has `autoIndex` off, so it never creates these itself; run
 * this BEFORE the admin screen is deployed. Like 51, 67 and 68 it does NOT import the model
 * (importing one with `autoIndex` on creates indexes in whatever database the connection points
 * at, and a local dry run would write to production). The definitions are pinned against the
 * model by a test.
 *
 * USAGE: invoke ts-node directly (PowerShell strips `--` from `npm run`).
 *
 *   npx ts-node src/migrations/69_whatsapp_enquiry_admin_indexes.ts
 *   npx ts-node src/migrations/69_whatsapp_enquiry_admin_indexes.ts --apply
 *   npx ts-node src/migrations/69_whatsapp_enquiry_admin_indexes.ts --down --apply
 *
 * Re-running is idempotent; every line reads `[skip]` once done.
 */

type Db = mongoose.mongo.Db;

interface Options {
  apply?: boolean;
}

const COLLECTION = "whatsappenquiries";

export const WHATSAPP_ENQUIRY_ADMIN_INDEXES: Array<{
  name: string;
  key: Record<string, 1 | -1>;
}> = [
  { name: "followUpStatus_1_lastMessageAt_-1", key: { followUpStatus: 1, lastMessageAt: -1 } },
  { name: "createdAt_-1", key: { createdAt: -1 } },
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

  for (const spec of WHATSAPP_ENQUIRY_ADMIN_INDEXES) {
    if (live.has(spec.name)) {
      console.log(`[skip]   ${spec.name} already present`);
      continue;
    }
    console.log(`[create] ${spec.name}`);
    if (apply) await db.collection(COLLECTION).createIndex(spec.key, { name: spec.name });
  }
  console.log(apply ? "Done." : "Dry run complete. Re-run with --apply.");
};

export const down = async (
  options: Options = {},
  db: Db = mongoose.connection.db as unknown as Db
): Promise<void> => {
  const { apply = false } = options;
  const live = await liveIndexNames(db);

  for (const spec of WHATSAPP_ENQUIRY_ADMIN_INDEXES) {
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
      console.error("Migration 69 failed:", error);
      process.exit(1);
    });
}
