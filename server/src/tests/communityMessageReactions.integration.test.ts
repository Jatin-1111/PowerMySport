/* eslint-disable @typescript-eslint/no-var-requires */
// Integration tests for message reactions. In-memory MongoDB — local dev
// points at the live cluster, so a test on the default connection would write
// to production.
process.env.JWT_SECRET = "test-secret-test-secret-test-secret-1234567890";

import assert = require("node:assert/strict");
const { after, before, beforeEach, describe, it } = require("node:test");
const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");

const {
  CommunityConversation,
} = require("../community/models/CommunityConversation");
const { CommunityMessage } = require("../community/models/CommunityMessage");
const {
  CommunityMessageReaction,
} = require("../community/models/CommunityMessageReaction");
const { CommunityProfile } = require("../community/models/CommunityProfile");
const { CommunityService } = require("../community/services/CommunityService");
const { User } = require("../client/models/User");

let memoryServer: { getUri(): string; stop(): Promise<void> };

let seq = 0;
const createUser = async (name: string) => {
  seq += 1;
  const user = await User.create({
    name,
    email: `react-${seq}@example.com`,
    phone: `917000${String(seq).padStart(4, "0")}`,
    password: "test-password",
    role: "Parent",
  });
  return String(user._id);
};

const openConversation = async (participants: string[]) => {
  const conversation = await CommunityConversation.create({
    conversationType: participants.length > 2 ? "GROUP" : "DM",
    participants,
    participantKey: [...participants].sort().join(":"),
    status: "ACTIVE",
    requestedBy: participants[0],
    lastMessageAt: new Date(),
  });
  return String(conversation._id);
};

before(async () => {
  memoryServer = await MongoMemoryServer.create();
  await mongoose.connect(memoryServer.getUri());
  await CommunityMessageReaction.syncIndexes();
});

after(async () => {
  await mongoose.disconnect();
  await memoryServer.stop();
});

beforeEach(async () => {
  await Promise.all([
    CommunityConversation.deleteMany({}),
    CommunityMessage.deleteMany({}),
    CommunityMessageReaction.deleteMany({}),
    CommunityProfile.deleteMany({}),
    User.deleteMany({}),
  ]);
});

const setup = async () => {
  const a = await createUser("Ana");
  const b = await createUser("Ben");
  const conversationId = await openConversation([a, b]);
  const message = await CommunityService.sendMessage(
    a,
    conversationId,
    "Courts are booked for six.",
  );
  return { a, b, conversationId, message };
};

describe("reacting to a message", () => {
  it("records a reaction and counts it", async () => {
    const { b, message } = await setup();

    const result = await CommunityService.reactToMessage(b, message.id, "👍");

    assert.equal(result.reactions.length, 1);
    assert.equal(result.reactions[0].emoji, "👍");
    assert.equal(result.reactions[0].count, 1);
    assert.equal(result.reactions[0].reactedByMe, true);
  });

  it("clears the reaction when the same emoji is sent again", async () => {
    const { b, message } = await setup();

    await CommunityService.reactToMessage(b, message.id, "👍");
    const result = await CommunityService.reactToMessage(b, message.id, "👍");

    assert.equal(result.reactions.length, 0);
  });

  it("replaces rather than stacks when the emoji changes", async () => {
    const { b, message } = await setup();

    await CommunityService.reactToMessage(b, message.id, "👍");
    const result = await CommunityService.reactToMessage(b, message.id, "🎉");

    // One reaction per person: the old one must not linger alongside the new.
    assert.equal(result.reactions.length, 1);
    assert.equal(result.reactions[0].emoji, "🎉");
    assert.equal(
      await CommunityMessageReaction.countDocuments({ messageId: message.id }),
      1,
    );
  });

  it("groups the same emoji from different people", async () => {
    const { a, b, message } = await setup();

    await CommunityService.reactToMessage(a, message.id, "👍");
    const result = await CommunityService.reactToMessage(b, message.id, "👍");

    assert.equal(result.reactions.length, 1);
    assert.equal(result.reactions[0].count, 2);
  });

  it("reports reactedByMe per viewer", async () => {
    const { a, b, conversationId, message } = await setup();

    await CommunityService.reactToMessage(b, message.id, "👍");

    const asB = await CommunityService.getMessages(b, conversationId);
    const asA = await CommunityService.getMessages(a, conversationId);
    const forB = asB.messages.find((m: { id: string }) => m.id === message.id);
    const forA = asA.messages.find((m: { id: string }) => m.id === message.id);

    assert.equal(forB.reactions[0].reactedByMe, true);
    assert.equal(forA.reactions[0].reactedByMe, false);
    assert.equal(forA.reactions[0].count, 1);
  });

  it("refuses someone outside the conversation", async () => {
    const { message } = await setup();
    const outsider = await createUser("Outsider");

    // Reacting is participation, so it needs the same gate as reading.
    await assert.rejects(
      () => CommunityService.reactToMessage(outsider, message.id, "👍"),
      /denied|not found|access/i,
    );
  });

  it("refuses an empty emoji", async () => {
    const { b, message } = await setup();

    await assert.rejects(
      () => CommunityService.reactToMessage(b, message.id, "   "),
      /emoji is required/i,
    );
  });

  it("refuses a deleted message", async () => {
    const { a, b, message } = await setup();
    await CommunityService.deleteMessage(a, message.id);

    await assert.rejects(
      () => CommunityService.reactToMessage(b, message.id, "👍"),
      /Message not found/,
    );
  });

  it("clears reactions when the message is deleted", async () => {
    const { a, b, message } = await setup();
    await CommunityService.reactToMessage(b, message.id, "👍");

    await CommunityService.deleteMessage(a, message.id);

    // Otherwise a row of emoji sits under "This message was deleted".
    assert.equal(
      await CommunityMessageReaction.countDocuments({ messageId: message.id }),
      0,
    );
  });

  it("keeps one row per person even under a double tap", async () => {
    const { b, message } = await setup();

    await Promise.all([
      CommunityService.reactToMessage(b, message.id, "👍").catch(() => {}),
      CommunityService.reactToMessage(b, message.id, "👍").catch(() => {}),
    ]);

    const rows = await CommunityMessageReaction.countDocuments({
      messageId: message.id,
    });
    // The unique index is the arbiter, not application logic.
    assert.ok(rows <= 1, `expected at most one row, found ${rows}`);
  });
});
