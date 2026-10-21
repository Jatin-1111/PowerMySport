/* eslint-disable @typescript-eslint/no-var-requires */
// What deleting a child does to their coaching records.
//
// A live enrolment (recurring subscription, a seat the coach counts on) and unused or
// refund-pending credits block the delete. A waiting-list place has no seat and no
// money, so it is cancelled. Everything finished stays as history.
process.env.JWT_SECRET = "test-secret-test-secret-test-secret-1234567890";
process.env.PHONEPE_CLIENT_ID = "test-client";
process.env.PHONEPE_CLIENT_SECRET = "test-secret";
process.env.PHONEPE_CLIENT_VERSION = "1";
process.env.PHONEPE_ENV = "SANDBOX";
process.env.REDIS_ENABLED = "false";

import assert = require("node:assert/strict");
const { after, before, beforeEach, describe, it } = require("node:test");
const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");

const { deleteDependent } = require("../shared/services/AuthService/dependents");
const { Player } = require("../client/models/Player");
const { User } = require("../client/models/User");
const { CoachEnrollment } = require("../client/models/CoachEnrollment");
const { CoachWaitlistEntry } = require("../client/models/CoachWaitlistEntry");
const { CoachSessionCredit } = require("../client/models/CoachSessionCredit");
const redis = require("../config/redis").default;

const oid = () => new mongoose.Types.ObjectId();

let mongod: any;

before(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
});

after(async () => {
  await mongoose.disconnect();
  await mongod.stop();
  redis.disconnect();
});

beforeEach(async () => {
  for (const model of [Player, User, CoachEnrollment, CoachWaitlistEntry, CoachSessionCredit]) {
    await model.collection.deleteMany({});
  }
});

let counter = 0;

const seed = async () => {
  const userId = oid();
  counter += 1;
  await User.collection.insertOne({
    _id: userId,
    name: "Parent Person",
    email: `parent-${userId}@test.com`,
    phone: `7${String(counter).padStart(9, "0")}`,
    role: "Parent",
    isActive: true,
  });
  const childId = oid();
  await Player.collection.insertOne({
    _id: childId,
    userId,
    type: "DEPENDENT",
    name: "Riya",
    age: 11,
  });
  return { userId, childId };
};

const insertEnrollment = async (userId: any, childId: any, fields: Record<string, unknown>) => {
  const _id = oid();
  await CoachEnrollment.collection.insertOne({
    _id,
    offeringId: oid(),
    coachId: oid(),
    userId,
    playerId: childId,
    studentName: "Riya",
    joinedAt: new Date(),
    ...fields,
  });
  return _id;
};

const insertWaitlist = async (userId: any, childId: any, status: string) => {
  const _id = oid();
  await CoachWaitlistEntry.collection.insertOne({
    _id,
    offeringId: oid(),
    coachId: oid(),
    userId,
    playerId: childId,
    studentName: "Riya",
    status,
    notifyCount: 0,
    joinedAt: new Date(),
  });
  return _id;
};

const insertCredit = async (userId: any, childId: any, status: string) => {
  const _id = oid();
  await CoachSessionCredit.collection.insertOne({
    _id,
    enrollmentId: oid(),
    offeringId: oid(),
    coachId: oid(),
    userId,
    playerId: childId,
    periodStart: new Date(),
    periodEnd: new Date(Date.now() + 30 * 86_400_000),
    valuePaise: 50_000,
    status,
  });
  return _id;
};

const refused = (userId: any, childId: any, pattern: RegExp) =>
  assert.rejects(
    () => deleteDependent(String(userId), String(childId)),
    (error: any) => error.statusCode === 409 && pattern.test(error.message)
  );

