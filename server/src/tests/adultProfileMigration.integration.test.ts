/* eslint-disable @typescript-eslint/no-var-requires */
// Migration 65 and the adult's own sport details now living on the user.
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

const migration = require("../migrations/65_move_adult_sport_details_to_user");
const migration66 = require("../migrations/66_remove_player_type");
const { updateProfile } = require("../shared/services/AuthService/profile");
const { User } = require("../client/models/User");
const { Player } = require("../client/models/Player");
const redis = require("../config/redis").default;

const oid = () => new mongoose.Types.ObjectId();

let mongod: any;
let db: any;

before(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri(), { autoIndex: false, autoCreate: false });
  db = mongoose.connection.db;
});

after(async () => {
  await mongoose.disconnect();
  await mongod.stop();
  redis.disconnect();
});

beforeEach(async () => {
  for (const name of ["players", "users", "expertsessions"]) {
    await db
      .collection(name)
      .deleteMany({})
      .catch(() => undefined);
  }
});

let counter = 0;
const seedUser = async (fields: Record<string, unknown> = {}) => {
  const _id = oid();
  counter += 1;
  await db.collection("users").insertOne({
    _id,
    name: "Adult",
    email: `adult-${_id}@test.com`,
    phone: `6${String(counter).padStart(9, "0")}`,
    role: "Player",
    isActive: true,
    ...fields,
  });
  return _id;
};

const quietly = async <T>(run: () => Promise<T>): Promise<{ result: T; lines: string[] }> => {
  const log = console.log;
  const lines: string[] = [];
  console.log = (line: string) => lines.push(String(line));
  try {
    return { result: await run(), lines };
  } finally {
    console.log = log;
  }
};

const run = (apply: boolean) =>
  quietly<any>(() => migration.up({ apply }, db)).then(({ result }) => result);

describe("migration 65", () => {
  it("a dry run changes nothing and says what it would do", async () => {
    const owner = await seedUser();
    await db.collection("players").insertOne({
      userId: owner,
      type: "SELF",
      name: "Adult",
      sportsFocus: ["Tennis"],
    });

    const result = await run(false);

    assert.equal(result.copied, 1);
    assert.equal(await db.collection("players").countDocuments({ type: "SELF" }), 1);
    assert.equal((await db.collection("users").findOne({ _id: owner })).athleteProfile, undefined);
  });

  it("copies a live owner's sport details onto the user, then deletes the row", async () => {
    const owner = await seedUser();
    await db.collection("players").insertOne({
      userId: owner,
      type: "SELF",
      name: "Adult",
      sportsFocus: ["Tennis", "Chess"],
      yearsPlaying: 4,
      budgetTier: "Moderate",
      location: "",
      personalityTags: [],
    });

    await run(true);

    const user = await db.collection("users").findOne({ _id: owner });
    assert.deepEqual(user.athleteProfile, {
      sportsFocus: ["Tennis", "Chess"],
      yearsPlaying: 4,
      budgetTier: "Moderate",
    });
    assert.equal(await db.collection("players").countDocuments({ type: "SELF" }), 0);
  });

  it("does not overwrite what the user already has", async () => {
    const owner = await seedUser({ athleteProfile: { sportsFocus: ["Golf"] } });
    await db.collection("players").insertOne({
      userId: owner,
      type: "SELF",
      name: "Adult",
      sportsFocus: ["Tennis"],
    });

    const result = await run(true);

    assert.equal(result.keptUsers, 1);
    const user = await db.collection("users").findOne({ _id: owner });
    assert.deepEqual(user.athleteProfile.sportsFocus, ["Golf"]);
  });

  it("deletes empty rows and rows whose owner is gone, copying nothing", async () => {
    const owner = await seedUser();
    await db.collection("players").insertMany([
      { userId: owner, type: "SELF", name: "Adult", sportsFocus: [] },
      { userId: oid(), type: "SELF", name: "Gone", sportsFocus: ["Tennis"] },
    ]);

    const result = await run(true);

    assert.equal(result.empty, 1);
    assert.equal(result.ownerless, 1);
    assert.equal(await db.collection("players").countDocuments({ type: "SELF" }), 0);
    assert.equal((await db.collection("users").findOne({ _id: owner })).athleteProfile, undefined);
  });

  it("never touches a child", async () => {
    const owner = await seedUser();
    const child = oid();
    await db.collection("players").insertMany([
      { _id: child, userId: owner, type: "DEPENDENT", name: "Riya" },
      { userId: owner, type: "SELF", name: "Adult" },
    ]);

    await run(true);

    assert.ok(await db.collection("players").findOne({ _id: child }));
  });

  it("refuses to delete a row that something points at, and leaves the others to go", async () => {
    const owner = await seedUser();
    const pointedAt = oid();
    await db.collection("players").insertMany([
      { _id: pointedAt, userId: owner, type: "SELF", name: "Adult" },
      { userId: oid(), type: "SELF", name: "Other" },
    ]);
    await db.collection("expertsessions").insertOne({ playerId: pointedAt, userId: owner });

    const result = await run(true);

    assert.equal(result.blocked, 1);
    assert.ok(await db.collection("players").findOne({ _id: pointedAt }));
    assert.equal(await db.collection("players").countDocuments({ type: "SELF" }), 1);
  });

  it("running it again finds nothing", async () => {
    const owner = await seedUser();
    await db
      .collection("players")
      .insertOne({ userId: owner, type: "SELF", sportsFocus: ["Tennis"] });
    await run(true);

    const again = await run(true);

    assert.equal(again.selfRows, 0);
  });
});

