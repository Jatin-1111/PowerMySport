/* eslint-disable @typescript-eslint/no-var-requires */
// Integration tests for the weekly ranking digest sweep.
//
// The sweep decides who gets an email about a child's ranking. Three of its
// properties are the kind that fail silently in production and are noticed only
// as complaints: sending twice for one list, sending to someone who turned it
// off, and sending one email per list instead of one per family.
process.env.JWT_SECRET = "test-secret-test-secret-test-secret-1234567890";
process.env.REDIS_ENABLED = "false";

import assert = require("node:assert/strict");
const { after, before, beforeEach, describe, it } = require("node:test");
const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");

const { Player } = require("../client/models/Player");
const { User } = require("../client/models/User");
const { PlayerRankingLink } = require("../client/models/PlayerRankingLink");
const { ScheduledNotification } = require("../client/models/ScheduledNotification");
const { RankingEntry } = require("../shared/models/RankingEntry");
const { RankingSnapshot } = require("../shared/models/RankingSnapshot");
const { RankingDigestService, digestSummary } = require("../client/services/RankingDigestService");

let memoryServer: { getUri(): string; stop(): Promise<void> };

const MS_PER_WEEK = 7 * 24 * 60 * 60 * 1000;
const THIS_WEEK = new Date(Date.UTC(2026, 8, 7));
const LAST_WEEK = new Date(THIS_WEEK.getTime() - MS_PER_WEEK);

const seedParent = async (name: string, preferences?: Record<string, unknown>) =>
  User.create({
    name,
    email: `${name.toLowerCase().replace(/\s+/g, ".")}@example.test`,
    phone: `9${Math.floor(100000000 + Math.random() * 899999999)}`,
    password: "not-a-real-password",
    role: "Parent",
    ...(preferences ? { notificationPreferences: preferences } : {}),
  });

const seedLinkedChild = async (
  parentId: unknown,
  options: { name: string; regNo: string; lastNotifiedAsOnDate?: Date }
) => {
  const child = await Player.create({ userId: parentId, type: "DEPENDENT", name: options.name });
  await PlayerRankingLink.create({
    userId: parentId,
    dependentId: child._id,
    sportSlug: "tennis",
    federationCode: "AITA",
    regNo: options.regNo,
    verificationMethod: "DOB_CHALLENGE",
    verifiedAt: new Date(),
    ...(options.lastNotifiedAsOnDate ? { lastNotifiedAsOnDate: options.lastNotifiedAsOnDate } : {}),
  });
  return child;
};

const seedList = async (options: {
  regNo: string;
  asOnDate: Date;
  rank: number;
  prevRank?: number;
  totalPoints?: number;
  isLatest?: boolean;
  subcategory?: string;
}) => {
  const subcategory = options.subcategory ?? "U-14";
  const snapshot = await RankingSnapshot.create({
    sportSlug: "tennis",
    federationCode: "AITA",
    category: "Boys",
    subcategory,
    asOnDate: options.asOnDate,
    pdfUrl: "https://example.test/list",
    sourceUrl: "https://example.test",
    contentHash: `hash-${options.regNo}-${subcategory}-${options.asOnDate.getTime()}`,
    status: "published",
    isLatestForCombo: Boolean(options.isLatest),
    rowCount: 900,
  });

  await RankingEntry.create({
    snapshot: snapshot._id,
    sportSlug: "tennis",
    federationCode: "AITA",
    category: "Boys",
    subcategory,
    asOnDate: options.asOnDate,
    isLatest: Boolean(options.isLatest),
    rank: options.rank,
    ...(options.prevRank ? { prevRank: options.prevRank } : {}),
    regNo: options.regNo,
    givenName: "Child",
    familyName: "Player",
    fullName: "Child Player",
    nameSearch: "child player",
    totalPoints: options.totalPoints ?? 140,
  });
};

before(async () => {
  memoryServer = await MongoMemoryServer.create();
  await mongoose.connect(memoryServer.getUri());
  await PlayerRankingLink.syncIndexes();
});

after(async () => {
  await mongoose.disconnect();
  await memoryServer.stop();
});

beforeEach(async () => {
  await Promise.all([
    User.deleteMany({}),
    Player.deleteMany({}),
    PlayerRankingLink.deleteMany({}),
    ScheduledNotification.deleteMany({}),
    RankingEntry.deleteMany({}),
    RankingSnapshot.deleteMany({}),
  ]);
});

