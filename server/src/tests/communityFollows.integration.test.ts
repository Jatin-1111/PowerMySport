/* eslint-disable @typescript-eslint/no-var-requires */
// Integration tests for community follows. Uses an in-memory MongoDB, so
// nothing external — and in particular nothing in the shared dev/prod
// database — is touched. See the note in bookingEvent.integration.test.ts:
// local dev points at the live cluster, so a test that reached for the default
// connection would be writing to production.
//
// Env must be set BEFORE the app modules are required (several read env at
// load time), so we use require() in source order rather than hoisted imports.
process.env.JWT_SECRET = "test-secret-test-secret-test-secret-1234567890";

import assert = require("node:assert/strict");
const { after, before, beforeEach, describe, it } = require("node:test");
const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");

const { CommunityFollow } = require("../community/models/CommunityFollow");
const { CommunityGroup } = require("../community/models/CommunityGroup");
const { CommunityService } = require("../community/services/CommunityService");
const { User } = require("../client/models/User");

let memoryServer: { getUri(): string; stop(): Promise<void> };

let USER_ID = "";

// Follows hang off a community profile, which in turn requires a real user in
// a community-eligible role — so the fixture is a whole user, not a bare id.
let userSeq = 0;
const createUser = async (role = "Parent") => {
  userSeq += 1;
  const user = await User.create({
    name: `Follow Tester ${userSeq}`,
    email: `follow-tester-${userSeq}@example.com`,
    phone: `900000${String(userSeq).padStart(4, "0")}`,
    password: "test-password",
    role,
  });
  return String(user._id);
};

const createGroup = async (name: string) => {
  const group = await CommunityGroup.create({
    name,
    createdBy: new mongoose.Types.ObjectId(),
    inviteCode: Math.random().toString(36).slice(2, 10),
  });
  return String(group._id);
};

describe("community follows", () => {
  before(async () => {
    memoryServer = await MongoMemoryServer.create();
    await mongoose.connect(memoryServer.getUri());
  });

  after(async () => {
    await mongoose.disconnect();
    await memoryServer.stop();
  });

  beforeEach(async () => {
    await CommunityFollow.deleteMany({});
    await CommunityGroup.deleteMany({});
    USER_ID = await createUser();
  });

  it("toggles a topic on and back off", async () => {
    const first = await CommunityService.toggleFollow(USER_ID, {
      kind: "TOPIC",
      targetId: "Tennis",
    });
    assert.equal(first.following, true);

    const stored = await CommunityFollow.find({ userId: USER_ID }).lean();
    assert.equal(stored.length, 1);
    // Normalized on the way in, or `#Tennis` and `#tennis` become two follows.
    assert.equal(stored[0].targetId, "tennis");

    const second = await CommunityService.toggleFollow(USER_ID, {
      kind: "TOPIC",
      targetId: "tennis",
    });
    assert.equal(second.following, false);
    assert.equal(await CommunityFollow.countDocuments({ userId: USER_ID }), 0);
  });

  it("rejects a group id that is not an ObjectId", async () => {
    await assert.rejects(
      () =>
        CommunityService.toggleFollow(USER_ID, {
          kind: "GROUP",
          targetId: "not-an-id",
        }),
      /Invalid group id/
    );
  });

  it("rejects an over-long topic", async () => {
    await assert.rejects(
      () =>
        CommunityService.toggleFollow(USER_ID, {
          kind: "TOPIC",
          targetId: "x".repeat(41),
        }),
      /Invalid topic/
    );
  });

  it("resolves a group's label from the group, not from a stored copy", async () => {
    const groupId = await createGroup("Delhi Tennis Parents");
    await CommunityService.toggleFollow(USER_ID, {
      kind: "GROUP",
      targetId: groupId,
    });

    await CommunityGroup.updateOne({ _id: groupId }, { $set: { name: "Delhi Tennis Families" } });

    const { items } = await CommunityService.listFollows(USER_ID);
    assert.equal(items.length, 1);
    // The old localStorage store cached the name and would still say "Parents".
    assert.equal(items[0].label, "Delhi Tennis Families");
  });

  it("prunes follows whose group has been deleted", async () => {
    const groupId = await createGroup("Doomed Group");
    await CommunityService.toggleFollow(USER_ID, {
      kind: "GROUP",
      targetId: groupId,
    });
    await CommunityService.toggleFollow(USER_ID, {
      kind: "TOPIC",
      targetId: "cricket",
    });

    await CommunityGroup.deleteOne({ _id: groupId });

    const { items } = await CommunityService.listFollows(USER_ID);
    assert.deepEqual(
      items.map((item: { targetId: string }) => item.targetId),
      ["cricket"]
    );
  });

  it("imports legacy follows idempotently", async () => {
    const groupId = await createGroup("Imported Group");
    const payload = [
      { kind: "TOPIC", targetId: "Tennis" },
      { kind: "TOPIC", targetId: "tennis" }, // same follow after normalization
      { kind: "GROUP", targetId: groupId },
      { kind: "GROUP", targetId: "junk" }, // one bad row must not fail the rest
    ];

    const first = await CommunityService.importFollows(USER_ID, payload);
    assert.equal(first.imported, 2);

    // A retry — or a second browser — merges rather than duplicating.
    const second = await CommunityService.importFollows(USER_ID, payload);
    assert.equal(second.imported, 0);
    assert.equal(await CommunityFollow.countDocuments({ userId: USER_ID }), 2);
  });

  it("caps how many things one user can follow", async () => {
    const documents = Array.from({ length: 200 }, (_, index) => ({
      userId: USER_ID,
      kind: "TOPIC",
      targetId: `topic-${index}`,
    }));
    await CommunityFollow.insertMany(documents);

    await assert.rejects(
      () =>
        CommunityService.toggleFollow(USER_ID, {
          kind: "TOPIC",
          targetId: "one-too-many",
        }),
      /at most 200/
    );

    // Unfollowing still works at the cap — otherwise a user who hits it would
    // be stuck with no way back down.
    const removed = await CommunityService.toggleFollow(USER_ID, {
      kind: "TOPIC",
      targetId: "topic-0",
    });
    assert.equal(removed.following, false);
  });

  it("keeps one user's follows out of another's list", async () => {
    const otherUserId = await createUser("Player");
    await CommunityService.toggleFollow(USER_ID, {
      kind: "TOPIC",
      targetId: "tennis",
    });

    const { items } = await CommunityService.listFollows(otherUserId);
    assert.equal(items.length, 0);
  });
});
