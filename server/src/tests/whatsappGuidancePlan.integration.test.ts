// Making a development plan from WhatsApp: the yes check, the two steps, the limits and the
// switch. Real (in-memory) MongoDB; the model is a stub, so there is no network, no key and no cost.
process.env.JWT_SECRET = "test-secret-test-secret-test-secret-1234567890";
process.env.REDIS_ENABLED = "false";
process.env.FRONTEND_URL = "https://site.example.test";

import assert = require("node:assert/strict");
const { after, afterEach, before, beforeEach, describe, it } = require("node:test");
const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");

const { User } = require("../client/models/User");
const { Player } = require("../client/models/Player");
const { GuidanceSubmission } = require("../client/models/GuidanceSubmission");
const { WhatsAppConversation } = require("../client/models/WhatsAppConversation");
const { PlanCheckIn } = require("../shared/models/PlanCheckIn");
const guidanceAi = require("../shared/services/guidanceAiService");
const { ASSISTANT_CHAT_TOOLS } = require("../shared/services/chatToolsService");
const { isAffirmative } = require("../shared/services/whatsappPendingAction");
const {
  answerWhatsAppMessage,
  hashPhone,
  identityAddendum,
} = require("../shared/services/whatsappAssistantService");
const redis = require("../config/redis").default;

let mongod: { getUri(): string; stop(): Promise<void> };
const realGenerate = guidanceAi.generateYouthSportsGuidance;
let generated: Array<Record<string, unknown>> = [];
let generatorBehaviour: () => unknown;

const planResponse = () => ({
  profileAnalysis: "A focused player.",
  idealCoachingStyle: "Structured and patient",
  weeklyBlueprint: { trainingHours: "6 hours", freePlayHours: "2 hours", restDays: "1 day" },
  recommendedPlatformActions: "Start with a trial session.",
  recommendedSports: ["Tennis"],
  goalAssessment: { statedGoal: "Play state level", verdict: "Ambitious", rationale: "Needs time" },
  journeyPhases: [
    { title: "Build the base", timeframe: "0 to 6 months", focus: "Technique", milestones: ["a"] },
  ],
});

before(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
});

after(async () => {
  guidanceAi.generateYouthSportsGuidance = realGenerate;
  await mongoose.disconnect();
  await mongod.stop();
  redis.disconnect();
});

beforeEach(async () => {
  process.env.WHATSAPP_GUIDANCE_PLAN = "on";
  generated = [];
  generatorBehaviour = planResponse;
  guidanceAi.generateYouthSportsGuidance = async (payload: Record<string, unknown>) => {
    generated.push(payload);
    return generatorBehaviour();
  };
  await Promise.all([
    User.collection.deleteMany({}),
    Player.deleteMany({}),
    GuidanceSubmission.deleteMany({}),
    WhatsAppConversation.deleteMany({}),
    PlanCheckIn.deleteMany({}),
  ]);
});

afterEach(() => {
  guidanceAi.generateYouthSportsGuidance = realGenerate;
  delete process.env.WHATSAPP_GUIDANCE_PLAN;
});

const HASH = "hash-plan-parent";
const oid = () => new mongoose.Types.ObjectId();
const tool = (name: string) => ASSISTANT_CHAT_TOOLS.find((t: { name: string }) => t.name === name);

const fullChild = {
  name: "Aarav Kapoor",
  dob: new Date("2012-12-01T00:00:00Z"),
  gender: "MALE",
  sportsFocus: ["Tennis"],
  chosenSport: "Tennis",
  yearsPlaying: 3,
  location: "Delhi",
  ambition: "competitive",
  experienceLevel: "intermediate",
  weeklyHoursCategory: "4-7",
  budgetRange: "7k-15k",
};

const parentWith = async (...children: Array<Record<string, unknown>>) => {
  const _id = oid();
  await User.collection.insertOne({
    _id,
    name: "Meera Kapoor",
    email: `${_id}@example.test`,
    phone: `98${Math.floor(10000000 + Math.random() * 89999999)}`,
    role: "Parent",
    isActive: true,
    status: "ACTIVE",
  });
  const made = [];
  for (const child of children) made.push(await Player.create({ userId: _id, ...child }));
  return { userId: String(_id), children: made };
};

const ctx = (userId: string, userMessage = "make a plan") => ({
  userId,
  phoneHash: HASH,
  userMessage,
});

/** The parent's next message arrives: the service counts one more turn. */
const nextTurn = () =>
  WhatsAppConversation.updateOne({ phoneHash: HASH }, { $inc: { totalMessageCount: 1 } });

