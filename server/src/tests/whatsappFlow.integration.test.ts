// The WhatsApp flow end to end, minus Meta and the model: the welcome menu, taps that mean something
// without a model call, the next-steps request a tool leaves for after the reply, and what each of
// those does to the enquiry record. Real (in-memory) MongoDB; the model call is a stub.
process.env.JWT_SECRET = "test-secret-test-secret-test-secret-1234567890";
process.env.REDIS_ENABLED = "false";
process.env.BANK_ENCRYPTION_KEY = "0123456789abcdef".repeat(4);

import assert = require("node:assert/strict");
const { after, before, beforeEach, describe, it } = require("node:test");
const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");

const { WhatsAppEnquiry } = require("../client/models/WhatsAppEnquiry");
const { WhatsAppConversation } = require("../client/models/WhatsAppConversation");
const { ASSISTANT_CHAT_TOOLS } = require("../shared/services/chatToolsService");
const {
  answerWhatsAppMessage,
  CHANNEL_ADDENDUM,
} = require("../shared/services/whatsappAssistantService");
const enquiries = require("../shared/services/whatsappEnquiries");
const redis = require("../config/redis").default;

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
  await Promise.all([WhatsAppEnquiry.deleteMany({}), WhatsAppConversation.deleteMany({})]);
});

// A number of its own for each run: the daily message count lives in Redis and outlasts a run,
// so a fixed number would stop answering after a few runs in one day.
const PHONE = `9198${String(Date.now()).slice(-8)}`;
const msg = (text: string, replyId?: string, id = `wamid.${Math.random()}`) => ({
  id,
  from: PHONE,
  type: replyId ? "interactive" : "text",
  text,
  replyId: replyId ?? null,
});

type Call = { userMessage: string; toolContext: any };
const stub = (reply: string, calls: Call[] = [], beforeReply?: (ctx: any) => Promise<void>) =>
  async function* (_system: string, _history: unknown[], userMessage: string, toolContext: any) {
    calls.push({ userMessage, toolContext });
    await beforeReply?.(toolContext);
    yield reply;
  };
const neverCalled = (calls: Call[]) => stub("should not be asked", calls);

describe("the welcome menu", () => {
  it("answers a first hello with the menu, no model call, and the first-contact notice", async () => {
    const calls: Call[] = [];
    const answer = await answerWhatsAppMessage(msg("Hi"), neverCalled(calls));

    assert.equal(answer.menu, true);
    assert.equal(answer.firstContact, true);
    assert.match(answer.reply, /Welcome to PowerMySport/);
    assert.equal(calls.length, 0);
  });

  it("does not repeat the notice on the second hello, and stores the exchange", async () => {
    await answerWhatsAppMessage(msg("Hi"), neverCalled([]));
    const again = await answerWhatsAppMessage(msg("menu"), neverCalled([]));

    assert.equal(again.firstContact, false);
    assert.equal(again.menu, true);
    const conversation = await WhatsAppConversation.findOne({}).lean();
    assert.equal(conversation.messages.length, 4);
  });

  it("goes to the assistant when the first message is a real question", async () => {
    const calls: Call[] = [];
    const answer = await answerWhatsAppMessage(
      msg("Hi, which sport suits a 9 year old?"),
      stub("Try swimming.", calls)
    );
    assert.equal(answer.menu, undefined);
    assert.equal(calls.length, 1);
  });

  it("turns a tapped menu row into a sentence the assistant can act on", async () => {
    const calls: Call[] = [];
    await answerWhatsAppMessage(
      msg("Choosing the right sport", "menu_sport"),
      stub("Tell me about your child.", calls)
    );
    assert.equal(calls[0]!.userMessage, "I need help choosing the right sport for my child.");
    const enquiry = await WhatsAppEnquiry.findOne({}).lean();
    assert.equal(enquiry.question, "I need help choosing the right sport for my child.");
  });

  it("treats an unknown id as the text the parent saw", async () => {
    const calls: Call[] = [];
    await answerWhatsAppMessage(msg("Some old button", "stale_id"), stub("Ok.", calls));
    assert.equal(calls[0]!.userMessage, "Some old button");
  });
});

