/* eslint-disable @typescript-eslint/no-var-requires */
// Integration tests for the find-sport trial check-in. Retaking the wizard used
// to queue a new check-in (and a new in-app card + email) on every run, so one
// child got "How's Badminton going?" several times. In-memory MongoDB, because
// local dev points at the live cluster.
process.env.JWT_SECRET = "test-secret-test-secret-test-secret-1234567890";

import assert = require("node:assert/strict");
const { after, before, beforeEach, describe, it } = require("node:test");
const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");

const { PlanCheckIn } = require("../shared/models/PlanCheckIn");
const { ScheduledNotification } = require("../client/models/ScheduledNotification");
const { PlanCheckInService } = require("../shared/services/PlanCheckInService");
const { ScheduledNotificationService } = require("../client/services/ScheduledNotificationService");
const { User } = require("../client/models/User");
const { up: dedupeMigration } = require("../migrations/52_dedupe_find_sport_trial_checkins");

const oid = () => new mongoose.Types.ObjectId();
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

let mongod: any;

before(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
  await PlanCheckIn.init(); // build the partial unique index
});

after(async () => {
  await mongoose.disconnect();
  await mongod.stop();
});

beforeEach(async () => {
  await PlanCheckIn.deleteMany({});
  await ScheduledNotification.deleteMany({});
  await User.collection.deleteMany({});
});

const trial = (
  userId: any,
  dependentId: any,
  sport: string,
  title = `We recommended ${sport}`
) => ({
  userId,
  dependentId,
  sport,
  title,
  signals: [`watch ${sport}`],
  checkInDueAt: new Date(Date.now() + 4 * WEEK_MS),
});

describe("PlanCheckInService.scheduleFindSportTrial", () => {
  it("creates one check-in and one queued nudge the first time", async () => {
    const userId = oid();
    const dependentId = oid();

    await PlanCheckInService.scheduleFindSportTrial(trial(userId, dependentId, "Badminton"));

    assert.equal(await PlanCheckIn.countDocuments({ userId }), 1);
    assert.equal(await ScheduledNotification.countDocuments({ userId, status: "PENDING" }), 1);
  });

  it("reuses the active trial on a retake instead of queuing another", async () => {
    const userId = oid();
    const dependentId = oid();

    const first = await PlanCheckInService.scheduleFindSportTrial(
      trial(userId, dependentId, "Badminton")
    );
    for (let i = 0; i < 3; i++) {
      await PlanCheckInService.scheduleFindSportTrial(trial(userId, dependentId, "Badminton"));
    }

    assert.equal(await PlanCheckIn.countDocuments({ userId }), 1);
    assert.equal(await ScheduledNotification.countDocuments({ userId }), 1);
    const [only] = await PlanCheckIn.find({ userId }).lean();
    assert.equal(only._id.toString(), first._id.toString());
  });

  it("keeps the original due date so retakes cannot push the nudge back", async () => {
    const userId = oid();
    const dependentId = oid();
    const first = await PlanCheckInService.scheduleFindSportTrial(
      trial(userId, dependentId, "Badminton")
    );

    await PlanCheckInService.scheduleFindSportTrial({
      ...trial(userId, dependentId, "Badminton"),
      checkInDueAt: new Date(Date.now() + 8 * WEEK_MS),
    });

    const [only] = await PlanCheckIn.find({ userId }).lean();
    assert.equal(only.checkInDueAt.getTime(), first.checkInDueAt.getTime());
  });

  it("follows a changed top sport, in the check-in and the queued nudge", async () => {
    const userId = oid();
    const dependentId = oid();
    await PlanCheckInService.scheduleFindSportTrial(trial(userId, dependentId, "Badminton"));

    await PlanCheckInService.scheduleFindSportTrial(trial(userId, dependentId, "Tennis"));

    const [checkIn] = await PlanCheckIn.find({ userId }).lean();
    assert.equal(checkIn.sport, "Tennis");
    const [nudge] = await ScheduledNotification.find({ userId }).lean();
    assert.equal(nudge.title, "How's Tennis going?");
    assert.equal(nudge.data.sport, "Tennis");
  });

  it("keeps separate trials for separate children", async () => {
    const userId = oid();
    await PlanCheckInService.scheduleFindSportTrial(trial(userId, oid(), "Badminton"));
    await PlanCheckInService.scheduleFindSportTrial(trial(userId, oid(), "Badminton"));

    assert.equal(await PlanCheckIn.countDocuments({ userId }), 2);
  });

  it("treats 'no child selected' as one slot, not as any child", async () => {
    const userId = oid();
    const dependentId = oid();
    await PlanCheckInService.scheduleFindSportTrial(trial(userId, dependentId, "Badminton"));

    await PlanCheckInService.scheduleFindSportTrial(trial(userId, null, "Badminton"));
    await PlanCheckInService.scheduleFindSportTrial(trial(userId, null, "Badminton"));

    assert.equal(await PlanCheckIn.countDocuments({ userId }), 2);
  });

  it("does not reuse a due check-in: the nudge already went out", async () => {
    const userId = oid();
    const dependentId = oid();
    const first = await PlanCheckInService.scheduleFindSportTrial(
      trial(userId, dependentId, "Badminton")
    );
    await PlanCheckIn.updateOne({ _id: first._id }, { $set: { status: "due" } });

    await PlanCheckInService.scheduleFindSportTrial(trial(userId, dependentId, "Badminton"));

    assert.equal(await PlanCheckIn.countDocuments({ userId }), 2);
  });

  it("produces a single record when runs race", async () => {
    const userId = oid();
    const dependentId = oid();

    await Promise.all(
      Array.from({ length: 6 }, () =>
        PlanCheckInService.scheduleFindSportTrial(trial(userId, dependentId, "Badminton"))
      )
    );

    assert.equal(await PlanCheckIn.countDocuments({ userId, status: "active" }), 1);
    assert.equal(await ScheduledNotification.countDocuments({ userId, status: "PENDING" }), 1);
  });
});

