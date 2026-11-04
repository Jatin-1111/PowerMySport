// Migration 51: retention and index cleanup for `analyticsevents`.
//
// The legacy shape seeded here is what production has (probed 2026-10-04). The
// main claim is behavioural and is checked against a REAL TTL monitor, not by
// reading the index definition: after the migration, old guest events are
// deleted, while old non-guest events (which the unsupported-sports view reads up
// to 365 days back) and recent guest events survive. Runs on an in-memory MongoDB
// with autoIndex off and the TTL monitor sped up to one second.
process.env.JWT_SECRET = "test-secret-test-secret-test-secret-1234567890";
process.env.REDIS_ENABLED = "false";

import assert = require("node:assert/strict");
const { after, before, beforeEach, describe, it, mock } = require("node:test");
const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");

// Before any model is required, or the model's own indexes are created as soon
// as the connection opens and the legacy state is lost.
mongoose.set("autoIndex", false);
mongoose.set("autoCreate", false);

const { up, down } = require("../migrations/51_analytics_event_retention_and_indexes");
const {
  GUEST_EVENT_TTL_INDEX,
  REDUNDANT_ANALYTICS_INDEXES,
} = require("../admin/models/analyticsEventIndexes");
const { AnalyticsEvent } = require("../admin/models/AnalyticsEvent");

const DAY = 24 * 60 * 60 * 1000;

let mongod: { getUri(): string; stop(): Promise<void> };
const events = () => mongoose.connection.db.collection("analyticsevents");
const db = () => mongoose.connection.db;
const names = async () => (await events().indexes()).map((i: { name: string }) => i.name).sort();

before(async () => {
  mongod = await MongoMemoryServer.create({
    instance: { args: ["--setParameter", "ttlMonitorSleepSecs=1"] },
  });
  await mongoose.connect(mongod.getUri(), { autoIndex: false, autoCreate: false });
});

after(async () => {
  await mongoose.disconnect();
  await mongod.stop();
});

/** The indexes production has today. */
const seedLegacy = async () => {
  await events().createIndex({ userId: 1 });
  await events().createIndex({ eventName: 1 });
  await events().createIndex({ source: 1 });
  await events().createIndex({ guestId: 1 });
  await events().createIndex({ eventName: 1, createdAt: -1 });
  await events().createIndex({ userId: 1, createdAt: -1 });
  await events().createIndex({ createdAt: -1 });
  await events().createIndex({ guestId: 1, createdAt: -1 });
};

beforeEach(async () => {
  await events()
    .drop()
    .catch(() => undefined);
  await mongoose.connection.db.createCollection("analyticsevents");
});

const ago = (days: number) => new Date(Date.now() - days * DAY);
const doc = (extra: Record<string, unknown>) => ({
  eventName: "page_view",
  source: "WEB",
  metadata: {},
  ...extra,
});

/** Old and recent, guest and not. */
const seedEvents = () =>
  events().insertMany([
    doc({ guestId: "g-old-1", createdAt: ago(200) }),
    doc({ guestId: "g-old-2", createdAt: ago(100) }),
    doc({ guestId: "g-new-1", createdAt: ago(10) }),
    doc({ guestId: "g-new-2", createdAt: ago(1) }),
    // Not guest events: no guestId. The unsupported-sports view reads 365 days.
    doc({
      eventName: "unsupported_sport_search",
      createdAt: ago(300),
      metadata: { sport: "padel" },
    }),
    doc({ eventName: "funnel_step", userId: new mongoose.Types.ObjectId(), createdAt: ago(150) }),
  ]);

