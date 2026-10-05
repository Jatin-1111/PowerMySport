/* eslint-disable @typescript-eslint/no-var-requires */
// Integration tests for the planner overview: the one function the planner page
// and the assistant chat both read.
//
// What is worth pinning is that the verdicts are the shared rules' verdicts and
// that the inputs are honest: a past or cancelled or merged event never reaches
// the rules, someone else's child is never readable, and an unlinked child is
// told to link rather than shown a list judged against a rank we invented.
process.env.JWT_SECRET = "test-secret-test-secret-test-secret-1234567890";
process.env.REDIS_ENABLED = "false";

import assert = require("node:assert/strict");
const { after, before, beforeEach, describe, it } = require("node:test");
const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");

const { Player } = require("../client/models/Player");
const { User } = require("../client/models/User");
const { PlayerRankingLink } = require("../client/models/PlayerRankingLink");
const { SeasonPlan } = require("../client/models/SeasonPlan");
const { RankingEntry } = require("../shared/models/RankingEntry");
const { TournamentEdition } = require("../shared/models/TournamentEdition");
const { PlannerService } = require("../client/services/PlannerService");
const { SeasonPlanService } = require("../client/services/SeasonPlanService");
const { resolveOrigin, setHomeCity } = require("../client/services/plannerCosts/origin");

let memoryServer: { getUri(): string; stop(): Promise<void> };

const DAY = 24 * 60 * 60 * 1000;
const inDays = (days: number) => new Date(Date.now() + days * DAY);

const seedParent = (name: string) =>
  User.create({
    name,
    email: `${name.toLowerCase().replace(/\s+/g, ".")}@example.test`,
    phone: `9${Math.floor(100000000 + Math.random() * 899999999)}`,
    password: "not-a-real-password",
    role: "Parent",
  });

const seedChild = (parentId: unknown, name = "Aarav") =>
  Player.create({ userId: parentId, type: "DEPENDENT", name });

const seedStanding = (
  regNo: string,
  options: { rank: number; subcategory?: string; category?: string }
) =>
  RankingEntry.create({
    snapshot: new mongoose.Types.ObjectId(),
    sportSlug: "tennis",
    federationCode: "AITA",
    category: options.category ?? "Boys",
    subcategory: options.subcategory ?? "U-14",
    asOnDate: new Date(Date.UTC(2026, 8, 7)),
    isLatest: true,
    rank: options.rank,
    regNo,
    givenName: "Aarav",
    familyName: "Khandelwal",
    fullName: "Aarav Khandelwal",
    nameSearch: "aarav khandelwal",
    dob: new Date(Date.UTC(2012, 4, 17)),
    birthYear: 2012,
    state: "Maharashtra",
    stateCode: "MH",
    totalPoints: 148,
  });

const link = (userId: unknown, dependentId: unknown, regNo: string) =>
  PlayerRankingLink.create({ userId, dependentId, regNo });

let counter = 0;
const seedEdition = (
  overrides: Partial<{
    name: string;
    startDate: Date;
    ageGroups: string[];
    ladder: string;
    grade: number;
    kind: string;
    status: string;
    mergedInto: string;
    sportSlug: string;
  }> = {}
) => {
  counter += 1;
  return TournamentEdition.create({
    sportSlug: overrides.sportSlug ?? "tennis",
    name: overrides.name ?? `AITA CS${counter} (Sonipat)`,
    slug: `edition-${counter}`,
    editionYear: 2026,
    startDate: overrides.startDate ?? inDays(10 + counter),
    sourceUrl: "https://example.test",
    city: "Sonipat",
    ageGroups: overrides.ageGroups ?? ["Under-14"],
    ladder: overrides.ladder ?? "Championship Series",
    grade: overrides.grade ?? 7,
    kind: overrides.kind ?? "junior-ladder",
    ...(overrides.status ? { status: overrides.status } : {}),
    ...(overrides.mergedInto ? { mergedInto: overrides.mergedInto } : {}),
  });
};

