/* eslint-disable @typescript-eslint/no-var-requires */
// The admin Parent list shows how many children each parent has: a number, nothing
// about the children. These tests pin what counts and what does not.
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
const { childCountsFor } = require("../admin/controllers/statsController/users");
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
  await db.collection("players").deleteMany({});
});

const child = (userId: any) => ({
  userId,
  type: "DEPENDENT",
  name: "Riya",
  dob: new Date("2015-01-01"),
});

describe("childCountsFor", () => {
  it("counts each parent's children separately", async () => {
    const a = oid();
    const b = oid();
    await db.collection("players").insertMany([child(a), child(a), child(b)]);

    const counts = await childCountsFor([a, b]);
    assert.equal(counts.get(String(a)), 2);
    assert.equal(counts.get(String(b)), 1);
  });

  it("has no entry for a parent with no children, so the caller shows 0", async () => {
    const a = oid();
    assert.equal((await childCountsFor([a])).has(String(a)), false);
  });

  it("only looks at the parents asked about", async () => {
    const asked = oid();
    const other = oid();
    await db.collection("players").insertMany([child(asked), child(other), child(other)]);

    const counts = await childCountsFor([asked]);
    assert.equal(counts.size, 1);
    assert.equal(counts.get(String(other)), undefined);
  });

  it("accepts ids as strings", async () => {
    const a = oid();
    await db.collection("players").insertOne(child(a));

    assert.equal((await childCountsFor([String(a)])).get(String(a)), 1);
  });

  it("returns numbers only: no name, birth date or profile reaches admin", async () => {
    const a = oid();
    await db.collection("players").insertOne(child(a));

    const counts = await childCountsFor([a]);
    for (const value of counts.values()) assert.equal(typeof value, "number");
  });
});
