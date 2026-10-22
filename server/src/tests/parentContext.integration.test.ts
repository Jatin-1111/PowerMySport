// What the assistant may know about a parent, read from a real (in-memory) database.
// The point of these tests is as much what is left out as what is in.
process.env.JWT_SECRET = "test-secret-test-secret-test-secret-1234567890";
process.env.REDIS_ENABLED = "false";

import assert = require("node:assert/strict");
const { after, before, beforeEach, describe, it } = require("node:test");
const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");

const { User } = require("../client/models/User");
const { Player } = require("../client/models/Player");
const { SeasonPlan } = require("../client/models/SeasonPlan");
const { ExpertSession } = require("../client/models/ExpertBooking");
const { Expert } = require("../client/models/ExpertProfile");
const { GuidanceSubmission } = require("../client/models/GuidanceSubmission");
const { getParentContext, formatParentContext } = require("../shared/services/parentContext");
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
  await Promise.all([
    User.deleteMany({}),
    Player.deleteMany({}),
    SeasonPlan.deleteMany({}),
    ExpertSession.deleteMany({}),
    Expert.deleteMany({}),
    GuidanceSubmission.deleteMany({}),
  ]);
});

const NOW = new Date("2026-10-22T10:00:00Z");

const makeParent = (over: Record<string, unknown> = {}) =>
  User.create({
    name: "Meera Kapoor",
    email: `parent-${Math.random().toString(36).slice(2)}@example.com`,
    phone: `98${Math.floor(10000000 + Math.random() * 89999999)}`,
    password: "Passw0rd!x",
    role: "Parent",
    city: "Pune",
    ...over,
  });

const makeChild = (userId: unknown, over: Record<string, unknown> = {}) =>
  Player.create({
    userId,
    name: "Aarav Kapoor",
    dob: new Date("2012-12-01T00:00:00Z"),
    sportsFocus: ["Tennis"],
    yearsPlaying: 3,
    location: "Maharashtra",
    ...over,
  });

describe("getParentContext", () => {
  it("returns the parent's first name and city, and each child's first name, age and sport", async () => {
    const parent = await makeParent();
    await makeChild(parent._id, { chosenSport: "Badminton" });

    const ctx = await getParentContext(String(parent._id), NOW);
    assert.equal(ctx.parent.firstName, "Meera");
    assert.equal(ctx.parent.city, "Pune");
    assert.equal(ctx.children.length, 1);
    assert.equal(ctx.children[0].firstName, "Aarav");
    // Born 1 Dec 2012: still 13 on 22 Oct 2026.
    assert.equal(ctx.children[0].age, 13);
    assert.deepEqual(ctx.children[0].sports, ["Badminton", "Tennis"]);
    assert.equal(ctx.children[0].yearsPlaying, 3);
    assert.equal(ctx.children[0].state, "Maharashtra");
  });

  it("leaves out surnames, dates of birth and every contact detail", async () => {
    const parent = await makeParent({ email: "meera.private@example.com" });
    await makeChild(parent._id);

    const ctx = await getParentContext(String(parent._id), NOW);
    const text = JSON.stringify(ctx) + formatParentContext(ctx);
    for (const secret of ["Kapoor", "2012", "meera.private", String(parent.phone)]) {
      assert.ok(!text.includes(secret), `${secret} must not reach the prompt`);
    }
  });

  it("caps the children listed and says how many more there are", async () => {
    const parent = await makeParent();
    for (let i = 0; i < 6; i += 1) await makeChild(parent._id, { name: `Kid${i} Surname` });

    const ctx = await getParentContext(String(parent._id), NOW);
    assert.equal(ctx.children.length, 4);
    assert.equal(ctx.moreChildren, 2);
  });

  it("says plainly that an account has no children, plan or sessions", async () => {
    const parent = await makeParent();
    const ctx = await getParentContext(String(parent._id), NOW);
    assert.equal(ctx.children.length, 0);
    assert.equal(ctx.plannedEvents, 0);
    assert.equal(ctx.upcomingSessions, 0);
    assert.match(formatParentContext(ctx), /No child has been added to this account yet/);
  });

  it("counts planned tournaments and upcoming sessions for this parent only", async () => {
    const mine = await makeParent();
    const other = await makeParent();
    const child = await makeChild(mine._id);
    const otherChild = await makeChild(other._id);
    const entry = (slug: string) => ({
      editionSlug: slug,
      name: slug,
      startDate: new Date("2026-11-20T00:00:00Z"),
      status: "shortlisted",
    });
    await SeasonPlan.create({
      userId: mine._id,
      dependentId: child._id,
      sportSlug: "tennis",
      entries: [entry("a"), entry("b")],
    });
    await SeasonPlan.create({
      userId: other._id,
      dependentId: otherChild._id,
      sportSlug: "tennis",
      entries: [entry("c")],
    });

    const ctx = await getParentContext(String(mine._id), NOW);
    assert.equal(ctx.plannedEvents, 2);
    assert.match(formatParentContext(ctx), /2 tournaments on a season plan/);
  });

  it("returns null for an account that does not exist", async () => {
    assert.equal(await getParentContext(String(new mongoose.Types.ObjectId()), NOW), null);
  });

  it("still answers when one of the reads fails", async () => {
    const parent = await makeParent();
    await makeChild(parent._id);
    const original = SeasonPlan.find;
    SeasonPlan.find = () => {
      throw new Error("boom");
    };
    try {
      const ctx = await getParentContext(String(parent._id), NOW);
      assert.equal(ctx.parent.firstName, "Meera");
      assert.equal(ctx.children.length, 1);
      assert.equal(ctx.plannedEvents, 0);
    } finally {
      SeasonPlan.find = original;
    }
  });
});

