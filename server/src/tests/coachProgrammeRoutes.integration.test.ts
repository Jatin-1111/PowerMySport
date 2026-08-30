/* eslint-disable @typescript-eslint/no-var-requires */
// HTTP-level tests for the coaching-programme routes.
//
// These close the one seam the rest of the suite could not reach: a REAL
// request travelling through the mounted router and `authMiddleware` into the
// handler. Everything else has been tested by calling handlers directly, which
// proves the handler but not that it is wired up, reachable, or actually
// protected.
//
// Requests go through the real `app`, so the real route table, the real auth
// middleware and the real validation schemas are all exercised.
process.env.JWT_SECRET = "test-secret-test-secret-test-secret-1234567890";
process.env.PHONEPE_CLIENT_ID = "test-client";
process.env.PHONEPE_CLIENT_SECRET = "test-secret";
process.env.PHONEPE_CLIENT_VERSION = "1";
process.env.PHONEPE_ENV = "SANDBOX";

import assert = require("node:assert/strict");
const { after, before, beforeEach, describe, it } = require("node:test");
const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");
const request = require("supertest");

const { app } = require("../app");
const { generateToken } = require("../utils/jwt");
const { User } = require("../client/models/User");
const { Coach } = require("../client/models/Coach");
const { CoachOffering } = require("../client/models/CoachOffering");
const {
  CoachSubscriptionPackage,
} = require("../client/models/CoachSubscriptionPackage");
const redis = require("../config/redis").default;

const oid = () => new mongoose.Types.ObjectId();

let mongod: any;

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
  for (const name of [
    "users",
    "coaches",
    "coachofferings",
    "coachsubscriptionpackages",
    "coachenrollments",
  ]) {
    await mongoose.connection.db.collection(name).deleteMany({});
  }
});

/** A real user row plus a real signed token — the same pair a login produces. */
const signedInAs = async (role: string) => {
  const userId = oid();
  await User.collection.insertOne({
    _id: userId,
    name: `Test ${role}`,
    email: `${userId.toString()}@example.test`,
    role,
    isActive: true,
    status: "ACTIVE",
  });

  const token = generateToken({
    id: userId.toString(),
    email: `${userId.toString()}@example.test`,
    role,
  });

  return { userId, token };
};

const seedCoachWithProgramme = async (userId: any) => {
  const coachId = oid();
  await Coach.collection.insertOne({
    _id: coachId,
    userId,
    sports: ["Chess"],
    hourlyRate: 500,
    serviceMode: "FREELANCE",
  });

  const pkg = await CoachSubscriptionPackage.create({
    coachId,
    name: "Monthly",
    frequency: "MONTHLY",
    price: 400000,
    maxSessions: 8,
  });

  const offering = await CoachOffering.create({
    coachId,
    sport: "Chess",
    title: "Route test programme",
    deliveryKind: "ONLINE",
    onlinePlatform: "Zoom",
    capacity: 4,
    schedule: [{ dayOfWeek: 2, startTime: "18:00", durationMinutes: 60 }],
    packageId: pkg._id,
    startDate: new Date("2026-09-01T00:00:00.000Z"),
    status: "ACTIVE",
  });

  return { coachId, pkg, offering };
};

// ───────────────── the routes are actually mounted ─────────────────

describe("coach programme routes are reachable", () => {
  it("serves the public browse endpoint", async () => {
    const response = await request(app).get("/api/coach-programmes/browse");

    assert.equal(response.status, 200);
    assert.equal(response.body.success, true);
    assert.ok(Array.isArray(response.body.data.offerings));
  });

  it("returns programmes with an `id`, not a raw `_id`", async () => {
    // The bug this pins: these handlers use .lean(), which skips the schema's
    // toJSON transform, so every client link rendered as /programmes/undefined.
    const { userId } = await signedInAs("Coach");
    await seedCoachWithProgramme(userId);

    const response = await request(app).get("/api/coach-programmes/browse");
    const [offering] = response.body.data.offerings;

    assert.ok(offering, "the seeded programme was not returned");
    assert.ok(offering.id, "programmes must carry `id` for the client to link");
    assert.equal(typeof offering.id, "string");
  });
});

// ───────────────── auth middleware -> handler ─────────────────