const prepare = (c: Record<string, unknown>, args: Record<string, unknown> = {}) =>
  tool("prepare_guidance_plan").execute(args, c);
const confirm = (c: Record<string, unknown>) => tool("confirm_pending_action").execute({}, c);

const pendingOf = async () =>
  (await WhatsAppConversation.findOne({ phoneHash: HASH }).lean())?.pendingAction;

describe("is this message a yes", () => {
  it("accepts a clear yes in English, Hinglish and Devanagari", () => {
    for (const text of [
      "yes",
      "Yes!",
      "YES please",
      "ok",
      "okay",
      "sure",
      "go ahead",
      "yes go ahead",
      "yes, do it",
      "haan",
      "Haan ji",
      "haan bana do",
      "kar do",
      "theek hai",
      "ठीक है",
      "हाँ",
      "हां बना दो",
      "👍 yes",
    ]) {
      assert.equal(isAffirmative(text), true, text);
    }
  });

  it("refuses anything that is not only a yes", () => {
    for (const text of [
      "",
      "   ",
      "no",
      "not yet",
      "yes but add cricket",
      "what do you do",
      "can you explain first",
      "yes yes yes yes yes yes yes yes",
      "ok but wait",
      "nahi",
      "mat banao",
      "tell me more",
      "make a plan for Aarav",
      "I said yes to the other one but change the sport",
    ]) {
      assert.equal(isAffirmative(text), false, text);
    }
    assert.equal(isAffirmative(undefined), false);
    assert.equal(isAffirmative(null), false);
  });
});

describe("the switch and the account", () => {
  it("both tools decline while the switch is off", async () => {
    delete process.env.WHATSAPP_GUIDANCE_PLAN;
    const { userId } = await parentWith(fullChild);
    for (const out of [await prepare(ctx(userId)), await confirm(ctx(userId, "yes"))]) {
      assert.equal(out.available, false);
      assert.match(out.instruction, /not switched on yet/);
    }
    assert.equal(generated.length, 0);
  });

  it("both decline for a number with no account, and outside a WhatsApp chat", async () => {
    for (const out of [
      await prepare({ phoneHash: HASH, userMessage: "x" }),
      await confirm({ phoneHash: HASH, userMessage: "yes" }),
      await prepare({}),
    ]) {
      assert.equal(out.reason, "number_not_linked");
    }
  });
});

