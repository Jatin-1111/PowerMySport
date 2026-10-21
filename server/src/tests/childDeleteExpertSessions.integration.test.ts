/* eslint-disable @typescript-eslint/no-var-requires */
// What deleting a child does to their expert sessions.
//
// A session that is still ahead of us (paid, scheduled, or a live payment hold) blocks the
// delete: the expert prepares from the child's profile and a paid session must not lose
// who it was for. Sessions that are over keep the child's name and age and lose the link,
// so the history still reads while the profile itself goes.
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
const { ExpertSession } = require("../client/models/ExpertBooking");
const { playerForSession } = require("../client/services/ExpertsService/shared");
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
  for (const model of [Player, User, ExpertSession]) await model.collection.deleteMany({});
});

let counter = 0;

const seedParentAndChild = async () => {
  const userId = oid();
  counter += 1;
  await User.collection.insertOne({
    _id: userId,
    name: "Parent Person",
    email: `parent-${userId}@test.com`,
    phone: `8${String(counter).padStart(9, "0")}`,
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

const seedSession = async (
  userId: any,
  childId: any,
  fields: Record<string, unknown>
): Promise<any> => {
  const _id = oid();
  await ExpertSession.collection.insertOne({
    _id,
    expertId: oid(),
    userId,
    playerId: childId,
    amount: 500,
    merchantOrderId: `EXP_${_id}`,
    ...fields,
  });
  return _id;
};

const sessionRow = (id: any) => ExpertSession.collection.findOne({ _id: id });

describe("deleting a child who has expert sessions", () => {
  for (const status of ["PAID", "SCHEDULED"]) {
    it(`is refused while a ${status} session is open, and nothing changes`, async () => {
      const { userId, childId } = await seedParentAndChild();
      const sessionId = await seedSession(userId, childId, {
        status,
        paymentStatus: "COMPLETED",
      });

      await assert.rejects(
        () => deleteDependent(String(userId), String(childId)),
        (error: any) => error.statusCode === 409 && /expert session/.test(error.message)
      );

      assert.ok(await Player.collection.findOne({ _id: childId }));
      assert.equal(String((await sessionRow(sessionId)).playerId), String(childId));
    });
  }

  it("is refused while an unpaid hold is still live", async () => {
    const { userId, childId } = await seedParentAndChild();
    await seedSession(userId, childId, {
      status: "PENDING_PAYMENT",
      paymentStatus: "PENDING",
      holdExpiresAt: new Date(Date.now() + 10 * 60_000),
    });

    await assert.rejects(() => deleteDependent(String(userId), String(childId)), /expert session/);
    assert.ok(await Player.collection.findOne({ _id: childId }));
  });

  it("goes through once the hold has expired", async () => {
    const { userId, childId } = await seedParentAndChild();
    await seedSession(userId, childId, {
      status: "PENDING_PAYMENT",
      paymentStatus: "PENDING",
      holdExpiresAt: new Date(Date.now() - 60_000),
    });

    await deleteDependent(String(userId), String(childId));

    assert.equal(await Player.collection.findOne({ _id: childId }), null);
  });

  it("keeps the name and age on finished sessions and clears the link", async () => {
    const { userId, childId } = await seedParentAndChild();
    const done = await seedSession(userId, childId, {
      status: "COMPLETED",
      paymentStatus: "COMPLETED",
    });
    const cancelled = await seedSession(userId, childId, {
      status: "CANCELLED",
      paymentStatus: "COMPLETED",
    });

    await deleteDependent(String(userId), String(childId));

    assert.equal(await Player.collection.findOne({ _id: childId }), null);
    for (const id of [done, cancelled]) {
      const row = await sessionRow(id);
      assert.equal("playerId" in row, false);
      assert.deepEqual(row.playerSnapshot, { name: "Riya", age: 11 });
    }
  });

  it("leaves a sibling's sessions alone", async () => {
    const { userId, childId } = await seedParentAndChild();
    const siblingId = oid();
    await Player.collection.insertOne({
      _id: siblingId,
      userId,
      type: "DEPENDENT",
      name: "Meera",
      age: 9,
    });
    const siblingSession = await seedSession(userId, siblingId, {
      status: "SCHEDULED",
      paymentStatus: "COMPLETED",
    });
    await seedSession(userId, childId, { status: "COMPLETED", paymentStatus: "COMPLETED" });

    await deleteDependent(String(userId), String(childId));

    const row = await sessionRow(siblingSession);
    assert.equal(String(row.playerId), String(siblingId));
    assert.equal(row.playerSnapshot, undefined);
  });
});

describe("showing who a session was about", () => {
  it("uses the live briefing while the profile exists", () => {
    const summaries = new Map([["c1", { name: "Riya", age: 12 }]]);
    assert.deepEqual(playerForSession({ playerId: "c1" }, summaries), { name: "Riya", age: 12 });
  });

  it("falls back to the kept name and age, marked as removed", () => {
    const view = playerForSession({ playerSnapshot: { name: "Riya", age: 11 } }, new Map());
    assert.deepEqual(view, { name: "Riya", age: 11, removed: true });
  });

  it("shows nothing for a session that was never about a child", () => {
    assert.equal(playerForSession({}, new Map()), undefined);
  });
});