before(async () => {
  memoryServer = await MongoMemoryServer.create();
  await mongoose.connect(memoryServer.getUri());
  await PlayerRankingLink.syncIndexes();
  await SeasonPlan.syncIndexes();
});

after(async () => {
  await mongoose.disconnect();
  await memoryServer.stop();
});

beforeEach(async () => {
  counter = 0;
  await Promise.all([
    User.deleteMany({}),
    Player.deleteMany({}),
    PlayerRankingLink.deleteMany({}),
    RankingEntry.deleteMany({}),
    TournamentEdition.deleteMany({}),
    SeasonPlan.deleteMany({}),
  ]);
});

describe("a child with no ranking link", () => {
  it("is told to link one, and is shown no verdicts", async () => {
    const parent = await seedParent("Rahul One");
    const child = await seedChild(parent._id);
    await seedEdition();

    const overview = await PlannerService.forDependent(String(parent._id), String(child._id));

    assert.equal(overview.linkState, "not-linked");
    assert.equal(overview.shortlist, null);
    assert.equal(overview.standing, null);
    assert.equal(overview.dependentName, "Aarav");
  });
});

describe("a linked child", () => {
  it("is judged against the list they are ranked in", async () => {
    const parent = await seedParent("Rahul Two");
    const child = await seedChild(parent._id);
    await seedStanding("440090", { rank: 312 });
    await link(parent._id, child._id, "440090");
    await seedEdition({ name: "AITA CS7 (Sonipat)", ladder: "Championship Series" });
    await seedEdition({ name: "AITA TS (Pune)", ladder: "Talent Series", grade: 1 });

    const overview = await PlannerService.forDependent(String(parent._id), String(child._id));

    assert.equal(overview.linkState, "ready");
    assert.equal(overview.standing.subcategory, "U-14");
    assert.equal(overview.standing.rank, 312);
    assert.equal(overview.annualEntryCap, 25);
    assert.equal(overview.shortlist.ownGroup.length, 2);
    assert.equal(overview.editionsConsidered, 2);
  });

  it("is barred from Talent Series inside the top 75, with the reason attached", async () => {
    const parent = await seedParent("Rahul Three");
    const child = await seedChild(parent._id);
    await seedStanding("440091", { rank: 40 });
    await link(parent._id, child._id, "440091");
    await seedEdition({ name: "AITA CS7 (Sonipat)", ladder: "Championship Series" });
    await seedEdition({ name: "AITA TS (Pune)", ladder: "Talent Series", grade: 1 });

    const overview = await PlannerService.forDependent(String(parent._id), String(child._id));

    assert.equal(overview.shortlist.ownGroup.length, 1);
    assert.equal(overview.shortlist.closed.length, 1);
    assert.match(overview.shortlist.closed[0].reason, /Talent Series is closed at rank 40/);
  });

  it("never judges events that are past, cancelled, merged away, or in another sport", async () => {
    const parent = await seedParent("Rahul Four");
    const child = await seedChild(parent._id);
    await seedStanding("440092", { rank: 312 });
    await link(parent._id, child._id, "440092");
    await seedEdition({ name: "Open one" });
    await seedEdition({ name: "Last month", startDate: inDays(-30) });
    await seedEdition({ name: "Called off", status: "cancelled" });
    await seedEdition({ name: "Duplicate", mergedInto: "edition-1" });
    await seedEdition({ name: "Squash thing", sportSlug: "squash" });

    const overview = await PlannerService.forDependent(String(parent._id), String(child._id));

    assert.equal(overview.editionsConsidered, 1);
    assert.deepEqual(
      overview.shortlist.ownGroup.map((entry: { edition: { name: string } }) => entry.edition.name),
      ["Open one"]
    );
  });

  it("keeps an adult prize-money event out of a junior list", async () => {
    const parent = await seedParent("Rahul Five");
    const child = await seedChild(parent._id);
    await seedStanding("440093", { rank: 312 });
    await link(parent._id, child._id, "440093");
    await seedEdition({ name: "AITA Mens 25k", kind: "senior-prize-money", ageGroups: ["Men"] });

    const overview = await PlannerService.forDependent(String(parent._id), String(child._id));

    assert.equal(overview.shortlist.ownGroup.length, 0);
    assert.equal(overview.shortlist.closed.length, 0);
    assert.equal(overview.shortlist.unknown.length, 0);
  });

  it("returns the plan the parent has already made, beside the verdicts", async () => {
    const parent = await seedParent("Rahul Six");
    const child = await seedChild(parent._id);
    await seedStanding("440094", { rank: 312 });
    await link(parent._id, child._id, "440094");
    const edition = await seedEdition();
    await SeasonPlanService.addEntry({
      userId: String(parent._id),
      dependentId: String(child._id),
      editionSlug: edition.slug,
    });

    const overview = await PlannerService.forDependent(String(parent._id), String(child._id));

    assert.equal(overview.plan.entries.length, 1);
    assert.equal(overview.plan.entries[0].editionSlug, edition.slug);
  });

  it("serialises dates as ISO strings, because the rules are shared with a browser", async () => {
    const parent = await seedParent("Rahul Seven");
    const child = await seedChild(parent._id);
    await seedStanding("440095", { rank: 312 });
    await link(parent._id, child._id, "440095");
    await seedEdition();

    const overview = await PlannerService.forDependent(String(parent._id), String(child._id));

    assert.equal(typeof overview.shortlist.ownGroup[0].edition.startDate, "string");
  });
});