describe("saving an adult's sports", () => {
  it("stores them on the user, from the field name the client sends", async () => {
    const owner = await seedUser();

    await updateProfile(String(owner), {
      playerProfile: { sportsFocus: ["Tennis", "Chess"], yearsPlaying: 3 },
    });

    const user = await User.findById(owner).lean();
    assert.deepEqual(user.athleteProfile.sportsFocus, ["Tennis", "Chess"]);
    assert.equal(user.athleteProfile.yearsPlaying, 3);
    assert.equal(await Player.collection.countDocuments({ userId: owner }), 0);
  });

  it("still accepts the old name for the sports list", async () => {
    const owner = await seedUser();

    await updateProfile(String(owner), { playerProfile: { sports: ["Golf"] } });

    const user = await User.findById(owner).lean();
    assert.deepEqual(user.athleteProfile.sportsFocus, ["Golf"]);
  });

  it("keeps earlier details when a later save sends only some", async () => {
    const owner = await seedUser();
    await updateProfile(String(owner), {
      playerProfile: { sportsFocus: ["Tennis"], yearsPlaying: 3 },
    });

    await updateProfile(String(owner), { playerProfile: { yearsPlaying: 5 } });

    const user = await User.findById(owner).lean();
    assert.deepEqual(user.athleteProfile.sportsFocus, ["Tennis"]);
    assert.equal(user.athleteProfile.yearsPlaying, 5);
  });
});

describe("migration 66", () => {
  it("refuses while any SELF row exists", async () => {
    const owner = await seedUser();
    await db.collection("players").insertMany([
      { userId: owner, type: "SELF", name: "Adult" },
      { userId: owner, type: "DEPENDENT", name: "Riya" },
    ]);

    const { result } = await quietly<any>(() => migration66.up({ apply: true }, db));

    assert.equal(result.refused, true);
    assert.equal(await db.collection("players").countDocuments({ type: { $exists: true } }), 2);
  });

  it("unsets type on every row once only children remain, and nothing else", async () => {
    const owner = await seedUser();
    await db.collection("players").insertMany([
      { userId: owner, type: "DEPENDENT", name: "Riya", sportsFocus: ["Tennis"] },
      { userId: owner, type: "DEPENDENT", name: "Meera" },
    ]);

    await quietly(() => migration66.up({ apply: true }, db));

    assert.equal(await db.collection("players").countDocuments({ type: { $exists: true } }), 0);
    const riya = await db.collection("players").findOne({ name: "Riya" });
    assert.deepEqual(riya.sportsFocus, ["Tennis"]);
  });

  it("a dry run changes nothing", async () => {
    const owner = await seedUser();
    await db.collection("players").insertOne({ userId: owner, type: "DEPENDENT", name: "Riya" });

    await quietly(() => migration66.up({}, db));

    assert.equal(await db.collection("players").countDocuments({ type: "DEPENDENT" }), 1);
  });
});
