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