describe("a child ranked only on an open-age list", () => {
  it("is not judged, because the junior rules do not apply to them", async () => {
    const parent = await seedParent("Rahul Eight");
    const child = await seedChild(parent._id);
    await seedStanding("440096", { rank: 3, subcategory: "Men", category: "Open" });
    await link(parent._id, child._id, "440096");

    const overview = await PlannerService.forDependent(String(parent._id), String(child._id));

    assert.equal(overview.linkState, "no-junior-standing");
    assert.equal(overview.shortlist, null);
  });
});

describe("ownership", () => {
  it("will not read another account's child", async () => {
    const owner = await seedParent("Rahul Owner");
    const stranger = await seedParent("Priya Stranger");
    const child = await seedChild(owner._id);

    await assert.rejects(
      () => PlannerService.forDependent(String(stranger._id), String(child._id)),
      (error: { statusCode?: number }) => error.statusCode === 404
    );
  });

  it("rejects an id that is not an id", async () => {
    const parent = await seedParent("Rahul Nine");
    await assert.rejects(
      () => PlannerService.forDependent(String(parent._id), "not-an-id"),
      (error: { statusCode?: number }) => error.statusCode === 400
    );
  });
});

describe("planning preferences", () => {
  const setup = async () => {
    const parent = await seedParent("Rahul Prefs");
    const child = await seedChild(parent._id);
    return { userId: String(parent._id), dependentId: String(child._id) };
  };

  it("defaults to the points goal with nothing blocked", async () => {
    const { userId, dependentId } = await setup();
    const plan = await SeasonPlanService.get(userId, dependentId);
    assert.deepEqual(plan.preferences, { goal: "points", blockedRanges: [], budget: null });
  });

  it("saves the goal and blocked dates, creating the plan if there is none", async () => {
    const { userId, dependentId } = await setup();

    const plan = await SeasonPlanService.setPreferences({
      userId,
      dependentId,
      goal: "home",
      blockedRanges: [{ from: "2026-11-02", to: "2026-11-20", label: "  Board exams " }],
    });

    assert.equal(plan.preferences.goal, "home");
    assert.deepEqual(plan.preferences.blockedRanges, [
      { from: "2026-11-02", to: "2026-11-20", label: "Board exams" },
    ]);
    assert.deepEqual(
      (await SeasonPlanService.get(userId, dependentId)).preferences,
      plan.preferences
    );
  });

  it("keeps blocked ranges in date order", async () => {
    const { userId, dependentId } = await setup();
    const plan = await SeasonPlanService.setPreferences({
      userId,
      dependentId,
      goal: "points",
      blockedRanges: [
        { from: "2026-12-01", to: "2026-12-05" },
        { from: "2026-11-01", to: "2026-11-05" },
      ],
    });
    assert.deepEqual(
      plan.preferences.blockedRanges.map((range: { from: string }) => range.from),
      ["2026-11-01", "2026-12-01"]
    );
  });

  it("returns the preferences with every plan change, so the page never loses them", async () => {
    const { userId, dependentId } = await setup();
    await SeasonPlanService.setPreferences({
      userId,
      dependentId,
      goal: "experience",
      blockedRanges: [],
    });
    const edition = await seedEdition();

    const added = await SeasonPlanService.addEntry({
      userId,
      dependentId,
      editionSlug: edition.slug,
    });
    const moved = await SeasonPlanService.updateEntry({
      userId,
      dependentId,
      editionSlug: edition.slug,
      status: "entered",
    });
    const removed = await SeasonPlanService.removeEntry(userId, dependentId, edition.slug);

    for (const plan of [added, moved, removed]) {
      assert.equal(plan.preferences.goal, "experience");
    }
  });

  it("rejects what is not a goal, a list, or a real date", async () => {
    const { userId, dependentId } = await setup();
    // Lazy, so each attempt starts only when it is awaited. Building them all up
    // front leaves most rejecting with nobody listening yet.
    const bad = (overrides: Record<string, unknown>) => () =>
      SeasonPlanService.setPreferences({
        userId,
        dependentId,
        goal: "points",
        blockedRanges: [],
        ...overrides,
      });

    for (const attempt of [
      bad({ goal: "glory" }),
      bad({ goal: undefined }),
      bad({ blockedRanges: "soon" }),
      bad({ blockedRanges: [{ from: "2026-02-31", to: "2026-03-02" }] }),
      bad({ blockedRanges: [{ from: "11/02/2026", to: "2026-11-20" }] }),
      bad({ blockedRanges: [{ from: "2026-11-20", to: "2026-11-02" }] }),
      bad({ blockedRanges: [{ from: "2026-11-02" }] }),
    ]) {
      await assert.rejects(attempt, (error: { statusCode?: number }) => error.statusCode === 400);
    }
  });

  it("allows five blocked ranges and refuses a sixth", async () => {
    const { userId, dependentId } = await setup();
    const pad = (month: number) => String(month).padStart(2, "0");
    const range = (month: number) => ({
      from: `2026-${pad(month)}-01`,
      to: `2026-${pad(month)}-05`,
    });
    const five = [1, 2, 3, 4, 5].map(range);

    const saved = await SeasonPlanService.setPreferences({
      userId,
      dependentId,
      goal: "points",
      blockedRanges: five,
    });
    assert.equal(saved.preferences.blockedRanges.length, 5);

    await assert.rejects(
      () =>
        SeasonPlanService.setPreferences({
          userId,
          dependentId,
          goal: "points",
          blockedRanges: [...five, range(6)],
        }),
      (error: { statusCode?: number }) => error.statusCode === 400
    );
  });

  it("will not touch another account's child", async () => {
    const owner = await seedParent("Rahul Owner Two");
    const stranger = await seedParent("Priya Stranger Two");
    const child = await seedChild(owner._id);

    await assert.rejects(
      () =>
        SeasonPlanService.setPreferences({
          userId: String(stranger._id),
          dependentId: String(child._id),
          goal: "points",
          blockedRanges: [],
        }),
      (error: { statusCode?: number }) => error.statusCode === 404
    );
  });

  it("flows into the planner overview, where the recommender reads it", async () => {
    const { userId, dependentId } = await setup();
    await SeasonPlanService.setPreferences({
      userId,
      dependentId,
      goal: "experience",
      blockedRanges: [{ from: "2026-11-02", to: "2026-11-03" }],
    });
    await seedStanding("440199", { rank: 312 });
    await link(userId, dependentId, "440199");

    const overview = await PlannerService.forDependent(userId, dependentId);

    assert.equal(overview.plan.preferences.goal, "experience");
    assert.equal(overview.plan.preferences.blockedRanges.length, 1);
    assert.equal(overview.standing.state, "Maharashtra");
  });
});