describe("step one: prepare", () => {
  it("prepares a full profile, saves the request, and makes and asks nothing", async () => {
    const { userId, children } = await parentWith(fullChild);
    const out = await prepare(ctx(userId), { childName: "Aarav" });

    assert.equal(out.ready, true);
    assert.equal(out.child, "Aarav");
    assert.equal(out.sport, "Tennis");
    assert.deepEqual(out.assumptions, []);
    assert.match(out.instruction, /reply YES/);
    assert.match(out.instruction, /Do NOT call confirm_pending_action/);

    const pending = await pendingOf();
    assert.equal(pending.payload.request.dependent_id, String(children[0]._id));
    assert.equal(pending.payload.request.sport, "Tennis");
    assert.equal(generated.length, 0, "the model is not called");
    assert.equal(await GuidanceSubmission.countDocuments({}), 0);
  });

  it("uses the only child without being told which", async () => {
    const { userId } = await parentWith(fullChild);
    assert.equal((await prepare(ctx(userId))).ready, true);
  });

  it("asks which child when there are several, and when the name is not on the profile", async () => {
    const { userId } = await parentWith(fullChild, { ...fullChild, name: "Riya Kapoor" });
    const which = await prepare(ctx(userId));
    assert.equal(which.reason, "which_child");
    assert.deepEqual(which.children, ["Aarav", "Riya"]);

    const wrong = await prepare(ctx(userId), { childName: "Vikrant" });
    assert.equal(wrong.reason, "child_not_on_account");
    assert.deepEqual(wrong.childrenOnAccount, ["Aarav", "Riya"]);
    assert.equal(await pendingOf(), undefined);
  });

  it("cannot reach another parent's child", async () => {
    const mine = await parentWith(fullChild);
    await parentWith({ ...fullChild, name: "Zoya Other" });
    const out = await prepare(ctx(mine.userId), { childName: "Zoya" });
    assert.equal(out.reason, "child_not_on_account");
    assert.ok(!JSON.stringify(out).includes("Zoya Other"));
  });

  it("says plainly when there is no child on the profile", async () => {
    const { userId } = await parentWith();
    assert.equal((await prepare(ctx(userId))).reason, "no_children");
  });

  it("asks only for what the profile lacks, one question at a time, and prepares nothing yet", async () => {
    const { userId } = await parentWith({ ...fullChild, gender: undefined });
    const out = await prepare(ctx(userId));

    assert.equal(out.ready, false);
    assert.equal(out.reason, "needs_answers");
    assert.equal(out.next.field, "gender");
    assert.deepEqual(out.next.options, ["boy", "girl"]);
    assert.equal(await pendingOf(), undefined);

    const answered = await prepare(ctx(userId), { gender: "girl" });
    assert.equal(answered.ready, true);
    assert.equal((await pendingOf()).payload.request.child_gender, "female");
  });

  it("lets the parent skip the optional questions and says what it assumed", async () => {
    const { userId } = await parentWith({
      ...fullChild,
      ambition: undefined,
      experienceLevel: undefined,
      weeklyHoursCategory: undefined,
    });
    const asked = await prepare(ctx(userId));
    assert.equal(asked.next.optional, true);

    const skipped = await prepare(ctx(userId), { skipOptionalQuestions: true });
    assert.equal(skipped.ready, true);
    assert.deepEqual(skipped.assumptions, [
      "a general fitness goal",
      "an intermediate level",
      "6 hours a week",
    ]);
  });

  it("asks for a supported sport when the child's is one we do not make plans for", async () => {
    const { userId } = await parentWith({
      ...fullChild,
      chosenSport: "Curling",
      sportsFocus: ["Curling"],
    });
    const out = await prepare(ctx(userId));
    assert.equal(out.next.field, "sport");
    assert.equal(out.next.options.length, 10);
    assert.equal(await pendingOf(), undefined);
  });

  it("carries the parent's own words into the plan request, as plain text", async () => {
    const { userId } = await parentWith(fullChild);
    await prepare(ctx(userId), { question: "He gets nervous <b>before</b> matches" });
    const request = (await pendingOf()).payload.request;
    assert.equal(request.plan_horizon, "auto");
    assert.ok(!request.parent_specific_question.includes("<"));
  });

  it("replaces an earlier prepared plan instead of keeping two", async () => {
    const { userId } = await parentWith(fullChild);
    await prepare(ctx(userId), { question: "first" });
    await prepare(ctx(userId), { question: "second" });
    assert.equal((await pendingOf()).payload.request.parent_specific_question, "second");
  });
});

describe("step two: confirm", () => {
  const prepared = async (...children: Array<Record<string, unknown>>) => {
    const parent = await parentWith(...(children.length ? children : [fullChild]));
    await prepare(ctx(parent.userId));
    await nextTurn();
    return parent;
  };

  it("makes nothing when the parent's message is not a clear yes, and keeps the plan waiting", async () => {
    const { userId } = await prepared();
    for (const text of ["tell me more", "yes but add cricket", "no", ""]) {
      const out = await confirm(ctx(userId, text));
      assert.equal(out.done, false, text);
      assert.equal(out.reason, "not_confirmed", text);
    }
    assert.ok(await pendingOf(), "still waiting");
    assert.equal(generated.length, 0);
    assert.equal(await GuidanceSubmission.countDocuments({}), 0);
  });

  it("cannot be confirmed in the same turn that prepared it, even with a yes", async () => {
    const { userId } = await parentWith(fullChild);
    await prepare(ctx(userId));
    // No new message has arrived: the model is trying to prepare and confirm in one reply.
    const out = await confirm(ctx(userId, "yes"));
    assert.equal(out.done, false);
    assert.equal(out.reason, "not_confirmed");
    assert.equal(generated.length, 0);
    assert.ok(await pendingOf());
  });

  it("makes and saves the plan after a yes, schedules the check-in, and gives a short summary and the link", async () => {
    const { userId, children } = await prepared();
    const out = await confirm(ctx(userId, "Yes please"));

    assert.equal(out.created, true);
    assert.equal(out.link, "https://site.example.test/guidance");
    assert.equal(out.plan.child, "Aarav");
    assert.equal(out.plan.goal.verdict, "Ambitious");
    assert.equal(out.plan.weeklyBlueprint.trainingHours, "6 hours");
    assert.equal(out.plan.burnoutRisk.level, "low");
    assert.match(out.instruction, /Do not paste the whole plan/);

    const saved = await GuidanceSubmission.findOne({}).lean();
    assert.equal(String(saved.userId), userId);
    assert.equal(String(saved.request.dependent_id), String(children[0]._id));
    assert.equal(saved.request.sport, "Tennis");
    assert.equal(generated.length, 1);
    assert.ok(!JSON.stringify(generated[0]).includes("Aarav"), "no name goes to the model");
    assert.equal(await pendingOf(), undefined, "the waiting plan is used up");

    await new Promise((resolve) => setTimeout(resolve, 150));
    assert.equal(await PlanCheckIn.countDocuments({ userId }), 1);
  });

  it("makes one plan when two yeses arrive together", async () => {
    const { userId } = await prepared();
    const [a, b] = await Promise.all([confirm(ctx(userId, "yes")), confirm(ctx(userId, "yes"))]);

    assert.equal([a, b].filter((r) => r.created === true).length, 1);
    assert.equal(await GuidanceSubmission.countDocuments({}), 1);
    assert.equal(generated.length, 1, "the model is called once");
  });

  it("refuses when nothing is waiting, and after fifteen minutes", async () => {
    const { userId } = await parentWith(fullChild);
    assert.equal((await confirm(ctx(userId, "yes"))).reason, "nothing_pending");

    await prepare(ctx(userId));
    await nextTurn();
    await WhatsAppConversation.updateOne(
      { phoneHash: HASH },
      { $set: { "pendingAction.createdAt": new Date(Date.now() - 16 * 60_000) } }
    );
    const late = await confirm(ctx(userId, "yes"));
    assert.equal(late.reason, "nothing_pending");
    assert.equal(generated.length, 0);
  });

  it("saves nothing and keeps the plan waiting when the model fails, so a retry works", async () => {
    const { userId } = await prepared();
    generatorBehaviour = () => {
      throw new Error("quota exceeded");
    };
    const failed = await confirm(ctx(userId, "yes"));
    assert.equal(failed.created, false);
    assert.equal(failed.reason, "unavailable");
    assert.match(failed.instruction, /nothing was saved/);
    assert.equal(await GuidanceSubmission.countDocuments({}), 0);
    assert.ok(await pendingOf(), "put back for the retry");

    generatorBehaviour = planResponse;
    await nextTurn();
    assert.equal((await confirm(ctx(userId, "yes"))).created, true);
    assert.equal(await GuidanceSubmission.countDocuments({}), 1);
  });
});

