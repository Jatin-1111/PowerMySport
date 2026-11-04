/* eslint-disable @typescript-eslint/no-var-requires */
// The dummy-data script runs against the one production database. Two helpers decide
// what it may do: `moneyFor` says whether an account has records that must survive,
// and `referencesTo` reports what still names a deleted account. Both are pinned here.
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
const { moneyFor, referencesTo } = require("../scripts/deleteDummyParentData");
const redis = require("../config/redis").default;

let mongod: any;
let db: any;
const oid = () => new mongoose.Types.ObjectId();

const COLLECTIONS = [
  "bookings",
  "bookingpaymenttransactions",
  "orders",
  "expertsessions",
  "coachsubscriptions",
  "wallets",
  "players",
  "guidancesubmissions",
  "communitymessages",
];

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
  for (const name of COLLECTIONS) await db.collection(name).deleteMany({});
});

describe("moneyFor", () => {
  it("is empty for an account with no money records", async () => {
    const id = oid();
    await db.collection("players").insertOne({ userId: id });
    assert.deepEqual(await moneyFor(id), {});
  });

  it("reports a booking", async () => {
    const id = oid();
    await db.collection("bookings").insertOne({ userId: id });
    assert.deepEqual(await moneyFor(id), { bookings: 1 });
  });

  it("reports every kind of money record, each by name", async () => {
    const id = oid();
    await db.collection("bookingpaymenttransactions").insertOne({ userId: id });
    await db.collection("orders").insertOne({ userId: id });
    await db.collection("expertsessions").insertOne({ userId: id });
    await db.collection("coachsubscriptions").insertOne({ userId: id });
    assert.deepEqual(await moneyFor(id), {
      bookingpaymenttransactions: 1,
      orders: 1,
      expertsessions: 1,
      coachsubscriptions: 1,
    });
  });

  it("ignores a wallet with nothing in it but reports one with a balance", async () => {
    const empty = oid();
    const funded = oid();
    await db.collection("wallets").insertMany([
      { userId: empty, balance: 0 },
      { userId: funded, balance: 500 },
    ]);
    assert.deepEqual(await moneyFor(empty), {});
    assert.deepEqual(await moneyFor(funded), { wallets: 1 });
  });

  it("does not count another account's money", async () => {
    const mine = oid();
    await db.collection("bookings").insertOne({ userId: oid() });
    assert.deepEqual(await moneyFor(mine), {});
  });
});

describe("referencesTo", () => {
  it("counts rows that name the accounts, by collection and field", async () => {
    const a = oid();
    const b = oid();
    await db.collection("players").insertMany([{ userId: a }, { userId: a }, { userId: b }]);
    await db.collection("communitymessages").insertOne({ senderId: a });

    assert.deepEqual(await referencesTo([a]), {
      "players.userId": 2,
      "communitymessages.senderId": 1,
    });
  });

  it("is empty when nothing names them", async () => {
    await db.collection("players").insertOne({ userId: oid() });
    assert.deepEqual(await referencesTo([oid()]), {});
  });
});
