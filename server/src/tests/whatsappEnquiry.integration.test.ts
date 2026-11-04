// The pilot's enquiry record: what is kept from a parent's question, how topics are split, who can
// reach the number, and what STOP removes. Real (in-memory) MongoDB; the model call is a stub.
process.env.JWT_SECRET = "test-secret-test-secret-test-secret-1234567890";
process.env.REDIS_ENABLED = "false";
process.env.BANK_ENCRYPTION_KEY = "0123456789abcdef".repeat(4);

import assert = require("node:assert/strict");
const { after, before, beforeEach, describe, it } = require("node:test");
const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");

const {
  ENQUIRY_IDLE_MS,
  ENQUIRY_RETENTION_SECONDS,
  WhatsAppEnquiry,
} = require("../client/models/WhatsAppEnquiry");
const { WhatsAppConversation } = require("../client/models/WhatsAppConversation");
const enquiries = require("../shared/services/whatsappEnquiries");
const { decryptValue } = require("../shared/utils/encryption");
const { ASSISTANT_CHAT_TOOLS } = require("../shared/services/chatToolsService");
const { answerWhatsAppMessage, hashPhone } = require("../shared/services/whatsappAssistantService");
const { up, down, WHATSAPP_ENQUIRY_INDEXES } = require("../migrations/68_whatsapp_enquiry_indexes");
const redis = require("../config/redis").default;

let mongod: { getUri(): string; stop(): Promise<void> };

before(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
  await WhatsAppEnquiry.init();
});

after(async () => {
  await mongoose.disconnect();
  await mongod.stop();
  redis.disconnect();
});

beforeEach(async () => {
  await Promise.all([WhatsAppEnquiry.deleteMany({}), WhatsAppConversation.deleteMany({})]);
});

const HASH = "hash-parent-1";
// A number of its own for each run: the daily message count lives in Redis and outlasts a run.
const PHONE = `9198${String(Date.now()).slice(-8)}`;
const tool = (name: string) => ASSISTANT_CHAT_TOOLS.find((t: { name: string }) => t.name === name);
const record = (args: Record<string, unknown>, userMessage = "my son plays tennis") =>
  tool("record_enquiry").execute(args, { phoneHash: HASH, userMessage });

describe("record_enquiry", () => {
  it("keeps what the parent said, cleaned, and opens the enquiry with their first message", async () => {
    const out = await record({
      childAge: 11,
      sport: "Tennis",
      level: "beginner",
      objective: "wants to play district tournaments https://evil.example <b>x</b>",
      assistance: ["tournaments", "bogus"],
    });
    assert.equal(out.recorded, true);

    const stored = await WhatsAppEnquiry.findOne({ phoneHash: HASH }).lean();
    assert.equal(stored.question, "my son plays tennis");
    assert.equal(stored.childAge, 11);
    assert.equal(stored.sport, "Tennis");
    assert.deepEqual(stored.assistance, ["tournaments"]);
    assert.ok(!stored.objective.includes("evil.example"));
    assert.ok(!/[<>]/.test(stored.objective));
    assert.match(stored.reference, /^PMS-[A-Z2-9]{5}$/);
    assert.equal(stored.parentRef, enquiries.parentRefFor(HASH));
  });

  it("keeps earlier fields when a later call mentions only one, and ignores a nonsense age", async () => {
    await record({ childAge: 11, sport: "Tennis" });
    await record({ level: "intermediate", childAge: 99 });

    assert.equal(await WhatsAppEnquiry.countDocuments({}), 1);
    const stored = await WhatsAppEnquiry.findOne({}).lean();
    assert.equal(stored.childAge, 11);
    assert.equal(stored.sport, "Tennis");
    assert.equal(stored.level, "intermediate");
  });

  it("does nothing without a chat to attach to", async () => {
    const out = await tool("record_enquiry").execute({ sport: "Tennis" }, {});
    assert.equal(out.recorded, false);
    assert.equal(await WhatsAppEnquiry.countDocuments({}), 0);
  });

  it("does not expose the parent's number or a model-supplied id as a parameter", () => {
    const props = Object.keys(tool("record_enquiry").parametersJsonSchema.properties);
    assert.ok(!props.some((p) => /phone|hash|id|email/i.test(p)));
  });
});