describe("the shared confirm step", () => {
  it("adds `done` to every reply, so there is one thing to check whatever was set up", async () => {
    const parent = await parentWith(fullChild);
    await prepare(ctx(parent.userId));
    await nextTurn();
    assert.equal((await confirm(ctx(parent.userId, "no"))).done, false);
    assert.equal((await confirm(ctx(parent.userId, "yes"))).done, true);

    // Nothing waiting now: still a `done`.
    assert.equal((await confirm(ctx(parent.userId, "yes"))).done, false);
  });

  it("keeps the plan-specific fields on a plan's reply alongside `done`", async () => {
    const parent = await parentWith(fullChild);
    await prepare(ctx(parent.userId));
    await nextTurn();
    const out = await confirm(ctx(parent.userId, "yes"));
    assert.equal(out.done, true);
    assert.equal(out.created, true);
    assert.equal(out.link, "https://site.example.test/guidance");
  });

  it("does nothing for a waiting action of a kind it does not know, and leaves it waiting", async () => {
    const parent = await parentWith(fullChild);
    await WhatsAppConversation.create({
      phoneHash: HASH,
      totalMessageCount: 3,
      pendingAction: { kind: "from_the_future", payload: {}, turn: 1, createdAt: new Date() },
    });
    const out = await confirm(ctx(parent.userId, "yes"));
    assert.equal(out.done, false);
    assert.equal(out.reason, "unavailable");
    assert.ok(await pendingOf(), "not consumed");
    assert.equal(generated.length, 0);
  });

  it("says plainly that nothing was changed when the action throws, and keeps it for a retry", async () => {
    const parent = await parentWith(fullChild);
    await prepare(ctx(parent.userId));
    await nextTurn();
    // An unexpected failure inside the executor (not the model call, which it handles itself).
    const original = GuidanceSubmission.create;
    GuidanceSubmission.create = async () => {
      throw new Error("database down");
    };
    try {
      const out = await confirm(ctx(parent.userId, "yes"));
      assert.equal(out.done, false);
      assert.ok(await pendingOf(), "put back");
    } finally {
      GuidanceSubmission.create = original;
    }
  });

  it("describes the tool as covering whatever was set up, not only a plan", () => {
    assert.match(tool("confirm_pending_action").description, /a prepare tool/);
    assert.equal(tool("confirm_guidance_plan"), undefined, "the old name is gone");
  });
});

