// Migration 50: the `reviews` unique indexes.
//
// The legacy shape seeded here is what production actually has (probed
// 2026-10-04). The first test proves the premise, that the legacy indexes block
// reviews that should be allowed, so the later tests are not passing against a
// problem that never existed. Everything runs on an in-memory MongoDB with
// autoIndex off, so no index is created except by the migration under test.
process.env.JWT_SECRET = "test-secret-test-secret-test-secret-1234567890";
process.env.REDIS_ENABLED = "false";

import assert = require("node:assert/strict");
const { after, before, beforeEach, describe, it } = require("node:test");
const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");

// Must be set before any model is required, or the Review model's own indexes
// are created as soon as the connection opens and the legacy state is lost.
mongoose.set("autoIndex", false);
mongoose.set("autoCreate", false);

const { up, down } = require("../migrations/50_fix_review_unique_indexes");
const { REVIEW_UNIQUE_INDEXES } = require("../client/models/reviewIndexes");
const { Review } = require("../client/models/Review");

const oid = () => new mongoose.Types.ObjectId();

let mongod: { getUri(): string; stop(): Promise<void> };
const reviews = () => mongoose.connection.db.collection("reviews");
const db = () => mongoose.connection.db;

before(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri(), { autoIndex: false, autoCreate: false });
});

after(async () => {
  await mongoose.disconnect();
  await mongod.stop();
});

/** The three indexes production has today. */
const seedLegacy = async () => {
  await reviews().createIndex({ bookingId: 1, targetType: 1 }, { unique: true });
  await reviews().createIndex({ bookingId: 1, targetType: 1, userId: 1 }, { unique: true });
  await reviews().createIndex(
    { orderId: 1, targetType: 1, targetId: 1, userId: 1 },
    { unique: true, sparse: true }
  );
};

beforeEach(async () => {
  await reviews()
    .drop()
    .catch(() => undefined);
  await mongoose.connection.db.createCollection("reviews");
});

const insert = (doc: Record<string, unknown>) => reviews().insertOne({ rating: 5, ...doc });
const names = async () => (await reviews().indexes()).map((i: { name: string }) => i.name).sort();

const rejects = async (doc: Record<string, unknown>) => {
  try {
    await insert(doc);
  } catch (error) {
    assert.equal((error as { code?: number }).code, 11000);
    return true;
  }
  return false;
};

describe("legacy review indexes (premise)", () => {
  it("block a second product review and a repeat venue review", async () => {
    await seedLegacy();
    const [u1, u2, p1, p2, v1, b1, b2] = Array.from({ length: 7 }, oid);

    await insert({ userId: u1, targetType: "PRODUCT", targetId: p1 });
    assert.ok(await rejects({ userId: u2, targetType: "PRODUCT", targetId: p1 }), "other user");
    assert.ok(await rejects({ userId: u1, targetType: "PRODUCT", targetId: p2 }), "other product");

    await insert({ userId: u1, targetType: "VENUE", targetId: v1, bookingId: b1 });
    assert.ok(
      await rejects({ userId: u1, targetType: "VENUE", targetId: v1, bookingId: b2 }),
      "same venue on a second booking"
    );
  });
});

