/* eslint-disable @typescript-eslint/no-var-requires */
// HTTP-level tests for the DM consent flow.
//
// Community profiles are request-only by default: opening a conversation with
// someone creates a PENDING request, the sender gets exactly one message to
// introduce themselves, and nothing further moves until the recipient accepts.
//
// The one-message cap is the part worth pinning. Before it, a PENDING
// conversation blocked the *recipient* from replying but let the *requester*
// send without limit — so a "request" delivered an unlimited stream to someone
// who had never agreed to hear from them, which is the exact thing the request
// step exists to prevent.
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
const { CommunityProfile } = require("../community/models/CommunityProfile");
const { CommunityConversation } = require("../community/models/CommunityConversation");
const { CommunityMessage } = require("../community/models/CommunityMessage");
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
    "outboxmessages",
  ]) {
    await mongoose.connection.db.collection(name).deleteMany({});
  }
});

const signedInAs = async (role = "Parent") => {
  const userId = oid();
  userCounter += 1;
  await User.collection.insertOne({
    _id: userId,
    name: `Test ${role} ${userCounter}`,
    email: `${userId.toString()}@example.test`,
    // `phone` carries a non-sparse unique index — distinct values or inserts collide.
    phone: `9${userId.toString().slice(-9)}`,
    role,
    isActive: true,
    status: "ACTIVE",
  });

  const token = generateToken({
    id: userId.toString(),
    email: `${userId.toString()}@example.test`,
    role,
  });

  return { userId, token };
};

const startConversation = (token: string, targetUserId: string) =>
  request(app)
    .post("/api/community/conversations/start")
    .set("Authorization", `Bearer ${token}`)
    .send({ targetUserId });

const sendMessage = (token: string, conversationId: string, content: string) =>
  request(app)
    .post("/api/community/messages")
    .set("Authorization", `Bearer ${token}`)
    .send({ conversationId, content });

const acceptRequest = (token: string, conversationId: string) =>
  request(app)
    .post(`/api/community/conversations/${conversationId}/accept`)
    .set("Authorization", `Bearer ${token}`);

const rejectRequest = (token: string, conversationId: string) =>
  request(app)
    .post(`/api/community/conversations/${conversationId}/reject`)
    .set("Authorization", `Bearer ${token}`);

describe("community DM requests", () => {
  it("defaults a new profile to request-only", async () => {
    const { userId, token } = await signedInAs();
    // Any authenticated community read materialises the profile.
    await request(app).get("/api/community/profile").set("Authorization", `Bearer ${token}`);

    const profile = await CommunityProfile.findOne({ userId }).lean();
    assert.equal(profile?.messagePrivacy, "REQUEST_ONLY");
  });

  it("opens as PENDING against a request-only recipient", async () => {
    const sender = await signedInAs();
    const recipient = await signedInAs();

    const response = await startConversation(sender.token, recipient.userId.toString());

    assert.equal(response.status, 200);
    assert.equal(response.body.data.status, "PENDING");
  });

  it("lets the sender send exactly one intro message, then stops them", async () => {
    const sender = await signedInAs();
    const recipient = await signedInAs();
    const { body } = await startConversation(sender.token, recipient.userId.toString());
    const conversationId = body.data.id;

    const first = await sendMessage(sender.token, conversationId, "Hi — my son plays U12 tennis.");
    assert.equal(first.status, 201, "the intro message should go through");

    const second = await sendMessage(sender.token, conversationId, "Hello? Are you there?");
    assert.ok(
      second.status >= 400,
      `expected the second message to be refused, got ${second.status}`
    );

    assert.equal(
      await CommunityMessage.countDocuments({ conversationId }),
      1,
      "only the intro message may exist while the request is pending"
    );
  });

  /**
   * `isDeleted` only hides a message. If the cap ignored soft-deleted rows a
   * sender could delete their intro and send another, repeating indefinitely —
   * an unlimited channel wearing a one-message cap.
   */
  it("does not hand the slot back when the intro is deleted", async () => {
    const sender = await signedInAs();
    const recipient = await signedInAs();
    const { body } = await startConversation(sender.token, recipient.userId.toString());
    const conversationId = body.data.id;

    await sendMessage(sender.token, conversationId, "First and only.");
    await CommunityMessage.updateMany({ conversationId }, { $set: { isDeleted: true } });

    const retry = await sendMessage(sender.token, conversationId, "Sneaking a second one in.");
    assert.ok(retry.status >= 400, `expected the retry to be refused, got ${retry.status}`);
  });

  it("blocks the recipient from replying until they accept", async () => {
    const sender = await signedInAs();
    const recipient = await signedInAs();
    const { body } = await startConversation(sender.token, recipient.userId.toString());
    const conversationId = body.data.id;
    await sendMessage(sender.token, conversationId, "Hi there.");

    const earlyReply = await sendMessage(recipient.token, conversationId, "Who is this?");
    assert.ok(
      earlyReply.status >= 400,
      `expected the reply to be refused, got ${earlyReply.status}`
    );
  });

  it("opens the channel both ways once accepted", async () => {
    const sender = await signedInAs();
    const recipient = await signedInAs();
    const { body } = await startConversation(sender.token, recipient.userId.toString());
    const conversationId = body.data.id;
    await sendMessage(sender.token, conversationId, "Hi there.");

    const accepted = await acceptRequest(recipient.token, conversationId);
    assert.equal(accepted.status, 200);

    const reply = await sendMessage(recipient.token, conversationId, "Hello!");
    assert.equal(reply.status, 201, "the recipient can reply once accepted");

    const followUp = await sendMessage(sender.token, conversationId, "Great to hear from you.");
    assert.equal(followUp.status, 201, "the sender is no longer capped once accepted");
  });

  it("lets a sender try again after being declined", async () => {
    const sender = await signedInAs();
    const recipient = await signedInAs();
    const first = await startConversation(sender.token, recipient.userId.toString());
    await sendMessage(sender.token, first.body.data.id, "First attempt.");

    await rejectRequest(recipient.token, first.body.data.id);

    // Declining deletes the conversation, so a fresh request is a clean slate
    // rather than a conversation whose one-message budget is already spent.
    assert.equal(await CommunityConversation.countDocuments({}), 0);

    const second = await startConversation(sender.token, recipient.userId.toString());
    assert.equal(second.status, 200);
    assert.equal(second.body.data.status, "PENDING");

    const retry = await sendMessage(sender.token, second.body.data.id, "Trying again politely.");
    assert.equal(retry.status, 201);
  });

  it("still opens straight to ACTIVE for someone who chose EVERYONE", async () => {
    const sender = await signedInAs();
    const recipient = await signedInAs();
    await request(app)
      .get("/api/community/profile")
      .set("Authorization", `Bearer ${recipient.token}`);
    await CommunityProfile.updateOne(
      { userId: recipient.userId },
      { $set: { messagePrivacy: "EVERYONE" } }
    );

    const response = await startConversation(sender.token, recipient.userId.toString());

    assert.equal(response.body.data.status, "ACTIVE");

    const conversationId = response.body.data.id;
    assert.equal((await sendMessage(sender.token, conversationId, "One")).status, 201);
    assert.equal(
      (await sendMessage(sender.token, conversationId, "Two")).status,
      201,
      "no cap applies outside a pending request"
    );
  });
});
