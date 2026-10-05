// The public guest-analytics ingest: what it stores, and how much of it.
//
// POST /api/stats/guest/event is the one writer anybody on the internet can
// drive, into a collection on a 512 MB cluster. These tests go through the real
// app and check that real tracker events are stored intact, that an oversized
// event is trimmed without costing the rest of its batch, and that the byte
// budget refuses a source that exceeds it, per IP and globally. Redis is off
// here, which also proves the budget holds on its in-process fallback.
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
const { AnalyticsEvent } = require("../admin/models/AnalyticsEvent");
const { configureGuestEventBudget, resetGuestEventBudget } = require("../utils/guestEventBudget");
const redis = require("../config/redis").default;

let mongod: { getUri(): string; stop(): Promise<void> };

before(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
});

after(async () => {
  configureGuestEventBudget();
  await mongoose.disconnect();
  await mongod.stop();
  redis.disconnect();
});

beforeEach(async () => {
  await AnalyticsEvent.collection.deleteMany({});
  resetGuestEventBudget();
  configureGuestEventBudget(); // env defaults: far above anything here
});

const GUEST = "11111111-2222-3333-4444-555555555555";

const send = (events: unknown[], ip = "203.0.113.10", guestId = GUEST) =>
  request(app).post("/api/stats/guest/event").set("X-Forwarded-For", ip).send({ guestId, events });

/** The shapes GuestAnalyticsTracker.tsx really sends. */
const realBatch = () => [
  {
    eventName: "page_view",
    entityType: "PAGE",
    entityId: "/booking",
    metadata: {
      referrer: "https://www.google.com/".padEnd(200, "x"),
      utm: {
        utm_source: "s".repeat(100),
        utm_medium: "m".repeat(100),
        utm_campaign: "c".repeat(100),
        utm_term: "t".repeat(100),
        utm_content: "n".repeat(100),
      },
      title: "Book a venue, coach or academy".padEnd(120, "y"),
    },
  },
  {
    eventName: "click",
    entityType: "CLICK",
    entityId: "Book now",
    metadata: { path: "/booking", href: "/venues/abc".padEnd(200, "z") },
  },
  {
    eventName: "page_exit",
    entityType: "PAGE",
    entityId: "/booking",
    metadata: { durationMs: 41234, scrollDepthPct: 80 },
  },
];

describe("what the ingest stores", () => {
  it("stores real tracker events intact, even at their largest", async () => {
    const response = await send(realBatch());

    assert.equal(response.status, 201);
    const stored = await AnalyticsEvent.collection.find({}).sort({ _id: 1 }).toArray();
    assert.equal(stored.length, 3);
    assert.equal(stored[0].guestId, GUEST);
    assert.equal(stored[0].metadata.utm.utm_source.length, 100, "worst-case UTM is not trimmed");
    assert.equal(stored[0].metadata.referrer.length, 200);
    assert.deepEqual(stored[2].metadata, { durationMs: 41234, scrollDepthPct: 80 });
  });

  it("trims one oversized event without losing the others in its batch", async () => {
    const batch = realBatch();
    batch.splice(1, 0, {
      eventName: "page_view",
      entityType: "PAGE",
      entityId: "/x",
      metadata: { blob: "a".repeat(5000) },
    } as never);

    const response = await send(batch);

    assert.equal(response.status, 201);
    const stored = await AnalyticsEvent.collection.find({}).sort({ _id: 1 }).toArray();
    assert.equal(stored.length, 4, "all four events kept");
    assert.deepEqual(stored[1].metadata, { truncated: true });
    assert.equal(stored[0].metadata.utm.utm_source.length, 100, "its neighbours are untouched");
  });

  it("keeps at most 20 metadata keys", async () => {
    const metadata = Object.fromEntries(Array.from({ length: 40 }, (_, i) => [`k${i}`, i]));

    await send([{ eventName: "click", metadata }]);

    const [stored] = await AnalyticsEvent.collection.find({}).toArray();
    assert.equal(Object.keys(stored.metadata).length, 20);
  });

  it("still rejects a malformed batch before storing or charging anything", async () => {
    configureGuestEventBudget({ perIpHourBytes: 4000 });

    for (let i = 0; i < 10; i++) {
      const response = await request(app)
        .post("/api/stats/guest/event")
        .set("X-Forwarded-For", "203.0.113.20")
        .send({ guestId: "short", events: [] });
      assert.equal(response.status, 400);
    }

    // Ten rejected requests spent none of the budget.
    const ok = await send(realBatch(), "203.0.113.20");
    assert.equal(ok.status, 201);
    assert.equal(await AnalyticsEvent.countDocuments(), 3);
  });
});

describe("the byte budget", () => {
  it("refuses a source that exceeds its hourly budget, and stores nothing more", async () => {
    // One real batch is roughly 1.2 KB, so this admits a few and then refuses.
    configureGuestEventBudget({ perIpHourBytes: 4000 });

    const statuses: number[] = [];
    for (let i = 0; i < 10; i++) statuses.push((await send(realBatch())).status);

    const accepted = statuses.filter((s) => s === 201).length;
    assert.ok(accepted >= 1 && accepted < 10, `some accepted, not all: ${statuses.join(",")}`);
    assert.ok(statuses.includes(429), "later requests are refused");
    assert.equal(
      await AnalyticsEvent.countDocuments(),
      accepted * 3,
      "refused batches store nothing"
    );
  });

  it("tells a refused client when to come back", async () => {
    configureGuestEventBudget({ perIpHourBytes: 10 });

    const response = await send(realBatch());

    assert.equal(response.status, 429);
    assert.ok(Number(response.headers["retry-after"]) >= 1);
  });

  it("charges each IP separately", async () => {
    configureGuestEventBudget({ perIpHourBytes: 4000 });
    for (let i = 0; i < 10; i++) await send(realBatch(), "198.51.100.1");
    const exhausted = await send(realBatch(), "198.51.100.1");
    assert.equal(exhausted.status, 429);

    const other = await send(realBatch(), "198.51.100.2");

    assert.equal(other.status, 201, "a different source is unaffected");
  });

  it("caps the total for the day across every source", async () => {
    configureGuestEventBudget({ globalDayBytes: 4000 });

    const statuses: number[] = [];
    for (let i = 0; i < 12; i++)
      statuses.push((await send(realBatch(), `192.0.2.${i + 1}`)).status);

    assert.ok(statuses.includes(201), "early requests are accepted");
    assert.ok(statuses.includes(429), "a distributed flood is stopped by the global budget");
    const accepted = statuses.filter((s) => s === 201).length;
    assert.equal(await AnalyticsEvent.countDocuments(), accepted * 3);
  });

  it("leaves normal traffic far from the default limits", async () => {
    configureGuestEventBudget(); // env defaults
    for (let i = 0; i < 50; i++) {
      const response = await send(realBatch());
      assert.equal(response.status, 201, `batch ${i}`);
    }
  });
});