describe("migration 50", () => {
  it("dry run changes nothing", async () => {
    await seedLegacy();
    const snapshot = await reviews().indexes();

    await up({}, db());

    assert.deepEqual(await reviews().indexes(), snapshot);
  });

  it("leaves exactly the intended indexes, and keeps existing reviews", async () => {
    await seedLegacy();
    const kept = oid();
    await insert({
      _id: kept,
      userId: oid(),
      targetType: "VENUE",
      targetId: oid(),
      bookingId: oid(),
    });

    await up({ apply: true }, db());

    const live = await reviews().indexes();
    assert.ok(!live.some((i: { name: string }) => i.name === "bookingId_1_targetType_1"));
    for (const want of REVIEW_UNIQUE_INDEXES) {
      const found = live.find((i: { name: string }) => i.name === want.name);
      assert.ok(found, `${want.name} exists`);
      assert.equal(found.unique, true);
      assert.ok(!found.sparse, `${want.name} is partial, not sparse`);
      assert.deepEqual(found.partialFilterExpression, want.partialFilterExpression);
    }
    assert.ok(await reviews().findOne({ _id: kept }), "existing review survives");
  });

  it("allows the reviews the legacy indexes blocked, and still refuses real duplicates", async () => {
    await seedLegacy();
    await up({ apply: true }, db());
    const [u1, u2, p1, p2, v1, b1, b2, o1] = Array.from({ length: 8 }, oid);

    // Product reviews: many users, many products.
    await insert({ userId: u1, targetType: "PRODUCT", targetId: p1 });
    await insert({ userId: u2, targetType: "PRODUCT", targetId: p1 });
    await insert({ userId: u1, targetType: "PRODUCT", targetId: p2 });
    assert.ok(
      await rejects({ userId: u1, targetType: "PRODUCT", targetId: p1 }),
      "same product twice"
    );

    // Venue reviews: the same user, the same venue, a different booking.
    await insert({ userId: u1, targetType: "VENUE", targetId: v1, bookingId: b1 });
    await insert({ userId: u1, targetType: "VENUE", targetId: v1, bookingId: b2 });
    assert.ok(
      await rejects({ userId: u1, targetType: "VENUE", targetId: v1, bookingId: b1 }),
      "same booking, same target, same user"
    );
    // A venue and a coach on one booking, and another participant's own review.
    await insert({ userId: u1, targetType: "Coach", targetId: oid(), bookingId: b1 });
    await insert({ userId: u2, targetType: "VENUE", targetId: v1, bookingId: b1 });

    // Order-scoped reviews stay unique per order and target. ACADEMY is used so
    // the product-per-user index is not the one doing the refusing.
    const academy = oid();
    await insert({ userId: u1, targetType: "ACADEMY", targetId: academy, orderId: o1 });
    assert.ok(
      await rejects({ userId: u1, targetType: "ACADEMY", targetId: academy, orderId: o1 }),
      "same order, target and user"
    );
    await insert({ userId: u1, targetType: "ACADEMY", targetId: academy, orderId: oid() });
  });

  it("is idempotent", async () => {
    await seedLegacy();
    await up({ apply: true }, db());
    const first = await reviews().indexes();

    await up({ apply: true }, db());

    assert.deepEqual(await reviews().indexes(), first);
  });

  it("is blocked by existing duplicates and changes nothing", async () => {
    // Only the stale index present, so duplicates of the new product rule can exist.
    await reviews().createIndex({ bookingId: 1, targetType: 1 }, { unique: true });
    const [u1, p1] = [oid(), oid()];
    await reviews().insertMany([
      { rating: 5, userId: u1, targetType: "PRODUCT", targetId: p1, bookingId: oid() },
      { rating: 4, userId: u1, targetType: "PRODUCT", targetId: p1, bookingId: oid() },
    ]);
    const snapshot = await names();

    await assert.rejects(() => up({ apply: true }, db()), /duplicates present/);

    assert.deepEqual(await names(), snapshot);
  });

  it("down restores the legacy shape", async () => {
    await seedLegacy();
    const legacy = await reviews().indexes();
    await up({ apply: true }, db());

    await down({ apply: true }, db());

    const restored = await reviews().indexes();
    const shape = (list: Array<Record<string, unknown>>) =>
      list
        .map((i) => ({
          name: i.name,
          key: i.key,
          unique: Boolean(i.unique),
          sparse: Boolean(i.sparse),
          partial: i.partialFilterExpression,
        }))
        .sort((a, b) => String(a.name).localeCompare(String(b.name)));
    assert.deepEqual(shape(restored), shape(legacy));
  });
});

describe("Review model", () => {
  it("declares exactly the indexes the migration creates", () => {
    const declared = Review.schema.indexes() as Array<
      [Record<string, number>, Record<string, unknown>]
    >;
    for (const want of REVIEW_UNIQUE_INDEXES) {
      const match = declared.find(([, options]) => options.name === want.name);
      assert.ok(match, `${want.name} is declared on the model`);
      assert.deepEqual(match[0], want.key);
      assert.equal(match[1].unique, true);
      assert.equal(match[1].sparse, undefined);
      assert.deepEqual(match[1].partialFilterExpression, want.partialFilterExpression);
    }
  });
});