describe("the home city", () => {
  const ADDRESS = {
    fullName: "Rahul Test",
    email: "rahul.addr@example.test",
    phone: "9000000001",
    addressLine1: "1 Test Road",
    city: "Nagpur",
    state: "Maharashtra",
    postalCode: "440001",
  };

  it("is read from the profile city first", async () => {
    const parent = await seedParent("Rahul City");
    await User.updateOne({ _id: parent._id }, { $set: { city: "Pune" } });

    const origin = await resolveOrigin(String(parent._id), "Haryana");

    assert.deepEqual(origin, { kind: "city", city: "Pune", label: "Pune" });
  });

  it("falls back to a saved address, then the state on the ranking list, then nothing", async () => {
    const withAddress = await seedParent("Rahul Address");
    await User.updateOne({ _id: withAddress._id }, { $set: { addresses: [ADDRESS] } });
    const bare = await seedParent("Rahul Bare");

    assert.equal((await resolveOrigin(String(withAddress._id), "Haryana")).city, "Nagpur");
    assert.deepEqual(await resolveOrigin(String(bare._id), "Haryana"), {
      kind: "state",
      state: "Haryana",
      label: "Haryana",
    });
    assert.deepEqual(await resolveOrigin(String(bare._id), null), { kind: "none", label: null });
  });

  it("saves the city on the profile, trimmed, so the profile and the planner agree", async () => {
    const parent = await seedParent("Rahul Save");

    const saved = await setHomeCity(String(parent._id), "  Navi   Mumbai ");

    assert.equal(saved, "Navi Mumbai");
    assert.equal((await User.findById(parent._id).lean()).city, "Navi Mumbai");
    assert.equal((await resolveOrigin(String(parent._id), null)).city, "Navi Mumbai");
  });

  it("accepts the punctuation real place names use", async () => {
    const parent = await seedParent("Rahul Names");
    for (const name of [
      "Bengaluru",
      "Greater Noida",
      "Dehradun",
      "St. Thomas Mount",
      "Hazaribagh",
    ]) {
      assert.equal(await setHomeCity(String(parent._id), name), name);
    }
  });

  it("refuses what is not a city: empty, digits, markup, or far too long", async () => {
    const parent = await seedParent("Rahul Bad");
    const bad = (value: unknown) => () => setHomeCity(String(parent._id), value);

    for (const value of [
      "",
      "  ",
      "12345",
      "<script>x</script>",
      "Pune; DROP",
      "a".repeat(80),
      42,
      null,
      undefined,
    ]) {
      await assert.rejects(
        bad(value),
        (error: { statusCode?: number }) => error.statusCode === 400
      );
    }
    assert.equal((await User.findById(parent._id).lean()).city, undefined);
  });
});

