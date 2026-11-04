/* eslint-disable @typescript-eslint/no-var-requires */
// How long conversations are kept.
//
// Decided 2026-10-21: every chat store (site assistant, guidance follow-ups, roadmap)
// keeps a conversation 180 days after its last message. Guidance submissions are not on a
// timer: they go when the child or the account is deleted. The time limit is an index
// created by a migration, never by a model, because a model index would be created in
// production by any script that imports it.
process.env.JWT_SECRET = "test-secret-test-secret-test-secret-1234567890";
process.env.REDIS_ENABLED = "false";

import assert = require("node:assert/strict");
const { after, before, beforeEach, describe, it } = require("node:test");
const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");

const m55 = require("../migrations/55_assistant_chat_session_retention");
const m63 = require("../migrations/63_chat_retention_guidance_and_roadmap");
const { AssistantChatSession } = require("../client/models/AssistantChatSession");
const { GuidanceChatSession } = require("../client/models/GuidanceChatSession");
const { RoadmapChatSession } = require("../client/models/RoadmapChatSession");
const { GuidanceSubmission } = require("../client/models/GuidanceSubmission");
const redis = require("../config/redis").default;

const DAY = 86_400_000;
const SECONDS = 180 * 24 * 60 * 60;
const ALL = ["assistantchatsessions", "guidancechatsessions", "roadmapchatsessions"];

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
  for (const name of ALL)
    await db
      .collection(name)
      .drop()
      .catch(() => undefined);
});

const ttlOf = async (collection: string) => {
  const indexes = await db
    .collection(collection)
    .indexes()
    .catch(() => []);
  return indexes.find((i: any) => i.name === "updatedAt_1")?.expireAfterSeconds;
};

const silently = async (run: () => Promise<void>) => {
  const log = console.log;
  console.log = () => undefined;
  try {
    await run();
  } finally {
    console.log = log;
  }
};

describe("one retention period for every chat store", () => {
  it("is 180 days, and both migrations use the same number", () => {
    assert.equal(m55.RETENTION_DAYS, 180);
    assert.deepEqual(m63.COLLECTIONS, ["guidancechatsessions", "roadmapchatsessions"]);
  });

  it("is not declared on any model, so no script can create it in production", () => {
    for (const model of [AssistantChatSession, GuidanceChatSession, RoadmapChatSession]) {
      const ttl = model.schema
        .indexes()
        .filter(([, options]: any[]) => options && options.expireAfterSeconds !== undefined);
      assert.deepEqual(ttl, [], `${model.modelName} declares a TTL index`);
    }
  });

  it("does not put a timer on guidance submissions", () => {
    const ttl = GuidanceSubmission.schema
      .indexes()
      .filter(([, options]: any[]) => options && options.expireAfterSeconds !== undefined);
    assert.deepEqual(ttl, []);
  });
});

describe("migrations 55 and 63", () => {
  it("a dry run changes nothing and says how many chats would go", async () => {
    await db
      .collection("guidancechatsessions")
      .insertMany([{ updatedAt: new Date(Date.now() - 200 * DAY) }, { updatedAt: new Date() }]);
    const lines: string[] = [];
    const log = console.log;
    console.log = (line: string) => lines.push(String(line));
    try {
      await m63.up({}, db);
    } finally {
      console.log = log;
    }

    assert.equal(await ttlOf("guidancechatsessions"), undefined);
    assert.ok(
      lines.some((l) => /guidancechatsessions.*1 chat\(s\)/.test(l)),
      lines.join("\n")
    );
    assert.equal(await db.collection("guidancechatsessions").countDocuments(), 2);
  });

  it("--apply gives every chat store the same expiry", async () => {
    for (const name of ALL) await db.createCollection(name);

    await silently(async () => {
      await m55.up({ apply: true }, db);
      await m63.up({ apply: true }, db);
    });

    for (const name of ALL) assert.equal(await ttlOf(name), SECONDS, name);
  });

  it("running it again changes nothing", async () => {
    for (const name of ALL) await db.createCollection(name);
    await silently(async () => {
      await m63.up({ apply: true }, db);
      await m63.up({ apply: true }, db);
    });
    assert.equal(await ttlOf("roadmapchatsessions"), SECONDS);
  });

  it("will not overwrite an existing index with a different expiry", async () => {
    await db.createCollection("roadmapchatsessions");
    await db
      .collection("roadmapchatsessions")
      .createIndex(
        { updatedAt: 1 },
        { name: "updatedAt_1", expireAfterSeconds: 30 * 24 * 60 * 60 }
      );

    await silently(async () => m63.up({ apply: true }, db));

    assert.equal(await ttlOf("roadmapchatsessions"), 30 * 24 * 60 * 60);
  });

  it("--down removes it again", async () => {
    for (const name of ALL) await db.createCollection(name);
    await silently(async () => {
      await m63.up({ apply: true }, db);
      await m63.down({ apply: true }, db);
    });
    assert.equal(await ttlOf("guidancechatsessions"), undefined);
  });
});
