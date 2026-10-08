import "dotenv/config";
import { isDeepStrictEqual } from "node:util";
import mongoose from "mongoose";
import { ACTIVE_FIND_SPORT_TRIAL_INDEX } from "../shared/models/planCheckInIndexes";

/**
 * Migration 52: collapse duplicate find-sport trial check-ins and add the guard
 * that stops them coming back.
 *
 * Why there are duplicates: every completed run of the find-sport wizard queued
 * a fresh `PlanCheckIn` plus a `ScheduledNotification` (in-app + email) due four
 * weeks later, with no check for one already waiting. A family that retook the
 * assessment a few times got the same "How's Badminton going?" several times.
 *
 * Step 0: trials whose nudge was already SENT are still `active` (nothing ever
 * moved them to `due`); mark them `due`. Without this they would be mistaken
 * for waiting trials below.
 *
 * Then, per (userId, dependentId) with more than one still-waiting ACTIVE trial:
 *   1. keeps the newest one — it reflects the latest run and the latest pick;
 *   2. marks the rest `abandoned` with an outcomeNote saying why (kept, not
 *      deleted, so the history is still readable);
 *   3. cancels their still-PENDING `ScheduledNotification`s, which is what stops
 *      the extra email and in-app card from ever being sent.
 * Then it creates the partial unique index. The index cannot be built while
 * duplicates exist, so the order matters; a failed dedupe leaves it uncreated.
 *
 * Existing `due` records are otherwise untouched: their nudge has already gone out.
 *
 * Deploy ordering: run this BEFORE merging the code. The deployed server has
 * autoIndex off and never creates the index itself.
 *
 * This does NOT import the PlanCheckIn model (see migration 50 for why: with
 * autoIndex on, importing a model creates its indexes in production). It uses
 * the raw collections and connects with `autoIndex:false, autoCreate:false`.
 *
 * USAGE — invoke ts-node directly, not through `npm run x -- --apply`
 * (PowerShell strips the bare `--` and you silently get a dry run).
 *
 *   npx ts-node src/migrations/52_dedupe_find_sport_trial_checkins.ts
 *   npx ts-node src/migrations/52_dedupe_find_sport_trial_checkins.ts --apply
 *   npx ts-node src/migrations/52_dedupe_find_sport_trial_checkins.ts --down --apply
 *
 * `--down` only drops the index; it cannot un-abandon the superseded records
 * (they were duplicates, and their notifications are gone).
 */

type Db = mongoose.mongo.Db;

interface Options {
  apply?: boolean;
}

interface LiveIndex {
  name?: string;
  key?: Record<string, unknown>;
  unique?: boolean;
  partialFilterExpression?: Record<string, unknown>;
}

const {
  name: INDEX_NAME,
  key: INDEX_KEY,
  partialFilterExpression: INDEX_FILTER,
} = ACTIVE_FIND_SPORT_TRIAL_INDEX;

const liveIndex = async (db: Db): Promise<LiveIndex | undefined> => {
  const indexes = (await db
    .collection("plancheckins")
    .indexes()
    .catch(() => [])) as LiveIndex[];
  return indexes.find((index) => index.name === INDEX_NAME);
};

