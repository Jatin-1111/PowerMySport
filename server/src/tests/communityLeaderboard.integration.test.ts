/* eslint-disable @typescript-eslint/no-var-requires */
// Integration tests for the community leaderboard. Uses an in-memory MongoDB —
// local dev points at the live cluster, so a test on the default connection
// would be writing to production.
process.env.JWT_SECRET = "test-secret-test-secret-test-secret-1234567890";

import assert = require("node:assert/strict");
const { after, before, beforeEach, describe, it } = require("node:test");
const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");

const {
  CommunityReputation,
} = require("../community/models/CommunityReputation");
const { CommunityProfile } = require("../community/models/CommunityProfile");
const { CommunityService } = require("../community/services/CommunityService");
const { User } = require("../client/models/User");

let memoryServer: { getUri(): string; stop(): Promise<void> };

let userSeq = 0;
const createUser = async (name: string, role = "Parent") => {
  userSeq += 1;
  const user = await User.create({
    name,
    email: `leader-${userSeq}@example.com`,
    phone: `911000${String(userSeq).padStart(4, "0")}`,
    password: "test-password",
    role,
  });
  return String(user._id);
};

const giveReputation = async (
  userId: string,
  totalPoints: number,
  extra: Record<string, number> = {},
) => {
  await CommunityReputation.create({
    userId,
    totalPoints,
    questionCount: extra.questionCount || 0,
    answerCount: extra.answerCount || 0,
    receivedUpvotes: extra.receivedUpvotes || 0,
  });
};

describe("community leaderboard", () => {
  before(async () => {
    memoryServer = await MongoMemoryServer.create();
    await mongoose.connect(memoryServer.getUri());
  });

  after(async () => {
    await mongoose.disconnect();
    await memoryServer.stop();
  });

  beforeEach(async () => {
    await CommunityReputation.deleteMany({});
    await CommunityProfile.deleteMany({});
    await User.deleteMany({});
  });

  it("ranks by total points, highest first", async () => {
    const viewer = await createUser("Viewer");
    const middle = await createUser("Middle");
    const top = await createUser("Top");

    await giveReputation(viewer, 10);
    await giveReputation(middle, 50);
    await giveReputation(top, 90);

    const { items } = await CommunityService.listLeaderboard(viewer, 10);

    assert.deepEqual(
      items.map((item: { name: string; rank: number }) => [
        item.name,
        item.rank,
      ]),
      [
        ["Top", 1],
        ["Middle", 2],
        // Own row carries the real name; the UI adds the "You" pill.
        ["Viewer", 3],
      ],
    );
  });

  it("reports the caller's true rank even when they fall outside the page", async () => {
    const viewer = await createUser("Viewer");
    await giveReputation(viewer, 1);

    for (let index = 0; index < 20; index += 1) {
      const other = await createUser(`Other ${index}`);
      await giveReputation(other, 100 + index);
    }

    const { items, me } = await CommunityService.listLeaderboard(viewer, 5);

    assert.equal(items.length, 5);
    assert.ok(
      !items.some((item: { id: string }) => item.id === viewer),
      "viewer should not be in the top five",
    );
    // 20 people are ahead, so the viewer is 21st — not "6th of the 5 we loaded".
    assert.equal(me.rank, 21);
    assert.equal(me.score, 1);
  });

  it("leaves out members who have never scored", async () => {
    const viewer = await createUser("Viewer");
    const idle = await createUser("Idle");

    await giveReputation(viewer, 5);
    await giveReputation(idle, 0);

    const { items } = await CommunityService.listLeaderboard(viewer, 10);

    assert.equal(items.length, 1);
    assert.equal(items[0].id, viewer);
  });

  it("returns no self row for a caller who has never scored", async () => {
    const viewer = await createUser("Viewer");
    const other = await createUser("Other");
    await giveReputation(other, 30);

    const { items, me } = await CommunityService.listLeaderboard(viewer, 10);

    assert.equal(items.length, 1);
    assert.equal(me, null);
  });

  it("ranks a private member without naming them", async () => {
    const viewer = await createUser("Viewer");
    const shy = await createUser("Real Name");

    await giveReputation(viewer, 10);
    await giveReputation(shy, 80);
    await CommunityProfile.create({
      userId: shy,
      anonymousAlias: "Quiet Falcon",
      isIdentityPublic: false,
    });

    const { items } = await CommunityService.listLeaderboard(viewer, 10);

    const first = items[0];
    assert.equal(first.rank, 1);
    assert.equal(first.score, 80);
    // Ranked, but neither named nor linkable — an empty id means the row does
    // not open a profile.
    assert.equal(first.name, "Quiet Falcon");
    assert.equal(first.id, "");
    assert.equal(first.photoUrl, null);
    assert.equal(first.isIdentityPublic, false);
  });

  it("carries the same counts the reputation card shows", async () => {
    const viewer = await createUser("Viewer");
    await giveReputation(viewer, 42, {
      questionCount: 3,
      answerCount: 2,
      receivedUpvotes: 11,
    });

    const { items } = await CommunityService.listLeaderboard(viewer, 10);
    const reputation = await CommunityService.getMyReputation(viewer);

    // The old page scored posts*2 + answers*3 + upvotes*2 over recent posts, so
    // "Your Points" and your rank came from unrelated numbers.
    assert.equal(items[0].score, reputation.totalPoints);
    assert.equal(items[0].posts, reputation.questionCount);
    assert.equal(items[0].answers, reputation.answerCount);
    assert.equal(items[0].upvotes, reputation.receivedUpvotes);
  });

  it("caps how many rows one request can pull", async () => {
    const viewer = await createUser("Viewer");
    await giveReputation(viewer, 5);
    for (let index = 0; index < 60; index += 1) {
      const other = await createUser(`Bulk ${index}`);
      await giveReputation(other, 100 + index);
    }

    const { items } = await CommunityService.listLeaderboard(viewer, 500);
    assert.equal(items.length, 50);
  });
});
