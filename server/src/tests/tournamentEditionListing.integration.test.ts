// HTTP-level tests for the public tournament listing and its filters, plus the
// attribution and merged-duplicate rules the listing depends on.
//
// The filters exist for one reader: a parent narrowing a sport's calendar to
// what their child can play. What is pinned is that each filter's options come
// from the data (so a sport with no series information shows no category
// filter at all, rather than an empty one), that a stale link degrades to the
// full list, and that the same tournament is never listed twice.
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
const { Federation } = require("../shared/models/Federation");
const { TournamentEdition } = require("../shared/models/TournamentEdition");
const { getUpcomingEditions } = require("../shared/services/tournamentEditionQueries");
const redis = require("../config/redis").default;

let mongod: { getUri(): string; stop(): Promise<void> };

/** A day in the first week of the month after next, so month filters are stable. */
const nextMonthDay = (monthsAhead: number, day: number): Date => {
  const d = new Date();
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + monthsAhead, day));
};

const monthKey = (date: Date): string => date.toISOString().slice(0, 7);

let seq = 0;
const seedEdition = (options: {
  name: string;
  sportSlug?: string;
  startDate?: Date;
  ageGroups?: string[];
  ladder?: string;
  grade?: number;
  circuit?: string;
  kind?: string;
  federationSlug?: string;
  mergedInto?: string;
}) => {
  seq += 1;
  const startDate = options.startDate ?? nextMonthDay(1, 5);
  return TournamentEdition.create({
    sportSlug: options.sportSlug ?? "tennis",
    name: options.name,
    slug: `edition-${seq}`,
    editionYear: startDate.getUTCFullYear(),
    startDate,
    sourceUrl: "https://example.test/calendar",
    ageGroups: options.ageGroups ?? [],
    ...(options.ladder ? { ladder: options.ladder } : {}),
    ...(options.grade !== undefined ? { grade: options.grade } : {}),
    ...(options.circuit ? { circuit: options.circuit } : {}),
    ...(options.kind ? { kind: options.kind } : {}),
    ...(options.federationSlug ? { federationSlug: options.federationSlug } : {}),
    ...(options.mergedInto ? { mergedInto: options.mergedInto } : {}),
  });
};

const cs = (name: string, extra: Record<string, unknown> = {}) =>
  seedEdition({
    name,
    ladder: "Championship Series",
    grade: 7,
    circuit: "AITA",
    kind: "junior-ladder",
    ...extra,
  });

const list = async (query: Record<string, string>) => {
  const qs = new URLSearchParams({ sport: "tennis", ...query }).toString();
  const res = await request(app).get(`/api/tournament-editions?${qs}`);
  assert.equal(res.status, 200);
  return res.body.data as {
    editions: Array<{ name: string; categoryLabel: string | null }>;
    total: number;
    facets: {
      categories: Array<{ value: string; label: string; count: number }>;
      ages: Array<{ value: string; count: number }>;
      months: Array<{ value: string; count: number }>;
    };
    applied: Record<string, string>;
  };
};

before(async () => {
  // 60s, not the 10s default: mongod takes ~20s to come up on a Windows dev box.
  mongod = await MongoMemoryServer.create({ instance: { launchTimeout: 60_000 } });
  await mongoose.connect(mongod.getUri());
});

after(async () => {
  await mongoose.disconnect();
  await mongod.stop();
  await redis.quit?.().catch(() => undefined);
});

beforeEach(async () => {
  await Federation.deleteMany({});
  await TournamentEdition.deleteMany({});
});

