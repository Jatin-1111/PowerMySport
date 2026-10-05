/* eslint-disable @typescript-eslint/no-var-requires */
// HTTP-level tests for the planner routes: the costs, the home city, and the
// plan figures that feed them, through the real `app`, the real route table and
// the real `authMiddleware`.
//
// The service tests prove the logic; these prove it is wired: that `/home-city`
// is not swallowed by `/:dependentId`, that each route refuses a stranger, that a
// figure a parent PATCHes shows up in the next costs response, and that a request
// can never reach the AI model from a test.
process.env.JWT_SECRET = "test-secret-test-secret-test-secret-1234567890";
process.env.PHONEPE_CLIENT_ID = "test-client";
process.env.PHONEPE_CLIENT_SECRET = "test-secret";
process.env.PHONEPE_CLIENT_VERSION = "1";
process.env.PHONEPE_ENV = "SANDBOX";
process.env.REDIS_ENABLED = "false";
// Set to empty BEFORE the app loads its .env, which never overrides a variable that
// already exists. With no key the planner prices from its rough table, and no test
// can make a real model call.
process.env.GEMINI_API_KEY = "";
process.env.GOOGLE_API_KEY = "";

import assert = require("node:assert/strict");
const { after, before, beforeEach, describe, it } = require("node:test");
const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");
const request = require("supertest");

const { app } = require("../app");
const { generateToken } = require("../utils/jwt");
const { User } = require("../client/models/User");
const { Player } = require("../client/models/Player");
const { PlayerRankingLink } = require("../client/models/PlayerRankingLink");
const { SeasonPlan } = require("../client/models/SeasonPlan");
const { RankingEntry } = require("../shared/models/RankingEntry");
const { TournamentEdition } = require("../shared/models/TournamentEdition");
const redis = require("../config/redis").default;

const oid = () => new mongoose.Types.ObjectId();
const DAY = 24 * 60 * 60 * 1000;
const inDays = (days: number) => new Date(Date.now() + days * DAY);

let mongod: { getUri(): string; stop(): Promise<void> };

before(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
  await PlayerRankingLink.syncIndexes();
  await SeasonPlan.syncIndexes();
});

after(async () => {
  await mongoose.disconnect();
  await mongod.stop();
  redis.disconnect();
});

beforeEach(async () => {
  for (const name of [
    "users",
    "players",
    "playerrankinglinks",
    "seasonplans",
    "rankingentries",
    "tournamenteditions",
  ]) {
    await mongoose.connection.db.collection(name).deleteMany({});
  }
});

