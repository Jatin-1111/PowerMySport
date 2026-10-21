/* eslint-disable @typescript-eslint/no-var-requires */
// Migration 62 drops the athlete stories collection, but only when every row is one a
// model generated. A row a person wrote must stop it.
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
const { up } = require("../migrations/62_drop_athlete_stories");
const redis = require("../config/redis").default;

let mongod: any;
let db: any;

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
  await db
    .collection("athletestories")
    .drop()
    .catch(() => undefined);
});

const exists = async () =>
  (await db.listCollections({ name: "athletestories" }, { nameOnly: true }).toArray()).length > 0;

describe("migration 62", () => {
  it("only counts on a dry run", async () => {
    await db
      .collection("athletestories")
      .insertMany([{ isAiGenerated: true }, { isAiGenerated: true }]);
    await up({}, db);

    assert.equal(await exists(), true);
    assert.equal(await db.collection("athletestories").countDocuments({}), 2);
  });

  it("drops a collection whose rows were all generated", async () => {
    await db
      .collection("athletestories")
      .insertMany([{ isAiGenerated: true }, { isAiGenerated: true }]);
    await up({ apply: true }, db);

    assert.equal(await exists(), false);
  });

  it("refuses to drop when a row was not generated", async () => {
    await db
      .collection("athletestories")
      .insertMany([{ isAiGenerated: true }, { isAiGenerated: false }]);

    await assert.rejects(up({ apply: true }, db), /non-generated/);
    assert.equal(await db.collection("athletestories").countDocuments({}), 2);
  });

  it("treats a row with no flag at all as not generated", async () => {
    await db.collection("athletestories").insertMany([{ name: "written by a person" }]);

    await assert.rejects(up({ apply: true }, db), /non-generated/);
    assert.equal(await exists(), true);
  });

  it("only reports on a dry run when a row was not generated, and drops nothing", async () => {
    await db.collection("athletestories").insertMany([{ isAiGenerated: false }]);
    await up({}, db);

    assert.equal(await exists(), true);
  });

  it("is idempotent once the collection is gone", async () => {
    await db.collection("athletestories").insertOne({ isAiGenerated: true });
    await up({ apply: true }, db);
    await up({ apply: true }, db);

    assert.equal(await exists(), false);
  });
});
