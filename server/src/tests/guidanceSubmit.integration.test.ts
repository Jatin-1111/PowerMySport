// POST /api/guidance, the website's "make me a plan" endpoint. These tests pin what it does today
// (what is saved, what is scheduled, what the response looks like, how it refuses) so that moving
// the work into a shared service can be shown to change nothing. The AI call is a stub: no
// network, no key, and no cost.
process.env.JWT_SECRET = "test-secret-test-secret-test-secret-1234567890";
process.env.PHONEPE_CLIENT_ID = "test-client";
process.env.PHONEPE_CLIENT_SECRET = "test-secret";
process.env.PHONEPE_CLIENT_VERSION = "1";
process.env.PHONEPE_ENV = "SANDBOX";
process.env.REDIS_ENABLED = "false";

import assert = require("node:assert/strict");
const { after, afterEach, before, beforeEach, describe, it } = require("node:test");
const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");
const request = require("supertest");

const { app } = require("../app");
const { generateToken } = require("../utils/jwt");
const { User } = require("../client/models/User");
const { GuidanceSubmission } = require("../client/models/GuidanceSubmission");
const { AnalyticsEvent } = require("../admin/models/AnalyticsEvent");
const { PlanCheckIn } = require("../shared/models/PlanCheckIn");
const guidanceAi = require("../shared/services/guidanceAiService");
const redis = require("../config/redis").default;

const oid = () => new mongoose.Types.ObjectId();
let mongod: { getUri(): string; stop(): Promise<void> };

const realGenerate = guidanceAi.generateYouthSportsGuidance;
let generated: unknown[] = [];
let generatorBehaviour: () => unknown = () => ({});

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

const baseResponse = (over: Record<string, unknown> = {}) => ({
  profileAnalysis: "A focused player.",
  idealCoachingStyle: "Structured and patient",
  weeklyBlueprint: { trainingHours: "6 hours", freePlayHours: "2 hours", restDays: "1 day" },
  recommendedPlatformActions: "Start with a trial session.",
  recommendedSports: ["Tennis"],
  journeyPhases: [
    { title: "Build the base", timeframe: "0 to 6 months", focus: "Technique", milestones: ["a"] },
  ],
  ...over,
});

beforeEach(async () => {
  generated = [];
  generatorBehaviour = () => baseResponse();
  guidanceAi.generateYouthSportsGuidance = async (payload: unknown) => {
    generated.push(payload);
    return generatorBehaviour();
  };
  await Promise.all([
    GuidanceSubmission.deleteMany({}),
    PlanCheckIn.deleteMany({}),
    AnalyticsEvent.deleteMany({}),
    User.collection.deleteMany({}),
  ]);
});

afterEach(() => {
  guidanceAi.generateYouthSportsGuidance = realGenerate;
});

const signedInParent = async () => {
  const _id = oid();
  const email = `${_id}@example.test`;
  await User.collection.insertOne({
    _id,
    name: "Meera Kapoor",
    email,
    phone: "9811111111",
    role: "Parent",
    isActive: true,
    status: "ACTIVE",
  });
  return {
    id: _id.toString(),
    token: generateToken({ id: _id.toString(), email, role: "Parent" }),
  };
};

const valid = (over: Record<string, unknown> = {}) => ({
  child_age: 10,
  child_gender: "male",
  current_fitness_level: "Moderate",
  primary_objective: "Compete",
  weekly_time_commitment: 6,
  budget_tier: "Moderate",
  sport: "Tennis",
  ...over,
});

/**
 * A client address of its own for every request. The guest limiter and the API limiter count per
 * address in Redis when one is running, so a shared address would make these tests depend on what
 * an earlier run left behind. `trust proxy` is on, so the forwarded address is the one counted.
 */
const fakeIp = () =>
  `10.${Math.floor(Math.random() * 256)}.${Math.floor(Math.random() * 256)}.${Math.floor(Math.random() * 254) + 1}`;

