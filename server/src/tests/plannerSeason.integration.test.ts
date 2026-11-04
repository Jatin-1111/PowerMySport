/* eslint-disable @typescript-eslint/no-var-requires, @typescript-eslint/no-explicit-any */
// HTTP-level tests for what the season recommender added: "not for us", the opt-in to older
// age groups, what past draws say about each open event, the events expected later from last
// year's calendar, and the store of who got in at finished events.
//
// Through the real `app` and the real `authMiddleware`, with no model: the key is blanked so
// no request can reach one, and the recommender then answers from its own season.
process.env.JWT_SECRET = "test-secret-test-secret-test-secret-1234567890";
process.env.PHONEPE_CLIENT_ID = "test-client";
process.env.PHONEPE_CLIENT_SECRET = "test-secret";
process.env.PHONEPE_CLIENT_VERSION = "1";
process.env.PHONEPE_ENV = "SANDBOX";
process.env.REDIS_ENABLED = "false";
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
const { EditionAcceptance } = require("../shared/models/EditionAcceptance");
const store = require("../shared/services/aita/acceptanceStore");
const redis = require("../config/redis").default;

const oid = () => new mongoose.Types.ObjectId();
const DAY = 24 * 60 * 60 * 1000;
const inDays = (days: number) => new Date(Date.now() + days * DAY);
const ymd = (date: Date) => date.toISOString().slice(0, 10);

let mongod: { getUri(): string; stop(): Promise<void> };