describe("get_my_children and get_my_season_plan", () => {
  const { ASSISTANT_CHAT_TOOLS } = require("../shared/services/chatToolsService");
  const tool = (name: string) =>
    ASSISTANT_CHAT_TOOLS.find((t: { name: string }) => t.name === name);

  const seedPlan = (userId: unknown, dependentId: unknown, over: Record<string, unknown> = {}) =>
    SeasonPlan.create({
      userId,
      dependentId,
      sportSlug: "tennis",
      entries: [
        {
          editionSlug: "later",
          name: "Later event",
          startDate: new Date("2027-01-09T00:00:00Z"),
          status: "shortlisted",
          costs: { travel: 9999, stay: 8888, entryFee: 7777 },
        },
        {
          editionSlug: "sooner",
          name: "Sooner event",
          startDate: new Date("2026-11-14T00:00:00Z"),
          status: "entered",
          note: "Travelling by train",
        },
      ],
      preferences: {
        goal: "points",
        budget: 123456,
        blockedRanges: [
          {
            from: new Date("2026-12-01T00:00:00Z"),
            to: new Date("2026-12-15T00:00:00Z"),
            label: "Board exams",
          },
        ],
      },
      ...over,
    });

  it("say the number is not linked when no account is known, and read nothing", async () => {
    for (const name of ["get_my_children", "get_my_season_plan"]) {
      const out = await tool(name).execute({}, {});
      assert.equal(out.linked, false);
      assert.equal(out.reason, "number_not_linked");
    }
  });

  it("get_my_children returns the assessment's top sports and the child's goals, first name only", async () => {
    const parent = await makeParent();
    await makeChild(parent._id, {
      chosenSport: "Tennis",
      consideringSports: ["Badminton"],
      ambition: "competitive",
      sportMatches: [
        { sport: "Badminton", fitLabel: "Good fit", score: 70 },
        { sport: "Tennis", fitLabel: "Strong fit", score: 90 },
      ],
    });

    const out = await tool("get_my_children").execute({}, { userId: String(parent._id) });
    assert.equal(out.linked, true);
    assert.equal(out.children[0].child, "Aarav");
    assert.equal(out.children[0].committedSport, "Tennis");
    assert.deepEqual(out.children[0].assessmentMatches, [
      { sport: "Tennis", fit: "Strong fit" },
      { sport: "Badminton", fit: "Good fit" },
    ]);
    assert.ok(!JSON.stringify(out).includes("Kapoor"));
  });

  it("get_my_children names who is on the account when the name asked for is not", async () => {
    const parent = await makeParent();
    await makeChild(parent._id, { name: "Jatin Sharma" });
    const out = await tool("get_my_children").execute(
      { childName: "Vikrant" },
      { userId: String(parent._id) }
    );
    assert.deepEqual(out.childrenOnAccount, ["Jatin"]);
    assert.match(out.instruction, /Say who is/);
  });

  it("get_my_children says so for an account with no children", async () => {
    const parent = await makeParent();
    const out = await tool("get_my_children").execute({}, { userId: String(parent._id) });
    assert.deepEqual(out.children, []);
    assert.match(out.instruction, /No child has been added/);
  });

  it("get_my_season_plan lists the soonest tournament first, with goal and blocked dates, and no costs", async () => {
    const parent = await makeParent();
    const child = await makeChild(parent._id);
    await seedPlan(parent._id, child._id);

    const out = await tool("get_my_season_plan").execute({}, { userId: String(parent._id) });
    const plan = out.plans[0];
    assert.equal(plan.child, "Aarav");
    assert.equal(plan.goal, "points");
    assert.deepEqual(
      plan.tournaments.map((t: { name: string }) => t.name),
      ["Sooner event", "Later event"]
    );
    assert.equal(plan.tournaments[0].status, "entered");
    assert.deepEqual(plan.datesBlocked, [
      { from: "2026-12-01", to: "2026-12-15", label: "Board exams" },
    ]);
    const text = JSON.stringify(out);
    for (const secret of ["9999", "8888", "7777", "123456"]) {
      assert.ok(!text.includes(secret), `${secret} (a cost figure) must not be returned`);
    }
  });

  it("get_my_season_plan never returns another parent's plan", async () => {
    const mine = await makeParent();
    const other = await makeParent();
    const theirChild = await makeChild(other._id, { name: "Zoya Other" });
    await seedPlan(other._id, theirChild._id);

    const out = await tool("get_my_season_plan").execute({}, { userId: String(mine._id) });
    assert.deepEqual(out.plans, []);
    assert.ok(!JSON.stringify(out).includes("Zoya"));
  });

  it("get_my_season_plan says there is no plan yet, and filters by sport", async () => {
    const parent = await makeParent();
    const child = await makeChild(parent._id);
    await seedPlan(parent._id, child._id);

    const none = await tool("get_my_season_plan").execute(
      { sportSlug: "badminton" },
      { userId: String(parent._id) }
    );
    assert.deepEqual(none.plans, []);
    assert.match(none.instruction, /no season plan yet/);
  });
});

