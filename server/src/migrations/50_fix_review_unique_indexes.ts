import "dotenv/config";
import { isDeepStrictEqual } from "node:util";
import mongoose from "mongoose";
import { REVIEW_UNIQUE_INDEXES, ReviewUniqueIndexSpec } from "../client/models/reviewIndexes";

/**
 * Migration 50: replace the `reviews` unique indexes that block legitimate
 * reviews.
 *
 * What production has (probed 2026-10-04) and what that does:
 *
 *   • `bookingId_1_targetType_1`  UNIQUE, not partial, declared by no model.
 *     A review with no `bookingId` indexes as null, and product reviews have
 *     none, so only ONE product review can exist platform-wide. A second one,
 *     from any user on any product, fails with E11000.
 *   • `bookingId_1_targetType_1_userId_1`  UNIQUE, not sparse (the model said
 *     sparse). The same null collision: a user can write one bookingless review
 *     per target type, ever.
 *   • `orderId_1_targetType_1_targetId_1_userId_1`  UNIQUE, sparse. A compound
 *     sparse index still indexes a document that has any one of its key fields,
 *     and every review has `targetType`, so it covers venue and coach reviews
 *     too (orderId null). A user cannot review the same venue or coach on a
 *     second booking.
 *
 * The result in `reviewIndexes.ts`:
 *   1. drop the stale `bookingId_1_targetType_1`;
 *   2. rebuild the other two as PARTIAL unique indexes, same names;
 *   3. add `product_review_one_per_user`, because the old sparse index was
 *      accidentally what stopped one user reviewing one product twice, and
 *      removing it must not remove that guard.
 *
 * Mongo cannot change an index's options in place, so 2 is a drop followed
 * immediately by a create. For those milliseconds the rule is not enforced; the
 * collection is tiny and written rarely, and the product index is created first
 * so it is never unguarded.
 *
 * This does NOT import the Review model. Importing a model while `autoIndex` is
 * on (it keys off NODE_ENV, so it is on for a local run) creates that model's
 * indexes in whatever database the connection points at, which is how a dry run
 * has written to production before. The migration reads the shared index
 * definitions and talks to the raw collection, and connects with
 * `autoIndex:false, autoCreate:false`.
 *
 * Deploy ordering: run this BEFORE merging the model change. The deployed server
 * has autoIndex off, so it never creates these itself, and a local dev server
 * pointed at production would try and fail harmlessly with an index-options
 * conflict until this has run.
 *
 * USAGE — invoke ts-node directly.
 *
 *   npx ts-node src/migrations/50_fix_review_unique_indexes.ts
 *   npx ts-node src/migrations/50_fix_review_unique_indexes.ts --apply
 *   npx ts-node src/migrations/50_fix_review_unique_indexes.ts --down --apply
 *
 * Not `npm run migrate:review-indexes -- --apply`: PowerShell strips the first
 * bare `--`, npm swallows `--apply`, and this prints a dry run that changes
 * nothing. Re-running is idempotent; every line should read `[skip]` when done.
 */

// mongoose bundles its own copy of the driver; use its type so the handle from
// `mongoose.connection.db` matches.
type Db = mongoose.mongo.Db;

interface Options {
  apply?: boolean;
}

interface LiveIndex {
  name?: string;
  key?: Record<string, unknown>;
  unique?: boolean;
  sparse?: boolean;
  partialFilterExpression?: Record<string, unknown>;
}

/** The three indexes production has today. `down` restores exactly these. */
const LEGACY: Array<{
  name: string;
  key: Record<string, 1 | -1>;
  unique: true;
  sparse?: true;
}> = [
  { name: "bookingId_1_targetType_1", key: { bookingId: 1, targetType: 1 }, unique: true },
  {
    name: "bookingId_1_targetType_1_userId_1",
    key: { bookingId: 1, targetType: 1, userId: 1 },
    unique: true,
  },
  {
    name: "orderId_1_targetType_1_targetId_1_userId_1",
    key: { orderId: 1, targetType: 1, targetId: 1, userId: 1 },
    unique: true,
    sparse: true,
  },
];

const STALE_NAME = "bookingId_1_targetType_1";

const sameKey = (a: Record<string, unknown> | undefined, b: Record<string, unknown>) =>
  isDeepStrictEqual(Object.entries(a ?? {}), Object.entries(b));

/** Does a live index already match the wanted definition exactly? */
const matches = (live: LiveIndex, want: ReviewUniqueIndexSpec): boolean =>
  sameKey(live.key, want.key) &&
  live.unique === true &&
  !live.sparse &&
  isDeepStrictEqual(live.partialFilterExpression, want.partialFilterExpression);

/** Groups that would make a unique index over `want` fail, reported as data. */
const duplicatesFor = async (db: Db, want: ReviewUniqueIndexSpec) => {
  const groupId = Object.fromEntries(Object.keys(want.key).map((key) => [key, `$${key}`]));
  return db
    .collection("reviews")
    .aggregate([
      { $match: want.partialFilterExpression },
      { $group: { _id: groupId, count: { $sum: 1 } } },
      { $match: { count: { $gt: 1 } } },
      { $limit: 20 },
    ])
    .toArray();
};

