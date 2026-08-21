/* eslint-disable @typescript-eslint/no-var-requires */
// Integration tests for file and voice chat attachments. In-memory MongoDB —
// local dev points at the live cluster, so a test on the default connection
// would write to production.
process.env.JWT_SECRET = "test-secret-test-secret-test-secret-1234567890";

import assert = require("node:assert/strict");
const { after, before, beforeEach, describe, it } = require("node:test");
const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");

const {
  CommunityConversation,
} = require("../community/models/CommunityConversation");
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
    email: `attach-${seq}@example.com`,
    phone: `918000${String(seq).padStart(4, "0")}`,
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

describe("file and voice messages", () => {
  it("stores a file with its name and size", async () => {
    const a = await createUser("Ana");
    const b = await createUser("Ben");
    const conversationId = await openConversation(a, b);

    const sent = await CommunityService.sendMessage(
      a,
      conversationId,
      "chats/abc/files/generated-uuid.pdf",
      {
        type: "FILE",
        metadata: {
          fileName: "match-schedule.pdf",
          fileSize: 24_000,
          mimeType: "application/pdf",
        },
      },
    );

    assert.equal(sent.type, "FILE");
    // The display name has to survive separately: the key is generated
    // server-side and carries no trace of the original filename.
    assert.equal(sent.metadata.fileName, "match-schedule.pdf");
    assert.equal(sent.metadata.fileSize, 24_000);
  });

  it("stores a voice note with its duration", async () => {
    const a = await createUser("Ana");
    const b = await createUser("Ben");
    const conversationId = await openConversation(a, b);

    const sent = await CommunityService.sendMessage(
      a,
      conversationId,
      "chats/abc/voice/generated-uuid.webm",
      {
        type: "VOICE",
        metadata: { durationMs: 4200, mimeType: "audio/webm" },
      },
    );

    assert.equal(sent.type, "VOICE");
    assert.equal(sent.metadata.durationMs, 4200);
  });

  it("keeps metadata on the way back out", async () => {
    const a = await createUser("Ana");
    const b = await createUser("Ben");
    const conversationId = await openConversation(a, b);

    await CommunityService.sendMessage(
      a,
      conversationId,
      "chats/abc/files/generated-uuid.pdf",
      {
        type: "FILE",
        metadata: { fileName: "form.pdf", fileSize: 100, mimeType: "application/pdf" },
      },
    );

    const page = await CommunityService.getMessages(b, conversationId);
    assert.equal(page.messages[0].type, "FILE");
    assert.equal(page.messages[0].metadata.fileName, "form.pdf");
  });

  it("describes an attachment in a quote instead of leaking its key", async () => {
    const a = await createUser("Ana");
    const b = await createUser("Ben");
    const conversationId = await openConversation(a, b);

    const file = await CommunityService.sendMessage(
      a,
      conversationId,
      "chats/abc/files/secret-object-key.pdf",
      { type: "FILE", metadata: { fileName: "roster.pdf" } },
    );
    const voice = await CommunityService.sendMessage(
      a,
      conversationId,
      "chats/abc/voice/secret-voice-key.webm",
      { type: "VOICE", metadata: { durationMs: 3000 } },
    );

    const replyToFile = await CommunityService.sendMessage(
      b,
      conversationId,
      "Got it",
      { replyToId: file.id },
    );
    const replyToVoice = await CommunityService.sendMessage(
      b,
      conversationId,
      "Listened",
      { replyToId: voice.id },
    );

    assert.equal(replyToFile.replyTo.content, "roster.pdf");
    assert.equal(replyToVoice.replyTo.content, "Voice message (3s)");
    assert.ok(!replyToFile.replyTo.content.includes("secret-object-key"));
    assert.ok(!replyToVoice.replyTo.content.includes("secret-voice-key"));
  });

  it("describes an attachment in a quote read back from the thread", async () => {
    const a = await createUser("Ana");
    const b = await createUser("Ben");
    const conversationId = await openConversation(a, b);

    const file = await CommunityService.sendMessage(
      a,
      conversationId,
      "chats/abc/files/secret-object-key.pdf",
      { type: "FILE", metadata: { fileName: "roster.pdf" } },
    );
    await CommunityService.sendMessage(b, conversationId, "Got it", {
      replyToId: file.id,
    });

    // The send path and the read path shape this preview separately, so both
    // need covering — a regression in one is invisible to a test of the other.
    const page = await CommunityService.getMessages(b, conversationId);
    const reply = page.messages.find(
      (message: { replyTo?: { content: string } }) => message.replyTo,
    );
    assert.equal(reply.replyTo.content, "roster.pdf");
    assert.ok(!reply.replyTo.content.includes("secret-object-key"));
  });

  it("describes an attachment in the conversation list", async () => {
    const a = await createUser("Ana");
    const b = await createUser("Ben");
    const conversationId = await openConversation(a, b);

    await CommunityService.sendMessage(
      a,
      conversationId,
      "chats/abc/files/secret-object-key.pdf",
      { type: "FILE", metadata: { fileName: "roster.pdf" } },
    );

    const list = await CommunityService.listConversations(b, 1, 10);
    const row = list.items.find(
      (item: { id: string }) => item.id === conversationId,
    );
    // Falling through to `content` here would print an S3 key in the sidebar.
    assert.equal(row.latestMessage.content, "roster.pdf");
    assert.ok(!row.latestMessage.content.includes("secret-object-key"));
  });

  it("still stores a plain text message as TEXT", async () => {
    const a = await createUser("Ana");
    const b = await createUser("Ben");
    const conversationId = await openConversation(a, b);

    const sent = await CommunityService.sendMessage(
      a,
      conversationId,
      "Just a message.",
    );
    assert.equal(sent.type, "TEXT");
    assert.equal(sent.metadata, null);
  });
});

describe("the chat attachment allowlist", () => {
  const { S3Service } = require("../shared/services/S3Service");

  it("rejects a content type that is not on the list", async () => {
    process.env.AWS_S3_CHAT_BUCKET =
      process.env.AWS_S3_CHAT_BUCKET || "test-chat-bucket";
    const service = new S3Service();

    // An open allowlist here is how a chat becomes a malware channel.
    await assert.rejects(
      () =>
        service.generateChatAttachmentPresignedPost(
          "conversation-1",
          "application/x-msdownload",
          "FILE",
        ),
      /not supported/,
    );
  });

  it("rejects a disguised executable even with a plausible kind", async () => {
    process.env.AWS_S3_CHAT_BUCKET =
      process.env.AWS_S3_CHAT_BUCKET || "test-chat-bucket";
    const service = new S3Service();

    await assert.rejects(
      () =>
        service.generateChatAttachmentPresignedPost(
          "conversation-1",
          "application/octet-stream",
          "VOICE",
        ),
      /not supported/,
    );
  });
});
