// HTTP-level tests for GET /api/federations/:slug/editions.
//
// What is being pinned is an attribution rule, not a query: a federation page
// may only show events that federation itself sanctions. This endpoint used to
// filter on sport alone, so all four tennis federation pages served the same
// list — and since AITA's is the only tennis calendar anyone has sourced, UTR's
// page presented AITA ranking events as UTR's own, one section below its own
// key fact that UTR results earn no AITA ranking. That is the regression these
// tests exist to catch.
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
const redis = require("../config/redis").default;

let mongod: { getUri(): string; stop(): Promise<void> };

const daysFromNow = (n: number): Date => {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() + n);
  return d;
};

const seedFederation = (slug: string, acronym: string) =>
  Federation.create({
    slug,
    name: `${acronym} full name`,
    acronym,
    sportSlug: "tennis",
    type: "national",
    about: "Seeded for tests.",
    isActive: true,
  });

const seedEdition = (options: {
  name: string;
  federationSlug?: string;
  startDate?: Date;
  status?: string;
}) =>
  TournamentEdition.create({
    sportSlug: "tennis",
    name: options.name,
    editionYear: (options.startDate ?? daysFromNow(10)).getUTCFullYear(),
    startDate: options.startDate ?? daysFromNow(10),
    sourceUrl: "https://example.test/calendar",
    ...(options.federationSlug ? { federationSlug: options.federationSlug } : {}),
    ...(options.status ? { status: options.status } : {}),
  });

const getEditions = async (slug: string) => {
  const res = await request(app).get(`/api/federations/${slug}/editions`);
  assert.equal(res.status, 200);
  return res.body.data.editions as Array<{ name: string; federationSlug?: string }>;
};

before(async () => {
  // 60s, not the 10s default: mongod takes ~20s to come up on a Windows dev
  // box with live AV scanning, and a start timeout reads exactly like a failing
  // assertion in the runner's output.
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
  await seedFederation("aita", "AITA");
  await seedFederation("utr", "UTR");
});

describe("GET /api/federations/:slug/editions", () => {
  it("returns only the editions this federation sanctions", async () => {
    await seedEdition({ name: "AITA CS7 (Sonipat)", federationSlug: "aita" });
    await seedEdition({ name: "UTR Pro Series (Pune)", federationSlug: "utr" });

    const aita = await getEditions("aita");
    assert.deepEqual(
      aita.map((e) => e.name),
      ["AITA CS7 (Sonipat)"]
    );
  });

  it("shows nothing on a federation whose calendar has not been sourced", async () => {
    // The whole tennis calendar belongs to AITA, which is the real situation.
    await seedEdition({ name: "AITA CS7 (Sonipat)", federationSlug: "aita" });
    await seedEdition({ name: "AITA NS (Belagavi)", federationSlug: "aita" });

    assert.deepEqual(await getEditions("utr"), []);
  });

  it("does not fall back to the sport when a federation has no editions", async () => {
    // An edition with no owner at all — a pre-attribution row, or one whose
    // source was submitted before the federation picker existed. It must not
    // leak onto a page by default.
    await seedEdition({ name: "Unattributed Open (Delhi)" });

    assert.deepEqual(await getEditions("utr"), []);
    assert.deepEqual(await getEditions("aita"), []);
  });

  it("still excludes past and cancelled editions of its own federation", async () => {
    await seedEdition({
      name: "AITA CS7 (Last month)",
      federationSlug: "aita",
      startDate: daysFromNow(-30),
    });
    await seedEdition({
      name: "AITA CS7 (Called off)",
      federationSlug: "aita",
      status: "cancelled",
    });
    await seedEdition({ name: "AITA CS7 (Upcoming)", federationSlug: "aita" });

    assert.deepEqual(
      (await getEditions("aita")).map((e) => e.name),
      ["AITA CS7 (Upcoming)"]
    );
  });
});
