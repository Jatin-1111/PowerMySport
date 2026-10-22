/* eslint-disable @typescript-eslint/no-var-requires */
// Two abuse limits on chat: a declined requester cannot immediately ask again,
// and one user cannot flood a conversation from several tabs or over HTTP.
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
const { CommunityRequestDecline } = require("../community/models/CommunityRequestDecline");
const {
  resetSendAllowance,
  SEND_LIMIT,
} = require("../community/services/communityChatService/sendRateLimit");
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
  resetSendAllowance();
  for (const name of [
    "users",
    "communityprofiles",
    "communityconversations",
    "communitymessages",
    "communityrequestdeclines",
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

const startRequest = (token: string, targetUserId: string) =>
  post(token, "/conversations/start", {
    targetUserId,
    message: "Hello, I would like to connect with you.",
  });

describe("declined requests", () => {
  it("blocks the same sender from asking again, but not anyone else", async () => {
    const a = await signedInAs();
    const b = await signedInAs();
    const c = await signedInAs();
    const first = await startRequest(a.token, b.userId);
    await post(b.token, `/conversations/${first.body.data.id}/reject`);

    const again = await startRequest(a.token, b.userId);
    const other = await startRequest(c.token, b.userId);

    assert.equal(again.status, 400);
    assert.match(again.body.message, /cannot send this person a new request/);
    assert.equal(other.status, 200);
  });

  it("lets the sender ask again once the cooldown row has expired", async () => {
    const a = await signedInAs();
    const b = await signedInAs();
    const first = await startRequest(a.token, b.userId);
    await post(b.token, `/conversations/${first.body.data.id}/reject`);
    await CommunityRequestDecline.deleteMany({});

    const again = await startRequest(a.token, b.userId);

    assert.equal(again.status, 200);
  });

  it("keeps a single decline row when the same pair is declined twice", async () => {
    const a = await signedInAs();
    const b = await signedInAs();
    const first = await startRequest(a.token, b.userId);
    await post(b.token, `/conversations/${first.body.data.id}/reject`);
    await CommunityRequestDecline.deleteMany({});
    const second = await startRequest(a.token, b.userId);
    await post(b.token, `/conversations/${second.body.data.id}/reject`);

    assert.equal(await CommunityRequestDecline.countDocuments({}), 1);
  });
});

describe("send rate limit", () => {
  it("stops a user after the per-window allowance, over HTTP", async () => {
    const { a, conversationId } = await activeConversation();
    resetSendAllowance();

    const statuses: number[] = [];
    for (let i = 0; i < SEND_LIMIT + 3; i += 1) {
      const response = await post(a.token, "/messages", { conversationId, content: `m${i}` });
      statuses.push(response.status);
    }

    assert.equal(statuses.filter((s) => s === 201).length, SEND_LIMIT);
    assert.equal(
      statuses.slice(SEND_LIMIT).every((s) => s === 429),
      true
    );
  });

  it("counts each user separately", async () => {
    const { a, b, conversationId } = await activeConversation();
    resetSendAllowance();
    for (let i = 0; i < SEND_LIMIT; i += 1) {
      await post(a.token, "/messages", { conversationId, content: `m${i}` });
    }

    const blocked = await post(a.token, "/messages", { conversationId, content: "one too many" });
    const other = await post(b.token, "/messages", { conversationId, content: "still fine" });

    assert.equal(blocked.status, 429);
    assert.equal(other.status, 201);
  });
});