describe("authentication on programme routes", () => {
  it("rejects an unauthenticated coach request", async () => {
    const response = await request(app).get("/api/coach-programmes/mine");
    assert.equal(response.status, 401);
  });

  it("rejects a garbage token", async () => {
    const response = await request(app)
      .get("/api/coach-programmes/mine")
      .set("Authorization", "Bearer not-a-real-token");

    assert.equal(response.status, 401);
  });

  it("lets a signed-in coach through to the handler", async () => {
    // The seam: a real token -> real authMiddleware -> real handler, with
    // req.user populated well enough for the handler to resolve its own coach.
    const { userId, token } = await signedInAs("Coach");
    await seedCoachWithProgramme(userId);

    const response = await request(app)
      .get("/api/coach-programmes/mine")
      .set("Authorization", `Bearer ${token}`);

    assert.equal(response.status, 200, JSON.stringify(response.body));
    assert.equal(response.body.data.offerings.length, 1);
    assert.equal(response.body.data.offerings[0].title, "Route test programme");
  });

  it("refuses a signed-in NON-coach on a coach route", async () => {
    const { token } = await signedInAs("Parent");

    const response = await request(app)
      .get("/api/coach-programmes/mine")
      .set("Authorization", `Bearer ${token}`);

    assert.equal(response.status, 403);
  });

  it("shows a coach only their OWN programmes", async () => {
    // `requireOwnCoach` scopes by the caller's profile; an id in the URL is
    // never trusted. This proves the scoping survives the real request path.
    const mine = await signedInAs("Coach");
    await seedCoachWithProgramme(mine.userId);

    const theirs = await signedInAs("Coach");
    await seedCoachWithProgramme(theirs.userId);

    const response = await request(app)
      .get("/api/coach-programmes/mine")
      .set("Authorization", `Bearer ${mine.token}`);

    assert.equal(response.body.data.offerings.length, 1);
  });

  it("404s a coach acting on another coach's programme", async () => {
    const mine = await signedInAs("Coach");
    await seedCoachWithProgramme(mine.userId);

    const theirs = await signedInAs("Coach");
    const other = await seedCoachWithProgramme(theirs.userId);

    const response = await request(app)
      .post(`/api/coach-programmes/${other.offering._id}/pause`)
      .set("Authorization", `Bearer ${mine.token}`);

    assert.equal(response.status, 404);

    // And it really did not act on it.
    const untouched = await CoachOffering.findById(other.offering._id);
    assert.equal(untouched.status, "ACTIVE");
  });
});

// ───────────────── validation runs on the real route ─────────────────

describe("request validation on programme routes", () => {
  it("rejects a programme with no weekly slots", async () => {
    const { userId, token } = await signedInAs("Coach");
    const { pkg } = await seedCoachWithProgramme(userId);

    const response = await request(app)
      .post("/api/coach-programmes")
      .set("Authorization", `Bearer ${token}`)
      .send({
        sport: "Chess",
        title: "No classes",
        deliveryKind: "ONLINE",
        onlinePlatform: "Zoom",
        schedule: [],
        packageId: pkg._id.toString(),
        startDate: new Date("2026-09-01T00:00:00.000Z").toISOString(),
      });

    assert.equal(response.status, 400);
  });

  it("rejects an online programme with no platform", async () => {
    const { userId, token } = await signedInAs("Coach");
    const { pkg } = await seedCoachWithProgramme(userId);

    const response = await request(app)
      .post("/api/coach-programmes")
      .set("Authorization", `Bearer ${token}`)
      .send({
        sport: "Chess",
        title: "Platformless",
        deliveryKind: "ONLINE",
        schedule: [{ dayOfWeek: 2, startTime: "18:00", durationMinutes: 60 }],
        packageId: pkg._id.toString(),
        startDate: new Date("2026-09-01T00:00:00.000Z").toISOString(),
      });

    assert.equal(response.status, 400);
  });

  it("rejects a batch that would be taught at a student's home", async () => {
    const { userId, token } = await signedInAs("Coach");
    const { pkg } = await seedCoachWithProgramme(userId);

    const response = await request(app)
      .post("/api/coach-programmes")
      .set("Authorization", `Bearer ${token}`)
      .send({
        sport: "Chess",
        title: "Impossible batch",
        deliveryKind: "STUDENT_LOCATION",
        capacity: 6,
        schedule: [{ dayOfWeek: 2, startTime: "18:00", durationMinutes: 60 }],
        packageId: pkg._id.toString(),
        startDate: new Date("2026-09-01T00:00:00.000Z").toISOString(),
      });

    assert.equal(response.status, 400);
  });

  it("creates a valid programme end to end", async () => {
    const { userId, token } = await signedInAs("Coach");
    const { pkg } = await seedCoachWithProgramme(userId);

    const response = await request(app)
      .post("/api/coach-programmes")
      .set("Authorization", `Bearer ${token}`)
      .send({
        sport: "Chess",
        title: "Created over HTTP",
        deliveryKind: "ONLINE",
        onlinePlatform: "Zoom",
        capacity: 4,
        schedule: [{ dayOfWeek: 2, startTime: "18:00", durationMinutes: 60 }],
        packageId: pkg._id.toString(),
        startDate: new Date("2026-09-01T00:00:00.000Z").toISOString(),
      });

    assert.equal(response.status, 201, JSON.stringify(response.body));
    assert.equal(response.body.data.offering.title, "Created over HTTP");
    // Created as a draft — publishing is a separate, deliberate act.
    assert.equal(response.body.data.offering.status, "DRAFT");
  });
});