const signedInAs = async (role = "Parent") => {
  const userId = oid();
  await User.collection.insertOne({
    _id: userId,
    name: `Test ${role}`,
    email: `${userId.toString()}@example.test`,
    phone: `9${userId.toString().slice(-9)}`,
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

const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

/** A parent with one ranked child and two upcoming events in different cities. */
const seedFamily = async () => {
  const { userId, token } = await signedInAs();
  const child = await Player.create({ userId, type: "DEPENDENT", name: "Aarav" });
  await RankingEntry.create({
    snapshot: oid(),
    sportSlug: "tennis",
    federationCode: "AITA",
    category: "Boys",
    subcategory: "U-14",
    asOnDate: new Date(Date.UTC(2026, 8, 7)),
    isLatest: true,
    rank: 312,
    regNo: "660001",
    givenName: "Aarav",
    familyName: "Test",
    fullName: "Aarav Test",
    nameSearch: "aarav test",
    dob: new Date(Date.UTC(2012, 4, 17)),
    birthYear: 2012,
    state: "Haryana",
    stateCode: "HR",
    totalPoints: 100,
  });
  await PlayerRankingLink.create({ userId, dependentId: child._id, regNo: "660001" });

  const edition = (slug: string, city: string, state: string, start: number) =>
    TournamentEdition.create({
      sportSlug: "tennis",
      name: `AITA CS7 (${city})`,
      slug,
      editionYear: 2026,
      startDate: inDays(start),
      endDate: inDays(start + 4),
      sourceUrl: "https://example.test",
      city,
      state,
      ageGroups: ["Under-14"],
      ladder: "Championship Series",
      grade: 7,
      kind: "junior-ladder",
    });
  await edition("cs7-chennai", "Chennai", "Tamil Nadu", 30);
  await edition("cs7-sonipat", "Sonipat", "Haryana", 60);

  return { userId, token, dependentId: child._id.toString() };
};

const addToPlan = (token: string, dependentId: string, slug: string) =>
  request(app)
    .post(`/api/season-plans/${dependentId}/entries`)
    .set(auth(token))
    .send({ editionSlug: slug });

describe("the home city route", () => {
  it("refuses a visitor who is not signed in", async () => {
    const res = await request(app).put("/api/planner/home-city").send({ city: "Pune" });
    assert.equal(res.status, 401);
  });

  it("saves the city on the profile, and is not mistaken for a child id", async () => {
    const { userId, token } = await signedInAs();

    const res = await request(app)
      .put("/api/planner/home-city")
      .set(auth(token))
      .send({ city: "  Pune " });

    assert.equal(res.status, 200);
    assert.equal(res.body.data.city, "Pune");
    assert.equal((await User.findById(userId).lean()).city, "Pune");
  });

  it("answers 400, with a message a parent can read, for something that is not a city", async () => {
    const { token } = await signedInAs();

    for (const city of ["", "12345", "<b>x</b>"]) {
      const res = await request(app).put("/api/planner/home-city").set(auth(token)).send({ city });
      assert.equal(res.status, 400);
      assert.match(res.body.message, /city/i);
    }
  });
});

describe("the costs route", () => {
  it("refuses a visitor who is not signed in", async () => {
    const { dependentId } = await seedFamily();
    const res = await request(app).get(`/api/planner/${dependentId}/costs`);
    assert.equal(res.status, 401);
  });

  it("will not price another parent's child", async () => {
    const { dependentId } = await seedFamily();
    const stranger = await signedInAs();

    const res = await request(app)
      .get(`/api/planner/${dependentId}/costs`)
      .set(auth(stranger.token));

    assert.equal(res.status, 404);
  });

  it("starts from the state on the ranking list until a city is saved", async () => {
    const { token, dependentId } = await seedFamily();
    await addToPlan(token, dependentId, "cs7-chennai");

    const res = await request(app).get(`/api/planner/${dependentId}/costs`).set(auth(token));

    assert.equal(res.status, 200);
    assert.deepEqual(res.body.data.origin, { kind: "state", state: "Haryana", label: "Haryana" });
    const cost = res.body.data.events["cs7-chennai"];
    assert.equal(cost.source, "rough");
    assert.ok(cost.total.low > 0 && cost.total.low <= cost.total.high);
    assert.equal(cost.entryFee, null);
    assert.equal(cost.entryFeeMissing, true);
  });

  it("starts from the saved city, and that city shapes the estimate", async () => {
    const { token, dependentId } = await seedFamily();
    await addToPlan(token, dependentId, "cs7-sonipat");
    const before = await request(app).get(`/api/planner/${dependentId}/costs`).set(auth(token));

    await request(app).put("/api/planner/home-city").set(auth(token)).send({ city: "Sonipat" });
    const after = await request(app).get(`/api/planner/${dependentId}/costs`).set(auth(token));

    assert.equal(after.body.data.origin.kind, "city");
    assert.equal(after.body.data.origin.label, "Sonipat");
    // The event is in the city they live in: no stay, local travel only.
    assert.deepEqual(after.body.data.events["cs7-sonipat"].stay, {
      low: 0,
      high: 0,
      basis: "estimate",
    });
    assert.ok(
      after.body.data.events["cs7-sonipat"].total.high <
        before.body.data.events["cs7-sonipat"].total.high
    );
  });

  it("shows a figure the parent typed as theirs, and puts it in the season total", async () => {
    const { token, dependentId } = await seedFamily();
    await addToPlan(token, dependentId, "cs7-chennai");

    const patched = await request(app)
      .patch(`/api/season-plans/${dependentId}/entries/cs7-chennai`)
      .set(auth(token))
      .send({ costs: { travel: 8000, stay: 9000, entryFee: 1500 } });
    assert.equal(patched.status, 200);
    assert.deepEqual(patched.body.data.entries[0].costs, {
      travel: 8000,
      stay: 9000,
      entryFee: 1500,
    });

    const res = await request(app).get(`/api/planner/${dependentId}/costs`).set(auth(token));
    const cost = res.body.data.events["cs7-chennai"];

    assert.equal(cost.travel.basis, "yours");
    assert.equal(cost.stay.basis, "yours");
    assert.equal(cost.entryFee, 1500);
    assert.deepEqual(cost.total, { low: 18500, high: 18500 });
    assert.deepEqual(res.body.data.season.total, { low: 18500, high: 18500 });
    assert.equal(res.body.data.season.missingEntryFees, 0);
  });

  it("compares the season with the budget the parent set", async () => {
    const { token, dependentId } = await seedFamily();
    await addToPlan(token, dependentId, "cs7-chennai");
    await request(app)
      .patch(`/api/season-plans/${dependentId}/entries/cs7-chennai`)
      .set(auth(token))
      .send({ costs: { travel: 8000, stay: 9000 } });

    const set = (budget: number) =>
      request(app)
        .put(`/api/season-plans/${dependentId}/preferences`)
        .set(auth(token))
        .send({ goal: "points", blockedRanges: [], budget });
    const status = async () =>
      (await request(app).get(`/api/planner/${dependentId}/costs`).set(auth(token))).body.data
        .season.status;

    await set(50000);
    assert.equal(await status(), "within");
    await set(10000);
    assert.equal(await status(), "over");
  });

  it("prices suggestions named in slugs without adding them to the season", async () => {
    const { token, dependentId } = await seedFamily();
    await addToPlan(token, dependentId, "cs7-chennai");

    const res = await request(app)
      .get(`/api/planner/${dependentId}/costs`)
      .query({ slugs: "cs7-sonipat,not-an-event" })
      .set(auth(token));

    assert.ok(res.body.data.events["cs7-sonipat"].total);
    assert.equal(res.body.data.events["not-an-event"], undefined);
    assert.equal(res.body.data.season.events, 1);
  });

  it("refuses a bad figure with a 400 and leaves the stored ones alone", async () => {
    const { token, dependentId } = await seedFamily();
    await addToPlan(token, dependentId, "cs7-chennai");
    await request(app)
      .patch(`/api/season-plans/${dependentId}/entries/cs7-chennai`)
      .set(auth(token))
      .send({ costs: { travel: 8000 } });

    const bad = await request(app)
      .patch(`/api/season-plans/${dependentId}/entries/cs7-chennai`)
      .set(auth(token))
      .send({ costs: { travel: -5 } });

    assert.equal(bad.status, 400);
    const plan = await request(app).get(`/api/season-plans/${dependentId}`).set(auth(token));
    assert.deepEqual(plan.body.data.entries[0].costs, { travel: 8000 });
  });
});
