/* eslint-disable @typescript-eslint/no-var-requires */
// Migration 64: skillLevel and wizardCity come off every player row, and nothing else does.
process.env.JWT_SECRET = "test-secret-test-secret-test-secret-1234567890";
process.env.REDIS_ENABLED = "false";

import assert = require("node:assert/strict");
const { after, before, beforeEach, describe, it } = require("node:test");
const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");

const migration = require("../migrations/64_remove_dead_child_fields");
const { Player } = require("../client/models/Player");
const redis = require("../config/redis").default;

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
  await db
    .collection("players")
    .deleteMany({})
    .catch(() => undefined);
});

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

const seed = () =>
  db.collection("players").insertMany([
    { name: "A", type: "DEPENDENT", skillLevel: "BEGINNER", sportsFocus: ["Tennis"] },
    { name: "B", type: "DEPENDENT", skillLevel: "", wizardCity: "Mohali", yearsPlaying: 3 },
    { name: "C", type: "SELF", skillLevel: "BEGINNER" },
    { name: "D", type: "DEPENDENT", experienceLevel: "beginner" },
  ]);

describe("migration 64", () => {
  it("a dry run changes nothing and counts real values apart from empty ones", async () => {
    await seed();

    const { lines } = await quietly(() => migration.up({}, db));

    assert.equal(
      await db.collection("players").countDocuments({ skillLevel: { $exists: true } }),
      3
    );
    const skill = lines.find((l) => l.includes("skillLevel")) as string;
    assert.match(skill, /3 row\(s\), 2 with a value \(BEGINNER\)/);
    assert.match(
      lines.find((l) => l.includes("wizardCity")) as string,
      /1 row\(s\), 1 with a value/
    );
  });

  it("--apply removes both fields from every row, adult rows included", async () => {
    await seed();

    await quietly(() => migration.up({ apply: true }, db));

    assert.equal(
      await db.collection("players").countDocuments({
        $or: [{ skillLevel: { $exists: true } }, { wizardCity: { $exists: true } }],
      }),
      0
    );
  });

  it("leaves every other field alone", async () => {
    await seed();

    await quietly(() => migration.up({ apply: true }, db));

    const a = await db.collection("players").findOne({ name: "A" });
    assert.deepEqual(a.sportsFocus, ["Tennis"]);
    const b = await db.collection("players").findOne({ name: "B" });
    assert.equal(b.yearsPlaying, 3);
    const d = await db.collection("players").findOne({ name: "D" });
    assert.equal(d.experienceLevel, "beginner");
  });

  it("running it again finds nothing to do", async () => {
    await seed();
    await quietly(() => migration.up({ apply: true }, db));

    const { result } = await quietly<{ rows: number }>(() => migration.up({ apply: true }, db));

    assert.equal(result.rows, 0);
  });
});

describe("the player model after the removal", () => {
  it("no longer has either field", () => {
    assert.equal(Player.schema.path("skillLevel"), undefined);
    assert.equal(Player.schema.path("wizardCity"), undefined);
  });
});