describe("topics", () => {
  it("keeps a parent's follow-up messages on the same enquiry", async () => {
    await record({ sport: "Tennis" }, "first question");
    await enquiries.recordTurn(HASH, "first question", "answer one", new Date(Date.now() - 1000));
    await enquiries.recordTurn(HASH, "and the fees?", "answer two", new Date(Date.now() - 500));

    const all = await WhatsAppEnquiry.find({}).lean();
    assert.equal(all.length, 1);
    assert.equal(all[0].turnCount, 2);
    assert.equal(all[0].guidance, "answer two");
    assert.equal(all[0].question, "first question");
  });

  it("starts a new enquiry after a day of silence", async () => {
    await record({ sport: "Tennis" }, "old question");
    await WhatsAppEnquiry.updateOne(
      {},
      { $set: { lastMessageAt: new Date(Date.now() - ENQUIRY_IDLE_MS - 60_000) } }
    );
    await record({ sport: "Chess" }, "new question");

    assert.equal(await WhatsAppEnquiry.countDocuments({}), 2);
  });

  it("starts a new enquiry once the parent has closed the last, and not for the closing message", async () => {
    const turnStart = new Date();
    await record({ feedback: "helpful", closed: true }, "thanks, that is all");
    await enquiries.recordTurn(HASH, "thanks, that is all", "Glad to help.", turnStart);
    assert.equal(await WhatsAppEnquiry.countDocuments({}), 1, "closing opened no second topic");

    await record({ sport: "Badminton" }, "another question");
    assert.equal(await WhatsAppEnquiry.countDocuments({}), 2);
  });

  it("keeps two parents apart", async () => {
    await enquiries.updateEnquiry("hash-a", "q", { sport: "Tennis" });
    await enquiries.updateEnquiry("hash-b", "q", { sport: "Chess" });
    assert.equal(await WhatsAppEnquiry.countDocuments({}), 2);
    assert.notEqual(enquiries.parentRefFor("hash-a"), enquiries.parentRefFor("hash-b"));
  });
});

describe("asking for a person", () => {
  it("marks the topic as needing follow-up and returns the reference to quote", async () => {
    await record({ sport: "Tennis" });
    const reference = await enquiries.markFollowUpRequested(HASH, "help", {
      summary: "wants a call about academies",
      ticketId: "t1",
    });

    const stored = await WhatsAppEnquiry.findOne({}).lean();
    assert.equal(stored.reference, reference);
    assert.equal(stored.followUpStatus, "new");
    assert.ok(stored.assistance.includes("team"));
    assert.equal(stored.ticketId, "t1");
  });

  it("keeps the number encrypted, only on a topic with a follow-up request", async () => {
    await record({ sport: "Tennis" });
    await enquiries.attachContactNumber(HASH, PHONE);
    assert.equal(
      (await WhatsAppEnquiry.findOne({}).lean()).contactPhoneEnc,
      undefined,
      "no request, so no number kept"
    );

    await enquiries.markFollowUpRequested(HASH, "help", { summary: "call me" });
    await enquiries.attachContactNumber(HASH, PHONE);
    const stored = await WhatsAppEnquiry.findOne({}).lean();
    assert.ok(stored.contactPhoneEnc);
    assert.ok(!JSON.stringify(stored).includes(PHONE));
    assert.equal(decryptValue(stored.contactPhoneEnc), PHONE);
  });
});