describe("finishing and feedback", () => {
  const talk = async () => {
    await answerWhatsAppMessage(
      msg("My son is 12 and plays tennis. Which tournaments?"),
      stub("Here.")
    );
    await enquiries.updateEnquiry(
      require("../shared/services/whatsappAssistantService").hashPhone(PHONE),
      "q",
      { sport: "Tennis" }
    );
  };

  it("'I'm good for now' closes the topic without the model and asks for feedback", async () => {
    await talk();
    const calls: Call[] = [];
    const answer = await answerWhatsAppMessage(
      msg("I'm good for now", "next_done"),
      neverCalled(calls)
    );

    assert.equal(answer.feedbackPrompt, true);
    assert.equal(calls.length, 0);
    assert.equal((await WhatsAppEnquiry.findOne({}).lean()).closed, true);
  });

  it("a tapped feedback button is recorded on the topic that was just closed", async () => {
    await talk();
    await answerWhatsAppMessage(msg("I'm good for now", "next_done"), neverCalled([]));
    const answer = await answerWhatsAppMessage(msg("Yes, helpful", "fb_helpful"), neverCalled([]));

    assert.match(answer.reply, /Thank you/);
    const all = await WhatsAppEnquiry.find({}).lean();
    assert.equal(all.length, 1, "no new topic was opened for the tap");
    assert.equal(all[0].feedback, "helpful");
  });

  it("'not helpful' is recorded and answered kindly", async () => {
    await talk();
    await answerWhatsAppMessage(msg("I'm good for now", "next_done"), neverCalled([]));
    const answer = await answerWhatsAppMessage(
      msg("Not really", "fb_not_helpful"),
      neverCalled([])
    );

    assert.match(answer.reply, /Sorry/);
    assert.equal((await WhatsAppEnquiry.findOne({}).lean()).feedback, "not_helpful");
  });

  it("finishing with no recent topic just says thanks, with no feedback prompt", async () => {
    const answer = await answerWhatsAppMessage(
      msg("I'm good for now", "next_done"),
      neverCalled([])
    );
    assert.equal(answer.feedbackPrompt, undefined);
    assert.equal(await WhatsAppEnquiry.countDocuments({}), 0);
  });
});

describe("the next-steps list", () => {
  const offer = ASSISTANT_CHAT_TOOLS.find((t: { name: string }) => t.name === "offer_next_steps");

  it("is requested by the tool and reported on the answer", async () => {
    const answer = await answerWhatsAppMessage(
      msg("My daughter is 9. Swimming or tennis?"),
      stub("Your situation: ...", [], async (ctx) => {
        await offer.execute({}, ctx);
      })
    );
    assert.equal(answer.nextSteps, true);
  });

  it("is not on the answer when the tool was not called", async () => {
    const answer = await answerWhatsAppMessage(msg("What is the fee?"), stub("Rs 1000."));
    assert.equal(answer.nextSteps, undefined);
  });

  it("does nothing on a channel with no outbound request (the website)", async () => {
    assert.deepEqual(await offer.execute({}, { userMessage: "x" }), { shown: false });
    assert.deepEqual(await offer.execute({}, undefined), { shown: false });
  });
});

describe("the prompt", () => {
  it("carries the four-part guidance shape and the do-not-offer-what-you-cannot-do rule", () => {
    for (const part of ["Your situation", "What to consider", "My recommendation", "Why"]) {
      assert.ok(CHANNEL_ADDENDUM.includes(part), part);
    }
    assert.match(CHANNEL_ADDENDUM, /unless a tool shows it is/);
    assert.match(CHANNEL_ADDENDUM, /Ask only what you need/);
  });
});

