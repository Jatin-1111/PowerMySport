// A deleted message must not leave an unread badge behind: the reader sees a
// tombstone, so a count that includes it points at nothing. In-memory MongoDB: local dev points
// at the live cluster, so a test on the default connection would write to
// production.
process.env.JWT_SECRET = "test-secret-test-secret-test-secret-1234567890";

import assert = require("node:assert/strict");
const { after, before, beforeEach, describe, it } = require("node:test");
const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");

const { CommunityConversation } = require("../community/models/CommunityConversation");
const { CommunityMessage } = require("../community/models/CommunityMessage");
const { CommunityProfile } = require("../community/models/CommunityProfile");
const { CommunityService } = require("../community/services/CommunityService");
const { User } = require("../client/models/User");

let memoryServer: { getUri(): string; stop(): Promise<void> };

let seq = 0;
const createUser = async (name: string) => {
  seq += 1;
  const user = await User.create({
    name,
    email: `receipt-${seq}@example.com`,
    phone: `918000${String(seq).padStart(4, "0")}`,
    password: "test-password",
    role: "Parent",
  });
  return String(user._id);
};

before(async () => {
  memoryServer = await MongoMemoryServer.create();
  await mongoose.connect(memoryServer.getUri());
});

after(async () => {
  await mongoose.disconnect();
  await memoryServer.stop();
});

beforeEach(async () => {
  await Promise.all([
    CommunityConversation.deleteMany({}),
    CommunityMessage.deleteMany({}),
    CommunityProfile.deleteMany({}),
    User.deleteMany({}),
  ]);
});

const setup = async () => {
  const a = await createUser("Ana");
  const b = await createUser("Ben");
  const conversation = await CommunityConversation.create({
    conversationType: "DM",
    participants: [a, b],
    participantKey: [a, b].sort().join(":"),
    status: "ACTIVE",
    requestedBy: a,
    lastMessageAt: new Date(),
  });
  const conversationId = String(conversation._id);
  const sent = await CommunityService.sendMessage(a, conversationId, "Courts are booked for six.");
  return { a, b, conversationId, messageId: String(sent.id) };
};

describe("unread counts and deleted messages", () => {
  it("counts a live message as unread", async () => {
    const { b } = await setup();

    assert.equal(await CommunityService.getUnreadConversationCount(b), 1);
    const unread = await CommunityService.listConversations(b, 1, 25, { mode: "UNREAD" });
    assert.equal(unread.items.length, 1);
    assert.equal(unread.items[0].unreadCount, 1);
  });

  it("stops counting a message once its sender deletes it", async () => {
    const { a, b, messageId } = await setup();
    await CommunityService.deleteMessage(a, messageId);

    assert.equal(await CommunityService.getUnreadConversationCount(b), 0);
    const unread = await CommunityService.listConversations(b, 1, 25, { mode: "UNREAD" });
    assert.equal(unread.items.length, 0);
    const all = await CommunityService.listConversations(b, 1, 25);
    assert.equal(all.items[0].unreadCount, 0);
  });
});