describe("a parent's own costs and budget", () => {
  const setup = async () => {
    const parent = await seedParent("Rahul Costs");
    const child = await seedChild(parent._id);
    const edition = await seedEdition();
    await SeasonPlanService.addEntry({
      userId: String(parent._id),
      dependentId: String(child._id),
      editionSlug: edition.slug,
    });
    return { userId: String(parent._id), dependentId: String(child._id), slug: edition.slug };
  };
  const costsOf = (plan: { entries: Array<{ costs?: unknown }> }) => plan.entries[0]?.costs;

  it("stores the figures a parent types, per part", async () => {
    const { userId, dependentId, slug } = await setup();

    const plan = await SeasonPlanService.updateEntry({
      userId,
      dependentId,
      editionSlug: slug,
      costs: { travel: 8000, entryFee: 1500 },
    });

    assert.deepEqual(costsOf(plan), { travel: 8000, entryFee: 1500 });
  });

  it("changes one part without wiping the others, and clears a part with null", async () => {
    const { userId, dependentId, slug } = await setup();
    const update = (costs: unknown) =>
      SeasonPlanService.updateEntry({ userId, dependentId, editionSlug: slug, costs });
    await update({ travel: 8000, stay: 9000 });

    assert.deepEqual(costsOf(await update({ travel: 7000 })), { travel: 7000, stay: 9000 });
    assert.deepEqual(costsOf(await update({ stay: null })), { travel: 7000 });
  });

  it("leaves no empty costs behind once every part is cleared", async () => {
    const { userId, dependentId, slug } = await setup();
    const update = (costs: unknown) =>
      SeasonPlanService.updateEntry({ userId, dependentId, editionSlug: slug, costs });
    await update({ travel: 8000 });

    assert.equal(costsOf(await update(null)), undefined);
  });

  it("does not touch the costs when the status changes", async () => {
    const { userId, dependentId, slug } = await setup();
    await SeasonPlanService.updateEntry({
      userId,
      dependentId,
      editionSlug: slug,
      costs: { travel: 8000 },
    });

    const plan = await SeasonPlanService.updateEntry({
      userId,
      dependentId,
      editionSlug: slug,
      status: "entered",
    });

    assert.deepEqual(costsOf(plan), { travel: 8000 });
  });

  it("refuses an amount that is not whole rupees within a sane ceiling", async () => {
    const { userId, dependentId, slug } = await setup();
    const bad = (costs: unknown) => () =>
      SeasonPlanService.updateEntry({ userId, dependentId, editionSlug: slug, costs });

    for (const costs of [
      { travel: -1 },
      { travel: 1.5 },
      { stay: "9000" },
      { entryFee: 99999999 },
      { travel: NaN },
      "lots",
      [1],
    ]) {
      await assert.rejects(
        bad(costs),
        (error: { statusCode?: number }) => error.statusCode === 400
      );
    }
  });

  it("saves a season budget with the preferences, and 0 or nothing means no ceiling", async () => {
    const { userId, dependentId } = await setup();
    const save = (budget: unknown) =>
      SeasonPlanService.setPreferences({
        userId,
        dependentId,
        goal: "points",
        blockedRanges: [],
        budget,
      });

    assert.equal((await save(60000)).preferences.budget, 60000);
    assert.equal((await save(0)).preferences.budget, null);
    assert.equal((await save(60000)).preferences.budget, 60000);
    assert.equal((await save(null)).preferences.budget, null);
    assert.equal((await save(undefined)).preferences.budget, null);
  });

  it("refuses a budget that is not whole rupees within the ceiling", async () => {
    const { userId, dependentId } = await setup();
    const bad = (budget: unknown) => () =>
      SeasonPlanService.setPreferences({
        userId,
        dependentId,
        goal: "points",
        blockedRanges: [],
        budget,
      });

    for (const budget of [-5, 1000.5, "50000", 999999999, NaN]) {
      await assert.rejects(
        bad(budget),
        (error: { statusCode?: number }) => error.statusCode === 400
      );
    }
  });

  it("returns the budget and the costs with every plan response, so the page never loses them", async () => {
    const { userId, dependentId, slug } = await setup();
    await SeasonPlanService.setPreferences({
      userId,
      dependentId,
      goal: "points",
      blockedRanges: [],
      budget: 50000,
    });
    await SeasonPlanService.updateEntry({
      userId,
      dependentId,
      editionSlug: slug,
      costs: { travel: 8000 },
    });

    const read = await SeasonPlanService.get(userId, dependentId);

    assert.equal(read.preferences.budget, 50000);
    assert.deepEqual(costsOf(read), { travel: 8000 });
  });
});