describe("when the nudge is sent", () => {
  const sendDueNudges = async (userId: any) => {
    await User.collection.insertOne({
      _id: userId,
      name: "Parent Test",
      email: `${userId.toString()}@example.test`,
    });
    // Make the queued nudge due now. No channels: nothing real gets sent.
    await ScheduledNotification.updateMany(
      { userId },
      {
        $set: {
          scheduledFor: new Date(Date.now() - 1000),
          channels: { email: false, push: false, inApp: false },
        },
      }
    );
    return ScheduledNotificationService.processPendingReminders();
  };

  it("moves the check-in from active to due", async () => {
    const userId = oid();
    const first = await PlanCheckInService.scheduleFindSportTrial(
      trial(userId, oid(), "Badminton")
    );

    const stats = await sendDueNudges(userId);

    assert.equal(stats.sent, 1);
    assert.equal((await PlanCheckIn.findById(first._id).lean()).status, "due");
  });

  it("a retake after the nudge went out starts a fresh trial and nudge", async () => {
    const userId = oid();
    const dependentId = oid();
    await PlanCheckInService.scheduleFindSportTrial(trial(userId, dependentId, "Badminton"));
    await sendDueNudges(userId);

    await PlanCheckInService.scheduleFindSportTrial(trial(userId, dependentId, "Badminton"));

    assert.equal(await PlanCheckIn.countDocuments({ userId }), 2);
    assert.equal(await PlanCheckIn.countDocuments({ userId, status: "active" }), 1);
    assert.equal(await ScheduledNotification.countDocuments({ userId, status: "PENDING" }), 1);
  });
});

