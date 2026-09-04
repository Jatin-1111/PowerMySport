/* eslint-disable @typescript-eslint/no-var-requires */
// HTTP-level tests for the community Q&A routes (communityController/qna.ts).
//
// Per a Phase 5 testing-plan audit, Q&A had decent coverage at the
// CommunityService layer (several integration tests call createPost,
// acceptAnswer, createAnswerComment, etc. directly) but zero coverage of the
// controllers themselves — request parsing, status-code mapping, and route
// wiring were all unverified. These tests go through the real `app`, so the
// real route table, `authMiddleware`/`optionalAuthMiddleware`, and the real
// Zod validation schemas are all exercised, matching the pattern established
// in coachProgrammeRoutes.integration.test.ts and blogRoutes.integration.test.ts.
//
// COMMUNITY_ALLOWED_ROLES (communityShared.ts) is `["Parent"]` — unlike the
// blog, which allows Player/Coach/Parent, the whole Q&A/community surface is
// Parent-only. Every actor below that is expected to succeed is seeded as
// "Parent"; a disallowed role (e.g. "Coach") is used only for the negative
// role-gating test.
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
const { CommunityPost } = require("../community/models/CommunityPost");
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
    "communityposts",
    "communityanswers",
    "communityanswercomments",
    "communityvotes",
    "communityprofiles",
    "communityreputations",
  ]) {
    await mongoose.connection.db.collection(name).deleteMany({});
  }
});