describe("asking the team to follow up on WhatsApp", () => {
  const { decryptValue } = require("../shared/utils/encryption");
  const { followUpReply } = require("../shared/services/whatsappInteractive");
  const {
    hashPhone,
    answerWhatsAppMessage: answer,
  } = require("../shared/services/whatsappAssistantService");
  const { WEB_CHAT_TOOLS, WHATSAPP_CHAT_TOOLS } = require("../shared/services/chatToolsService");
  const followUp = ASSISTANT_CHAT_TOOLS.find(
    (t: { name: string }) => t.name === "request_whatsapp_followup"
  );

  const talk = () =>
    answer(msg("My son is 12 and plays tennis. What should we do next?"), stub("Here is advice."));

  it("tapping 'Find a coach or academy' records the request, with no model call", async () => {
    await talk();
    const calls: Call[] = [];
    const reply = await answer(msg("Find a coach or academy", "next_coach"), neverCalled(calls));

    assert.equal(calls.length, 0);
    assert.match(reply.reply, /We have noted that you are looking for a coach or academy/);
    assert.match(reply.reply, /get back to you here on WhatsApp/);
    const enquiry = await WhatsAppEnquiry.findOne({}).lean();
    assert.equal(enquiry.followUpStatus, "new");
    assert.ok(enquiry.assistance.includes("coach"));
    assert.ok(reply.reply.includes(enquiry.reference), "the parent is given the reference");
  });

  it("keeps the parent's number, encrypted, so the team can answer here", async () => {
    await talk();
    await answer(msg("Find a coach or academy", "next_coach"), neverCalled([]));
    const enquiry = await WhatsAppEnquiry.findOne({}).lean();
    assert.ok(enquiry.contactPhoneEnc);
    assert.equal(decryptValue(enquiry.contactPhoneEnc), PHONE);
    assert.ok(!JSON.stringify(enquiry).includes(PHONE));
  });

  it("tapping twice is one request with one reference", async () => {
    await talk();
    const first = await answer(msg("Find a coach or academy", "next_coach"), neverCalled([]));
    const second = await answer(msg("Find a coach or academy", "next_coach"), neverCalled([]));

    assert.match(second.reply, /already with our team/);
    assert.equal(await WhatsAppEnquiry.countDocuments({}), 1);
    const reference = (await WhatsAppEnquiry.findOne({}).lean()).reference;
    assert.ok(first.reply.includes(reference) && second.reply.includes(reference));
  });

  it("an expert request also keeps the self-serve link open", async () => {
    await talk();
    const reply = await answer(msg("Speak to a sports expert", "next_expert"), neverCalled([]));
    assert.match(reply.reply, /sports expert/);
    assert.match(reply.reply, /https:\/\/powermysport\.com\/experts/);
    assert.ok((await WhatsAppEnquiry.findOne({}).lean()).assistance.includes("expert"));
  });

  it("works with no earlier conversation, and does not use up a daily message", async () => {
    const reply = await answer(msg("Find a coach or academy", "next_coach"), neverCalled([]));
    assert.match(reply.reply, /Your reference: PMS-/);
    assert.equal(await WhatsAppEnquiry.countDocuments({ followUpStatus: "new" }), 1);
  });

  it("the tool refuses without a clear yes, and records with one", async () => {
    const ctx = { phoneHash: hashPhone(PHONE), userMessage: "talk to someone" };
    const refused = await followUp.execute({ kind: "team", summary: "x" }, ctx);
    assert.equal(refused.sent, false);
    assert.match(refused.instruction, /clear yes/);
    assert.equal(await WhatsAppEnquiry.countDocuments({}), 0);

    const sent = await followUp.execute(
      { kind: "team", summary: "wants a call about academies", parentAgreed: true },
      ctx
    );
    assert.equal(sent.sent, true);
    assert.match(sent.reference, /^PMS-/);
    assert.match(sent.instruction, /WhatsApp/);
    const enquiry = await WhatsAppEnquiry.findOne({}).lean();
    assert.equal(enquiry.followUpStatus, "new");
    assert.equal(enquiry.followUpSummary, "wants a call about academies");
  });

  it("the tool does nothing, and says where to go instead, outside WhatsApp", async () => {
    const out = await followUp.execute({ kind: "team", summary: "x", parentAgreed: true }, {});
    assert.equal(out.sent, false);
    assert.match(out.instruction, /powermysport\.com\/contact/);
    assert.equal(await WhatsAppEnquiry.countDocuments({}), 0);
  });

  it("an unknown kind falls back to 'team' rather than being stored", async () => {
    const ctx = { phoneHash: hashPhone(PHONE), userMessage: "q" };
    await followUp.execute({ kind: "<script>", summary: "x", parentAgreed: true }, ctx);
    assert.deepEqual((await WhatsAppEnquiry.findOne({}).lean()).assistance, ["team"]);
  });

  it("each channel is shown only its own way of reaching the team", () => {
    const names = (tools: Array<{ name: string }>) => tools.map((t) => t.name);
    assert.ok(names(WHATSAPP_CHAT_TOOLS).includes("request_whatsapp_followup"));
    assert.ok(!names(WHATSAPP_CHAT_TOOLS).includes("request_team_followup"));
    assert.ok(names(WEB_CHAT_TOOLS).includes("request_team_followup"));
    for (const only of ["request_whatsapp_followup", "record_enquiry", "offer_next_steps"]) {
      assert.ok(!names(WEB_CHAT_TOOLS).includes(only), `${only} is not on the website`);
    }
  });

  it("the wording never promises a time and never asks for contact details", () => {
    for (const kind of ["coach", "expert", "team", "tournaments", "other"] as const) {
      for (const already of [false, true]) {
        const text = followUpReply(kind, "PMS-ABCDE", already);
        assert.ok(text.includes("PMS-ABCDE"));
        assert.ok(!/hours|within|today|tomorrow|email|phone number/i.test(text), text);
        assert.ok(!text.includes("—"), "no em dashes in copy");
      }
    }
  });

  it("STOP deletes the request and the number kept for it", async () => {
    await talk();
    await answer(msg("Find a coach or academy", "next_coach"), neverCalled([]));
    assert.equal(await WhatsAppEnquiry.countDocuments({}), 1);
    await answer(msg("STOP"), neverCalled([]));
    assert.equal(await WhatsAppEnquiry.countDocuments({}), 0);
  });
});
