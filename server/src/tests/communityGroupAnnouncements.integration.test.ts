/* eslint-disable @typescript-eslint/no-var-requires */
// Integration tests for announcement groups and pinned messages. In-memory
// MongoDB — local dev points at the live cluster, so a test on the default
// connection would write to production.
process.env.JWT_SECRET = "test-secret-test-secret-test-secret-1234567890";

import assert = require("node:assert/strict");
const { after, before, beforeEach, describe, it } = require("node:test");
const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");

const { CommunityGroup } = require("../community/models/CommunityGroup");
const { CommunityGroupMember } = require("../community/models/CommunityGroupMember");
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
    email: `announce-${seq}@example.com`,
    phone: `919000${String(seq).padStart(4, "0")}`,
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
    CommunityGroup.deleteMany({}),
    CommunityGroupMember.deleteMany({}),
    CommunityConversation.deleteMany({}),
    CommunityMessage.deleteMany({}),
    CommunityProfile.deleteMany({}),
    User.deleteMany({}),
  ]);
});

/** An admin plus one ordinary member, in a group with its conversation. */
const setupGroup = async () => {
  const admin = await createUser("Admin");
  const member = await createUser("Member");
  const group = await CommunityService.createGroup(admin, {
    name: "Under-14 Squad",
  });
  await CommunityService.joinGroup(member, group.id);
  return { admin, member, groupId: group.id, conversationId: group.conversationId };
};

describe("announcement groups", () => {
  it("lets any member post in an ordinary group", async () => {
    const { member, conversationId } = await setupGroup();

    const sent = await CommunityService.sendMessage(member, conversationId, "See you at training.");
    assert.equal(sent.type, "TEXT");
  });

  it("stops a member posting once it becomes announcement-only", async () => {
    const { admin, member, groupId, conversationId } = await setupGroup();

    await CommunityService.updateGroupSettings(admin, groupId, {
      postPolicy: "ADMIN_ONLY",
    });

    await assert.rejects(
      () => CommunityService.sendMessage(member, conversationId, "Can I still?"),
      /Only admins can post/
    );
  });

  it("still lets an admin post there", async () => {
    const { admin, groupId, conversationId } = await setupGroup();

    await CommunityService.updateGroupSettings(admin, groupId, {
      postPolicy: "ADMIN_ONLY",
    });

    const sent = await CommunityService.sendMessage(
      admin,
      conversationId,
      "Training moved to seven."
    );
    assert.equal(sent.content, "Training moved to seven.");
  });

  it("reports canPost per viewer", async () => {
    const { admin, member, groupId, conversationId } = await setupGroup();
    await CommunityService.updateGroupSettings(admin, groupId, {
      postPolicy: "ADMIN_ONLY",
    });

    const asAdmin = await CommunityService.getMessages(admin, conversationId);
    const asMember = await CommunityService.getMessages(member, conversationId);

    assert.equal(asAdmin.conversation.group.canPost, true);
    assert.equal(asMember.conversation.group.canPost, false);
  });

  it("refuses a member trying to change the policy", async () => {
    const { member, groupId } = await setupGroup();

    await assert.rejects(
      () =>
        CommunityService.updateGroupSettings(member, groupId, {
          postPolicy: "ADMIN_ONLY",
        }),
      /Only group admins/
    );
  });

  it("leaves DMs untouched", async () => {
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

    const sent = await CommunityService.sendMessage(b, String(conversation._id), "Hello");
    assert.equal(sent.content, "Hello");
  });
});

describe("pinned group messages", () => {
  it("pins for everyone, not just the person who pinned", async () => {
    const { admin, member, groupId, conversationId } = await setupGroup();
    const message = await CommunityService.sendMessage(
      admin,
      conversationId,
      "Kit collection is on Friday."
    );

    await CommunityService.pinGroupMessage(admin, message.id);

    // Pins used to live in localStorage, so only the pinner saw them.
    const stored = await CommunityGroup.findById(groupId).lean();
    assert.equal(String(stored.pinnedMessageId), message.id);

    const asMember = await CommunityService.getMessages(member, conversationId);
    assert.equal(asMember.conversation.group.pinnedMessageId, message.id);
  });

  it("unpins when the same message is pinned again", async () => {
    const { admin, conversationId } = await setupGroup();
    const message = await CommunityService.sendMessage(
      admin,
      conversationId,
      "Kit collection is on Friday."
    );

    await CommunityService.pinGroupMessage(admin, message.id);
    const second = await CommunityService.pinGroupMessage(admin, message.id);

    assert.equal(second.pinned, false);
    assert.equal(second.pinnedMessageId, null);
  });

  it("keeps only one pin at a time", async () => {
    const { admin, conversationId } = await setupGroup();
    const first = await CommunityService.sendMessage(admin, conversationId, "First");
    const second = await CommunityService.sendMessage(admin, conversationId, "Second");

    await CommunityService.pinGroupMessage(admin, first.id);
    const result = await CommunityService.pinGroupMessage(admin, second.id);

    assert.equal(result.pinnedMessageId, second.id);
  });

  it("refuses a member who is not an admin", async () => {
    const { admin, member, conversationId } = await setupGroup();
    const message = await CommunityService.sendMessage(
      admin,
      conversationId,
      "Kit collection is on Friday."
    );

    await assert.rejects(
      () => CommunityService.pinGroupMessage(member, message.id),
      /Only group admins can pin/
    );
  });

  it("refuses a DM, which has no group to pin to", async () => {
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
    const message = await CommunityService.sendMessage(a, String(conversation._id), "Hello");

    await assert.rejects(
      () => CommunityService.pinGroupMessage(a, message.id),
      /Only group messages can be pinned/
    );
  });

  it("clears the pin when the pinned message is deleted", async () => {
    const { admin, groupId, conversationId } = await setupGroup();
    const message = await CommunityService.sendMessage(
      admin,
      conversationId,
      "Kit collection is on Friday."
    );
    await CommunityService.pinGroupMessage(admin, message.id);

    await CommunityService.deleteMessage(admin, message.id);

    const stored = await CommunityGroup.findById(groupId).lean();
    // A banner pointing at deleted text is worse than no banner.
    assert.equal(stored.pinnedMessageId, null);
  });
});