const post = (body: Record<string, unknown>, token?: string) => {
  const req = request(app).post("/api/guidance").set("X-Forwarded-For", fakeIp());
  if (token) req.set("Authorization", `Bearer ${token}`);
  return req.send(body);
};

describe("POST /api/guidance", () => {
  it("makes and saves a plan for a guest, with the burnout check added and nothing scheduled", async () => {
    const res = await post(valid());

    assert.equal(res.status, 201);
    assert.equal(res.body.success, true);
    assert.equal(res.body.message, "Guidance generated and saved");
    assert.equal(res.body.data.response.profileAnalysis, "A focused player.");
    assert.equal(res.body.data.response.burnoutRisk.level, "low");
    assert.deepEqual(Object.keys(res.body.data).sort(), [
      "createdAt",
      "id",
      "query",
      "response",
      "updatedAt",
    ]);

    const saved = await GuidanceSubmission.findById(res.body.data.id).lean();
    assert.equal(saved.userId, undefined);
    assert.equal(saved.request.sport, "Tennis");
    assert.equal(saved.response.burnoutRisk.level, "low");
    assert.equal(await PlanCheckIn.countDocuments({}), 0, "a guest gets no check-in");
  });

  it("saves a signed-in parent's plan under their account and schedules the check-in", async () => {
    const parent = await signedInParent();
    const dependentId = oid().toString();
    const res = await post(valid({ dependent_id: dependentId }), parent.token);

    assert.equal(res.status, 201);
    const saved = await GuidanceSubmission.findById(res.body.data.id).lean();
    assert.equal(String(saved.userId), parent.id);
    assert.equal(saved.request.dependent_id.toString(), dependentId);

    // Fire-and-forget, so give it a moment to land.
    await new Promise((resolve) => setTimeout(resolve, 150));
    const checkIns = await PlanCheckIn.find({ userId: parent.id }).lean();
    assert.equal(checkIns.length, 1);
    assert.equal(checkIns[0].source, "guidance_journey");
    assert.equal(String(checkIns[0].sourceId), res.body.data.id);
  });

  it("schedules the short-plan check-in when the plan is a short one", async () => {
    const parent = await signedInParent();
    generatorBehaviour = () =>
      baseResponse({
        journeyPhases: [],
        shortTermPlan: {
          durationWeeks: 4,
          weeks: [{ label: "Week 1", focus: "Footwork", sessions: ["a"] }],
          successCheck: "Can hold a rally of ten",
        },
      });
    await post(valid({ plan_horizon: "short" }), parent.token);
    await new Promise((resolve) => setTimeout(resolve, 150));
    const [checkIn] = await PlanCheckIn.find({ userId: parent.id }).lean();
    assert.equal(checkIn.source, "guidance_short_plan");
  });

  it("works out the burnout level from age and hours, without the model", async () => {
    const level = async (age: number, hours: number) =>
      (await post(valid({ child_age: age, weekly_time_commitment: hours }))).body.data.response
        .burnoutRisk.level;

    assert.equal(await level(10, 3), "low");
    assert.equal(await level(10, 11), "medium");
    assert.equal(await level(10, 16), "high");
    assert.equal(await level(16, 25), "medium");
    assert.equal(await level(20, 35), "high");
  });

  it("gives the model the request without the child profile id", async () => {
    await post(valid({ dependent_id: oid().toString() }));
    assert.equal(generated.length, 1);
    assert.equal(
      (generated[0] as { sport: string }).sport,
      "Tennis",
      "the model is asked about the sport the parent chose"
    );
  });

  it("refuses a payload that does not fit with 400 and the field problems", async () => {
    const res = await post({ child_age: 2 });
    assert.equal(res.status, 400);
    assert.equal(res.body.message, "Invalid guidance payload");
    assert.ok(res.body.issues.fieldErrors.child_age);
    assert.equal(generated.length, 0);
  });

  it("answers an unsupported sport with 200 not_supported, records it and never calls the model", async () => {
    const res = await post(valid({ sport: "Curling" }));

    assert.equal(res.status, 200);
    assert.equal(res.body.success, false);
    assert.equal(res.body.status, "not_supported");
    assert.equal(res.body.sport, "Curling");
    assert.equal(res.body.supportedSports.length, 10);
    assert.match(res.body.message, /Curling/);
    assert.equal(generated.length, 0);
    assert.equal(await GuidanceSubmission.countDocuments({}), 0);

    await new Promise((resolve) => setTimeout(resolve, 100));
    const event = await AnalyticsEvent.findOne({ eventName: "unsupported_sport_search" }).lean();
    assert.equal(event.metadata.sport, "Curling");
    assert.equal(event.metadata.source, "guidance");
  });

  it("saves nothing and fails when the model fails", async () => {
    generatorBehaviour = () => {
      throw new Error("model exploded");
    };
    const res = await post(valid());
    assert.ok(res.status >= 500);
    assert.equal(await GuidanceSubmission.countDocuments({}), 0);
  });

  it("does not let a failed check-in fail the plan the parent is waiting for", async () => {
    const parent = await signedInParent();
    const original = PlanCheckIn.create;
    const originalSave = PlanCheckIn.prototype.save;
    PlanCheckIn.create = async () => {
      throw new Error("scheduler down");
    };
    PlanCheckIn.prototype.save = async () => {
      throw new Error("scheduler down");
    };
    try {
      const res = await post(valid(), parent.token);
      assert.equal(res.status, 201);
      assert.equal(await GuidanceSubmission.countDocuments({}), 1);
    } finally {
      PlanCheckIn.create = original;
      PlanCheckIn.prototype.save = originalSave;
    }
  });
});