describe("coach enrolments", () => {
  for (const status of ["ACTIVE", "PAUSED"]) {
    it(`a ${status} enrolment blocks the delete, and nothing changes`, async () => {
      const { userId, childId } = await seed();
      await insertEnrollment(userId, childId, { status });

      await refused(userId, childId, /coaching enrolment/);

      assert.ok(await Player.collection.findOne({ _id: childId }));
    });
  }

  it("an unpaid seat hold that is still live blocks the delete", async () => {
    const { userId, childId } = await seed();
    await insertEnrollment(userId, childId, {
      status: "PENDING",
      holdExpiresAt: new Date(Date.now() + 10 * 60_000),
    });

    await refused(userId, childId, /coaching enrolment/);
  });

  it("an unpaid hold that has expired does not", async () => {
    const { userId, childId } = await seed();
    await insertEnrollment(userId, childId, {
      status: "PENDING",
      holdExpiresAt: new Date(Date.now() - 60_000),
    });

    await deleteDependent(String(userId), String(childId));

    assert.equal(await Player.collection.findOne({ _id: childId }), null);
  });

  it("cancelled and completed enrolments do not, and stay as history", async () => {
    const { userId, childId } = await seed();
    const cancelled = await insertEnrollment(userId, childId, { status: "CANCELLED" });
    const completed = await insertEnrollment(userId, childId, { status: "COMPLETED" });

    await deleteDependent(String(userId), String(childId));

    for (const id of [cancelled, completed]) {
      const row = await CoachEnrollment.collection.findOne({ _id: id });
      assert.equal(row.studentName, "Riya");
    }
  });

  it("another child's enrolment does not block this child", async () => {
    const { userId, childId } = await seed();
    await insertEnrollment(userId, oid(), { status: "ACTIVE" });

    await deleteDependent(String(userId), String(childId));

    assert.equal(await Player.collection.findOne({ _id: childId }), null);
  });
});

describe("coach credits", () => {
  for (const status of ["AVAILABLE", "REFUND_PENDING"]) {
    it(`a ${status} credit blocks the delete`, async () => {
      const { userId, childId } = await seed();
      await insertCredit(userId, childId, status);

      await refused(userId, childId, /credits or a refund/);

      assert.ok(await Player.collection.findOne({ _id: childId }));
    });
  }

  it("consumed, expired and refunded credits do not, and the ledger stays", async () => {
    const { userId, childId } = await seed();
    const ids = [];
    for (const status of ["CONSUMED", "EXPIRED", "REFUNDED"]) {
      ids.push(await insertCredit(userId, childId, status));
    }

    await deleteDependent(String(userId), String(childId));

    assert.equal(await CoachSessionCredit.collection.countDocuments({ _id: { $in: ids } }), 3);
  });
});

describe("coach waiting lists", () => {
  it("cancels a live place and leaves finished ones alone", async () => {
    const { userId, childId } = await seed();
    const waiting = await insertWaitlist(userId, childId, "WAITING");
    const notified = await insertWaitlist(userId, childId, "NOTIFIED");
    const converted = await insertWaitlist(userId, childId, "CONVERTED");

    await deleteDependent(String(userId), String(childId));

    for (const id of [waiting, notified]) {
      const row = await CoachWaitlistEntry.collection.findOne({ _id: id });
      assert.equal(row.status, "CANCELLED");
      assert.ok(row.leftAt);
    }
    assert.equal(
      (await CoachWaitlistEntry.collection.findOne({ _id: converted })).status,
      "CONVERTED"
    );
  });

  it("does not cancel another child's place", async () => {
    const { userId, childId } = await seed();
    const other = await insertWaitlist(userId, oid(), "WAITING");

    await deleteDependent(String(userId), String(childId));

    assert.equal((await CoachWaitlistEntry.collection.findOne({ _id: other })).status, "WAITING");
  });

  it("a refusal for another reason leaves the waiting-list place untouched", async () => {
    const { userId, childId } = await seed();
    const waiting = await insertWaitlist(userId, childId, "WAITING");
    await insertEnrollment(userId, childId, { status: "ACTIVE" });

    await refused(userId, childId, /coaching enrolment/);

    assert.equal((await CoachWaitlistEntry.collection.findOne({ _id: waiting })).status, "WAITING");
  });
});
