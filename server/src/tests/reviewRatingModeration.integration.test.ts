/* eslint-disable @typescript-eslint/no-var-requires */
// A coach's or venue's headline rating must be made of the reviews the public can
// see. Hiding or removing a review used to change the list but not the rating,
// so a removed abusive one-star review kept dragging the provider down, and the
// star count and the visible reviews disagreed. Expert reviews already did this
// correctly; these tests pin the same behaviour for venues and coaches.
process.env.JWT_SECRET = "test-secret-test-secret-test-secret-1234567890";
process.env.REDIS_ENABLED = "false";

import assert = require("node:assert/strict");
const { after, before, beforeEach, describe, it } = require("node:test");
const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");

const {
  moderateReview,
  recomputeCoachRating,
  recomputeVenueRating,
} = require("../client/services/ReviewService");
const { Review } = require("../client/models/Review");
const { Coach } = require("../client/models/Coach");
const { Venue } = require("../client/models/Venue");
const redis = require("../config/redis").default;

const oid = () => new mongoose.Types.ObjectId();

let mongod: any;

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
  await Review.collection.deleteMany({});
  await Coach.collection.deleteMany({});
  await Venue.collection.deleteMany({});
});

const seedProvider = async (model: any) => {
  const id = oid();
  // `userId` is unique on coaches, so each provider needs its own.
  await model.collection.insertOne({
    _id: id,
    userId: oid(),
    ownerId: oid(),
    rating: 0,
    reviewCount: 0,
  });
  return id;
};

const seedReview = async (
  targetType: "VENUE" | "Coach",
  targetId: any,
  rating: number,
  overrides: Record<string, unknown> = {}
) => {
  const id = oid();
  await Review.collection.insertOne({
    _id: id,
    bookingId: oid(),
    userId: oid(),
    targetType,
    targetId,
    rating,
    isHidden: false,
    moderationStatus: "APPROVED",
    helpfulCount: 0,
    reportCount: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  });
  return id.toString();
};

const providerOf = (model: any, id: any) => model.collection.findOne({ _id: id });

describe("coach rating", () => {
  it("averages only the reviews the public can see", async () => {
    const coachId = await seedProvider(Coach);
    await seedReview("Coach", coachId, 5);
    await seedReview("Coach", coachId, 5);
    await seedReview("Coach", coachId, 1, { isHidden: true });
    await seedReview("Coach", coachId, 1, { isHidden: true, moderationStatus: "REMOVED" });
    await recomputeCoachRating(String(coachId));
    const coach = await providerOf(Coach, coachId);
    assert.equal(coach.rating, 5);
    assert.equal(coach.reviewCount, 2);
  });

  it("drops a one-star review from the rating when an admin removes it", async () => {
    const coachId = await seedProvider(Coach);
    await seedReview("Coach", coachId, 5);
    const bad = await seedReview("Coach", coachId, 1);
    await recomputeCoachRating(String(coachId));
    assert.equal((await providerOf(Coach, coachId)).rating, 3);

    await moderateReview(bad, "REMOVE", "abusive");

    const coach = await providerOf(Coach, coachId);
    assert.equal(coach.rating, 5);
    assert.equal(coach.reviewCount, 1);
  });

  it("drops a hidden review, and brings it back when it is approved again", async () => {
    const coachId = await seedProvider(Coach);
    await seedReview("Coach", coachId, 5);
    const review = await seedReview("Coach", coachId, 1);
    await recomputeCoachRating(String(coachId));

    await moderateReview(review, "HIDE");
    assert.equal((await providerOf(Coach, coachId)).rating, 5);

    await moderateReview(review, "APPROVE");
    const coach = await providerOf(Coach, coachId);
    assert.equal(coach.rating, 3);
    assert.equal(coach.reviewCount, 2);
  });

  it("goes back to zero when the last review is removed", async () => {
    const coachId = await seedProvider(Coach);
    const only = await seedReview("Coach", coachId, 4);
    await recomputeCoachRating(String(coachId));
    assert.equal((await providerOf(Coach, coachId)).rating, 4);

    await moderateReview(only, "REMOVE");

    const coach = await providerOf(Coach, coachId);
    assert.equal(coach.rating, 0);
    assert.equal(coach.reviewCount, 0);
  });

  it("does not touch another coach's rating", async () => {
    const coachId = await seedProvider(Coach);
    const otherId = await seedProvider(Coach);
    const review = await seedReview("Coach", coachId, 1);
    await seedReview("Coach", otherId, 4);
    await recomputeCoachRating(String(otherId));

    await moderateReview(review, "REMOVE");

    assert.equal((await providerOf(Coach, otherId)).rating, 4);
  });
});

describe("migration 56 (ratings stored before the fix)", () => {
  const { up } = require("../migrations/56_recompute_provider_ratings");

  const seedStale = async () => {
    const coachId = await seedProvider(Coach);
    await seedReview("Coach", coachId, 5);
    await seedReview("Coach", coachId, 1, { isHidden: true, moderationStatus: "REMOVED" });
    // What the old code left behind: the removed review still averaged in.
    await Coach.collection.updateOne({ _id: coachId }, { $set: { rating: 3, reviewCount: 2 } });
    return coachId;
  };

  it("changes nothing on a dry run", async () => {
    const coachId = await seedStale();
    const result = await up({}, mongoose.connection.db);
    assert.deepEqual(result, { checked: 1, changed: 1 });
    assert.equal((await providerOf(Coach, coachId)).rating, 3);
  });

  it("corrects a stale rating when applied, then finds nothing left to do", async () => {
    const coachId = await seedStale();
    await up({ apply: true }, mongoose.connection.db);
    const coach = await providerOf(Coach, coachId);
    assert.equal(coach.rating, 5);
    assert.equal(coach.reviewCount, 1);
    assert.deepEqual(await up({ apply: true }, mongoose.connection.db), { checked: 1, changed: 0 });
  });

  it("leaves a provider with no moderated reviews alone", async () => {
    const coachId = await seedProvider(Coach);
    await seedReview("Coach", coachId, 4);
    await Coach.collection.updateOne({ _id: coachId }, { $set: { rating: 2, reviewCount: 9 } });
    const result = await up({ apply: true }, mongoose.connection.db);
    assert.deepEqual(result, { checked: 0, changed: 0 });
    assert.equal((await providerOf(Coach, coachId)).rating, 2);
  });
});

describe("venue rating", () => {
  it("follows moderation the same way", async () => {
    const venueId = await seedProvider(Venue);
    await seedReview("VENUE", venueId, 4);
    const bad = await seedReview("VENUE", venueId, 2);
    await recomputeVenueRating(String(venueId));
    assert.equal((await providerOf(Venue, venueId)).rating, 3);

    await moderateReview(bad, "REMOVE");

    const venue = await providerOf(Venue, venueId);
    assert.equal(venue.rating, 4);
    assert.equal(venue.reviewCount, 1);
  });
});