describe("in the WhatsApp assistant", () => {
  const msg = (text: string, id = "wamid.1") => ({ id, from: PHONE, type: "text", text });
  const stub = (reply: string) =>
    async function* () {
      yield reply;
    };

  it("records the question and the answer for every turn, with no tool call at all", async () => {
    await answerWhatsAppMessage(msg("Which sport suits my 9 year old?"), stub("Try swimming."));
    await answerWhatsAppMessage(msg("and the cost?", "wamid.2"), stub("About 2000 a month."));

    const all = await WhatsAppEnquiry.find({}).lean();
    assert.equal(all.length, 1);
    assert.equal(all[0].question, "Which sport suits my 9 year old?");
    assert.equal(all[0].guidance, "About 2000 a month.");
    assert.equal(all[0].turnCount, 2);
    assert.equal(all[0].phoneHash, hashPhone(PHONE));
  });

  it("still answers the parent when the record cannot be written", async () => {
    const original = WhatsAppEnquiry.create;
    WhatsAppEnquiry.create = async () => {
      throw new Error("db down");
    };
    try {
      const answer = await answerWhatsAppMessage(msg("Hello, can you help me?"), stub("Hi there."));
      assert.equal(answer.reply, "Hi there.");
    } finally {
      WhatsAppEnquiry.create = original;
    }
  });

  it("deletes the enquiries, and any kept number, with the chat on STOP", async () => {
    await answerWhatsAppMessage(msg("Hello, can you help me?"), stub("Hi."));
    await enquiries.markFollowUpRequested(hashPhone(PHONE), "hello", { summary: "call me" });
    await enquiries.attachContactNumber(hashPhone(PHONE), PHONE);
    assert.equal(await WhatsAppEnquiry.countDocuments({}), 1);

    await answerWhatsAppMessage(msg("STOP", "wamid.2"), stub("unused"));
    assert.equal(await WhatsAppEnquiry.countDocuments({}), 0);
    assert.equal(await WhatsAppConversation.countDocuments({}), 0);
  });
});

describe("migration 68 (indexes)", () => {
  const coll = () => mongoose.connection.db.collection("whatsappenquiries");
  const names = async (): Promise<string[]> =>
    (await coll().indexes()).map((i: { name: string }) => i.name);

  it("matches the model, so the two cannot drift", () => {
    const fromModel = WhatsAppEnquiry.schema.indexes();
    const ttl = fromModel.find(([key]: [Record<string, number>]) => key.lastMessageAt === 1);
    const spec = WHATSAPP_ENQUIRY_INDEXES.find(
      (i: { name: string }) => i.name === "lastMessageAt_1"
    );
    assert.equal(ttl[1].expireAfterSeconds, spec.options.expireAfterSeconds);
    assert.equal(spec.options.expireAfterSeconds, ENQUIRY_RETENTION_SECONDS);
    assert.equal(ENQUIRY_RETENTION_SECONDS, 60 * 60 * 24 * 180, "180 days, as agreed");

    const lookup = fromModel.find(([key]: [Record<string, number>]) => key.phoneHash === 1);
    assert.deepEqual(lookup[0], { phoneHash: 1, lastMessageAt: -1 });
    assert.equal(
      (WhatsAppEnquiry.schema.path("reference") as { options: { unique?: boolean } }).options
        .unique,
      true
    );
  });

  it("creates all three indexes, runs twice harmlessly, and reverts", async () => {
    await coll()
      .drop()
      .catch(() => undefined);
    const db = mongoose.connection.db;

    await up({}, db);
    assert.equal((await db.listCollections({ name: "whatsappenquiries" }).toArray()).length, 0);

    await up({ apply: true }, db);
    await up({ apply: true }, db);
    for (const spec of WHATSAPP_ENQUIRY_INDEXES) assert.ok((await names()).includes(spec.name));

    await down({ apply: true }, db);
    for (const spec of WHATSAPP_ENQUIRY_INDEXES) assert.ok(!(await names()).includes(spec.name));
  });
});

