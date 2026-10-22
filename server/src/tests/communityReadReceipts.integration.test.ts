// markConversationRead reports whether the reader shares read receipts, so the
// realtime layer can honour the setting. In-memory MongoDB: local dev points
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
  await CommunityService.sendMessage(a, String(conversation._id), "Courts are booked for six.");
  return { a, b, conversationId: String(conversation._id) };
};

describe("markConversationRead and read receipts", () => {
  it("says receipts are shared by default", async () => {
    const { b, conversationId } = await setup();

    const result = await CommunityService.markConversationRead(b, conversationId);

    assert.equal(result.messageIds.length, 1);
    assert.equal(result.readReceiptsShared, true);
  });

  it("says they are not shared once the reader turns them off", async () => {
    const { b, conversationId } = await setup();
    await CommunityService.updateMyProfile(b, { readReceiptsEnabled: false });

    const result = await CommunityService.markConversationRead(b, conversationId);

    assert.equal(result.messageIds.length, 1, "the messages are still marked read");
    assert.equal(result.readReceiptsShared, false);
  });

  it("reports the setting even when there was nothing new to read", async () => {
    const { b, conversationId } = await setup();
    await CommunityService.updateMyProfile(b, { readReceiptsEnabled: false });
    await CommunityService.markConversationRead(b, conversationId);

    const again = await CommunityService.markConversationRead(b, conversationId);

    assert.deepEqual(again.messageIds, []);
    assert.equal(again.readReceiptsShared, false);
  });
});
