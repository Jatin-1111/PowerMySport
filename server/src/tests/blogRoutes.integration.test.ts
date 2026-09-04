/* eslint-disable @typescript-eslint/no-var-requires */
// HTTP-level tests for the community blog routes.
//
// blogController.ts and BlogService.ts had zero test coverage at any layer
// before this file (per a Phase 5 testing-plan audit) — the only blog-adjacent
// test seeded BlogPost documents directly to exercise search indexing, never
// the controller/service. These tests go through the real `app`, so the real
// route table, `authMiddleware`/`optionalAuthMiddleware`, and the real Zod
// validation schemas are all exercised, matching the pattern established in
// coachProgrammeRoutes.integration.test.ts.
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
const { BlogPost } = require("../community/models/BlogPost");
const redis = require("../config/redis").default;

const oid = () => new mongoose.Types.ObjectId();

let mongod: any;

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
  for (const name of ["users", "blogposts", "blogcomments", "bloglikes", "communityprofiles"]) {
    await mongoose.connection.db.collection(name).deleteMany({});
  }
});

/** A real user row plus a real signed token — the same pair a login produces. */
const signedInAs = async (role: string) => {
  const userId = oid();
  await User.collection.insertOne({
    _id: userId,
    name: `Test ${role}`,
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

const validCreatePayload = (overrides: Record<string, unknown> = {}) => ({
  title: "How I trained for my first tournament",
  content: "<p>It started with a single early morning.</p>",
  topic: "Training",
  ...overrides,
});

// ───────────────── the routes are actually mounted ─────────────────

describe("blog routes are reachable", () => {
  it("serves the public posts feed without auth", async () => {
    const response = await request(app).get("/api/community/blog/posts");

    assert.equal(response.status, 200);
    assert.equal(response.body.success, true);
    assert.ok(Array.isArray(response.body.data.items));
  });

  it("rejects an unauthenticated create attempt", async () => {
    const response = await request(app)
      .post("/api/community/blog/posts")
      .send(validCreatePayload());

    assert.equal(response.status, 401);
  });
});

// ───────────────── validation runs on the real route ─────────────────

describe("request validation on blog routes", () => {
  it("rejects a title under 5 characters", async () => {
    const { token } = await signedInAs("Player");

    const response = await request(app)
      .post("/api/community/blog/posts")
      .set("Authorization", `Bearer ${token}`)
      .send(validCreatePayload({ title: "Hi" }));

    assert.equal(response.status, 400);
  });

  it("rejects more than 8 tags", async () => {
    const { token } = await signedInAs("Player");

    const response = await request(app)
      .post("/api/community/blog/posts")
      .set("Authorization", `Bearer ${token}`)
      .send(validCreatePayload({ tags: Array.from({ length: 9 }, (_, i) => `tag${i}`) }));

    assert.equal(response.status, 400);
  });
});

// ───────────────── create / read ─────────────────

describe("creating and reading a blog post over HTTP", () => {
  it("publishes a blog end to end and returns it with an author", async () => {
    const { userId, token } = await signedInAs("Player");

    const response = await request(app)
      .post("/api/community/blog/posts")
      .set("Authorization", `Bearer ${token}`)
      .send(validCreatePayload());

    assert.equal(response.status, 201, JSON.stringify(response.body));
    assert.equal(response.body.data.title, "How I trained for my first tournament");
    assert.equal(response.body.data.status, "PUBLISHED");
    assert.equal(response.body.data.author.id, userId.toString());
  });

  it("rejects publishing for a role the community blog is not available to", async () => {
    // BlogService.ensureCommunityUser restricts to Player/Coach/Parent —
    // getStatusCode maps "only for" onto 400, not the default 500.
    const { token } = await signedInAs("Venue");

    const response = await request(app)
      .post("/api/community/blog/posts")
      .set("Authorization", `Bearer ${token}`)
      .send(validCreatePayload());

    assert.equal(response.status, 400);
  });

  it("creates as a draft when status: DRAFT is sent", async () => {
    const { token } = await signedInAs("Coach");

    const response = await request(app)
      .post("/api/community/blog/posts")
      .set("Authorization", `Bearer ${token}`)
      .send(validCreatePayload({ status: "DRAFT" }));

    assert.equal(response.status, 201);
    assert.equal(response.body.data.status, "DRAFT");
  });

  it("hides another author's draft behind a 404, not a 403", async () => {
    const author = await signedInAs("Player");
    const createResponse = await request(app)
      .post("/api/community/blog/posts")
      .set("Authorization", `Bearer ${author.token}`)
      .send(validCreatePayload({ status: "DRAFT" }));
    const blogId = createResponse.body.data.id;

    const viewer = await signedInAs("Parent");
    const response = await request(app)
      .get(`/api/community/blog/posts/${blogId}`)
      .set("Authorization", `Bearer ${viewer.token}`);

    assert.equal(response.status, 404);
  });

  it("lets the author read their own draft", async () => {
    const author = await signedInAs("Player");
    const createResponse = await request(app)
      .post("/api/community/blog/posts")
      .set("Authorization", `Bearer ${author.token}`)
      .send(validCreatePayload({ status: "DRAFT" }));
    const blogId = createResponse.body.data.id;

    const response = await request(app)
      .get(`/api/community/blog/posts/${blogId}`)
      .set("Authorization", `Bearer ${author.token}`);

    assert.equal(response.status, 200);
    assert.equal(response.body.data.isMine, true);
  });

  it("includes the author's own drafts only when mine=true, never in the public feed", async () => {
    const author = await signedInAs("Player");
    await request(app)
      .post("/api/community/blog/posts")
      .set("Authorization", `Bearer ${author.token}`)
      .send(validCreatePayload({ title: "Draft post to hide", status: "DRAFT" }));

    const publicFeed = await request(app).get("/api/community/blog/posts");
    assert.equal(publicFeed.body.data.items.length, 0);

    const mineFeed = await request(app)
      .get("/api/community/blog/posts?mine=true")
      .set("Authorization", `Bearer ${author.token}`);
    assert.equal(mineFeed.body.data.items.length, 1);
  });
});

// ───────────────── update / delete ─────────────────

describe("updating and deleting a blog post over HTTP", () => {
  const createPublished = async (token: string) => {
    const response = await request(app)
      .post("/api/community/blog/posts")
      .set("Authorization", `Bearer ${token}`)
      .send(validCreatePayload());
    return response.body.data.id as string;
  };

  it("lets the author update their own post", async () => {
    const { token } = await signedInAs("Player");
    const blogId = await createPublished(token);

    const response = await request(app)
      .patch(`/api/community/blog/posts/${blogId}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ title: "Updated: how I trained" });

    assert.equal(response.status, 200, JSON.stringify(response.body));
    assert.equal(response.body.data.title, "Updated: how I trained");
  });

  it("refuses a non-author's update with 403", async () => {
    const author = await signedInAs("Player");
    const blogId = await createPublished(author.token);

    const stranger = await signedInAs("Coach");
    const response = await request(app)
      .patch(`/api/community/blog/posts/${blogId}`)
      .set("Authorization", `Bearer ${stranger.token}`)
      .send({ title: "Hijacked title" });

    assert.equal(response.status, 403);

    const untouched = await BlogPost.findById(blogId);
    assert.equal(untouched.title, "How I trained for my first tournament");
  });

  it("soft-deletes so the post 404s afterward but the row survives", async () => {
    const { token } = await signedInAs("Player");
    const blogId = await createPublished(token);

    const deleteResponse = await request(app)
      .delete(`/api/community/blog/posts/${blogId}`)
      .set("Authorization", `Bearer ${token}`);
    assert.equal(deleteResponse.status, 200);

    const getResponse = await request(app).get(`/api/community/blog/posts/${blogId}`);
    assert.equal(getResponse.status, 404);

    const stillInDb = await BlogPost.findById(blogId);
    assert.ok(stillInDb, "soft delete must not remove the document");
    assert.equal(stillInDb.isDeleted, true);
  });

  it("refuses a non-author's delete with 403", async () => {
    const author = await signedInAs("Player");
    const blogId = await createPublished(author.token);

    const stranger = await signedInAs("Coach");
    const response = await request(app)
      .delete(`/api/community/blog/posts/${blogId}`)
      .set("Authorization", `Bearer ${stranger.token}`);

    assert.equal(response.status, 403);
  });
});

// ───────────────── likes ─────────────────

describe("liking a blog post over HTTP", () => {
  it("toggles a like on and back off", async () => {
    const author = await signedInAs("Player");
    const createResponse = await request(app)
      .post("/api/community/blog/posts")
      .set("Authorization", `Bearer ${author.token}`)
      .send(validCreatePayload());
    const blogId = createResponse.body.data.id;

    const liker = await signedInAs("Coach");

    const likeResponse = await request(app)
      .post("/api/community/blog/likes")
      .set("Authorization", `Bearer ${liker.token}`)
      .send({ targetType: "BLOG", targetId: blogId });
    assert.equal(likeResponse.status, 200);
    assert.equal(likeResponse.body.data.liked, true);
    assert.equal(likeResponse.body.data.likeCount, 1);

    const unlikeResponse = await request(app)
      .post("/api/community/blog/likes")
      .set("Authorization", `Bearer ${liker.token}`)
      .send({ targetType: "BLOG", targetId: blogId });
    assert.equal(unlikeResponse.body.data.liked, false);
    assert.equal(unlikeResponse.body.data.likeCount, 0);
  });
});

// ───────────────── comments ─────────────────

describe("commenting on a blog post over HTTP", () => {
  const createPublished = async (token: string) => {
    const response = await request(app)
      .post("/api/community/blog/posts")
      .set("Authorization", `Bearer ${token}`)
      .send(validCreatePayload());
    return response.body.data.id as string;
  };

  it("posts a comment and it shows up in the comment list", async () => {
    const author = await signedInAs("Player");
    const blogId = await createPublished(author.token);

    const commenter = await signedInAs("Parent");
    const postResponse = await request(app)
      .post(`/api/community/blog/posts/${blogId}/comments`)
      .set("Authorization", `Bearer ${commenter.token}`)
      .send({ content: "This is a great read, thank you for sharing." });

    assert.equal(postResponse.status, 201, JSON.stringify(postResponse.body));

    const listResponse = await request(app).get(`/api/community/blog/posts/${blogId}/comments`);
    assert.equal(listResponse.body.data.items.length, 1);
    assert.equal(
      listResponse.body.data.items[0].content,
      "This is a great read, thank you for sharing."
    );
  });

  it("rejects an empty comment", async () => {
    const author = await signedInAs("Player");
    const blogId = await createPublished(author.token);

    const response = await request(app)
      .post(`/api/community/blog/posts/${blogId}/comments`)
      .set("Authorization", `Bearer ${author.token}`)
      .send({ content: "" });

    assert.equal(response.status, 400);
  });

  it("refuses a non-author's comment deletion with 403", async () => {
    const author = await signedInAs("Player");
    const blogId = await createPublished(author.token);

    const commenter = await signedInAs("Parent");
    const postResponse = await request(app)
      .post(`/api/community/blog/posts/${blogId}/comments`)
      .set("Authorization", `Bearer ${commenter.token}`)
      .send({ content: "Nice write-up overall, learned a lot." });
    const commentId = postResponse.body.data.id;

    const stranger = await signedInAs("Coach");
    const deleteResponse = await request(app)
      .delete(`/api/community/blog/comments/${commentId}`)
      .set("Authorization", `Bearer ${stranger.token}`);

    assert.equal(deleteResponse.status, 403);
  });
});