describe("who gets a digest, and how often", () => {
  it("queues one digest for a newly published list and none on a second run", async () => {
    const parent = await seedParent("Rahul One");
    await seedLinkedChild(parent._id, { name: "Aarav", regNo: "440090" });
    await seedList({ regNo: "440090", asOnDate: LAST_WEEK, rank: 330 });
    await seedList({
      regNo: "440090",
      asOnDate: THIS_WEEK,
      rank: 312,
      prevRank: 330,
      isLatest: true,
    });

    const first = await RankingDigestService.sweep();
    assert.equal(first.queued, 1);

    const queued = await ScheduledNotification.find({ type: "RANKING_DIGEST" }).lean();
    assert.equal(queued.length, 1);
    assert.equal(queued[0].interval, "CUSTOM");
    assert.match(queued[0].body, /Aarav moved up 18 places to 312/);
    assert.equal(queued[0].channels.email, true);

    // The same list must never be mailed twice, however often the cron runs.
    const second = await RankingDigestService.sweep();
    assert.equal(second.queued, 0);
    assert.equal(await ScheduledNotification.countDocuments({ type: "RANKING_DIGEST" }), 1);
  });

  it("sends one email per account, not one per child or per list", async () => {
    const parent = await seedParent("Rahul Two");
    await seedLinkedChild(parent._id, { name: "Aarav", regNo: "440090" });
    await seedLinkedChild(parent._id, { name: "Isha", regNo: "440091" });
    // One child ranked in two age groups, the other in one: three standings.
    await seedList({ regNo: "440090", asOnDate: THIS_WEEK, rank: 312, isLatest: true });
    await seedList({
      regNo: "440090",
      asOnDate: THIS_WEEK,
      rank: 800,
      subcategory: "U-16",
      isLatest: true,
    });
    await seedList({ regNo: "440091", asOnDate: THIS_WEEK, rank: 120, isLatest: true });

    const result = await RankingDigestService.sweep();
    assert.equal(result.queued, 1);

    const [digest] = await ScheduledNotification.find({ type: "RANKING_DIGEST" }).lean();
    assert.equal(digest.data.players.length, 2);
    const aarav = digest.data.players.find((p: { name: string }) => p.name === "Aarav");
    assert.equal(aarav.standings.length, 2);
    // The headline names the one further up, which is the list they belong to.
    assert.match(digest.body, /and 1 more player/);
  });

  it("does not queue anything for a list the account has already seen", async () => {
    const parent = await seedParent("Rahul Three");
    await seedLinkedChild(parent._id, {
      name: "Aarav",
      regNo: "440090",
      lastNotifiedAsOnDate: THIS_WEEK,
    });
    await seedList({ regNo: "440090", asOnDate: THIS_WEEK, rank: 312, isLatest: true });

    const result = await RankingDigestService.sweep();
    assert.equal(result.queued, 0);
  });

  it("respects a parent who turned ranking updates off, and does not bank them a backlog", async () => {
    const parent = await seedParent("Rahul Four", {
      email: { rankingUpdates: false },
      push: { rankingUpdates: false },
      inApp: { rankingUpdates: false },
    });
    await seedLinkedChild(parent._id, { name: "Aarav", regNo: "440090" });
    await seedList({ regNo: "440090", asOnDate: THIS_WEEK, rank: 312, isLatest: true });

    const result = await RankingDigestService.sweep();
    assert.equal(result.queued, 0);
    assert.equal(await ScheduledNotification.countDocuments({}), 0);

    // The link is still marked as seen. Otherwise turning the setting back on
    // would deliver every list published while it was off.
    const link = await PlayerRankingLink.findOne({ regNo: "440090" }).lean();
    assert.ok(link.lastNotifiedAsOnDate);
  });

  it("keeps the email channel off but still notifies in-app when only email is declined", async () => {
    const parent = await seedParent("Rahul Five", {
      email: { rankingUpdates: false },
    });
    await seedLinkedChild(parent._id, { name: "Aarav", regNo: "440090" });
    await seedList({ regNo: "440090", asOnDate: THIS_WEEK, rank: 312, isLatest: true });

    await RankingDigestService.sweep();
    const [digest] = await ScheduledNotification.find({ type: "RANKING_DIGEST" }).lean();
    assert.equal(digest.channels.email, false);
    assert.equal(digest.channels.inApp, true);
  });

  it("skips an account that has asked to be deleted", async () => {
    const parent = await seedParent("Rahul Six");
    await User.updateOne({ _id: parent._id }, { $set: { pendingDeletion: true } });
    await seedLinkedChild(parent._id, { name: "Aarav", regNo: "440090" });
    await seedList({ regNo: "440090", asOnDate: THIS_WEEK, rank: 312, isLatest: true });

    const result = await RankingDigestService.sweep();
    assert.equal(result.queued, 0);
  });

  it("stays silent for a linked player who is not on any current list", async () => {
    const parent = await seedParent("Rahul Seven");
    await seedLinkedChild(parent._id, { name: "Aarav", regNo: "440090" });
    // Ranked once, but no longer on the current list.
    await seedList({ regNo: "440090", asOnDate: LAST_WEEK, rank: 330, isLatest: false });

    const result = await RankingDigestService.sweep();
    assert.equal(result.queued, 0);
  });
});

describe("the sentence a parent reads first", () => {
  const standing = (over: Record<string, unknown> = {}) => ({
    listLabel: "Boys U-14",
    rank: 312,
    previousRank: 330,
    totalPoints: 148,
    asOnDate: THIS_WEEK,
    projection: null,
    ...over,
  });

  it("says the direction in words", () => {
    const { body } = digestSummary({
      asOnDate: THIS_WEEK,
      players: [{ name: "Aarav", regNo: "440090", sportSlug: "tennis", standings: [standing()] }],
    });
    assert.equal(body, "Aarav moved up 18 places to 312 on the Boys U-14 list.");
  });

  it("does not claim movement for a player new to the list", () => {
    const { body } = digestSummary({
      asOnDate: THIS_WEEK,
      players: [
        {
          name: "Aarav",
          regNo: "440090",
          sportSlug: "tennis",
          standings: [standing({ previousRank: null })],
        },
      ],
    });
    assert.match(body, /is now ranked 312/);
    assert.ok(!/moved/.test(body));
  });

  it("says 'still' rather than inventing a move of zero places", () => {
    const { body } = digestSummary({
      asOnDate: THIS_WEEK,
      players: [
        {
          name: "Aarav",
          regNo: "440090",
          sportSlug: "tennis",
          standings: [standing({ previousRank: 312 })],
        },
      ],
    });
    assert.match(body, /is still ranked 312/);
  });
});
