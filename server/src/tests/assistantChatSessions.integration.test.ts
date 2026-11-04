// HTTP-level tests for the assistant chat's session list and delete.
//
// They go through the real `app`, so the real route table and
// `authMiddleware` are exercised. What matters here is who may delete what, and
// that the history list does not fill up with chats nobody wrote in.
process.env.JWT_SECRET = "test-secret-test-secret-test-secret-1234567890";
process.env.PHONEPE_CLIENT_ID = "test-client";
process.env.PHONEPE_CLIENT_SECRET = "test-secret";
process.env.PHONEPE_CLIENT_VERSION = "1";
process.env.PHONEPE_ENV = "SANDBOX";
process.env.REDIS_ENABLED = "false";

import assert = require("node:assert/strict");
const { after, before, beforeEach, describe, it } = require("node:test");
const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");
const request = require("supertest");

const { app } = require("../app");
const { generateToken } = require("../utils/jwt");
const { User } = require("../client/models/User");
const { AssistantChatSession } = require("../client/models/AssistantChatSession");
const redis = require("../config/redis").default;

const oid = () => new mongoose.Types.ObjectId();

let mongod: { getUri(): string; stop(): Promise<void> };

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
  for (const name of ["users", "assistantchatsessions"]) {
    await mongoose.connection.db.collection(name).deleteMany({});
  }
});

/** A real user row plus a real signed token, the same pair a login produces. */
const signedInAs = async () => {
  const userId = oid();
  await User.collection.insertOne({
    _id: userId,
    name: "Test Parent",
    email: `${userId.toString()}@example.test`,
    phone: `9${userId.toString().slice(-9)}`,
    role: "Player",
    isActive: true,
    status: "ACTIVE",
  });
  const token = generateToken({
    id: userId.toString(),
    email: `${userId.toString()}@example.test`,
    role: "Player",
  });
  return { userId, token };
};

/** A chat with `asked` exchanges in it; 0 is a session that was opened and left alone. */
const seedSession = (userId: unknown, asked: number, title: string | null = null) =>
  AssistantChatSession.create({
    userId,
    title,
    totalMessageCount: asked,
    messages: [{ role: "assistant", content: "Hi!", createdAt: new Date() }],
  });

describe("DELETE /api/assistant-chat/sessions/:sessionId", () => {
  it("deletes the caller's own chat", async () => {
    const owner = await signedInAs();
    const session = await seedSession(owner.userId, 2, "Is tennis good?");

    const response = await request(app)
      .delete(`/api/assistant-chat/sessions/${session._id}`)
      .set("Authorization", `Bearer ${owner.token}`);

    assert.equal(response.status, 200);
    assert.equal(response.body.success, true);
    assert.equal(await AssistantChatSession.countDocuments({ _id: session._id }), 0);
  });

  it("will not delete someone else's chat, and says only that it was not found", async () => {
    const owner = await signedInAs();
    const stranger = await signedInAs();
    const session = await seedSession(owner.userId, 2);

    const response = await request(app)
      .delete(`/api/assistant-chat/sessions/${session._id}`)
      .set("Authorization", `Bearer ${stranger.token}`);

    assert.equal(response.status, 404);
    assert.equal(await AssistantChatSession.countDocuments({ _id: session._id }), 1);
  });

  it("leaves the caller's other chats alone", async () => {
    const owner = await signedInAs();
    const doomed = await seedSession(owner.userId, 1);
    const kept = await seedSession(owner.userId, 3);

    await request(app)
      .delete(`/api/assistant-chat/sessions/${doomed._id}`)
      .set("Authorization", `Bearer ${owner.token}`);

    assert.equal(await AssistantChatSession.countDocuments({ _id: kept._id }), 1);
  });

  it("answers 404 for a chat that is already gone", async () => {
    const owner = await signedInAs();

    const response = await request(app)
      .delete(`/api/assistant-chat/sessions/${oid()}`)
      .set("Authorization", `Bearer ${owner.token}`);

    assert.equal(response.status, 404);
  });

  it("rejects an id that is not an id", async () => {
    const owner = await signedInAs();

    const response = await request(app)
      .delete("/api/assistant-chat/sessions/not-an-id")
      .set("Authorization", `Bearer ${owner.token}`);

    assert.equal(response.status, 400);
  });

  it("requires a signed-in caller", async () => {
    const owner = await signedInAs();
    const session = await seedSession(owner.userId, 1);

    const response = await request(app).delete(`/api/assistant-chat/sessions/${session._id}`);

    assert.equal(response.status, 401);
    assert.equal(await AssistantChatSession.countDocuments({ _id: session._id }), 1);
  });

  it("cannot be read back once it is deleted", async () => {
    const owner = await signedInAs();
    const session = await seedSession(owner.userId, 1);

    await request(app)
      .delete(`/api/assistant-chat/sessions/${session._id}`)
      .set("Authorization", `Bearer ${owner.token}`);
    const readBack = await request(app)
      .get(`/api/assistant-chat/sessions/${session._id}`)
      .set("Authorization", `Bearer ${owner.token}`);

    assert.equal(readBack.status, 404);
  });
});

describe("GET /api/assistant-chat/sessions", () => {
  it("lists chats that have been written in, and leaves out untouched ones", async () => {
    const owner = await signedInAs();
    await seedSession(owner.userId, 0);
    await seedSession(owner.userId, 0);
    const used = await seedSession(owner.userId, 2, "Is tennis good?");

    const response = await request(app)
      .get("/api/assistant-chat/sessions")
      .set("Authorization", `Bearer ${owner.token}`);

    assert.equal(response.status, 200);
    assert.deepEqual(
      response.body.data.map((row: { _id: string }) => row._id),
      [used._id.toString()]
    );
  });

  it("only ever lists the caller's own chats", async () => {
    const owner = await signedInAs();
    const stranger = await signedInAs();
    await seedSession(stranger.userId, 4, "Not yours");
    const mine = await seedSession(owner.userId, 1, "Mine");

    const response = await request(app)
      .get("/api/assistant-chat/sessions")
      .set("Authorization", `Bearer ${owner.token}`);

    assert.deepEqual(
      response.body.data.map((row: { _id: string }) => row._id),
      [mine._id.toString()]
    );
  });

  it("lists the most recently active chat first", async () => {
    const owner = await signedInAs();
    const older = await seedSession(owner.userId, 1, "Older");
    const newer = await seedSession(owner.userId, 1, "Newer");
    await AssistantChatSession.collection.updateOne(
      { _id: older._id },
      { $set: { updatedAt: new Date(Date.now() - 86_400_000) } }
    );

    const response = await request(app)
      .get("/api/assistant-chat/sessions")
      .set("Authorization", `Bearer ${owner.token}`);

    assert.deepEqual(
      response.body.data.map((row: { _id: string }) => row._id),
      [newer._id.toString(), older._id.toString()]
    );
  });
});
