/* eslint-disable @typescript-eslint/no-var-requires */
// HTTP-level tests for the projection now attached to /api/rankings/players/:regNo.
//
// The maths is covered as pure arithmetic in rankingProjection.test.ts. What can
// only be tested here is the wiring: that the endpoint feeds the projector the
// right series — one combo at a time, with a corrected re-upload resolved to its
// live version — and that adding a forward-looking block did not put a date of
// birth on the wire.
process.env.JWT_SECRET = "test-secret-test-secret-test-secret-1234567890";
process.env.PHONEPE_CLIENT_ID = "test-client";
process.env.PHONEPE_CLIENT_SECRET = "test-secret";
process.env.PHONEPE_CLIENT_VERSION = "1";
process.env.PHONEPE_ENV = "SANDBOX";
process.env.REDIS_ENABLED = "false";

import assert = require("node:assert/strict");
const { after, before, beforeEach, describe, it } = require("node:test");
const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");
const request = require("supertest");

const { app } = require("../app");
const { RankingEntry } = require("../shared/models/RankingEntry");
const { RankingSnapshot } = require("../shared/models/RankingSnapshot");
const redis = require("../config/redis").default;

let mongod: { getUri(): string; stop(): Promise<void> };

const MS_PER_WEEK = 7 * 24 * 60 * 60 * 1000;
const LATEST = new Date(Date.UTC(2026, 8, 7));
const weeksBefore = (weeks: number) => new Date(LATEST.getTime() - weeks * MS_PER_WEEK);

const REG_NO = "440090";
/** A real date, on a row the API must never echo. */
const DOB = new Date(Date.UTC(2012, 4, 17));

const seedWeek = async (options: {
  asOnDate: Date;
  rank: number;
  totalPoints: number;
  isLatest?: boolean;
  version?: number;
  status?: string;
  subcategory?: string;
  benchmarks?: Array<{ rank: number; points: number }>;
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
    contentHash: `hash-${subcategory}-${options.asOnDate.getTime()}-${options.version ?? 1}`,
    status: options.status ?? "published",
    version: options.version ?? 1,
    isLatestForCombo: Boolean(options.isLatest),
    rowCount: 1200,
    ...(options.benchmarks ? { benchmarks: options.benchmarks } : {}),
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
    regNo: REG_NO,
    givenName: "Aarav",
    familyName: "Khandelwal",
    fullName: "Aarav Khandelwal",
    nameSearch: "aarav khandelwal",
    dob: DOB,
    birthYear: DOB.getUTCFullYear(),
    state: "Maharashtra",
    stateCode: "MH",
    totalPoints: options.totalPoints,
  });
};

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
  await Promise.all([RankingEntry.deleteMany({}), RankingSnapshot.deleteMany({})]);
});

describe("the projection attached to a player's standing", () => {
  it("measures movement over the series and names what the next tier costs", async () => {
    await seedWeek({ asOnDate: weeksBefore(12), rank: 420, totalPoints: 90 });
    await seedWeek({ asOnDate: weeksBefore(4), rank: 360, totalPoints: 120 });
    await seedWeek({
      asOnDate: LATEST,
      rank: 312,
      totalPoints: 148,
      isLatest: true,
      benchmarks: [
        { rank: 100, points: 300 },
        { rank: 250, points: 160 },
      ],
    });

    const response = await request(app).get(`/api/rankings/players/${REG_NO}`).expect(200);
    const projection = response.body.data.current[0].projection;

    assert.ok(projection, "the standing should carry a projection");
    assert.equal(projection.window.listsHeld, 3);
    assert.equal(projection.movement.fourWeeks.points, 28);
    assert.equal(projection.movement.twelveWeeks.points, 58);
    assert.equal(projection.movement.twelveWeeks.rank, 108);
    // Twelve weeks of history cannot speak for a year, and must not pretend to.
    assert.equal(projection.movement.fiftyTwoWeeks, null);
    assert.equal(projection.atRisk, null);
    assert.equal(projection.toNextTier.rank, 250);
    assert.equal(projection.toNextTier.gap, 12);
  });

  it("uses the corrected list, not the one it replaced", async () => {
    await seedWeek({ asOnDate: weeksBefore(4), rank: 420, totalPoints: 90 });
    // The first publication of this week, later superseded.
    await seedWeek({ asOnDate: LATEST, rank: 400, totalPoints: 95, version: 1 });
    // The correction: same date, higher version, and the live row.
    await seedWeek({
      asOnDate: LATEST,
      rank: 312,
      totalPoints: 148,
      version: 2,
      isLatest: true,
    });

    const response = await request(app).get(`/api/rankings/players/${REG_NO}`).expect(200);
    const projection = response.body.data.current[0].projection;

    // Three rows, two real weeks. Counting the correction as its own week would
    // invent a 53-point gain between a list and its own re-issue.
    assert.equal(projection.window.listsHeld, 2);
    assert.equal(projection.movement.fourWeeks.points, 58);
  });

  it("keeps each list's series to itself", async () => {
    // The same player in their own age group and the one above. Points in the
    // two lists are unrelated, and mixing them would produce deltas that never
    // happened.
    await seedWeek({ asOnDate: weeksBefore(4), rank: 420, totalPoints: 90 });
    await seedWeek({ asOnDate: LATEST, rank: 312, totalPoints: 148, isLatest: true });
    await seedWeek({
      asOnDate: weeksBefore(4),
      rank: 900,
      totalPoints: 20,
      subcategory: "U-16",
    });
    await seedWeek({
      asOnDate: LATEST,
      rank: 880,
      totalPoints: 25,
      subcategory: "U-16",
      isLatest: true,
    });

    const response = await request(app).get(`/api/rankings/players/${REG_NO}`).expect(200);
    const byList = Object.fromEntries(
      response.body.data.current.map((entry: { subcategory: string; projection: unknown }) => [
        entry.subcategory,
        entry.projection,
      ])
    );

    assert.equal(byList["U-14"].movement.fourWeeks.points, 58);
    assert.equal(byList["U-16"].movement.fourWeeks.points, 5);
  });

  it("returns no projection from a single published list", async () => {
    await seedWeek({ asOnDate: LATEST, rank: 312, totalPoints: 148, isLatest: true });

    const response = await request(app).get(`/api/rankings/players/${REG_NO}`).expect(200);
    // Null rather than a zeroed object: one list is a standing, not a trend, and
    // a block of zeroes would render as "no movement" instead of "no history".
    assert.equal(response.body.data.current[0].projection, null);
  });

  it("still returns no date of birth", async () => {
    await seedWeek({ asOnDate: weeksBefore(4), rank: 420, totalPoints: 90 });
    await seedWeek({ asOnDate: LATEST, rank: 312, totalPoints: 148, isLatest: true });

    const response = await request(app).get(`/api/rankings/players/${REG_NO}`).expect(200);
    const body = JSON.stringify(response.body);

    assert.ok(!/"dob"/.test(body));
    assert.ok(!body.includes("2012-05-17"));
    assert.equal(response.body.data.player.birthYear, 2012);
  });
});