describe("get_my_guidance_plan and get_my_sessions", () => {
  const { ASSISTANT_CHAT_TOOLS } = require("../shared/services/chatToolsService");
  const tool = (name: string) =>
    ASSISTANT_CHAT_TOOLS.find((t: { name: string }) => t.name === name);

  const guidanceRequest = (dependentId: unknown, over: Record<string, unknown> = {}) => ({
    child_age: 13,
    child_gender: "male",
    current_fitness_level: "Moderate",
    primary_objective: "Compete",
    weekly_time_commitment: 8,
    budget_tier: "Moderate",
    sport: "Tennis",
    dependent_id: dependentId,
    ...over,
  });

  const seedGuidance = (userId: unknown, request: unknown, over: Record<string, unknown> = {}) =>
    GuidanceSubmission.create({
      userId,
      request,
      response: {
        profileAnalysis: "A focused player. ".repeat(60),
        idealCoachingStyle: "Structured and patient",
        weeklyBlueprint: {
          trainingHours: "6 hours",
          freePlayHours: "2 hours",
          restDays: "1 day",
        },
        recommendedPlatformActions: "internal",
        recommendedSports: ["Tennis"],
        goalAssessment: {
          statedGoal: "State level",
          verdict: "Ambitious",
          rationale: "Needs time",
        },
        costBreakdown: {
          monthlyCoaching: "Rs 4000",
          equipment: "Rs 8000",
          tournaments: "Rs 6000",
        },
      },
      ...over,
    });

  const makeExpert = async (name: string) => {
    const expertUser = await makeParent({ name, role: "EXPERT" });
    return Expert.create({
      userId: expertUser._id,
      bio: "Coach",
      sports: ["Tennis"],
      sessionFee: 1000,
      sessionMode: "BOTH",
      sessionDurationMinutes: 45,
      timezone: "Asia/Kolkata",
      inPersonAddress: "12 Secret Lane, Pune",
    });
  };

  const seedSession = (parentId: unknown, expertId: unknown, over: Record<string, unknown> = {}) =>
    ExpertSession.create({
      expertId,
      userId: parentId,
      amount: 1000,
      status: "SCHEDULED",
      paymentStatus: "COMPLETED",
      merchantOrderId: `order-${Math.random().toString(36).slice(2)}`,
      durationMinutes: 45,
      mode: "ONLINE",
      meetingLink: "https://meet.example.com/secret-room",
      expertAcceptance: "ACCEPTED",
      refundStatus: "NONE",
      payoutStatus: "PENDING",
      scheduledAt: new Date(Date.now() + 5 * 24 * 3600 * 1000),
      ...over,
    });

  it("both say the number is not linked when no account is known", async () => {
    for (const name of ["get_my_guidance_plan", "get_my_sessions"]) {
      const out = await tool(name).execute({}, {});
      assert.equal(out.reason, "number_not_linked");
    }
  });

  it("get_my_guidance_plan returns the plan with long text trimmed, and only that child's", async () => {
    const parent = await makeParent();
    const child = await makeChild(parent._id);
    const other = await makeChild(parent._id, { name: "Zoya Kapoor" });
    await seedGuidance(parent._id, guidanceRequest(child._id));
    await seedGuidance(parent._id, guidanceRequest(other._id, { sport: "Swimming" }));

    const out = await tool("get_my_guidance_plan").execute(
      { childName: "Aarav" },
      { userId: String(parent._id) }
    );
    assert.equal(out.plans.length, 1);
    const plan = out.plans[0];
    assert.equal(plan.child, "Aarav");
    assert.equal(plan.sport, "Tennis");
    assert.equal(plan.goal.verdict, "Ambitious");
    assert.ok(plan.profileAnalysis.length <= 510, "long AI text is trimmed");
    assert.match(plan.profileAnalysis, /\.\.\.$/);
    assert.equal(plan.estimatedCosts.coaching, "Rs 4000");
    assert.ok(!JSON.stringify(out).includes("Swimming"));
  });

  it("get_my_guidance_plan keeps only the newest plan per child, and says when there is none", async () => {
    const parent = await makeParent();
    const child = await makeChild(parent._id);
    const none = await tool("get_my_guidance_plan").execute({}, { userId: String(parent._id) });
    assert.deepEqual(none.plans, []);
    assert.match(none.instruction, /No AI plan has been made yet/);

    await seedGuidance(parent._id, guidanceRequest(child._id), {
      createdAt: new Date("2026-01-01T00:00:00Z"),
    });
    await seedGuidance(parent._id, guidanceRequest(child._id), {
      createdAt: new Date("2026-09-01T00:00:00Z"),
    });
    const out = await tool("get_my_guidance_plan").execute({}, { userId: String(parent._id) });
    assert.equal(out.plans.length, 1);
    assert.equal(out.plans[0].madeOn, "2026-09-01");
  });

  it("get_my_guidance_plan never returns another parent's plan", async () => {
    const mine = await makeParent();
    const other = await makeParent();
    const theirChild = await makeChild(other._id, { name: "Zoya Other" });
    await seedGuidance(other._id, guidanceRequest(theirChild._id));
    const out = await tool("get_my_guidance_plan").execute({}, { userId: String(mine._id) });
    assert.deepEqual(out.plans, []);
  });

  it("get_my_sessions lists upcoming sessions soonest first with the expert's first name and Indian time", async () => {
    const parent = await makeParent();
    const child = await makeChild(parent._id);
    const expert = await makeExpert("Rohan Mehta");
    await seedSession(parent._id, expert._id, {
      playerId: child._id,
      scheduledAt: new Date("2099-11-02T12:30:00Z"),
    });
    await seedSession(parent._id, expert._id, {
      playerId: child._id,
      scheduledAt: new Date("2099-10-30T12:30:00Z"),
      expertAcceptance: "PENDING",
    });

    const out = await tool("get_my_sessions").execute({}, { userId: String(parent._id) });
    assert.equal(out.upcoming.length, 2);
    assert.equal(out.upcoming[0].with, "Rohan");
    assert.equal(out.upcoming[0].forChild, "Aarav");
    assert.equal(out.upcoming[0].status, "booked");
    assert.equal(out.upcoming[1].status, "confirmed by the expert");
    assert.equal(out.upcoming[0].when, "30 Oct 2099, 6:00 PM");
    assert.equal(out.upcoming[0].mode, "online");
  });

  it("get_my_sessions leaves out the meeting link, the address, the amount and unpaid holds", async () => {
    const parent = await makeParent();
    const expert = await makeExpert("Rohan Mehta");
    await seedSession(parent._id, expert._id);
    await seedSession(parent._id, expert._id, {
      status: "PENDING_PAYMENT",
      paymentStatus: "PENDING",
      scheduledAt: new Date("2099-12-01T00:00:00Z"),
    });

    const out = await tool("get_my_sessions").execute({}, { userId: String(parent._id) });
    assert.equal(out.upcoming.length, 1, "the unpaid hold is not a session");
    const text = JSON.stringify(out);
    for (const secret of ["secret-room", "Secret Lane", "1000", "Mehta"]) {
      assert.ok(!text.includes(secret), `${secret} must not be returned`);
    }
  });

  it("get_my_sessions shows ended and cancelled sessions under recent, and says when there are none", async () => {
    const parent = await makeParent();
    const none = await tool("get_my_sessions").execute({}, { userId: String(parent._id) });
    assert.match(none.instruction, /No expert session has been booked/);

    const expert = await makeExpert("Rohan Mehta");
    await seedSession(parent._id, expert._id, {
      status: "COMPLETED",
      scheduledAt: new Date("2026-09-01T12:30:00Z"),
    });
    await seedSession(parent._id, expert._id, {
      status: "CANCELLED",
      scheduledAt: new Date("2026-09-10T12:30:00Z"),
    });
    const out = await tool("get_my_sessions").execute({}, { userId: String(parent._id) });
    assert.equal(out.upcoming.length, 0);
    assert.deepEqual(
      out.recent.map((s: { status: string }) => s.status),
      ["cancelled", "completed"]
    );

    // A past session nobody marked completed is not "booked" any more.
    await seedSession(parent._id, expert._id, {
      scheduledAt: new Date("2026-10-19T03:30:00Z"),
    });
    const later = await tool("get_my_sessions").execute({}, { userId: String(parent._id) });
    assert.ok(
      later.recent.some(
        (s: { status: string }) => s.status === "time has passed, not marked completed"
      )
    );
  });

  it("get_my_sessions never returns another parent's session", async () => {
    const mine = await makeParent();
    const other = await makeParent();
    const expert = await makeExpert("Rohan Mehta");
    await seedSession(other._id, expert._id);
    const out = await tool("get_my_sessions").execute({}, { userId: String(mine._id) });
    assert.equal(out.upcoming?.length ?? 0, 0);
  });
});
