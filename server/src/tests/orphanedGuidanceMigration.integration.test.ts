/* eslint-disable @typescript-eslint/no-var-requires */
// Migration 61: removes guidance submissions (and their chats) whose child is gone,
// and leaves everything else alone, including submissions whose OWNER is gone.
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
const { up } = require("../migrations/61_remove_guidance_for_deleted_children");
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
  for (const name of ["players", "users", "guidancesubmissions", "guidancechatsessions"]) {
    await db.collection(name).deleteMany({});
  }
});

const seed = async () => {
  const userId = oid();
  const goneUserId = oid();
  const liveChild = oid();
  const goneChild = oid();
  await db.collection("users").insertOne({ _id: userId });
  await db.collection("players").insertOne({ _id: liveChild, userId, type: "DEPENDENT" });

  const keepChild = oid();
  const orphan = oid();
  const noChild = oid();
  const guest = oid();
  const ownerGone = oid();
  await db.collection("guidancesubmissions").insertMany([
    { _id: keepChild, userId, request: { dependent_id: liveChild } },
    { _id: orphan, userId, request: { dependent_id: goneChild } },
    { _id: noChild, userId, request: { child_age: 11 } },
    { _id: guest, request: { child_age: 9 } },
    { _id: ownerGone, userId: goneUserId, request: { child_age: 10 } },
  ]);
  await db.collection("guidancechatsessions").insertMany([
    { submissionId: orphan, userId },
    { submissionId: keepChild, userId },
  ]);
  return { keepChild, orphan, noChild, guest, ownerGone };
};

const remaining = async () =>
  (await db.collection("guidancesubmissions").find({}).toArray()).map((r: any) => String(r._id));

describe("migration 61", () => {
  it("only counts on a dry run", async () => {
    await seed();
    await up({}, db);

    assert.equal(await db.collection("guidancesubmissions").countDocuments({}), 5);
    assert.equal(await db.collection("guidancechatsessions").countDocuments({}), 2);
  });

  it("removes the submission that names a deleted child, with its chat", async () => {
    const { orphan } = await seed();
    await up({ apply: true }, db);

    assert.equal((await remaining()).includes(String(orphan)), false);
    assert.equal(
      await db.collection("guidancechatsessions").countDocuments({ submissionId: orphan }),
      0
    );
  });

  it("keeps a live child's submission and its chat", async () => {
    const { keepChild } = await seed();
    await up({ apply: true }, db);

    assert.equal((await remaining()).includes(String(keepChild)), true);
    assert.equal(
      await db.collection("guidancechatsessions").countDocuments({ submissionId: keepChild }),
      1
    );
  });

  it("never touches a submission with no child, a guest's, or one whose owner is gone", async () => {
    const { noChild, guest, ownerGone } = await seed();
    await up({ apply: true }, db);

    const left = await remaining();
    for (const id of [noChild, guest, ownerGone]) assert.equal(left.includes(String(id)), true);
    assert.equal(left.length, 4);
  });

  it("is idempotent", async () => {
    await seed();
    await up({ apply: true }, db);
    await up({ apply: true }, db);

    assert.equal(await db.collection("guidancesubmissions").countDocuments({}), 4);
  });
});