describe("every exchange is kept", () => {
  const { MAX_ENQUIRY_TURNS } = require("../client/models/WhatsAppEnquiry");
  const {
    FIRST_CONTACT_NOTICE,
    FIRST_CONTACT_NOTICE_MEMBER,
  } = require("../shared/services/whatsappPilot");

  it("keeps each question and answer in order, with the latest answer also as the guidance", async () => {
    await enquiries.recordTurn(HASH, "first question", "first answer", new Date(Date.now() - 3000));
    await enquiries.recordTurn(
      HASH,
      "second question",
      "second answer",
      new Date(Date.now() - 2000)
    );
    await enquiries.recordTurn(HASH, "third question", "third answer", new Date(Date.now() - 1000));

    const stored = await WhatsAppEnquiry.findOne({}).lean();
    assert.deepEqual(
      stored.turns.map((t: { parent: string; assistant: string }) => [t.parent, t.assistant]),
      [
        ["first question", "first answer"],
        ["second question", "second answer"],
        ["third question", "third answer"],
      ]
    );
    assert.equal(stored.guidance, "third answer");
    assert.equal(stored.turnCount, 3);
    assert.ok(stored.turns.every((t: { at: Date }) => t.at instanceof Date));
  });

  it("keeps only the most recent exchanges on a very long topic", async () => {
    for (let i = 1; i <= MAX_ENQUIRY_TURNS + 5; i++) {
      await enquiries.recordTurn(HASH, `q${i}`, `a${i}`, new Date(Date.now() - 1000));
    }
    const stored = await WhatsAppEnquiry.findOne({}).lean();
    assert.equal(stored.turns.length, MAX_ENQUIRY_TURNS);
    assert.equal(stored.turns[0].parent, "q6", "the oldest five dropped off");
    assert.equal(stored.turns.at(-1).parent, `q${MAX_ENQUIRY_TURNS + 5}`);
    assert.equal(
      stored.turnCount,
      MAX_ENQUIRY_TURNS + 5,
      "the count still says how many there were"
    );
  });

  it("cuts a very long question or answer to what the model allows instead of failing", async () => {
    await enquiries.recordTurn(
      HASH,
      "q".repeat(900),
      "a".repeat(5000),
      new Date(Date.now() - 1000)
    );
    const stored = await WhatsAppEnquiry.findOne({}).lean();
    assert.equal(stored.turns[0].parent.length, 500);
    assert.equal(stored.turns[0].assistant.length, 2000);
  });

  it("adds an exchange without changing the guidance or the message count", async () => {
    await enquiries.recordTurn(HASH, "which sport?", "Try swimming.", new Date(Date.now() - 1000));
    await enquiries.addExchange(
      HASH,
      "I would like help finding a coach",
      "We have noted that. Your reference: PMS-ABCDE"
    );

    const stored = await WhatsAppEnquiry.findOne({}).lean();
    assert.equal(stored.turns.length, 2);
    assert.match(stored.turns[1].assistant, /PMS-ABCDE/);
    assert.equal(stored.guidance, "Try swimming.");
    assert.equal(stored.turnCount, 1);
  });

  it("an enquiry from before this change reads as having no exchanges, and gains them", async () => {
    const reference = "PMS-OLD22";
    await WhatsAppEnquiry.collection.insertOne({
      phoneHash: HASH,
      parentRef: enquiries.parentRefFor(HASH),
      reference,
      question: "old question",
      guidance: "old answer",
      assistance: [],
      followUpStatus: "none",
      closed: false,
      turnCount: 1,
      lastMessageAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    await enquiries.recordTurn(HASH, "a new message", "a new answer", new Date(Date.now() - 1000));
    const stored = await WhatsAppEnquiry.findOne({ reference }).lean();
    assert.equal(stored.turns.length, 1);
    assert.equal(stored.guidance, "a new answer");
  });

  it("is deleted with the rest on STOP", async () => {
    await enquiries.recordTurn(HASH, "q", "a", new Date(Date.now() - 1000));
    await enquiries.forgetAllEnquiries(HASH);
    assert.equal(await WhatsAppEnquiry.countDocuments({}), 0);
  });

  it("is promised to the parent in the first message, in both versions, and the promise matches the retention", () => {
    for (const notice of [FIRST_CONTACT_NOTICE, FIRST_CONTACT_NOTICE_MEMBER]) {
      assert.match(notice, /Our team can read your questions and my answers for up to 6 months/);
      assert.match(notice, /improve PowerMySport/);
      assert.match(notice, /STOP/);
      assert.ok(!notice.includes("—"), "no em dashes in copy");
    }
    // Six months is what the enquiry expiry enforces: 180 days.
    assert.equal(ENQUIRY_RETENTION_SECONDS, 60 * 60 * 24 * 180);
  });
});
