/* eslint-disable @typescript-eslint/no-var-requires */
// Reported chat content must survive its sender.
//
// Before this, deleting a message overwrote its text, an edit replaced it with
// no history, a report kept only timestamps, and declining a request worked on
// an ACTIVE conversation and erased the whole thread for both people. Anyone
// reported for something could remove the evidence in a click.
process.env.JWT_SECRET = "test-secret-test-secret-test-secret-1234567890";
process.env.PHONEPE_CLIENT_ID = "test-client";
process.env.PHONEPE_CLIENT_SECRET = "test-secret";
process.env.PHONEPE_CLIENT_VERSION = "1";
process.env.PHONEPE_ENV = "SANDBOX";

import assert = require("node:assert/strict");
const { after, before, beforeEach, describe, it } = require("node:test");
const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");
const request = require("supertest");

const { app } = require("../app");
const { generateToken } = require("../utils/jwt");
const { User } = require("../client/models/User");
const { CommunityConversation } = require("../community/models/CommunityConversation");
const { CommunityMessage } = require("../community/models/CommunityMessage");
const { CommunityReport } = require("../community/models/CommunityReport");
const redis = require("../config/redis").default;

const oid = () => new mongoose.Types.ObjectId();

let mongod: any;
let userCounter = 0;

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
  for (const name of [
    "users",
    "communityprofiles",
    "communityconversations",
    "communitymessages",
    "communityreports",
    "outboxmessages",
  ]) {
    await mongoose.connection.db.collection(name).deleteMany({});
  }
});

const signedInAs = async () => {
  const userId = oid();
  userCounter += 1;
  await User.collection.insertOne({
    _id: userId,
    name: `Test Parent ${userCounter}`,
    email: `${userId.toString()}@example.test`,
    phone: `9${userId.toString().slice(-9)}`,
    role: "Parent",
    isActive: true,
    status: "ACTIVE",
  });
  const token = generateToken({
    id: userId.toString(),
    email: `${userId.toString()}@example.test`,
    role: "Parent",
  });
  return { userId: userId.toString(), token };
};

const post = (token: string, path: string, body?: object) =>
  request(app)
    .post(`/api/community${path}`)
    .set("Authorization", `Bearer ${token}`)
    .send(body ?? {});
const patch = (token: string, path: string, body: object) =>
  request(app).patch(`/api/community${path}`).set("Authorization", `Bearer ${token}`).send(body);
const del = (token: string, path: string) =>
  request(app).delete(`/api/community${path}`).set("Authorization", `Bearer ${token}`);

/** Two parents with an accepted conversation and one message from `a`. */
const activeConversation = async (text = "the original wording") => {
  const a = await signedInAs();
  const b = await signedInAs();
  const started = await post(a.token, "/conversations/start", {
    targetUserId: b.userId,
    message: "Hello, I would like to connect with you.",
  });
  const conversationId = started.body.data.id;
  await post(b.token, `/conversations/${conversationId}/accept`);
  const sent = await post(a.token, "/messages", { conversationId, content: text });
  return { a, b, conversationId, messageId: sent.body.data.id as string };
};

const history = async (messageId: string) => {
  const doc = await CommunityMessage.findById(messageId).select("+contentHistory").lean();
  return (doc?.contentHistory ?? []) as Array<{ content: string; reason: string }>;
};

describe("declining a request", () => {
  it("is refused once the conversation is active, and nothing is deleted", async () => {
    const { b, conversationId, messageId } = await activeConversation();

    const response = await post(b.token, `/conversations/${conversationId}/reject`);

    assert.equal(response.status, 400);
    assert.match(response.body.message, /cannot be declined/);
    assert.ok(await CommunityConversation.exists({ _id: conversationId }));
    assert.ok(await CommunityMessage.exists({ _id: messageId }));
  });

  it("still deletes a pending request", async () => {
    const a = await signedInAs();
    const b = await signedInAs();
    const started = await post(a.token, "/conversations/start", {
      targetUserId: b.userId,
      message: "Hello, I would like to connect with you.",
    });

    const response = await post(b.token, `/conversations/${started.body.data.id}/reject`);

    assert.equal(response.status, 200);
    assert.equal(await CommunityConversation.countDocuments({}), 0);
  });
});

describe("edit and delete keep the original", () => {
  it("keeps the first wording when a message is edited, then every later one", async () => {
    const { a, messageId } = await activeConversation("first wording");

    await patch(a.token, `/messages/${messageId}`, { content: "second wording" });
    await patch(a.token, `/messages/${messageId}`, { content: "third wording" });

    assert.deepEqual(
      (await history(messageId)).map((entry) => [entry.reason, entry.content]),
      [
        ["EDIT", "first wording"],
        ["EDIT", "second wording"],
      ]
    );
  });

  it("keeps the text when a message is deleted, while readers see a tombstone", async () => {
    const { a, b, conversationId, messageId } = await activeConversation("something regrettable");

    const deleted = await del(a.token, `/messages/${messageId}`);
    assert.equal(deleted.status, 200);

    const seen = await request(app)
      .get(`/api/community/conversations/${conversationId}/messages`)
      .set("Authorization", `Bearer ${b.token}`);
    const shown = seen.body.data.messages.find(
      (message: { id: string }) => message.id === messageId
    );
    assert.equal(shown.content, "Message deleted");
    assert.equal(JSON.stringify(seen.body).includes("something regrettable"), false);

    assert.deepEqual(
      (await history(messageId)).map((entry) => [entry.reason, entry.content]),
      [["DELETE", "something regrettable"]]
    );
  });

  it("does not expose the history through ordinary reads", async () => {
    const { a, messageId } = await activeConversation("hidden from queries");
    await patch(a.token, `/messages/${messageId}`, { content: "changed" });

    const plain = await CommunityMessage.findById(messageId).lean();
    assert.equal(plain?.contentHistory, undefined);
  });
});

describe("reporting a message", () => {
  it("copies the text onto the report, so a later delete cannot remove it", async () => {
    const { a, b, messageId } = await activeConversation("the reported words");

    const report = await post(b.token, "/reports", {
      targetType: "MESSAGE",
      targetId: messageId,
      reason: "Harassment",
    });
    assert.equal(report.status, 201);

    await del(a.token, `/messages/${messageId}`);

    const stored = await CommunityReport.findOne({ targetId: messageId }).lean();
    assert.equal(stored?.messageAudit?.contentSnapshot, "the reported words");
    assert.equal(stored?.messageAudit?.messageType, "TEXT");
  });

  it("snapshots the last real text when the message was already deleted", async () => {
    const { a, b, messageId } = await activeConversation("said before deleting");
    await del(a.token, `/messages/${messageId}`);

    const report = await post(b.token, "/reports", {
      targetType: "MESSAGE",
      targetId: messageId,
      reason: "Other",
    });
    assert.equal(report.status, 201);

    const stored = await CommunityReport.findOne({ targetId: messageId }).lean();
    assert.equal(stored?.messageAudit?.contentSnapshot, "said before deleting");
    assert.equal(stored?.messageAudit?.wasDeleted, true);
  });

  it("refuses a report from someone who is not in the conversation", async () => {
    const { messageId } = await activeConversation("private words");
    const outsider = await signedInAs();

    const response = await post(outsider.token, "/reports", {
      targetType: "MESSAGE",
      targetId: messageId,
      reason: "Spam",
    });

    assert.equal(response.status, 403);
    assert.equal(await CommunityReport.countDocuments({}), 0);
  });
});