describe("the daily limits", () => {
  const submissionFor = (userId: string, dependentId: unknown, createdAt: Date) =>
    GuidanceSubmission.create({
      userId,
      createdAt,
      request: {
        child_age: 13,
        child_gender: "male",
        current_fitness_level: "Moderate",
        primary_objective: "Compete",
        weekly_time_commitment: 6,
        budget_tier: "Moderate",
        sport: "Tennis",
        dependent_id: dependentId,
      },
      response: planResponse(),
    });

  it("allows one plan per child a day, and says where the saved one is", async () => {
    const { userId, children } = await parentWith(fullChild);
    await submissionFor(userId, children[0]._id, new Date(Date.now() - 2 * 3600_000));

    const out = await prepare(ctx(userId));
    assert.equal(out.reason, "daily_limit");
    assert.match(out.instruction, /already has a plan made in the last day/);
    assert.match(out.instruction, /\/guidance/);
    assert.equal(await pendingOf(), undefined);
  });

  it("does not count a plan older than a day", async () => {
    const { userId, children } = await parentWith(fullChild);
    await submissionFor(userId, children[0]._id, new Date(Date.now() - 26 * 3600_000));
    assert.equal((await prepare(ctx(userId))).ready, true);
  });

  it("allows three plans an account a day", async () => {
    const { userId } = await parentWith(fullChild);
    for (let i = 0; i < 3; i += 1) await submissionFor(userId, oid(), new Date());
    const out = await prepare(ctx(userId));
    assert.equal(out.reason, "daily_limit");
    assert.match(out.instruction, /limited to 3 a day/);
  });

  it("counts the website's plans too, since they are the same allowance", async () => {
    const { userId, children } = await parentWith(fullChild);
    await submissionFor(userId, children[0]._id, new Date());
    assert.equal((await prepare(ctx(userId))).reason, "daily_limit");
  });

  it("checks again at confirm, in case a plan was made in between", async () => {
    const { userId, children } = await parentWith(fullChild);
    await prepare(ctx(userId));
    await nextTurn();
    await submissionFor(userId, children[0]._id, new Date());

    const out = await confirm(ctx(userId, "yes"));
    assert.equal(out.created, false);
    assert.equal(out.reason, "daily_limit");
    assert.equal(generated.length, 0);
  });
});

describe("in the WhatsApp assistant", () => {
  const PHONE = "919811111111";
  const msg = (text: string, id = "wamid.1") => ({ id, from: PHONE, type: "text", text });

  type Seen = { systemPrompt: string; toolContext: Record<string, unknown> };
  const stub = (seen: Seen[]) =>
    async function* (
      systemPrompt: string,
      _h: unknown[],
      _m: string,
      toolContext: Seen["toolContext"]
    ) {
      seen.push({ systemPrompt, toolContext });
      yield "Hello.";
    };

  it("hands the tools the parent's own message, trimmed", async () => {
    const seen: Seen[] = [];
    await answerWhatsAppMessage(msg("  Yes please  "), stub(seen));
    assert.equal(seen[0]!.toolContext.userMessage, "Yes please");
    assert.equal(seen[0]!.toolContext.phoneHash, hashPhone(PHONE));
  });

  it("tells a known parent's assistant how to make a plan, and not an unknown number's", () => {
    const known = identityAddendum(true, null, []);
    assert.match(known, /Making a development plan/);
    assert.match(known, /prepare_guidance_plan/);
    assert.match(
      known,
      /Never say a plan is made, or promise one, until confirm_pending_action returns done: true/
    );
    assert.ok(!identityAddendum(false, null, []).includes("Making a development plan"));
  });

  it("deletes a waiting plan with the chat on STOP", async () => {
    const { userId } = await parentWith(fullChild);
    // The chat is keyed by the hash of the number that sends STOP, so prepare under that hash.
    const phoneHash = hashPhone(PHONE);
    await prepare({ userId, phoneHash, userMessage: "plan" });
    assert.ok(
      (await WhatsAppConversation.findOne({ phoneHash }).lean())?.pendingAction,
      "a plan is waiting"
    );

    await answerWhatsAppMessage(msg("STOP", "wamid.2"), stub([]));
    assert.equal(await WhatsAppConversation.countDocuments({ phoneHash }), 0);
    assert.equal(await WhatsAppConversation.countDocuments({}), 0);
  });

  it("registers both tools, described to the model", () => {
    assert.ok(tool("prepare_guidance_plan"));
    assert.ok(tool("confirm_pending_action"));
    assert.match(tool("confirm_pending_action").description, /checks their message itself/);
  });
});
