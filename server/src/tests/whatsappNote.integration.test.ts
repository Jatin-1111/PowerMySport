// The WhatsApp note collection and migration 67, against a real (in-memory) MongoDB.
// The point is that the model, the migration and the retention promise cannot drift apart.
process.env.JWT_SECRET = "test-secret-test-secret-test-secret-1234567890";
process.env.REDIS_ENABLED = "false";

import assert = require("node:assert/strict");
const { after, before, beforeEach, describe, it } = require("node:test");
const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");

const {
  MAX_NOTE_CHILDREN,
  NOTE_RETENTION_SECONDS,
  WhatsAppNote,
} = require("../client/models/WhatsAppNote");
const { up, down, WHATSAPP_NOTE_INDEXES } = require("../migrations/67_whatsapp_note_indexes");

let mongod: { getUri(): string; stop(): Promise<void> };

before(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
});

after(async () => {
  await mongoose.disconnect();
  await mongod.stop();
});

beforeEach(async () => {
  await WhatsAppNote.deleteMany({});
});

const indexNames = async (): Promise<string[]> =>
  (await mongoose.connection.db.collection("whatsappnotes").indexes()).map(
    (i: { name: string }) => i.name
  );

const dropCollection = () =>
  mongoose.connection.db
    .collection("whatsappnotes")
    .drop()
    .catch(() => undefined);

describe("WhatsAppNote model", () => {
  it("stores a child's note without a phone number, surname or date of birth", async () => {
    await WhatsAppNote.create({
      phoneHash: "hash-1",
      children: [
        {
          key: "vikrant",
          firstName: "Vikrant",
          age: 14,
          ageNotedAt: new Date("2026-10-22T00:00:00Z"),
          sports: ["Tennis"],
          level: "intermediate",
          goal: "state level",
          state: "Delhi",
        },
      ],
    });

    const stored = await WhatsAppNote.findOne({ phoneHash: "hash-1" }).lean();
    assert.deepEqual(Object.keys(stored.children[0]).sort(), [
      "age",
      "ageNotedAt",
      "firstName",
      "goal",
      "key",
      "level",
      "notedAt",
      "sports",
      "state",
    ]);
  });

  it("allows one note per number", async () => {
    await WhatsAppNote.init();
    await WhatsAppNote.create({ phoneHash: "hash-2" });
    await assert.rejects(WhatsAppNote.create({ phoneHash: "hash-2" }), /duplicate key/);
  });

  it("rejects an age outside a child's range", async () => {
    await assert.rejects(
      WhatsAppNote.create({
        phoneHash: "hash-3",
        children: [{ key: "x", firstName: "X", age: 40 }],
      }),
      /age/
    );
  });

  it("keeps the child limit the assistant will enforce", () => {
    assert.equal(MAX_NOTE_CHILDREN, 4);
  });
});

describe("migration 67 (indexes)", () => {
  it("matches the model's own index definitions, so the two cannot drift", () => {
    const fromModel = WhatsAppNote.schema
      .indexes()
      .map(([key, opts]: [Record<string, number>, Record<string, unknown>]) => ({ key, opts }));
    const unique = (WhatsAppNote.schema.path("phoneHash") as { options: { unique?: boolean } })
      .options.unique;
    assert.equal(unique, true);

    const ttl = fromModel.find((i: { key: Record<string, number> }) => i.key.updatedAt === 1);
    const spec = WHATSAPP_NOTE_INDEXES.find((i: { name: string }) => i.name === "updatedAt_1");
    assert.equal(ttl.opts.expireAfterSeconds, spec.options.expireAfterSeconds);
    assert.equal(spec.options.expireAfterSeconds, NOTE_RETENTION_SECONDS);
    assert.equal(NOTE_RETENTION_SECONDS, 60 * 60 * 24 * 365, "12 months, as agreed");
  });

  it("creates both indexes, and a second run changes nothing", async () => {
    await dropCollection();
    const db = mongoose.connection.db;

    await up({ apply: true }, db);
    await up({ apply: true }, db);

    const names = await indexNames();
    assert.ok(names.includes("phoneHash_1"));
    assert.ok(names.includes("updatedAt_1"));
  });

  it("a dry run creates nothing, not even the collection", async () => {
    await dropCollection();
    await up({}, mongoose.connection.db);

    const exists = await mongoose.connection.db
      .listCollections({ name: "whatsappnotes" })
      .toArray();
    assert.equal(exists.length, 0);
  });

  it("down removes what up created, and a dry run down removes nothing", async () => {
    await dropCollection();
    const db = mongoose.connection.db;
    await up({ apply: true }, db);

    await down({}, db);
    assert.ok((await indexNames()).includes("phoneHash_1"), "dry run leaves the index");

    await down({ apply: true }, db);
    const names = await indexNames();
    assert.ok(!names.includes("phoneHash_1"));
    assert.ok(!names.includes("updatedAt_1"));
  });
});
