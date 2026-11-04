/* eslint-disable @typescript-eslint/no-var-requires */
// cascadeDeleteUserData is the one list of what is removed when a user goes. Both
// the real account deletion and the dummy-data script call it, so this pins what it
// removes, what it must leave (money), and that it never touches the User itself.
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

const {
  cascadeDeleteUserData,
  finalizeAccountDeletion,
} = require("../shared/services/AuthService/accountDeletion");
const redis = require("../config/redis").default;

let mongod: any;
let db: any;
const oid = () => new mongoose.Types.ObjectId();

const OWNED = [
  ["players", "userId"],
  ["guidancesubmissions", "userId"],
  ["guidancechatsessions", "userId"],
  ["roadmapchatsessions", "userId"],
  ["assistantchatsessions", "userId"],
  ["plancheckins", "userId"],
  ["seasonplans", "userId"],
  ["notifications", "userId"],
  ["usercalendarevents", "userId"],
] as const;

// Rows a user's account must outlive: money and the receipts for it.
const KEPT = [
  ["bookings", "userId"],
  ["bookingpaymenttransactions", "userId"],
  ["wallets", "userId"],
] as const;

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
  for (const [name] of [...OWNED, ...KEPT]) await db.collection(name).deleteMany({});
  await db.collection("users").deleteMany({});
});

const seed = async () => {
  const userId = oid();
  const otherId = oid();
  await db.collection("users").insertMany([
    // `phone` is unique, so two users without one collide as null once the index exists.
    {
      _id: userId,
      name: "Parent Person",
      email: `p-${userId}@test.com`,
      phone: `1${String(userId).slice(-9)}`,
      role: "Parent",
    },
    {
      _id: otherId,
      name: "Someone Else",
      email: `o-${otherId}@test.com`,
      phone: `2${String(otherId).slice(-9)}`,
      role: "Parent",
    },
  ]);
  for (const [name, field] of [...OWNED, ...KEPT]) {
    await db.collection(name).insertMany([{ [field]: userId }, { [field]: otherId }]);
  }
  return { userId, otherId };
};

const countFor = (collection: string, field: string, id: any) =>
  db.collection(collection).countDocuments({ [field]: id });

describe("cascadeDeleteUserData", () => {
  it("removes what the user owns across every collection it covers", async () => {
    const { userId } = await seed();
    await cascadeDeleteUserData(String(userId));

    for (const [name, field] of OWNED) {
      assert.equal(await countFor(name, field, userId), 0, name);
    }
  });

  it("leaves another user's rows alone", async () => {
    const { userId, otherId } = await seed();
    await cascadeDeleteUserData(String(userId));

    for (const [name, field] of OWNED) {
      assert.equal(await countFor(name, field, otherId), 1, name);
    }
  });

  it("leaves bookings, payment records and wallets, which must outlive an account", async () => {
    const { userId } = await seed();
    await cascadeDeleteUserData(String(userId));

    for (const [name, field] of KEPT) {
      assert.equal(await countFor(name, field, userId), 1, name);
    }
  });

  it("does not touch the user document itself", async () => {
    const { userId } = await seed();
    await cascadeDeleteUserData(String(userId));

    const user = await db.collection("users").findOne({ _id: userId });
    assert.equal(user.name, "Parent Person");
    assert.ok(user.email.startsWith("p-"));
  });

  it("is what the real account deletion runs: anonymizes the user, then removes the same rows", async () => {
    const { userId } = await seed();
    await finalizeAccountDeletion(String(userId));

    const user = await db.collection("users").findOne({ _id: userId });
    assert.equal(user.name, "Deleted User");
    for (const [name, field] of OWNED) {
      assert.equal(await countFor(name, field, userId), 0, name);
    }
    for (const [name, field] of KEPT) {
      assert.equal(await countFor(name, field, userId), 1, name);
    }
  });
});
