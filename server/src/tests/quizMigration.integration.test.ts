/* eslint-disable @typescript-eslint/no-var-requires */
// Migration 58 moves a child's quiz answers into `quiz`. It runs on both sides of a
// deploy, and a wrong guess about which side is newer destroys an answer. These
// tests pin each case of that guess.
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
  up,
  classify,
  sameAnswers,
  buildQuiz,
} = require("../migrations/58_move_quiz_answers_into_quiz");
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

const OLD = { energyType: "explosive", eyesight: "sharp", teamIndividual: 3 };

const insert = async (fields: Record<string, unknown>) => {
  const _id = oid();
  await db
    .collection("players")
    .insertOne({ _id, userId: oid(), type: "DEPENDENT", name: "Riya", ...fields });
  return _id;
};
const read = async (_id: any) => db.collection("players").findOne({ _id });

describe("which side is newer", () => {
  it("copies a row that has old values and no quiz", () => {
    assert.equal(classify({ ...OLD }), "copy");
  });

  it("calls matching sides in sync, whatever the key order", () => {
    assert.equal(
      classify({ ...OLD, quiz: { teamIndividual: 3, eyesight: "sharp", energyType: "explosive" } }),
      "in-sync"
    );
  });

  it("sees the old fields as newer when only they moved since the snapshot", () => {
    assert.equal(
      classify({ ...OLD, agility: "high", quiz: { ...OLD }, quizSource: { ...OLD } }),
      "refresh"
    );
  });

  it("sees the quiz as newer when only it moved since the snapshot", () => {
    assert.equal(
      classify({ ...OLD, quiz: { ...OLD, agility: "low" }, quizSource: { ...OLD } }),
      "quiz-newer"
    );
  });

  it("calls it a conflict when both moved", () => {
    assert.equal(
      classify({
        ...OLD,
        agility: "high",
        quiz: { ...OLD, agility: "low" },
        quizSource: { ...OLD },
      }),
      "conflict"
    );
  });

  it("does not guess when there is no snapshot and they differ", () => {
    assert.equal(classify({ ...OLD, quiz: { ...OLD, agility: "low" } }), "unknown");
  });

  it("treats a quiz with no old values behind it as newer, never as something to overwrite", () => {
    assert.equal(classify({ quiz: { ...OLD } }), "quiz-newer");
  });

  it("ignores empty old values", () => {
    assert.deepEqual(buildQuiz({ energyType: "", eyesight: null, agility: undefined }), {});
    assert.equal(sameAnswers({ a: 1, b: 2 }, { b: 2, a: 1 }), true);
  });
});

describe("copy and refresh", () => {
  it("copies with a snapshot and keeps the old fields", async () => {
    const id = await insert({ ...OLD });
    await up({ apply: true }, db);
    const row = await read(id);
    assert.deepEqual(row.quiz, OLD);
    assert.deepEqual(row.quizSource, OLD);
    assert.equal(row.energyType, "explosive");
  });

  it("writes nothing on a dry run", async () => {
    const id = await insert({ ...OLD });
    await up({ refresh: true }, db);
    assert.equal((await read(id)).quiz, undefined);
  });

  it("refreshes a quiz the old server has since outdated", async () => {
    const id = await insert({ ...OLD, agility: "high", quiz: { ...OLD }, quizSource: { ...OLD } });
    await up({ refresh: true, apply: true }, db);
    const row = await read(id);
    assert.equal(row.quiz.agility, "high");
    assert.equal(row.quizSource.agility, "high");
  });

  it("never overwrites a quiz the new code wrote", async () => {
    const id = await insert({ ...OLD, quiz: { ...OLD, agility: "low" }, quizSource: { ...OLD } });
    await up({ refresh: true, apply: true }, db);
    assert.equal((await read(id)).quiz.agility, "low");
  });

  it("never overwrites a quiz that has no old values behind it, even with --prefer-legacy", async () => {
    const id = await insert({ quiz: { ...OLD } });
    await up({ refresh: true, preferLegacy: true, apply: true }, db);
    assert.deepEqual((await read(id)).quiz, OLD);
  });

  it("leaves a conflict alone", async () => {
    const id = await insert({
      ...OLD,
      agility: "high",
      quiz: { ...OLD, agility: "low" },
      quizSource: { ...OLD },
    });
    await up({ refresh: true, apply: true }, db);
    assert.equal((await read(id)).quiz.agility, "low");
  });

  it("leaves a row with no snapshot alone unless --prefer-legacy is given", async () => {
    const id = await insert({ ...OLD, agility: "high", quiz: { ...OLD } });
    await up({ refresh: true, apply: true }, db);
    assert.equal((await read(id)).quiz.agility, undefined);

    await up({ refresh: true, preferLegacy: true, apply: true }, db);
    assert.equal((await read(id)).quiz.agility, "high");
  });

  it("gives an in-sync row without a snapshot one, so the unset can tell sides apart", async () => {
    const id = await insert({ ...OLD, quiz: { ...OLD } });
    await up({ refresh: true, apply: true }, db);
    assert.deepEqual((await read(id)).quizSource, OLD);
  });

  it("is idempotent", async () => {
    const id = await insert({ ...OLD });
    await up({ refresh: true, apply: true }, db);
    const once = await read(id);
    await up({ refresh: true, apply: true }, db);
    assert.deepEqual(await read(id), once);
  });
});

describe("the unset guard", () => {
  const unset = () => up({ unsetLegacy: true, apply: true }, db);

  it("removes the old fields and the snapshot from an in-sync row", async () => {
    const id = await insert({ ...OLD, quiz: { ...OLD }, quizSource: { ...OLD } });
    await unset();
    const row = await read(id);
    assert.equal(row.energyType, undefined);
    assert.equal(row.quizSource, undefined);
    assert.deepEqual(row.quiz, OLD);
  });

  it("removes the old fields when the quiz is newer, and keeps the newer quiz", async () => {
    const id = await insert({ ...OLD, quiz: { ...OLD, agility: "low" }, quizSource: { ...OLD } });
    await unset();
    const row = await read(id);
    assert.equal(row.energyType, undefined);
    assert.equal(row.quiz.agility, "low");
  });

  it("refuses a row whose old fields are newer than the quiz", async () => {
    const id = await insert({ ...OLD, agility: "high", quiz: { ...OLD }, quizSource: { ...OLD } });
    await unset();
    const row = await read(id);
    assert.equal(row.agility, "high");
    assert.equal(row.energyType, "explosive");
  });

  it("refuses a conflict and a row it cannot compare", async () => {
    const conflict = await insert({
      ...OLD,
      agility: "high",
      quiz: { ...OLD, agility: "low" },
      quizSource: { ...OLD },
    });
    const unknown = await insert({ ...OLD, agility: "high", quiz: { ...OLD } });
    await unset();
    assert.equal((await read(conflict)).agility, "high");
    assert.equal((await read(unknown)).agility, "high");
  });

  it("refuses a row that was never copied", async () => {
    const id = await insert({ ...OLD });
    await unset();
    assert.equal((await read(id)).energyType, "explosive");
  });

  it("clears a row that holds only empty old values", async () => {
    const id = await insert({ energyType: "", eyesight: null });
    await unset();
    const row = await read(id);
    assert.equal(row.energyType, undefined);
    assert.equal(row.eyesight, undefined);
  });

  it("writes nothing on a dry run", async () => {
    const id = await insert({ ...OLD, quiz: { ...OLD }, quizSource: { ...OLD } });
    await up({ unsetLegacy: true }, db);
    assert.equal((await read(id)).energyType, "explosive");
  });
});
