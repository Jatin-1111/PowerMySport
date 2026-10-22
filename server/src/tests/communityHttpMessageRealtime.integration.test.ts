/* eslint-disable @typescript-eslint/no-var-requires */
// Messages sent, edited or deleted over HTTP must reach the other person live.
//
// The socket handlers announced every change to the conversation room; the
// HTTP routes did not, so a send that went over HTTP (socket down, outbox
// retry) stayed invisible to the other side until they refreshed.
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
const {
  setCommunityRealtimeSocketInstance,
} = require("../community/services/CommunityRealtimeService");

const oid = () => new mongoose.Types.ObjectId();

let mongod: any;
let userCounter = 0;

before(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
});

after(async () => {
  await mongoose.disconnect();
  setCommunityRealtimeSocketInstance(null);
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

type Emit = { room: string; event: string; payload: any };

/** Stand-in socket.io Server recording every `.of("/community").to(room).emit()`. */
const installFakeIo = () => {
  const emitted: Emit[] = [];
  const namespace = {
    to: (room: string) => ({
      emit: (event: string, payload: unknown) => void emitted.push({ room, event, payload }),
    }),
  };
  setCommunityRealtimeSocketInstance({ of: () => namespace });
  return emitted;
};

describe("HTTP message routes announce to the conversation", () => {
  it("announces a sent message and refreshes both participants' lists", async () => {
    const { a, b, conversationId } = await activeConversation();
    const emitted = installFakeIo();

    const sent = await post(a.token, "/messages", { conversationId, content: "over http" });

    assert.equal(sent.status, 201);
    const created = emitted.find((e) => e.event === "community:newMessage");
    assert.equal(created?.room, `conversation:${conversationId}`);
    assert.equal(created?.payload.id, sent.body.data.id);
    assert.deepEqual(
      emitted
        .filter((e) => e.event === "community:conversationUpdated")
        .map((e) => e.room)
        .sort(),
      [`user:${a.userId}`, `user:${b.userId}`].sort()
    );
  });

  it("announces an edit", async () => {
    const { a, conversationId, messageId } = await activeConversation();
    const emitted = installFakeIo();

    const response = await patch(a.token, `/messages/${messageId}`, { content: "edited" });

    assert.equal(response.status, 200);
    const edited = emitted.find((e) => e.event === "community:messageEdited");
    assert.equal(edited?.room, `conversation:${conversationId}`);
    assert.equal(edited?.payload.content, "edited");
  });

  it("announces a delete without leaking the text", async () => {
    const { a, conversationId, messageId } = await activeConversation("to be removed");
    const emitted = installFakeIo();

    const response = await del(a.token, `/messages/${messageId}`);

    assert.equal(response.status, 200);
    const removed = emitted.find((e) => e.event === "community:messageDeleted");
    assert.equal(removed?.room, `conversation:${conversationId}`);
    assert.equal(JSON.stringify(removed?.payload).includes("to be removed"), false);
  });

  it("announces nothing when the request is refused", async () => {
    const { conversationId } = await activeConversation();
    const outsider = await signedInAs();
    const emitted = installFakeIo();

    const response = await post(outsider.token, "/messages", { conversationId, content: "hi" });

    assert.notEqual(response.status, 201);
    assert.equal(emitted.length, 0);
  });
});
