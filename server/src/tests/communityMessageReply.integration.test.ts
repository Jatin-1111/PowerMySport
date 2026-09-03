/* eslint-disable @typescript-eslint/no-var-requires */
// Integration tests for replying to a chat message. In-memory MongoDB — local
// dev points at the live cluster, so a test on the default connection would
// write to production.
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
    email: `reply-${seq}@example.com`,
    phone: `916000${String(seq).padStart(4, "0")}`,
    password: "test-password",
    role: "Parent",
  });
  return String(user._id);
};

const openConversation = async (a: string, b: string) => {
  const conversation = await CommunityConversation.create({
    conversationType: "DM",
    participants: [a, b],
    participantKey: [a, b].sort().join(":"),
    status: "ACTIVE",
    requestedBy: a,
    lastMessageAt: new Date(),
  });
  return String(conversation._id);
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

describe("replying to a message", () => {
  it("stores the link and returns a preview", async () => {
    const a = await createUser("Ana");
    const b = await createUser("Ben");
    const conversationId = await openConversation(a, b);

    const original = await CommunityService.sendMessage(
      a,
      conversationId,
      "Is practice still on at six?"
    );
    const reply = await CommunityService.sendMessage(b, conversationId, "Yes, courts are booked.", {
      replyToId: original.id,
    });

    assert.equal(reply.replyTo.id, original.id);
    assert.equal(reply.replyTo.content, "Is practice still on at six?");
  });

  it("refuses to quote a message from another conversation", async () => {
    const a = await createUser("Ana");
    const b = await createUser("Ben");
    const c = await createUser("Cal");
    const ours = await openConversation(a, b);
    const theirs = await openConversation(a, c);

    const elsewhere = await CommunityService.sendMessage(
      a,
      theirs,
      "Something private in the other chat."
    );

    // Without this check the quote preview would carry that message's text
    // into a conversation its participants cannot read.
    await assert.rejects(
      () =>
        CommunityService.sendMessage(b, ours, "Look at this", {
          replyToId: elsewhere.id,
        }),
      /no longer available/
    );
  });

  it("refuses to quote a deleted message", async () => {
    const a = await createUser("Ana");
    const b = await createUser("Ben");
    const conversationId = await openConversation(a, b);

    const original = await CommunityService.sendMessage(a, conversationId, "This will be removed.");
    await CommunityService.deleteMessage(a, original.id);

    await assert.rejects(
      () =>
        CommunityService.sendMessage(b, conversationId, "About that", {
          replyToId: original.id,
        }),
      /no longer available/
    );
  });

  it("shows a deletion through an existing quote", async () => {
    const a = await createUser("Ana");
    const b = await createUser("Ben");
    const conversationId = await openConversation(a, b);

    const original = await CommunityService.sendMessage(a, conversationId, "The original text.");
    await CommunityService.sendMessage(b, conversationId, "Replying", {
      replyToId: original.id,
    });
    await CommunityService.deleteMessage(a, original.id);

    const page = await CommunityService.getMessages(b, conversationId);
    const reply = page.messages.find((message: { replyTo?: { id: string } }) => message.replyTo);
    // Quotes resolve live, so the reply must not keep showing text the sender
    // has since removed.
    assert.equal(reply.replyTo.isDeleted, true);
    assert.equal(reply.replyTo.content, "Message deleted");
  });

  it("shows an edit through an existing quote", async () => {
    const a = await createUser("Ana");
    const b = await createUser("Ben");
    const conversationId = await openConversation(a, b);

    const original = await CommunityService.sendMessage(a, conversationId, "Six o'clock.");
    await CommunityService.sendMessage(b, conversationId, "Got it", {
      replyToId: original.id,
    });
    await CommunityService.editMessage(a, original.id, "Seven o'clock.");

    const page = await CommunityService.getMessages(b, conversationId);
    const reply = page.messages.find((message: { replyTo?: { id: string } }) => message.replyTo);
    assert.equal(reply.replyTo.content, "Seven o'clock.");
  });

  it("labels an image quote rather than exposing its storage key", async () => {
    const a = await createUser("Ana");
    const b = await createUser("Ben");
    const conversationId = await openConversation(a, b);

    const image = await CommunityService.sendMessage(
      a,
      conversationId,
      "community/chat/secret-object-key.jpg",
      { type: "IMAGE" }
    );
    const reply = await CommunityService.sendMessage(b, conversationId, "Nice shot", {
      replyToId: image.id,
    });

    assert.equal(reply.replyTo.content, "Photo");
    assert.ok(!reply.replyTo.content.includes("secret-object-key"));
  });

  it("leaves an ordinary message without a quote", async () => {
    const a = await createUser("Ana");
    const b = await createUser("Ben");
    const conversationId = await openConversation(a, b);

    const plain = await CommunityService.sendMessage(a, conversationId, "No quote here.");
    assert.equal(plain.replyTo, null);

    const page = await CommunityService.getMessages(a, conversationId);
    assert.equal(page.messages[0].replyTo, null);
  });
});
