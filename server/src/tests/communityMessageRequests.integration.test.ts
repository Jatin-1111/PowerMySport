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

const INTRO = "Hi, my son plays U12 tennis and I'd like to connect.";

// A request is "connect with a message", so the helper sends one by default.
// Pass `null` to send none.
const startConversation = (token: string, targetUserId: string, message: string | null = INTRO) =>
  request(app)
    .post("/api/community/conversations/start")
    .set("Authorization", `Bearer ${token}`)
    .send({ targetUserId, ...(message === null ? {} : { message }) });

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

  it("sends the intro with the request, then stops the sender", async () => {
    const sender = await signedInAs();
    const recipient = await signedInAs();
    const { body } = await startConversation(sender.token, recipient.userId.toString());
    const conversationId = body.data.id;

    const intro = await CommunityMessage.findOne({ conversationId }).lean();
    assert.equal(intro?.content, INTRO, "the intro is written with the request");
    assert.equal(String(intro?.senderId), String(sender.userId));

    const second = await sendMessage(sender.token, conversationId, "Hello? Are you there?");
    assert.ok(
      second.status >= 400,
      `expected a further message to be refused, got ${second.status}`
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

    await CommunityMessage.updateMany({ conversationId }, { $set: { isDeleted: true } });

    const retry = await sendMessage(sender.token, conversationId, "Sneaking a second one in.");
    assert.ok(retry.status >= 400, `expected the retry to be refused, got ${retry.status}`);
  });

  it("blocks the recipient from replying until they accept", async () => {
    const sender = await signedInAs();
    const recipient = await signedInAs();
    const { body } = await startConversation(sender.token, recipient.userId.toString());
    const conversationId = body.data.id;

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

    await rejectRequest(recipient.token, first.body.data.id);

    // Declining deletes the conversation, so a fresh request is a clean slate
    // rather than a conversation whose one-message budget is already spent.
    assert.equal(await CommunityConversation.countDocuments({}), 0);

    const second = await startConversation(sender.token, recipient.userId.toString());
    assert.equal(second.status, 200);
    assert.equal(second.body.data.status, "PENDING");

    assert.equal(
      await CommunityMessage.countDocuments({ conversationId: second.body.data.id }),
      1,
      "the new request carries its own intro"
    );
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

    // No message needed: there is no request to explain.
    const response = await startConversation(sender.token, recipient.userId.toString(), null);

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

describe("the request's required message", () => {
  it("refuses a request with no message, and leaves nothing behind", async () => {
    const sender = await signedInAs();
    const recipient = await signedInAs();

    const response = await startConversation(sender.token, recipient.userId.toString(), null);

    assert.equal(response.status, 400);
    assert.match(response.body.message, /message is required/i);
    assert.equal(await CommunityConversation.countDocuments({}), 0);
    assert.equal(await CommunityMessage.countDocuments({}), 0);
  });

  it("refuses a message that is only whitespace or too short to say anything", async () => {
    const sender = await signedInAs();
    const recipient = await signedInAs();

    for (const message of ["", "   \n  ", "hi"]) {
      const response = await startConversation(sender.token, recipient.userId.toString(), message);
      assert.equal(response.status, 400, `"${message}" should be refused`);
    }
    assert.equal(await CommunityConversation.countDocuments({}), 0);
  });

  it("refuses a message over the limit", async () => {
    const sender = await signedInAs();
    const recipient = await signedInAs();

    const response = await startConversation(
      sender.token,
      recipient.userId.toString(),
      "x".repeat(501)
    );

    assert.equal(response.status, 400);
    assert.equal(await CommunityConversation.countDocuments({}), 0);
  });

  it("trims the message it stores", async () => {
    const sender = await signedInAs();
    const recipient = await signedInAs();

    const { body } = await startConversation(
      sender.token,
      recipient.userId.toString(),
      "   Hello, I'd like to connect.   "
    );

    const stored = await CommunityMessage.findOne({ conversationId: body.data.id }).lean();
    assert.equal(stored?.content, "Hello, I'd like to connect.");
  });

  it("lets the recipient read the message before accepting", async () => {
    const sender = await signedInAs();
    const recipient = await signedInAs();
    const { body } = await startConversation(sender.token, recipient.userId.toString());

    const messages = await request(app)
      .get(`/api/community/conversations/${body.data.id}/messages`)
      .set("Authorization", `Bearer ${recipient.token}`);

    assert.equal(messages.status, 200);
    assert.equal(messages.body.data.messages[0].content, INTRO);
  });

  it("does not post a second intro when the same request is sent again", async () => {
    const sender = await signedInAs();
    const recipient = await signedInAs();
    await startConversation(sender.token, recipient.userId.toString());

    const again = await startConversation(
      sender.token,
      recipient.userId.toString(),
      "A different message, sent a second time."
    );

    assert.equal(again.status, 200);
    assert.equal(await CommunityMessage.countDocuments({}), 1);
  });
});
