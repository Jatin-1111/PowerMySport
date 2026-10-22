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
  answerWhatsAppMessage,
  hashPhone,
  replyToWhatsAppMessage,
} = require("../shared/services/whatsappAssistantService");
const { User } = require("../client/models/User");
const { findUserIdByPhone } = require("../shared/services/whatsappIdentity");
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
  await User.deleteMany({});
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
  it("tells the model about exactly the tools it is given, and the channel it is on", async () => {
    const { ASSISTANT_CHAT_TOOLS } = require("../shared/services/chatToolsService");
    const seen: Seen[] = [];
    await replyToWhatsAppMessage(msg("What can you do?"), stub("I can help.", seen));

    const prompt = seen[0]!.systemPrompt;
    for (const tool of ASSISTANT_CHAT_TOOLS as Array<{ name: string; summary: string }>) {
      assert.ok(prompt.includes(`- ${tool.name}: ${tool.summary}.`), `prompt lists ${tool.name}`);
    }
    assert.match(prompt, /Channel: WhatsApp/);
  });

  it("sends WhatsApp text, not markdown, and stores what the parent actually read", async () => {
    const reply = await replyToWhatsAppMessage(
      msg("What can you do?"),
      stub("**I can help with:**\n*   Choosing a sport\n*   Finding tournaments")
    );
    assert.equal(reply, "*I can help with:*\n• Choosing a sport\n• Finding tournaments");

    const doc = await WhatsAppConversation.findOne({}).lean();
    assert.equal(doc.messages[1].content, reply);
  });

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

  it("flags a first message from a number, and not the ones after it", async () => {
    const first = await answerWhatsAppMessage(msg("hello"), stub("Hi there."));
    assert.equal(first.firstContact, true);
    const second = await answerWhatsAppMessage(msg("and another", "wamid.2"), stub("Sure."));
    assert.equal(second.firstContact, false);
  });

  it("deletes the chat on STOP, without asking the model, and treats the next message as new", async () => {
    await replyToWhatsAppMessage(msg("My son plays tennis"), stub("Great."));
    assert.equal(await WhatsAppConversation.countDocuments({}), 1);

    let asked = false;
    const never = async function* () {
      asked = true;
      yield "should not be used";
    };
    const stopped = await answerWhatsAppMessage(msg("STOP", "wamid.2"), never);
    assert.match(stopped.reply, /deleted/i);
    assert.equal(asked, false);
    assert.equal(await WhatsAppConversation.countDocuments({}), 0);

    const again = await answerWhatsAppMessage(msg("hello again", "wamid.3"), stub("Welcome back."));
    assert.equal(again.firstContact, true);
  });

  it("tells the model it is an AI and not to collect sensitive details", async () => {
    const seen: Seen[] = [];
    await replyToWhatsAppMessage(msg("hello"), stub("Hi.", seen));
    assert.match(seen[0]!.systemPrompt, /AI assistant/);
    assert.match(seen[0]!.systemPrompt, /medical details/);
  });

  it("does not pass an expert consultation off as a coach", async () => {
    const seen: Seen[] = [];
    await replyToWhatsAppMessage(msg("find me a tennis coach"), stub("Hi.", seen));
    // The prompt says a coach request is not a consultation request, and the fee
    // rule asks for rupees and the unit instead of a bare number.
    assert.match(seen[0]!.systemPrompt, /regular coaching is coming soon/);
    assert.match(seen[0]!.systemPrompt, /per session/);

    const { ASSISTANT_CHAT_TOOLS } = require("../shared/services/chatToolsService");
    const tool = ASSISTANT_CHAT_TOOLS.find((t: { name: string }) => t.name === "search_experts");
    assert.match(tool.description, /NOT coaches for regular training/);
  });

  it("recognises a parent by number and passes their account to the tools", async () => {
    await User.create({
      name: "Jatin",
      email: "parent-wa@example.com",
      phone: "+91 98765 43210",
      password: "Passw0rd!x",
      role: "Parent",
    });
    const contexts: unknown[] = [];
    const seen: Seen[] = [];
    const generate = async function* (
      systemPrompt: string,
      history: unknown[],
      userMessage: string,
      toolContext: unknown
    ) {
      contexts.push(toolContext);
      seen.push({ systemPrompt, history, userMessage });
      yield "Hello.";
    };
    await replyToWhatsAppMessage(msg("check his ranking"), generate);

    assert.match(String((contexts[0] as { userId?: string }).userId), /^[a-f0-9]{24}$/);
    assert.match(seen[0]!.systemPrompt, /This parent is known/);
    // The account block is there, and says plainly that no child has been added.
    assert.match(seen[0]!.systemPrompt, /What this parent's account shows/);
    assert.match(seen[0]!.systemPrompt, /No child has been added to this account yet/);
    assert.match(seen[0]!.systemPrompt, /Never explain how you work inside/);
  });

  it("treats a number held by two accounts as unknown", async () => {
    // The phone index is unique on the exact text, so the same number typed two ways is
    // how two accounts end up sharing one.
    for (const [email, phone] of [
      ["a-wa@example.com", "9876543210"],
      ["b-wa@example.com", "+91 98765 43210"],
    ]) {
      await User.create({
        name: "Shared",
        email,
        phone,
        password: "Passw0rd!x",
        role: "Parent",
      });
    }
    assert.equal(await findUserIdByPhone(PHONE), undefined);

    const contexts: unknown[] = [];
    const seen: Seen[] = [];
    await replyToWhatsAppMessage(
      msg("check his ranking"),
      async function* (
        systemPrompt: string,
        history: unknown[],
        userMessage: string,
        toolContext: unknown
      ) {
        contexts.push(toolContext);
        seen.push({ systemPrompt, history, userMessage });
        yield "Hello.";
      }
    );
    assert.deepEqual(contexts[0], {});
    assert.match(seen[0]!.systemPrompt, /not identified/);
  });

  it("does not identify a number nobody holds, or one whose account is closed", async () => {
    assert.equal(await findUserIdByPhone(PHONE), undefined);
    await User.create({
      name: "Gone",
      email: "gone-wa@example.com",
      phone: "9876543210",
      password: "Passw0rd!x",
      role: "Parent",
      deletionRequestedAt: new Date(),
    });
    assert.equal(await findUserIdByPhone(PHONE), undefined);
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
