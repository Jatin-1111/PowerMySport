// The WhatsApp assistant's conversation handling, run against a real (in-memory)
// MongoDB with the model call replaced by a stub. What matters here is what is
// stored (never the phone number), what history the model is given, and that a
// failure still produces a reply.
process.env.JWT_SECRET = "test-secret-test-secret-test-secret-1234567890";
process.env.REDIS_ENABLED = "false";

import assert = require("node:assert/strict");
const { after, before, beforeEach, describe, it } = require("node:test");
const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");

const { WhatsAppConversation } = require("../client/models/WhatsAppConversation");
const {
  hashPhone,
  replyToWhatsAppMessage,
} = require("../shared/services/whatsappAssistantService");
const redis = require("../config/redis").default;
const {
  up: createIndexes,
  WHATSAPP_CONVERSATION_INDEXES,
} = require("../migrations/51_whatsapp_conversation_indexes");

let mongod: { getUri(): string; stop(): Promise<void> };

before(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
});

after(async () => {
  await mongoose.disconnect();
  await mongod.stop();
  redis.disconnect();
});

beforeEach(async () => {
  await WhatsAppConversation.deleteMany({});
});

const PHONE = "919876543210";
const msg = (text: string | null, id = "wamid.1") => ({
  id,
  from: PHONE,
  type: text === null ? "image" : "text",
  text,
});

type Seen = { systemPrompt: string; history: unknown[]; userMessage: string };
const stub = (reply: string, seen?: Seen[]) =>
  async function* (systemPrompt: string, history: unknown[], userMessage: string) {
    seen?.push({ systemPrompt, history, userMessage });
    yield reply.slice(0, 5);
    yield reply.slice(5);
  };

describe("replyToWhatsAppMessage", () => {
  it("returns the model's reply and stores the turn under a hash, not the number", async () => {
    const reply = await replyToWhatsAppMessage(
      msg("Which sport suits my son?"),
      stub("Try the assessment.")
    );
    assert.equal(reply, "Try the assessment.");

    const docs = await WhatsAppConversation.find({}).lean();
    assert.equal(docs.length, 1);
    assert.equal(docs[0].phoneHash, hashPhone(PHONE));
    assert.equal(docs[0].totalMessageCount, 1);
    assert.deepEqual(
      docs[0].messages.map((m: { role: string; content: string }) => [m.role, m.content]),
      [
        ["user", "Which sport suits my son?"],
        ["assistant", "Try the assessment."],
      ]
    );
    assert.equal(
      JSON.stringify(docs[0]).includes(PHONE),
      false,
      "the raw number must not be stored"
    );
  });

  it("gives the model the earlier turns as history, and the WhatsApp formatting rules", async () => {
    const seen: Seen[] = [];
    await replyToWhatsAppMessage(
      msg("My son is 15 and plays tennis"),
      stub("Nice. How long has he played?", seen)
    );
    await replyToWhatsAppMessage(msg("About 4 years", "wamid.2"), stub("Got it.", seen));

    const [first, second] = seen;
    assert.ok(first && second);
    assert.equal(first.history.length, 0);
    assert.deepEqual(second.history, [
      { role: "user", content: "My son is 15 and plays tennis" },
      { role: "assistant", content: "Nice. How long has he played?" },
    ]);
    assert.match(second.systemPrompt, /Channel: WhatsApp/);
    assert.match(second.systemPrompt, /https:\/\/powermysport\.com/);
  });

  it("keeps only the most recent turns", async () => {
    for (let i = 0; i < 14; i++) {
      await replyToWhatsAppMessage(msg(`question ${i}`, `wamid.${i}`), stub(`answer ${i}`));
    }
    const doc = await WhatsAppConversation.findOne({}).lean();
    assert.equal(doc.messages.length, 20);
    assert.equal(doc.messages[0].content, "question 4");
    assert.equal(doc.messages[19].content, "answer 13");
    assert.equal(doc.totalMessageCount, 14);
  });

  it("asks for text when the message has none", async () => {
    const reply = await replyToWhatsAppMessage(msg(null), stub("never used"));
    assert.match(reply, /text/i);
    assert.equal(await WhatsAppConversation.countDocuments({}), 0);
  });

  it("answers with an apology, and stores nothing, when the model fails", async () => {
    // eslint-disable-next-line require-yield
    const failing = async function* () {
      throw new Error("model down");
    };
    const reply = await replyToWhatsAppMessage(msg("hello"), failing);
    assert.match(reply, /try again/i);
    assert.equal(await WhatsAppConversation.countDocuments({}), 0);
  });

  it("cuts a reply that is over WhatsApp's length limit", async () => {
    const reply = await replyToWhatsAppMessage(msg("tell me everything"), stub("x".repeat(6000)));
    assert.ok(reply.length <= 3800);
    assert.ok(reply.endsWith("…"));
  });

  it("hashPhone is stable and differs per number", () => {
    assert.equal(hashPhone(PHONE), hashPhone(PHONE));
    assert.notEqual(hashPhone(PHONE), hashPhone("919876543211"));
  });
});

describe("migration 51 (indexes)", () => {
  it("matches the model's own index definitions, so the two cannot drift", () => {
    const fromModel = WhatsAppConversation.schema
      .indexes()
      .map(([key, opts]: [Record<string, number>, Record<string, unknown>]) => ({ key, opts }));
    const fromPath = (
      WhatsAppConversation.schema.path("phoneHash") as { options: { unique?: boolean } }
    ).options.unique;

    assert.equal(fromPath, true);
    const ttl = fromModel.find((i: { key: Record<string, number> }) => i.key.updatedAt === 1);
    const spec = WHATSAPP_CONVERSATION_INDEXES.find(
      (i: { name: string }) => i.name === "updatedAt_1"
    );
    assert.equal(ttl.opts.expireAfterSeconds, spec.options.expireAfterSeconds);
  });

  it("creates both indexes, and a second run changes nothing", async () => {
    const db = mongoose.connection.db;
    await db
      .collection("whatsappconversations")
      .drop()
      .catch(() => undefined);

    await createIndexes({ apply: true }, db);
    await createIndexes({ apply: true }, db);

    const names = (await db.collection("whatsappconversations").indexes()).map(
      (i: { name: string }) => i.name
    );
    assert.ok(names.includes("phoneHash_1"));
    assert.ok(names.includes("updatedAt_1"));
  });

  it("a dry run creates nothing", async () => {
    const db = mongoose.connection.db;
    await db
      .collection("whatsappconversations")
      .drop()
      .catch(() => undefined);

    await createIndexes({}, db);

    const exists = await db.listCollections({ name: "whatsappconversations" }).toArray();
    assert.equal(exists.length, 0);
  });
});