describe("migration 52", () => {
  it("marks already-nudged trials due and does not count them as duplicates", async () => {
    await PlanCheckIn.collection.dropIndex("one_active_find_sport_trial_per_child").catch(() => {});
    const userId = oid();
    const dependentId = oid();

    // Three trials, all still `active` (the old behaviour), each with a SENT nudge.
    const sent: any[] = [];
    for (let i = 0; i < 3; i++) {
      const _id = oid();
      sent.push(_id);
      await PlanCheckIn.collection.insertOne({
        _id,
        userId,
        dependentId,
        source: "find_sport_trial",
        sport: "Badminton",
        title: "t",
        signals: [],
        checkInDueAt: new Date(Date.now() - WEEK_MS),
        status: "active",
        createdAt: new Date(Date.now() - (5 - i) * WEEK_MS),
        updatedAt: new Date(),
      });
      await ScheduledNotification.collection.insertOne({
        userId,
        type: "PLAN_CHECKIN",
        interval: "CUSTOM",
        scheduledFor: new Date(Date.now() - WEEK_MS),
        status: "SENT",
        title: "How's Badminton going?",
        body: "t",
        data: { checkInId: _id.toString() },
        channels: { email: true, inApp: true },
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }

    await dedupeMigration({ apply: true }, mongoose.connection.db);

    assert.equal(await PlanCheckIn.countDocuments({ userId, status: "due" }), 3);
    assert.equal(await PlanCheckIn.countDocuments({ userId, status: "abandoned" }), 0);
    // Index built fine, and a new trial is allowed now that none are waiting.
    await PlanCheckInService.scheduleFindSportTrial(trial(userId, dependentId, "Badminton"));
    assert.equal(await PlanCheckIn.countDocuments({ userId, status: "active" }), 1);
  });

  const seedDuplicates = async (userId: any, dependentId: any, count: number) => {
    const ids: any[] = [];
    for (let i = 0; i < count; i++) {
      const _id = oid();
      ids.push(_id);
      // Raw inserts: the unique index (rightly) refuses these through the model path.
      await PlanCheckIn.collection.insertOne({
        _id,
        userId,
        dependentId,
        source: "find_sport_trial",
        sport: "Badminton",
        title: "We recommended Badminton",
        signals: [],
        checkInDueAt: new Date(Date.now() + 4 * WEEK_MS),
        status: "active",
        createdAt: new Date(Date.now() - (count - i) * 60 * 60 * 1000), // later i = newer
        updatedAt: new Date(),
      });
      await ScheduledNotification.collection.insertOne({
        userId,
        type: "PLAN_CHECKIN",
        interval: "CUSTOM",
        scheduledFor: new Date(Date.now() + 4 * WEEK_MS),
        status: "PENDING",
        title: "How's Badminton going?",
        body: "We recommended Badminton",
        data: { checkInId: _id.toString(), sport: "Badminton", signals: [] },
        channels: { email: true, inApp: true },
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }
    return ids;
  };

  const dropGuard = async () => {
    await PlanCheckIn.collection.dropIndex("one_active_find_sport_trial_per_child").catch(() => {});
  };

  it("dry run changes nothing", async () => {
    await dropGuard();
    const userId = oid();
    await seedDuplicates(userId, oid(), 3);

    await dedupeMigration({ apply: false }, mongoose.connection.db);

    assert.equal(await PlanCheckIn.countDocuments({ userId, status: "active" }), 3);
    assert.equal(await ScheduledNotification.countDocuments({ userId, status: "PENDING" }), 3);
  });

  it("keeps the newest, supersedes the rest, cancels their nudges, then builds the index", async () => {
    await dropGuard();
    const userId = oid();
    const dependentId = oid();
    const ids = await seedDuplicates(userId, dependentId, 4);
    const newest = ids[ids.length - 1];

    await dedupeMigration({ apply: true }, mongoose.connection.db);

    const active = await PlanCheckIn.find({ userId, status: "active" }).lean();
    assert.equal(active.length, 1);
    assert.equal(active[0]._id.toString(), newest.toString());
    assert.equal(await PlanCheckIn.countDocuments({ userId, status: "abandoned" }), 3);

    const pending = await ScheduledNotification.find({ userId, status: "PENDING" }).lean();
    assert.equal(pending.length, 1);
    assert.equal(pending[0].data.checkInId, newest.toString());
    assert.equal(await ScheduledNotification.countDocuments({ userId, status: "CANCELLED" }), 3);

    // The guard now exists, so another duplicate is refused outright.
    await assert.rejects(() =>
      PlanCheckIn.collection.insertOne({
        userId,
        dependentId,
        source: "find_sport_trial",
        sport: "Badminton",
        title: "dup",
        signals: [],
        checkInDueAt: new Date(),
        status: "active",
      })
    );
  });

  it("is idempotent", async () => {
    await dropGuard();
    const userId = oid();
    await seedDuplicates(userId, oid(), 2);

    await dedupeMigration({ apply: true }, mongoose.connection.db);
    await dedupeMigration({ apply: true }, mongoose.connection.db);

    assert.equal(await PlanCheckIn.countDocuments({ userId, status: "active" }), 1);
  });
});