export const up = async (
  options: Options = {},
  db: Db = mongoose.connection.db as unknown as Db
) => {
  const apply = Boolean(options.apply);
  console.log(`Starting migration 52: find-sport trial dedupe (${apply ? "APPLY" : "DRY RUN"})...`);

  const checkIns = db.collection("plancheckins");
  const notifications = db.collection("schedulednotifications");

  // Step 0: a trial whose nudge has already gone out is `due`, not `active`.
  // The scheduler never made that move, so every sent trial is still `active`,
  // and treating those as waiting would both mis-dedupe them and make the index
  // refuse a legitimate new trial. Keyed on the notification actually being SENT
  // rather than on the date, so a late scheduler can't mislabel one.
  const sentCheckInIds = (
    await notifications
      .find({ type: "PLAN_CHECKIN", status: "SENT" }, { projection: { "data.checkInId": 1 } })
      .toArray()
  )
    .map((n) => (n.data as { checkInId?: string } | undefined)?.checkInId)
    .filter((id): id is string => typeof id === "string" && mongoose.isValidObjectId(id))
    .map((id) => new mongoose.Types.ObjectId(id));

  const stale = await checkIns.countDocuments({
    _id: { $in: sentCheckInIds },
    source: "find_sport_trial",
    status: "active",
  });
  console.log(`  ${stale} active trial(s) already nudged → ${apply ? "marking" : "to mark"} due`);
  if (apply && stale > 0) {
    await checkIns.updateMany(
      { _id: { $in: sentCheckInIds }, source: "find_sport_trial", status: "active" },
      { $set: { status: "due" } }
    );
  }

  // Newest first inside each group, so index 0 is the keeper.
  const groups = await checkIns
    .aggregate([
      // Excluding the already-nudged ones keeps a dry run honest: it has not
      // flipped them to `due` yet, but they are not duplicates of anything waiting.
      {
        $match: {
          source: "find_sport_trial",
          status: "active",
          _id: { $nin: sentCheckInIds },
        },
      },
      { $sort: { createdAt: -1, _id: -1 } },
      {
        $group: {
          _id: { userId: "$userId", dependentId: { $ifNull: ["$dependentId", null] } },
          ids: { $push: "$_id" },
          count: { $sum: 1 },
        },
      },
      { $match: { count: { $gt: 1 } } },
    ])
    .toArray();

  let superseded = 0;
  let cancelledNudges = 0;

  for (const group of groups) {
    const [keep, ...extras] = group.ids as mongoose.Types.ObjectId[];
    superseded += extras.length;

    const extraIds = extras.map((id) => id.toString());
    const pending = await notifications.countDocuments({
      type: "PLAN_CHECKIN",
      status: "PENDING",
      "data.checkInId": { $in: extraIds },
    });
    cancelledNudges += pending;

    console.log(
      `  user ${group._id.userId} child ${group._id.dependentId ?? "(none)"}: ` +
        `keep ${keep}, supersede ${extras.length}, cancel ${pending} queued nudge(s)`
    );

    if (!apply) continue;

    await notifications.updateMany(
      { type: "PLAN_CHECKIN", status: "PENDING", "data.checkInId": { $in: extraIds } },
      { $set: { status: "CANCELLED" } }
    );
    await checkIns.updateMany(
      { _id: { $in: extras } },
      {
        $set: {
          status: "abandoned",
          outcomeNote: "Superseded duplicate trial check-in (migration 52).",
          respondedAt: new Date(),
        },
      }
    );
  }

  console.log(
    `  ${groups.length} child(ren) with duplicates: ${superseded} check-in(s) ` +
      `${apply ? "superseded" : "to supersede"}, ${cancelledNudges} nudge(s) ` +
      `${apply ? "cancelled" : "to cancel"}`
  );

  const live = await liveIndex(db);
  const correct =
    live &&
    live.unique === true &&
    isDeepStrictEqual(Object.entries(live.key ?? {}), Object.entries(INDEX_KEY)) &&
    isDeepStrictEqual(live.partialFilterExpression, INDEX_FILTER);

  if (correct) {
    console.log(`  [skip] ${INDEX_NAME} — already correct`);
  } else if (live) {
    // Same name, different shape: leave it for a human rather than guess.
    throw new Error(`${INDEX_NAME} exists with a different definition; resolve by hand.`);
  } else if (!apply) {
    console.log(`  [would create] ${INDEX_NAME}`);
  } else {
    console.log(`  [creating] ${INDEX_NAME}...`);
    await checkIns.createIndex(INDEX_KEY, {
      name: INDEX_NAME,
      unique: true,
      partialFilterExpression: INDEX_FILTER,
    });
  }

  console.log(apply ? "Migration 52 complete." : "Dry run complete — re-run with --apply.");
};

export const down = async (
  options: Options = {},
  db: Db = mongoose.connection.db as unknown as Db
) => {
  const apply = Boolean(options.apply);
  console.log(`Reverting migration 52 (${apply ? "APPLY" : "DRY RUN"})...`);
  console.log("  NOTE: superseded check-ins are not restored; only the index is dropped.");

  if (!(await liveIndex(db))) {
    console.log(`  [skip] ${INDEX_NAME} — not present`);
  } else if (!apply) {
    console.log(`  [would drop] ${INDEX_NAME}`);
  } else {
    console.log(`  [dropping] ${INDEX_NAME}...`);
    await db.collection("plancheckins").dropIndex(INDEX_NAME);
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

  void mongoose
    .connect(uri, { autoIndex: false, autoCreate: false })
    .then(async () => {
      console.log(`Target database: ${mongoose.connection.name} on ${mongoose.connection.host}`);
      await (isDown ? down(options) : up(options));
    })
    .then(() => mongoose.disconnect())
    .then(() => process.exit(0))
    .catch((error: unknown) => {
      console.error("Migration 52 failed:", error);
      process.exit(1);
    });
}