const waitFor = async (check: () => Promise<boolean>, ms = 15000) => {
  const deadline = Date.now() + ms;
  while (Date.now() < deadline) {
    if (await check()) return true;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  return false;
};

describe("migration 51", () => {
  it("dry run changes nothing, and says how many events the TTL would delete", async () => {
    await seedLegacy();
    await seedEvents();
    const snapshot = await events().indexes();
    const lines: string[] = [];
    const log = mock.method(console, "log", (...args: unknown[]) => lines.push(args.join(" ")));

    try {
      await up({}, db());
    } finally {
      log.mock.restore();
    }

    assert.deepEqual(await events().indexes(), snapshot);
    assert.equal(await events().countDocuments(), 6, "no events deleted by a dry run");
    const report = lines.join("\n");
    assert.match(report, /6 total, 4 guest, 2 not guest/);
    assert.match(report, /2 guest event\(s\) are older than 90 days/);
    assert.match(report, /\[would create\] guest_events_ttl/);
  });

  it("creates the TTL index and drops only the redundant single-field indexes", async () => {
    await seedLegacy();

    await up({ apply: true }, db());

    const live = await events().indexes();
    const ttl = live.find((i: { name: string }) => i.name === GUEST_EVENT_TTL_INDEX.name);
    assert.ok(ttl, "TTL index exists");
    assert.equal(ttl.expireAfterSeconds, 90 * 24 * 60 * 60);
    assert.deepEqual(ttl.partialFilterExpression, GUEST_EVENT_TTL_INDEX.partialFilterExpression);
    for (const redundant of REDUNDANT_ANALYTICS_INDEXES) {
      assert.ok(
        !live.some((i: { name: string }) => i.name === redundant.name),
        `${redundant.name} dropped`
      );
    }
    for (const kept of [
      "eventName_1_createdAt_-1",
      "userId_1_createdAt_-1",
      "createdAt_-1",
      "guestId_1_createdAt_-1",
    ]) {
      assert.ok(
        live.some((i: { name: string }) => i.name === kept),
        `${kept} kept`
      );
    }
  });

  it("expires old guest events and nothing else", async () => {
    await seedLegacy();
    await seedEvents();

    await up({ apply: true }, db());

    const gone = await waitFor(
      async () =>
        (await events().countDocuments({ guestId: { $in: ["g-old-1", "g-old-2"] } })) === 0
    );
    assert.ok(gone, "old guest events were deleted by the TTL monitor");
    assert.equal(
      await events().countDocuments({ guestId: { $in: ["g-new-1", "g-new-2"] } }),
      2,
      "recent guest events survive"
    );
    assert.equal(
      await events().countDocuments({ eventName: "unsupported_sport_search" }),
      1,
      "a 300-day-old non-guest event survives"
    );
    assert.equal(await events().countDocuments({ eventName: "funnel_step" }), 1);
  });

  it("is idempotent", async () => {
    await seedLegacy();
    await up({ apply: true }, db());
    const first = await events().indexes();

    await up({ apply: true }, db());

    assert.deepEqual(await events().indexes(), first);
  });

  it("frees the redundant indexes even when the TTL index cannot be built for lack of space", async () => {
    // The 2026-10-05 run hit Atlas's quota wall on createIndex. The drops need no
    // write budget and give space back, so they must already have happened.
    await seedLegacy();
    const realDb = db();
    const noRoomDb = new Proxy(realDb, {
      get(target, prop) {
        if (prop === "collection") {
          return (name: string) => {
            const collection = target.collection(name);
            return new Proxy(collection, {
              get(inner, innerProp) {
                if (innerProp === "createIndex") {
                  return async () => {
                    throw new Error("you are over your space quota, using 512 MB of 512 MB");
                  };
                }
                const value = (inner as unknown as Record<string | symbol, unknown>)[innerProp];
                return typeof value === "function" ? value.bind(inner) : value;
              },
            });
          };
        }
        const value = (target as unknown as Record<string | symbol, unknown>)[prop];
        return typeof value === "function" ? value.bind(target) : value;
      },
    });

    await assert.rejects(() => up({ apply: true }, noRoomDb), /space quota/);

    const live = await names();
    for (const redundant of REDUNDANT_ANALYTICS_INDEXES) {
      assert.ok(!live.includes(redundant.name), `${redundant.name} was dropped before the failure`);
    }
    assert.ok(!live.includes(GUEST_EVENT_TTL_INDEX.name), "the TTL index is not there yet");
    assert.ok(live.includes("guestId_1_createdAt_-1"), "the compound indexes are untouched");
  });

  it("never drops a single-field index whose covering compound is missing", async () => {
    await seedLegacy();
    await events().dropIndex("userId_1_createdAt_-1");

    await up({ apply: true }, db());

    const live = await names();
    assert.ok(live.includes("userId_1"), "userId_1 stays, since nothing else serves userId");
    assert.ok(!live.includes("eventName_1"), "the others still go");
  });

  it("down removes the TTL index and restores the single-field indexes", async () => {
    await seedLegacy();
    const legacy = await names();
    await up({ apply: true }, db());

    await down({ apply: true }, db());

    assert.deepEqual(await names(), legacy);
  });
});

describe("AnalyticsEvent model", () => {
  const declared = () =>
    AnalyticsEvent.schema.indexes() as Array<[Record<string, number>, Record<string, unknown>]>;

  it("declares the TTL index exactly as the migration creates it", () => {
    const match = declared().find(([, options]) => options.name === GUEST_EVENT_TTL_INDEX.name);
    assert.ok(match, "declared on the model");
    assert.deepEqual(match[0], GUEST_EVENT_TTL_INDEX.key);
    assert.equal(match[1].expireAfterSeconds, GUEST_EVENT_TTL_INDEX.expireAfterSeconds);
    assert.deepEqual(
      match[1].partialFilterExpression,
      GUEST_EVENT_TTL_INDEX.partialFilterExpression
    );
  });

  it("no longer declares the single-field indexes the migration drops", () => {
    for (const redundant of REDUNDANT_ANALYTICS_INDEXES) {
      const found = declared().find(
        ([key]) => JSON.stringify(key) === JSON.stringify(redundant.key)
      );
      assert.equal(found, undefined, `${redundant.name} is not declared`);
    }
  });
});
