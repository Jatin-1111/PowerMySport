import "dotenv/config";
import { isDeepStrictEqual } from "node:util";
import mongoose from "mongoose";
import {
  GUEST_EVENT_TTL_DAYS,
  GUEST_EVENT_TTL_INDEX,
  REDUNDANT_ANALYTICS_INDEXES,
} from "../admin/models/analyticsEventIndexes";

/**
 * Migration 51: retention and index cleanup for `analyticsevents`.
 *
 * The collection takes writes from a public, unauthenticated endpoint
 * (`POST /api/stats/guest/event`) and had no retention. At the 2026-10-04 probe
 * it held 19,782 events and 8.3 MB on a cluster that was at its 512 MB cap; the
 * only way events ever left was an admin deleting all of them by hand.
 *
 *   1. Creates a TTL index so guest events expire after 90 days. It is PARTIAL
 *      on `guestId`, so signed-in funnel events and `unsupported_sport_search`
 *      (read up to 365 days back) are not touched. 90 days is the longest window
 *      any guest view reads.
 *   2. Drops four single-field indexes that another index already serves (about
 *      0.76 MB of the collection's 2.68 MB of index).
 *
 * THIS DELETES DATA. As soon as the TTL index exists, MongoDB's TTL monitor
 * removes every guest event older than 90 days, within about a minute, and it
 * cannot be undone. `down` removes the index but does not bring them back. The
 * dry run therefore counts what would go, and you should read that number
 * before running with --apply.
 *
 * Does NOT import the AnalyticsEvent model. Importing a model while `autoIndex`
 * is on (it keys off NODE_ENV, so it is on for a local run) creates that
 * model's indexes in whatever database the connection points at. This reads the
 * shared definitions and talks to the raw collection, and connects with
 * `autoIndex:false, autoCreate:false`.
 *
 * Deploy ordering: run BEFORE merging the model change. The deployed server has
 * autoIndex off and never creates these itself.
 *
 * USAGE — invoke ts-node directly.
 *
 *   npx ts-node src/migrations/51_analytics_event_retention_and_indexes.ts
 *   npx ts-node src/migrations/51_analytics_event_retention_and_indexes.ts --apply
 *   npx ts-node src/migrations/51_analytics_event_retention_and_indexes.ts --down --apply
 *
 * Not `npm run migrate:analytics-retention -- --apply`: PowerShell strips the
 * first bare `--`, npm swallows `--apply`, and this prints a dry run that
 * changes nothing. Re-running is idempotent; every line should read `[skip]`
 * when done.
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
  expireAfterSeconds?: number;
  partialFilterExpression?: Record<string, unknown>;
}

const sameKey = (a: Record<string, unknown> | undefined, b: Record<string, unknown>) =>
  isDeepStrictEqual(Object.entries(a ?? {}), Object.entries(b));

const liveIndexes = async (db: Db): Promise<LiveIndex[]> =>
  (await db
    .collection("analyticsevents")
    .indexes()
    .catch(() => [])) as LiveIndex[];

const ttlMatches = (live: LiveIndex): boolean =>
  sameKey(live.key, GUEST_EVENT_TTL_INDEX.key) &&
  live.expireAfterSeconds === GUEST_EVENT_TTL_INDEX.expireAfterSeconds &&
  isDeepStrictEqual(live.partialFilterExpression, GUEST_EVENT_TTL_INDEX.partialFilterExpression);

export const up = async (options: Options = {}, db: Db = mongoose.connection.db as Db) => {
  const apply = Boolean(options.apply);
  console.log(
    `Starting migration 51: analytics event retention and indexes (${apply ? "APPLY" : "DRY RUN"})...`
  );

  const collection = db.collection("analyticsevents");

  // What the TTL will remove, said out loud before anything happens.
  const cutoff = new Date(Date.now() - GUEST_EVENT_TTL_DAYS * 24 * 60 * 60 * 1000);
  const guestFilter = GUEST_EVENT_TTL_INDEX.partialFilterExpression;
  const [total, guestTotal, expiring] = await Promise.all([
    collection.estimatedDocumentCount(),
    collection.countDocuments(guestFilter),
    collection.countDocuments({ ...guestFilter, createdAt: { $lt: cutoff } }),
  ]);
  console.log(
    `  events: ${total} total, ${guestTotal} guest, ${total - guestTotal} not guest (never expire)`
  );
  console.log(
    `  ${expiring} guest event(s) are older than ${GUEST_EVENT_TTL_DAYS} days (before ${cutoff.toISOString()}) ` +
      `and WILL BE DELETED by MongoDB within about a minute of the TTL index being created.`
  );

  // 1. Redundant single-field indexes, FIRST. Dropping an index needs no write
  // budget and gives space back, whereas building the TTL index below does need
  // room. On the 2026-10-05 run the cluster was at its 512 MB cap, the TTL index
  // could not be built, and this step had not yet run: so the one step that frees
  // space went second. An index is only dropped when it really is the
  // single-field shape, and (for the three covered by a compound) only when that
  // compound exists, so this can never leave a query with no index.
  for (const redundant of REDUNDANT_ANALYTICS_INDEXES) {
    const indexes = await liveIndexes(db);
    const found = indexes.find((index) => index.name === redundant.name);
    if (!found) {
      console.log(`  [skip] ${redundant.name} — not present`);
      continue;
    }
    if (!sameKey(found.key, redundant.key)) {
      console.log(`  [skip] ${redundant.name} — present with a different key; left alone`);
      continue;
    }
    if (redundant.requires && !indexes.some((index) => index.name === redundant.requires)) {
      console.log(
        `  [skip] ${redundant.name} — its covering index ${redundant.requires} is missing`
      );
      continue;
    }
    if (!apply) {
      console.log(`  [would drop] ${redundant.name} (covered by ${redundant.coveredBy})`);
      continue;
    }
    console.log(`  [dropping] ${redundant.name}...`);
    await collection.dropIndex(redundant.name);
  }

  // 2. The TTL index. Needs a little room to build, which is why it is second.
  const live = (await liveIndexes(db)).find((index) => index.name === GUEST_EVENT_TTL_INDEX.name);
  if (live && ttlMatches(live)) {
    console.log(`  [skip] ${GUEST_EVENT_TTL_INDEX.name} — already correct`);
  } else if (!apply) {
    console.log(`  [would ${live ? "rebuild" : "create"}] ${GUEST_EVENT_TTL_INDEX.name}`);
  } else {
    if (live) {
      console.log(`  [dropping] ${GUEST_EVENT_TTL_INDEX.name} (options differ)...`);
      await collection.dropIndex(GUEST_EVENT_TTL_INDEX.name);
    }
    console.log(`  [creating] ${GUEST_EVENT_TTL_INDEX.name}...`);
    await collection.createIndex(GUEST_EVENT_TTL_INDEX.key, {
      name: GUEST_EVENT_TTL_INDEX.name,
      expireAfterSeconds: GUEST_EVENT_TTL_INDEX.expireAfterSeconds,
      partialFilterExpression: GUEST_EVENT_TTL_INDEX.partialFilterExpression,
    });
  }

  console.log(apply ? "Migration 51 complete." : "Dry run complete — re-run with --apply.");
};

export const down = async (options: Options = {}, db: Db = mongoose.connection.db as Db) => {
  const apply = Boolean(options.apply);
  console.log(`Reverting migration 51 (${apply ? "APPLY" : "DRY RUN"})...`);
  console.log("  NOTE: events the TTL already deleted are not restored.");

  const collection = db.collection("analyticsevents");

  if (!(await liveIndexes(db)).some((index) => index.name === GUEST_EVENT_TTL_INDEX.name)) {
    console.log(`  [skip] ${GUEST_EVENT_TTL_INDEX.name} — not present`);
  } else if (!apply) {
    console.log(`  [would drop] ${GUEST_EVENT_TTL_INDEX.name}`);
  } else {
    console.log(`  [dropping] ${GUEST_EVENT_TTL_INDEX.name}...`);
    await collection.dropIndex(GUEST_EVENT_TTL_INDEX.name);
  }

  for (const redundant of REDUNDANT_ANALYTICS_INDEXES) {
    if ((await liveIndexes(db)).some((index) => index.name === redundant.name)) {
      console.log(`  [skip] ${redundant.name} — already present`);
    } else if (!apply) {
      console.log(`  [would create] ${redundant.name}`);
    } else {
      console.log(`  [creating] ${redundant.name}...`);
      await collection.createIndex(redundant.key, { name: redundant.name });
    }
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
      console.error("Migration 51 failed:", error);
      process.exit(1);
    });
}
