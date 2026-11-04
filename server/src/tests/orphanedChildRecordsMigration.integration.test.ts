/* eslint-disable @typescript-eslint/no-var-requires */
// Migration 59: removes check-ins and pathway profiles whose child is gone, and
// leaves everything that still has a child, or has no child at all.
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
const { up } = require("../migrations/59_remove_orphaned_child_records");
const redis = require("../config/redis").default;

let mongod: any;
let db: any;
const oid = () => new mongoose.Types.ObjectId();

before(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
  db = mongoose.connection.db;
});

after(async () => {
  await mongoose.disconnect();
  await mongod.stop();
  redis.disconnect();
});

beforeEach(async () => {
  for (const name of ["players", "plancheckins", "userpathwayprofiles", "schedulednotifications"]) {
    await db.collection(name).deleteMany({});
  }
});

const seed = async () => {
  const userId = oid();
  const liveChild = oid();
  const goneChild = oid();
  await db.collection("players").insertOne({ _id: liveChild, userId, type: "DEPENDENT" });

  const keep = oid();
  const orphan = oid();
  const forSelf = oid();
  await db.collection("plancheckins").insertMany([
    { _id: keep, userId, dependentId: liveChild, status: "active" },
    { _id: orphan, userId, dependentId: goneChild, status: "due" },
    { _id: forSelf, userId, status: "active" },
  ]);
  await db.collection("schedulednotifications").insertMany([
    { type: "PLAN_CHECKIN", status: "PENDING", data: { checkInId: String(orphan) } },
    { type: "PLAN_CHECKIN", status: "SENT", data: { checkInId: String(orphan) } },
    { type: "PLAN_CHECKIN", status: "PENDING", data: { checkInId: String(keep) } },
  ]);
  await db
    .collection("userpathwayprofiles")
    .insertMany([
      { userId, dependentId: liveChild },
      { userId, dependentId: goneChild },
      { userId },
    ]);
  return { keep, forSelf };
};

describe("migration 59", () => {
  it("only counts on a dry run", async () => {
    await seed();
    await up({}, db);

    assert.equal(await db.collection("plancheckins").countDocuments({}), 3);
    assert.equal(await db.collection("userpathwayprofiles").countDocuments({}), 3);
    assert.equal(await db.collection("schedulednotifications").countDocuments({}), 3);
  });

  it("removes only the orphans, with their pending emails, and keeps sent history", async () => {
    const { keep, forSelf } = await seed();
    await up({ apply: true }, db);

    const remaining = (await db.collection("plancheckins").find({}).toArray()).map((r: any) =>
      String(r._id)
    );
    assert.deepEqual(remaining.sort(), [String(keep), String(forSelf)].sort());
    assert.equal(await db.collection("userpathwayprofiles").countDocuments({}), 2);

    const notes = await db.collection("schedulednotifications").find({}).toArray();
    assert.equal(notes.length, 2);
    assert.ok(notes.some((n: any) => n.status === "SENT"));
    assert.ok(notes.some((n: any) => n.data.checkInId === String(keep)));
  });

  it("is idempotent", async () => {
    await seed();
    await up({ apply: true }, db);
    await up({ apply: true }, db);

    assert.equal(await db.collection("plancheckins").countDocuments({}), 2);
  });
});