/** A real user row plus a real signed token — the same pair a login produces. */
const signedInAs = async (role: string) => {
  const userId = oid();
  userCounter += 1;
  await User.collection.insertOne({
    _id: userId,
    name: `Test ${role} ${userCounter}`,
    email: `${userId.toString()}@example.test`,
    // `phone` carries a non-sparse unique index — every seeded user needs a
    // distinct value or inserts collide once the index has finished building.
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

const validPostPayload = (overrides: Record<string, unknown> = {}) => ({
  title: "How do I improve my backhand technique?",
  body: "I've been struggling with consistency on my backhand for a few months now.",
  ...overrides,
});

const createPost = async (token: string, overrides: Record<string, unknown> = {}) => {
  const response = await request(app)
    .post("/api/community/posts")
    .set("Authorization", `Bearer ${token}`)
    .send(validPostPayload(overrides));
  return response;
};

const answerPost = async (token: string, postId: string, content: string) =>
  request(app)
    .post(`/api/community/posts/${postId}/answers`)
    .set("Authorization", `Bearer ${token}`)
    .send({ content });

// ───────────────── the routes are actually mounted ─────────────────

describe("Q&A routes are reachable", () => {
  it("serves the public posts feed without auth", async () => {
    const response = await request(app).get("/api/community/posts");

    assert.equal(response.status, 200);
    assert.equal(response.body.success, true);
    assert.ok(Array.isArray(response.body.data.items));
  });

  it("rejects an unauthenticated create attempt", async () => {
    const response = await request(app).post("/api/community/posts").send(validPostPayload());

    assert.equal(response.status, 401);
  });
});

// ───────────────── validation runs on the real route ─────────────────

describe("request validation on Q&A routes", () => {
  it("rejects a title under 10 characters", async () => {
    const { token } = await signedInAs("Parent");

    const response = await createPost(token, { title: "Too short" });

    assert.equal(response.status, 400);
  });

  it("rejects a body under 20 characters", async () => {
    const { token } = await signedInAs("Parent");

    const response = await createPost(token, { body: "Too short" });

    assert.equal(response.status, 400);
  });
});

// ───────────────── create / read ─────────────────

describe("creating and reading a Q&A post over HTTP", () => {
  it("publishes a post end to end, then reads it back with a resolved author", async () => {
    // postsService.createPost returns a slim shape with no `author` field —
    // the rich author/category/isAnonymous view only exists on the list and
    // detail reads, so this checks the create response for what it actually
    // carries and confirms the author via a follow-up GET.
    const { userId, token } = await signedInAs("Parent");

    const response = await createPost(token);

    assert.equal(response.status, 201, JSON.stringify(response.body));
    assert.equal(response.body.data.title, "How do I improve my backhand technique?");
    assert.equal(response.body.data.status, "OPEN");

    const detailResponse = await request(app).get(`/api/community/posts/${response.body.data.id}`);
    assert.equal(detailResponse.body.data.post.author.id, userId.toString());
  });

  it("rejects posting for a role the community is not available to", async () => {
    // COMMUNITY_ALLOWED_ROLES is Parent-only — getStatusCode maps "only for"
    // onto 400, not the default 500.
    const { token } = await signedInAs("Coach");

    const response = await createPost(token);

    assert.equal(response.status, 400);
  });

  it("honors isAnonymous — this was silently stripped by validation before the fix", async () => {
    // communityCreatePostSchema had no `isAnonymous`/`category` fields, so
    // Zod's default key-stripping discarded them before the controller ever
    // saw them regardless of what the client sent. The create response
    // itself carries no `author`/`isAnonymous` field (see the previous
    // test), so this checks the stored row and the detail read.
    const { userId, token } = await signedInAs("Parent");

    const response = await createPost(token, { isAnonymous: true });
    assert.equal(response.status, 201);

    const stored = await CommunityPost.findOne({ authorId: userId });
    assert.equal(stored.isAnonymous, true);

    const detailResponse = await request(app).get(`/api/community/posts/${response.body.data.id}`);
    assert.equal(detailResponse.body.data.post.isAnonymous, true);
    assert.equal(detailResponse.body.data.post.author.id, "anon");
    assert.equal(detailResponse.body.data.post.author.displayName, "Anonymous");
  });

  it("honors category — also silently stripped by validation before the fix", async () => {
    const { token } = await signedInAs("Parent");

    const response = await createPost(token, { category: "Training" });
    assert.equal(response.status, 201);

    const detailResponse = await request(app).get(`/api/community/posts/${response.body.data.id}`);
    assert.equal(detailResponse.body.data.post.category, "Training");
  });
});

// ───────────────── update / delete ─────────────────

describe("updating and deleting a Q&A post over HTTP", () => {
  it("lets the author update their own post", async () => {
    const { token } = await signedInAs("Parent");
    const createResponse = await createPost(token);
    const postId = createResponse.body.data.id;

    const response = await request(app)
      .patch(`/api/community/posts/${postId}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ title: "How do I fix my backhand for good?" });

    assert.equal(response.status, 200, JSON.stringify(response.body));
    assert.equal(response.body.data.title, "How do I fix my backhand for good?");
  });

  it("refuses a non-author's update with 403, not 500", async () => {
    // getStatusCode only exact-matched "Access denied"; postsService.updatePost
    // throws "Only the author can update this post", which fell through to
    // the 500 default before the fix.
    const author = await signedInAs("Parent");
    const createResponse = await createPost(author.token);
    const postId = createResponse.body.data.id;

    const stranger = await signedInAs("Parent");
    const response = await request(app)
      .patch(`/api/community/posts/${postId}`)
      .set("Authorization", `Bearer ${stranger.token}`)
      .send({ title: "Hijacked title goes here" });

    assert.equal(response.status, 403);

    const untouched = await CommunityPost.findById(postId);
    assert.equal(untouched.title, "How do I improve my backhand technique?");
  });

  it("closes a post via status: CLOSED", async () => {
    const { token } = await signedInAs("Parent");
    const createResponse = await createPost(token);
    const postId = createResponse.body.data.id;

    const response = await request(app)
      .patch(`/api/community/posts/${postId}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ status: "CLOSED" });

    assert.equal(response.status, 200);
    assert.equal(response.body.data.status, "CLOSED");
  });

  it("soft-deletes so the post 404s afterward but the row survives", async () => {
    const { token } = await signedInAs("Parent");
    const createResponse = await createPost(token);
    const postId = createResponse.body.data.id;

    const deleteResponse = await request(app)
      .delete(`/api/community/posts/${postId}`)
      .set("Authorization", `Bearer ${token}`);
    assert.equal(deleteResponse.status, 200);

    const getResponse = await request(app).get(`/api/community/posts/${postId}`);
    assert.equal(getResponse.status, 404);

    const stillInDb = await CommunityPost.findById(postId);
    assert.ok(stillInDb, "soft delete must not remove the document");
    assert.equal(stillInDb.isDeleted, true);
  });

  it("refuses a non-author's delete with 403, not 500", async () => {
    const author = await signedInAs("Parent");
    const createResponse = await createPost(author.token);
    const postId = createResponse.body.data.id;

    const stranger = await signedInAs("Parent");
    const response = await request(app)
      .delete(`/api/community/posts/${postId}`)
      .set("Authorization", `Bearer ${stranger.token}`);

    assert.equal(response.status, 403);
  });
});

// ───────────────── answers ─────────────────

describe("answering a Q&A post over HTTP", () => {
  it("posts an answer and it shows up in the post detail", async () => {
    const author = await signedInAs("Parent");
    const createResponse = await createPost(author.token);
    const postId = createResponse.body.data.id;

    const answerer = await signedInAs("Parent");
    const answerResponse = await answerPost(
      answerer.token,
      postId,
      "Try focusing on your follow-through and hip rotation."
    );

    assert.equal(answerResponse.status, 201, JSON.stringify(answerResponse.body));

    const detailResponse = await request(app).get(`/api/community/posts/${postId}`);
    assert.equal(detailResponse.body.data.answers.length, 1);
    assert.equal(
      detailResponse.body.data.answers[0].content,
      "Try focusing on your follow-through and hip rotation."
    );
  });

  it("refuses to answer a closed post", async () => {
    const author = await signedInAs("Parent");
    const createResponse = await createPost(author.token);
    const postId = createResponse.body.data.id;

    await request(app)
      .patch(`/api/community/posts/${postId}`)
      .set("Authorization", `Bearer ${author.token}`)
      .send({ status: "CLOSED" });

    const answerer = await signedInAs("Parent");
    const response = await answerPost(
      answerer.token,
      postId,
      "This should not be allowed to post at all."
    );

    assert.equal(response.status, 400);
  });

  it("refuses a non-author's answer update with 403, not 500", async () => {
    const author = await signedInAs("Parent");
    const createResponse = await createPost(author.token);
    const postId = createResponse.body.data.id;

    const answerer = await signedInAs("Parent");
    const answerResponse = await answerPost(
      answerer.token,
      postId,
      "Focus on your grip and wrist position."
    );
    const answerId = answerResponse.body.data.id;

    const stranger = await signedInAs("Parent");
    const response = await request(app)
      .patch(`/api/community/answers/${answerId}`)
      .set("Authorization", `Bearer ${stranger.token}`)
      .send({ content: "Hijacked answer content right here." });

    assert.equal(response.status, 403);
  });

  it("refuses a non-author's answer delete with 403, not 500", async () => {
    const author = await signedInAs("Parent");
    const createResponse = await createPost(author.token);
    const postId = createResponse.body.data.id;

    const answerer = await signedInAs("Parent");
    const answerResponse = await answerPost(
      answerer.token,
      postId,
      "Focus on your grip and wrist position."
    );
    const answerId = answerResponse.body.data.id;

    const stranger = await signedInAs("Parent");
    const response = await request(app)
      .delete(`/api/community/answers/${answerId}`)
      .set("Authorization", `Bearer ${stranger.token}`);

    assert.equal(response.status, 403);
  });
});

// ───────────────── accepting an answer ─────────────────

describe("accepting an answer over HTTP", () => {
  it("lets the asker accept an answer, then unaccept on a second call", async () => {
    const author = await signedInAs("Parent");
    const createResponse = await createPost(author.token);
    const postId = createResponse.body.data.id;

    const answerer = await signedInAs("Parent");
    const answerResponse = await answerPost(
      answerer.token,
      postId,
      "Focus on your grip and wrist position."
    );
    const answerId = answerResponse.body.data.id;

    const acceptResponse = await request(app)
      .post(`/api/community/posts/${postId}/accept/${answerId}`)
      .set("Authorization", `Bearer ${author.token}`);
    assert.equal(acceptResponse.status, 200);
    assert.equal(acceptResponse.body.data.accepted, true);

    const unacceptResponse = await request(app)
      .post(`/api/community/posts/${postId}/accept/${answerId}`)
      .set("Authorization", `Bearer ${author.token}`);
    assert.equal(unacceptResponse.body.data.accepted, false);
  });

  it("refuses acceptance from anyone other than the asker, with 403 not 400 or 500", async () => {
    // votingService throws "Only the person who asked can accept an answer" —
    // before the shared getStatusCode fix this accidentally mapped to 400 via
    // an unrelated substring match on "accept", not because it is a
    // validation error; it is an authorization failure and belongs at 403.
    const author = await signedInAs("Parent");
    const createResponse = await createPost(author.token);
    const postId = createResponse.body.data.id;

    const answerer = await signedInAs("Parent");
    const answerResponse = await answerPost(
      answerer.token,
      postId,
      "Focus on your grip and wrist position."
    );
    const answerId = answerResponse.body.data.id;

    const stranger = await signedInAs("Parent");
    const response = await request(app)
      .post(`/api/community/posts/${postId}/accept/${answerId}`)
      .set("Authorization", `Bearer ${stranger.token}`);

    assert.equal(response.status, 403);
  });
});

// ───────────────── voting ─────────────────

describe("voting on a Q&A post over HTTP", () => {
  it("upvotes a post and toggles the vote off on a repeat call", async () => {
    const author = await signedInAs("Parent");
    const createResponse = await createPost(author.token);
    const postId = createResponse.body.data.id;

    const voter = await signedInAs("Parent");

    const upvoteResponse = await request(app)
      .post("/api/community/votes")
      .set("Authorization", `Bearer ${voter.token}`)
      .send({ targetType: "POST", targetId: postId, value: 1 });
    assert.equal(upvoteResponse.status, 200);
    assert.equal(upvoteResponse.body.data.myVote, 1);
    assert.equal(upvoteResponse.body.data.upvoteCount, 1);

    const toggleOffResponse = await request(app)
      .post("/api/community/votes")
      .set("Authorization", `Bearer ${voter.token}`)
      .send({ targetType: "POST", targetId: postId, value: 1 });
    assert.equal(toggleOffResponse.body.data.myVote, 0);
    assert.equal(toggleOffResponse.body.data.upvoteCount, 0);
  });

  it("refuses to let the author vote on their own post", async () => {
    const author = await signedInAs("Parent");
    const createResponse = await createPost(author.token);
    const postId = createResponse.body.data.id;

    const response = await request(app)
      .post("/api/community/votes")
      .set("Authorization", `Bearer ${author.token}`)
      .send({ targetType: "POST", targetId: postId, value: 1 });

    assert.equal(response.status, 400);
  });
});

// ───────────────── answer comments ─────────────────

describe("commenting on an answer over HTTP", () => {
  it("posts a comment and it shows up in the post detail", async () => {
    const author = await signedInAs("Parent");
    const createResponse = await createPost(author.token);
    const postId = createResponse.body.data.id;

    const answerer = await signedInAs("Parent");
    const answerResponse = await answerPost(
      answerer.token,
      postId,
      "Focus on your grip and wrist position."
    );
    const answerId = answerResponse.body.data.id;

    const commenter = await signedInAs("Parent");
    const commentResponse = await request(app)
      .post(`/api/community/answers/${answerId}/comments`)
      .set("Authorization", `Bearer ${commenter.token}`)
      .send({ content: "This really helped, thank you!" });
    assert.equal(commentResponse.status, 201, JSON.stringify(commentResponse.body));

    const detailResponse = await request(app).get(`/api/community/posts/${postId}`);
    assert.equal(detailResponse.body.data.answers[0].comments.length, 1);
    assert.equal(
      detailResponse.body.data.answers[0].comments[0].content,
      "This really helped, thank you!"
    );
  });

  it("rejects an empty comment", async () => {
    const author = await signedInAs("Parent");
    const createResponse = await createPost(author.token);
    const postId = createResponse.body.data.id;

    const answerer = await signedInAs("Parent");
    const answerResponse = await answerPost(
      answerer.token,
      postId,
      "Focus on your grip and wrist position."
    );
    const answerId = answerResponse.body.data.id;

    const response = await request(app)
      .post(`/api/community/answers/${answerId}/comments`)
      .set("Authorization", `Bearer ${author.token}`)
      .send({ content: "" });

    assert.equal(response.status, 400);
  });

  it("lets the post author delete someone else's comment on their thread", async () => {
    const author = await signedInAs("Parent");
    const createResponse = await createPost(author.token);
    const postId = createResponse.body.data.id;

    const answerer = await signedInAs("Parent");
    const answerResponse = await answerPost(
      answerer.token,
      postId,
      "Focus on your grip and wrist position."
    );
    const answerId = answerResponse.body.data.id;

    const commenter = await signedInAs("Parent");
    const commentResponse = await request(app)
      .post(`/api/community/answers/${answerId}/comments`)
      .set("Authorization", `Bearer ${commenter.token}`)
      .send({ content: "Off-topic noise on my own thread." });
    const commentId = commentResponse.body.data.id;

    const deleteResponse = await request(app)
      .delete(`/api/community/answer-comments/${commentId}`)
      .set("Authorization", `Bearer ${author.token}`);

    assert.equal(deleteResponse.status, 200);
  });

  it('refuses a bystander\'s comment deletion with 400 ("cannot" maps below 403)', async () => {
    const author = await signedInAs("Parent");
    const createResponse = await createPost(author.token);
    const postId = createResponse.body.data.id;

    const answerer = await signedInAs("Parent");
    const answerResponse = await answerPost(
      answerer.token,
      postId,
      "Focus on your grip and wrist position."
    );
    const answerId = answerResponse.body.data.id;

    const commenter = await signedInAs("Parent");
    const commentResponse = await request(app)
      .post(`/api/community/answers/${answerId}/comments`)
      .set("Authorization", `Bearer ${commenter.token}`)
      .send({ content: "A comment only its author or the asker may remove." });
    const commentId = commentResponse.body.data.id;

    const bystander = await signedInAs("Parent");
    const deleteResponse = await request(app)
      .delete(`/api/community/answer-comments/${commentId}`)
      .set("Authorization", `Bearer ${bystander.token}`);

    assert.equal(deleteResponse.status, 400);
  });
});