describe("GET /api/tournament-editions?sport=… filters", () => {
  it("offers categories in ladder order, grouping grades under one rung", async () => {
    await cs("AITA CS7 (Delhi)");
    await cs("AITA CS5 (Pune)", { grade: 5 });
    await seedEdition({
      name: "AITA TS7 (Noida)",
      ladder: "Talent Series",
      grade: 7,
      circuit: "AITA",
      kind: "junior-ladder",
    });
    await seedEdition({ name: "ITF J30 (Delhi)", circuit: "ITF", kind: "international-junior" });

    const { facets, editions } = await list({});
    assert.deepEqual(
      facets.categories.map((c) => [c.label, c.count]),
      [
        ["Talent Series", 1],
        ["Championship Series", 2],
        ["ITF junior event", 1],
      ]
    );
    assert.equal(
      editions.find((e) => e.name === "ITF J30 (Delhi)")?.categoryLabel,
      "ITF junior event"
    );
  });

  it("narrows to one category and says so", async () => {
    await cs("AITA CS7 (Delhi)");
    await seedEdition({ name: "ITF J30 (Delhi)", circuit: "ITF", kind: "international-junior" });

    const result = await list({ category: "championship-series" });
    assert.deepEqual(
      result.editions.map((e) => e.name),
      ["AITA CS7 (Delhi)"]
    );
    assert.equal(result.applied.category, "championship-series");
    // The options still describe the whole window, not the current selection.
    assert.equal(result.facets.categories.length, 2);
  });

  it("filters by age group and sorts the options numerically", async () => {
    await cs("AITA CS7 (Delhi)", { ageGroups: ["Under-14", "Under-12"] });
    await cs("AITA CS7 (Pune)", { ageGroups: ["Under-16"] });
    await seedEdition({ name: "AITA Rs 1 Lakh (Goa)", ageGroups: ["Women", "Men"] });

    const result = await list({ age: "Under-12" });
    assert.deepEqual(
      result.editions.map((e) => e.name),
      ["AITA CS7 (Delhi)"]
    );
    assert.deepEqual(
      result.facets.ages.map((a) => a.value),
      ["Under-12", "Under-14", "Under-16", "Men", "Women"]
    );
  });

  it("filters by month", async () => {
    const soon = nextMonthDay(1, 5);
    const later = nextMonthDay(2, 5);
    await cs("AITA CS7 (Soon)", { startDate: soon });
    await cs("AITA CS7 (Later)", { startDate: later });

    const result = await list({ month: monthKey(later) });
    assert.deepEqual(
      result.editions.map((e) => e.name),
      ["AITA CS7 (Later)"]
    );
    assert.deepEqual(
      result.facets.months.map((m) => m.value),
      [monthKey(soon), monthKey(later)]
    );
  });

  it("ignores a filter value that matches nothing, instead of returning an empty page", async () => {
    await cs("AITA CS7 (Delhi)");

    const result = await list({ category: "no-such-series", age: "Under-99", month: "2026-13" });
    assert.equal(result.total, 1);
    assert.deepEqual(result.applied, {});
  });

  it("shows no category filter for a sport whose calendar carries no series", async () => {
    await seedEdition({ name: "Delhi Open", sportSlug: "chess" });

    const res = await request(app).get("/api/tournament-editions?sport=chess");
    assert.equal(res.status, 200);
    assert.deepEqual(res.body.data.facets.categories, []);
    assert.equal(res.body.data.editions[0].categoryLabel, null);
  });

  it("never lists or counts a merged duplicate", async () => {
    await cs("AITA CS7 (Delhi)");
    await cs("AITA CS7 (Delhi) duplicate", { mergedInto: "edition-1" });

    const result = await list({});
    assert.equal(result.total, 1);
    assert.equal(result.facets.categories[0]?.count, 1);
  });
});

describe("merged duplicates on the other read paths", () => {
  it("are left off a federation's calendar", async () => {
    await Federation.create({
      slug: "aita",
      name: "AITA full name",
      acronym: "AITA",
      sportSlug: "tennis",
      type: "national",
      about: "Seeded for tests.",
      isActive: true,
    });
    await cs("AITA CS7 (Delhi)", { federationSlug: "aita" });
    await cs("AITA CS7 (Delhi) duplicate", { federationSlug: "aita", mergedInto: "edition-1" });

    const res = await request(app).get("/api/federations/aita/editions");
    assert.equal(res.status, 200);
    assert.deepEqual(
      res.body.data.editions.map((e: { name: string }) => e.name),
      ["AITA CS7 (Delhi)"]
    );
  });

  it("are left out of the chat's upcoming list", async () => {
    await cs("AITA CS7 (Delhi)");
    await cs("AITA CS7 (Delhi) duplicate", { mergedInto: "edition-1" });

    const upcoming = await getUpcomingEditions("tennis", 5);
    assert.deepEqual(
      upcoming.map((e: { name: string }) => e.name),
      ["AITA CS7 (Delhi)"]
    );
  });
});

describe("GET /api/tournament-editions/:slug federation", () => {
  it("credits the calendar the edition was read from, not the name's first word", async () => {
    for (const [slug, acronym] of [
      ["aita", "AITA"],
      ["itf", "ITF"],
    ]) {
      await Federation.create({
        slug,
        name: `${acronym} full name`,
        acronym,
        sportSlug: "tennis",
        type: "national",
        about: "Seeded for tests.",
        isActive: true,
      });
    }
    // AITA prints ITF junior events on its own calendar under the ITF name.
    const edition = await seedEdition({
      name: "ITF J30 (Delhi)",
      circuit: "ITF",
      kind: "international-junior",
      federationSlug: "aita",
    });

    const res = await request(app).get(`/api/tournament-editions/${edition.slug}`);
    assert.equal(res.status, 200);
    assert.equal(res.body.data.federation.slug, "aita");
  });
});