const liveIndexes = async (db: Db): Promise<LiveIndex[]> =>
  (await db
    .collection("reviews")
    .indexes()
    .catch(() => [])) as LiveIndex[];

export const up = async (
  options: Options = {},
  db: Db = mongoose.connection.db as unknown as Db
) => {
  const apply = Boolean(options.apply);
  console.log(`Starting migration 50: review unique indexes (${apply ? "APPLY" : "DRY RUN"})...`);

  const collection = db.collection("reviews");

  // The product index goes first so uniqueness on product reviews is never
  // absent while the other two are rebuilt.
  const ordered = [...REVIEW_UNIQUE_INDEXES].sort((a, b) =>
    a.name === "product_review_one_per_user" ? -1 : b.name === "product_review_one_per_user" ? 1 : 0
  );

  for (const want of ordered) {
    const live = (await liveIndexes(db)).find((index) => index.name === want.name);

    if (live && matches(live, want)) {
      console.log(`  [skip] ${want.name} — already correct`);
      continue;
    }

    const dupes = await duplicatesFor(db, want);
    if (dupes.length > 0) {
      console.error(`  [BLOCKED] ${want.name} — existing duplicates must be resolved first:`);
      for (const dupe of dupes) console.error(`    ${JSON.stringify(dupe)}`);
      throw new Error(`Cannot create unique index ${want.name}: duplicates present`);
    }

    if (!apply) {
      console.log(`  [would ${live ? "rebuild" : "create"}] ${want.name}`);
      continue;
    }

    if (live) {
      console.log(`  [dropping] ${want.name} (options differ)...`);
      await collection.dropIndex(want.name);
    }
    console.log(`  [creating] ${want.name}...`);
    await collection.createIndex(want.key, {
      name: want.name,
      unique: true,
      partialFilterExpression: want.partialFilterExpression,
    });
  }

  // Only drop the stale one when it really is the legacy shape, so a future
  // index that happens to reuse the name is left alone.
  const stale = (await liveIndexes(db)).find((index) => index.name === STALE_NAME);
  if (!stale) {
    console.log(`  [skip] ${STALE_NAME} — not present`);
  } else if (!sameKey(stale.key, { bookingId: 1, targetType: 1 })) {
    console.log(`  [skip] ${STALE_NAME} — present but with a different key; left alone`);
  } else if (!apply) {
    console.log(`  [would drop] ${STALE_NAME}`);
  } else {
    console.log(`  [dropping] ${STALE_NAME}...`);
    await collection.dropIndex(STALE_NAME);
  }

  console.log(apply ? "Migration 50 complete." : "Dry run complete — re-run with --apply.");
};

export const down = async (
  options: Options = {},
  db: Db = mongoose.connection.db as unknown as Db
) => {
  const apply = Boolean(options.apply);
  console.log(`Reverting migration 50 (${apply ? "APPLY" : "DRY RUN"})...`);
  console.log("  NOTE: this restores the indexes that block product and repeat-venue reviews.");

  const collection = db.collection("reviews");

  for (const name of ["product_review_one_per_user"]) {
    if (!(await liveIndexes(db)).some((index) => index.name === name)) {
      console.log(`  [skip] ${name} — not present`);
    } else if (!apply) {
      console.log(`  [would drop] ${name}`);
    } else {
      console.log(`  [dropping] ${name}...`);
      await collection.dropIndex(name);
    }
  }

  for (const legacy of LEGACY) {
    const live = (await liveIndexes(db)).find((index) => index.name === legacy.name);
    const alreadyLegacy =
      live &&
      live.unique === true &&
      Boolean(live.sparse) === Boolean(legacy.sparse) &&
      live.partialFilterExpression === undefined;
    if (alreadyLegacy) {
      console.log(`  [skip] ${legacy.name} — already in its legacy form`);
      continue;
    }
    if (!apply) {
      console.log(`  [would ${live ? "rebuild" : "create"}] ${legacy.name} (legacy)`);
      continue;
    }
    if (live) {
      console.log(`  [dropping] ${legacy.name}...`);
      await collection.dropIndex(legacy.name);
    }
    console.log(`  [creating] ${legacy.name} (legacy)...`);
    await collection.createIndex(legacy.key, {
      name: legacy.name,
      unique: true,
      ...(legacy.sparse ? { sparse: true } : {}),
    });
  }

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

  // autoIndex/autoCreate off: nothing here may create anything except what the
  // migration itself asks for.
  void mongoose
    .connect(uri, { autoIndex: false, autoCreate: false })
    .then(async () => {
      console.log(`Target database: ${mongoose.connection.name} on ${mongoose.connection.host}`);
      await (isDown ? down(options) : up(options));
    })
    .then(() => mongoose.disconnect())
    .then(() => process.exit(0))
    .catch((error: unknown) => {
      console.error("Migration 50 failed:", error);
      process.exit(1);
    });
}
