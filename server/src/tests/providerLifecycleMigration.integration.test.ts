// Migration 71 against a throwaway in-memory database named like production
// (the migration refuses any other name). It must fill `lifecycle`, change
// nothing else, and be safe to repeat.
import assert = require("node:assert/strict");
const { after, before, beforeEach, describe, it } = require("node:test");
const { MongoMemoryServer } = require("mongodb-memory-server");
const { MongoClient, ObjectId } = require("mongodb");

let mongod: { getUri(): string; stop(): Promise<void> };
let client: any;
let migration: {
  up: (o?: { apply?: boolean }) => Promise<any>;
  down: (o?: { apply?: boolean }) => Promise<number>;
};

const db = () => client.db("Powermysport");

before(async () => {
  mongod = await MongoMemoryServer.create();
  // Set before the migration module loads; dotenv never overwrites an existing value.
  process.env.MONGO_URI = `${mongod.getUri()}Powermysport`;
  client = new MongoClient(process.env.MONGO_URI);
  await client.connect();
  migration = require("../migrations/71_backfill_provider_lifecycle");
});

after(async () => {
  await client.close();
  await mongod.stop();
});

const UPDATED_AT = new Date("2026-01-01T00:00:00Z");

beforeEach(async () => {
  for (const name of ["coaches", "experts", "venues", "academies"]) {
    await db().collection(name).deleteMany({});
  }
  await db()
    .collection("coaches")
    .insertMany([
      {
        _id: new ObjectId(),
        verificationStatus: "VERIFIED",
        isVerified: true,
        updatedAt: UPDATED_AT,
      },
      {
        _id: new ObjectId(),
        verificationStatus: "PENDING",
        isVerified: false,
        updatedAt: UPDATED_AT,
      },
      // Already correct: must not be rewritten.
      {
        _id: new ObjectId(),
        verificationStatus: "REJECTED",
        lifecycle: "REJECTED",
        updatedAt: UPDATED_AT,
      },
    ]);
  await db().collection("experts").insertOne({
    _id: new ObjectId(),
    verificationStatus: "APPROVED",
    isActive: false,
    updatedAt: UPDATED_AT,
  });
  await db()
    .collection("venues")
    .insertMany([
      { _id: new ObjectId(), approvalStatus: "PENDING", documents: [], updatedAt: UPDATED_AT },
      {
        _id: new ObjectId(),
        approvalStatus: "PENDING",
        documents: [{ type: "X" }],
        updatedAt: UPDATED_AT,
      },
    ]);
  await db().collection("academies").insertOne({
    _id: new ObjectId(),
    onboardingCompleted: true,
    isApproved: false,
    rejectionReason: "Photos are missing",
    updatedAt: UPDATED_AT,
  });
});

const states = async (collection: string) =>
  (await db().collection(collection).find({}).toArray()).map((d: any) => d.lifecycle).sort();

describe("migration 71", () => {
  it("dry run reports the plan and writes nothing", async () => {
    const result = await migration.up({ apply: false });
    assert.equal(result.planned, 6);
    assert.equal(result.modified, 0);
    // sort() puts missing values last
    assert.deepEqual(await states("coaches"), ["REJECTED", undefined, undefined]);
    assert.deepEqual(await states("experts"), [undefined]);
  });

  it("apply fills lifecycle from the status fields", async () => {
    const result = await migration.up({ apply: true });
    assert.equal(result.modified, 6);
    assert.deepEqual(await states("coaches"), ["APPROVED", "REJECTED", "SUBMITTED"]);
    assert.deepEqual(await states("experts"), ["SUSPENDED"]);
    assert.deepEqual(await states("venues"), ["DRAFT", "SUBMITTED"]);
    assert.deepEqual(await states("academies"), ["REJECTED"]);
  });

  it("changes nothing but lifecycle, and leaves updatedAt alone", async () => {
    await migration.up({ apply: true });
    const coach = await db().collection("coaches").findOne({ verificationStatus: "VERIFIED" });
    assert.equal(coach.isVerified, true);
    assert.equal(coach.verificationStatus, "VERIFIED");
    assert.deepEqual(coach.updatedAt, UPDATED_AT);
    const expert = await db().collection("experts").findOne({});
    assert.equal(expert.isActive, false);
    assert.equal(expert.verificationStatus, "APPROVED");
  });

  it("is safe to repeat", async () => {
    await migration.up({ apply: true });
    const second = await migration.up({ apply: true });
    assert.equal(second.planned, 0);
    assert.equal(second.modified, 0);
  });

  it("down unsets the field again", async () => {
    await migration.up({ apply: true });
    const dry = await migration.down({ apply: false });
    assert.equal(dry, 7);
    assert.deepEqual(await states("experts"), ["SUSPENDED"]);

    await migration.down({ apply: true });
    assert.deepEqual(await states("experts"), [undefined]);
    assert.deepEqual(await states("coaches"), [undefined, undefined, undefined]);
  });

  it("refuses a database that is not named Powermysport", async () => {
    const saved = process.env.MONGO_URI;
    process.env.MONGO_URI = mongod.getUri(); // no database name
    try {
      await assert.rejects(() => migration.up({ apply: true }), /Powermysport/);
    } finally {
      process.env.MONGO_URI = saved;
    }
  });
});