describe("createGuidancePlan (the service both the website and WhatsApp use)", () => {
  const {
    createGuidancePlan,
    calculateBurnoutRisk,
  } = require("../client/services/GuidancePlanService");

  it("returns the saved plan with the burnout check, and saves it under the account", async () => {
    const parent = await signedInParent();
    const result = await createGuidancePlan(valid(), { userId: parent.id, source: "SERVER" });

    assert.equal(result.status, "created");
    assert.equal(result.response.burnoutRisk.level, "low");
    const saved = await GuidanceSubmission.findById(result.submission._id).lean();
    assert.equal(String(saved.userId), parent.id);
  });

  it("records an unsupported sport with the source it came from, and never calls the model", async () => {
    const result = await createGuidancePlan(valid({ sport: "Curling" }), { source: "SERVER" });

    assert.deepEqual(result, { status: "not_supported", sport: "Curling" });
    assert.equal(generated.length, 0);
    await new Promise((resolve) => setTimeout(resolve, 100));
    const event = await AnalyticsEvent.findOne({ eventName: "unsupported_sport_search" }).lean();
    assert.equal(event.source, "SERVER");
  });

  it("treats a sport the same whatever its case or spacing", async () => {
    for (const sport of ["tennis", "  TENNIS ", "Table Tennis"]) {
      const result = await createGuidancePlan(valid({ sport }), { source: "SERVER" });
      assert.equal(result.status, "created", sport);
    }
  });

  it("lets a model failure through and saves nothing", async () => {
    generatorBehaviour = () => {
      throw new Error("quota");
    };
    await assert.rejects(createGuidancePlan(valid(), { source: "SERVER" }), /quota/);
    assert.equal(await GuidanceSubmission.countDocuments({}), 0);
  });

  it("scales the burnout thresholds with age", () => {
    assert.equal(calculateBurnoutRisk(6, 4).level, "low");
    assert.equal(calculateBurnoutRisk(6, 5).level, "medium");
    assert.equal(calculateBurnoutRisk(6, 8).level, "high");
  });
});