before(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
  await PlayerRankingLink.syncIndexes();
  await SeasonPlan.syncIndexes();
  await EditionAcceptance.syncIndexes();
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
    "editionacceptances",
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

const edition = (slug: string, over: Record<string, unknown> = {}) =>
  TournamentEdition.create({
    sportSlug: "tennis",
    name: `AITA CS7 (${(over.city as string) ?? "Sonipat"})`,
    slug,
    editionYear: 2026,
    startDate: inDays(20),
    endDate: inDays(24),
    sourceUrl: "https://example.test",
    city: "Sonipat",
    state: "Haryana",
    ageGroups: ["Under-14"],
    ladder: "Championship Series",
    grade: 7,
    kind: "junior-ladder",
    ...over,
  });

/** A parent with a U-14 boy ranked 312, linked, and no events yet. */
const family = async (gender = "Boys") => {
  const { userId, token } = await signedInAs();
  const child = await Player.create({ userId, type: "DEPENDENT", name: "Aarav" });
  await RankingEntry.create({
    snapshot: oid(),
    sportSlug: "tennis",
    federationCode: "AITA",
    category: gender,
    subcategory: "U-14",
    asOnDate: new Date(Date.UTC(2026, 8, 7)),
    isLatest: true,
    rank: 312,
    regNo: "770001",
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
  await PlayerRankingLink.create({ userId, dependentId: child._id, regNo: "770001" });
  return { userId, token, dependentId: child._id.toString() };
};

const sample = (n: number, over: Record<string, unknown> = {}) => ({
  externalId: String(n),
  tournamentName: "AITA National Series Tournament",
  ladder: "National Series",
  startDate: ymd(inDays(-10 * n)),
  category: "BS14",
  ageGroup: "U-14",
  gender: "Boys",
  mainDrawSize: 64,
  mainDirectSlots: 55,
  mainRanks: Array.from({ length: 55 }, (_, i) => 10 + i * 2),
  mainUnranked: 0,
  qualifyingSize: 48,
  qualifyingDirectSlots: 44,
  qualifyingRanks: Array.from({ length: 44 }, (_, i) => 130 + i * 8),
  qualifyingUnranked: 0,
  entered: 90,
  asOn: null,
  capturedAt: new Date(),
  ...over,
});

// ─── "Not for us" ─────────────────────────────────────────────────────────────

describe("marking a suggestion as not for us", () => {
  it("remembers it on the plan, and leaves it out of the next suggestions", async () => {
    const { token, dependentId } = await family();
    await edition("keep", { startDate: inDays(20), endDate: inDays(24) });
    await edition("drop", { startDate: inDays(40), endDate: inDays(44) });

    const dismissed = await request(app)
      .post(`/api/season-plans/${dependentId}/dismissed`)
      .set(auth(token))
      .send({ editionSlug: "drop" });
    assert.equal(dismissed.status, 200);
    assert.deepEqual(dismissed.body.data.dismissed, ["drop"]);

    const asked = await request(app)
      .post(`/api/planner/${dependentId}/recommendations`)
      .set(auth(token))
      .send({ force: false });
    assert.equal(asked.status, 200);
    const slugs = asked.body.data.recommendations.items.map((i: { slug: string }) => i.slug);
    assert.ok(slugs.includes("keep"));
    assert.ok(!slugs.includes("drop"));
    assert.match(asked.body.data.recommendations.notes.join(" "), /marked as not for you/);
  });

  it("is undone by restoring, and the event returns", async () => {
    const { token, dependentId } = await family();
    await edition("drop");
    await request(app)
      .post(`/api/season-plans/${dependentId}/dismissed`)
      .set(auth(token))
      .send({ editionSlug: "drop" });

    const restored = await request(app)
      .delete(`/api/season-plans/${dependentId}/dismissed/drop`)
      .set(auth(token));
    assert.deepEqual(restored.body.data.dismissed, []);

    const asked = await request(app)
      .post(`/api/planner/${dependentId}/recommendations`)
      .set(auth(token))
      .send({});
    assert.ok(
      asked.body.data.recommendations.items.some((i: { slug: string }) => i.slug === "drop")
    );
  });

  it("is safe to do twice, and to undo what was never done", async () => {
    const { token, dependentId } = await family();
    for (let i = 0; i < 2; i += 1) {
      const response = await request(app)
        .post(`/api/season-plans/${dependentId}/dismissed`)
        .set(auth(token))
        .send({ editionSlug: "same" });
      assert.deepEqual(response.body.data.dismissed, ["same"]);
    }
    const undone = await request(app)
      .delete(`/api/season-plans/${dependentId}/dismissed/never-dismissed`)
      .set(auth(token));
    assert.equal(undone.status, 200);
    assert.deepEqual(undone.body.data.dismissed, ["same"]);
  });

  it("keeps only the newest sixty, so the list cannot grow without end", async () => {
    const { token, dependentId } = await family();
    for (let i = 0; i < 63; i += 1) {
      await request(app)
        .post(`/api/season-plans/${dependentId}/dismissed`)
        .set(auth(token))
        .send({ editionSlug: `e${i}` });
    }
    const plan = await request(app).get(`/api/season-plans/${dependentId}`).set(auth(token));
    assert.equal(plan.body.data.dismissed.length, 60);
    assert.ok(plan.body.data.dismissed.includes("e62"));
    assert.ok(!plan.body.data.dismissed.includes("e0"));
  });

  it("is forgotten when the parent adds the event to the plan after all", async () => {
    const { token, dependentId } = await family();
    await edition("changed-mind");
    await request(app)
      .post(`/api/season-plans/${dependentId}/dismissed`)
      .set(auth(token))
      .send({ editionSlug: "changed-mind" });
    const added = await request(app)
      .post(`/api/season-plans/${dependentId}/entries`)
      .set(auth(token))
      .send({ editionSlug: "changed-mind" });
    assert.equal(added.status, 201);
    assert.deepEqual(added.body.data.dismissed, []);
  });

  it("refuses an empty event, and a stranger's child", async () => {
    const { token, dependentId } = await family();
    const empty = await request(app)
      .post(`/api/season-plans/${dependentId}/dismissed`)
      .set(auth(token))
      .send({});
    assert.equal(empty.status, 400);

    const stranger = await signedInAs();
    const other = await request(app)
      .post(`/api/season-plans/${dependentId}/dismissed`)
      .set(auth(stranger.token))
      .send({ editionSlug: "x" });
    assert.ok([403, 404].includes(other.status));
    const none = await request(app)
      .post(`/api/season-plans/${dependentId}/dismissed`)
      .send({ editionSlug: "x" });
    assert.equal(none.status, 401);
  });
});

// ─── Older age groups, by choice ──────────────────────────────────────────────

describe("offering events in an older age group", () => {
  const save = (token: string, dependentId: string, includeOlderGroup: unknown) =>
    request(app)
      .put(`/api/season-plans/${dependentId}/preferences`)
      .set(auth(token))
      .send({ goal: "points", blockedRanges: [], budget: null, includeOlderGroup });

  it("is off until the parent asks, and then offers them only as options", async () => {
    const { token, dependentId } = await family();
    await edition("own");
    await edition("up", {
      ageGroups: ["Under-16"],
      startDate: inDays(50),
      endDate: inDays(54),
    });

    const before = await request(app)
      .post(`/api/planner/${dependentId}/recommendations`)
      .set(auth(token))
      .send({});
    assert.ok(!before.body.data.recommendations.items.some((i: any) => i.slug === "up"));

    const saved = await save(token, dependentId, true);
    assert.equal(saved.body.data.preferences.includeOlderGroup, true);

    const after = await request(app)
      .post(`/api/planner/${dependentId}/recommendations`)
      .set(auth(token))
      .send({});
    const up = after.body.data.recommendations.items.find((i: any) => i.slug === "up");
    assert.equal(up.tier, "consider");
    assert.match(up.reason, /older age group/);
  });

  it("defaults to off, and refuses anything that is not true or false", async () => {
    const { token, dependentId } = await family();
    const plan = await request(app).get(`/api/season-plans/${dependentId}`).set(auth(token));
    assert.equal(plan.body.data.preferences.includeOlderGroup, false);
    assert.equal((await save(token, dependentId, "yes")).status, 400);
  });
});

// ─── What past draws say ──────────────────────────────────────────────────────

describe("what past draws say about each open event", () => {
  const overview = async (token: string, dependentId: string) =>
    (await request(app).get(`/api/planner/${dependentId}`).set(auth(token))).body.data;

  it("says where this rank would have landed, from the finished events of that level", async () => {
    const { token, dependentId } = await family();
    await edition("ns", { ladder: "National Series" });
    await store.saveRecords(
      [1, 2, 3].map((n) => ({ ...sample(n), capturedAt: new Date().toISOString() }))
    );

    const data = await overview(token, dependentId);
    // Rank 312: past main draws closed near rank 118, the qualifying near 474.
    assert.equal(data.reach.ns.kind, "qualifying");
    assert.match(data.reach.ns.text, /Boys U-14 National Series/);
    assert.match(data.reach.ns.text, /not this one/);
  });

  it("has no verdict for a level it holds no past events for", async () => {
    const { token, dependentId } = await family();
    await edition("ss", { ladder: "Super Series" });
    await store.saveRecords([{ ...sample(1), capturedAt: new Date().toISOString() }]);
    const data = await overview(token, dependentId);
    assert.equal(data.reach.ss.kind, "no-evidence");
  });

  it("judges a girl by the girls' draws, not the boys'", async () => {
    const { token, dependentId } = await family("Girls");
    await edition("ns", { ladder: "National Series" });
    await store.saveRecords(
      [1, 2, 3].map((n) => ({
        ...sample(n, { gender: "Girls", category: "GS14", mainRanks: [5, 6], mainUnranked: 0 }),
        capturedAt: new Date().toISOString(),
      }))
    );
    // A girls' draw that was nowhere near full: everyone who entered got in.
    const data = await overview(token, dependentId);
    assert.equal(data.reach.ns.kind, "likely");
  });

  it("stores each event and category once, however often it is captured", async () => {
    const records = [sample(1), sample(1, { category: "BS16", ageGroup: "U-16" }), sample(2)].map(
      (r) => ({
        ...r,
        capturedAt: new Date().toISOString(),
      })
    );
    await store.saveRecords(records);
    await store.saveRecords(records);
    assert.equal(await EditionAcceptance.countDocuments({}), 3);
    assert.deepEqual([...(await store.capturedIds())].sort(), ["1", "2"]);
  });

  it("hands back the newest past events first, as plain numbers", async () => {
    await store.saveRecords(
      [3, 1, 2].map((n) => ({ ...sample(n), capturedAt: new Date().toISOString() }))
    );
    const samples = await store.samplesFor("National Series", "U-14", "Boys", 2);
    assert.deepEqual(
      samples.map((s: { externalId: string }) => s.externalId),
      ["1", "2"]
    );
    assert.equal(samples[0].mainDrawSize, 64);
    assert.equal(JSON.stringify(samples).includes("tournamentName"), false);
  });

  it("holds no name, state or birth year for any player", async () => {
    await store.saveRecords([{ ...sample(1), capturedAt: new Date().toISOString() }]);
    const stored = await EditionAcceptance.collection.findOne({});
    const text = JSON.stringify(stored);
    assert.doesNotMatch(text, /firstName|familyName|dob|birthYear|regNo|"state"/);
  });
});

// ─── Expected later ───────────────────────────────────────────────────────────

describe("what last year suggests for the months beyond the calendar", () => {
  const overview = async (token: string, dependentId: string) =>
    (await request(app).get(`/api/planner/${dependentId}`).set(auth(token))).body.data;

  it("lists an event that ran about a year ago and is not on the published calendar", async () => {
    const { token, dependentId } = await family();
    await edition("soon", { startDate: inDays(15), endDate: inDays(19) });
    // Ran 304 days ago: its anniversary is 60 days from now, beyond the published calendar.
    await edition("last-year", {
      name: "AITA CS7 (Pune)",
      city: "Pune",
      state: "Maharashtra",
      startDate: inDays(-304),
      endDate: inDays(-300),
    });
    const data = await overview(token, dependentId);
    assert.equal(data.expected.length, 1);
    assert.equal(data.expected[0].city, "Pune");
    assert.match(data.expected[0].expectedMonth, /^[A-Z][a-z]+ \d{4}$/);
    // A month, never a day: the date a year on is a guess.
    assert.equal(data.expected[0].startDate, undefined);
  });

  it("does not list it when the calendar already holds this year's event", async () => {
    const { token, dependentId } = await family();
    await edition("this-year", {
      name: "AITA CS7 (Pune)",
      city: "Pune",
      startDate: inDays(60),
      endDate: inDays(64),
    });
    await edition("last-year", {
      name: "AITA CS7 (Pune)",
      city: "Pune",
      startDate: inDays(-304),
      endDate: inDays(-300),
    });
    assert.deepEqual((await overview(token, dependentId)).expected, []);
  });

  it("lists only events with a place for the child's age group", async () => {
    const { token, dependentId } = await family();
    await edition("soon", { startDate: inDays(15), endDate: inDays(19) });
    await edition("last-year-u18", {
      name: "AITA CS7 (Pune)",
      city: "Pune",
      ageGroups: ["Under-18"],
      startDate: inDays(-304),
      endDate: inDays(-300),
    });
    assert.deepEqual((await overview(token, dependentId)).expected, []);
  });
});
