/* eslint-disable @typescript-eslint/no-var-requires */
// HTTP-level tests for the community blog routes.
//
// blogController.ts and BlogService.ts had zero test coverage at any layer
// before this file (per a Phase 5 testing-plan audit) — the only blog-adjacent
// test seeded Experience documents directly to exercise search indexing, never
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
const { Experience } = require("../community/models/Experience");
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
  for (const name of [
    "users",
    "experiences",
    "experiencecomments",
    "experiencelikes",
    "communityprofiles",
    "coaches",
  ]) {
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

    const untouched = await Experience.findById(blogId);
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

    const stillInDb = await Experience.findById(blogId);
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

describe("anchoring an experience to a subject", () => {
  const tournamentId = oid();

  const tournamentSubject = () => ({
    kind: "TOURNAMENT",
    refId: String(tournamentId),
    nameSnapshot: "Delhi U-14 Open",
    slugSnapshot: "delhi-u14-open",
  });

  const coachSubject = () => ({
    kind: "COACH",
    refId: String(oid()),
    nameSnapshot: "Coach Mehta",
    slugSnapshot: null,
  });

  it("publishes immediately when anchored to an event, and returns the subject", async () => {
    const { token } = await signedInAs("Player");

    const response = await request(app)
      .post("/api/community/blog/posts")
      .set("Authorization", `Bearer ${token}`)
      .send(
        validCreatePayload({
          subject: tournamentSubject(),
          signals: { organisation: "GOOD", facilities: "OKAY" },
          attendedAt: "2026-08-01T00:00:00.000Z",
        })
      );

    assert.equal(response.status, 201);
    assert.equal(response.body.data.moderationStatus, "APPROVED");
    assert.deepEqual(response.body.data.subject, {
      kind: "TOURNAMENT",
      refId: String(tournamentId),
      name: "Delhi U-14 Open",
      slug: "delhi-u14-open",
    });
    assert.equal(response.body.data.signals.organisation, "GOOD");

    // Visible in the open feed right away — no review needed for an event.
    const feed = await request(app).get("/api/community/blog/posts");
    assert.ok(feed.body.data.items.some((item: { id: string }) => item.id === response.body.data.id)); // prettier-ignore
  });

  it("drops a signal key that does not belong to the subject's kind", async () => {
    const { token } = await signedInAs("Player");

    const response = await request(app)
      .post("/api/community/blog/posts")
      .set("Authorization", `Bearer ${token}`)
      .send(
        validCreatePayload({
          subject: tournamentSubject(),
          // "coachingQuality" is a COACH/ACADEMY signal, not a TOURNAMENT one.
          signals: { organisation: "GOOD", coachingQuality: "POOR" },
        })
      );

    assert.equal(response.status, 201);
    assert.equal(response.body.data.signals.organisation, "GOOD");
    assert.equal(response.body.data.signals.coachingQuality, undefined);
  });

  it("holds a coach-anchored experience for review and hides it from the public feed", async () => {
    const author = await signedInAs("Player");

    const response = await request(app)
      .post("/api/community/blog/posts")
      .set("Authorization", `Bearer ${author.token}`)
      .send(validCreatePayload({ subject: coachSubject() }));

    assert.equal(response.status, 201);
    assert.equal(response.body.data.moderationStatus, "PENDING");
    const experienceId = response.body.data.id;

    // Not in the open feed for anyone else...
    const publicFeed = await request(app).get("/api/community/blog/posts");
    assert.ok(!publicFeed.body.data.items.some((item: { id: string }) => item.id === experienceId));

    // ...and not fetchable by another visitor either, same treatment as a
    // draft that belongs to someone else.
    const viewer = await signedInAs("Parent");
    const viewerRead = await request(app)
      .get(`/api/community/blog/posts/${experienceId}`)
      .set("Authorization", `Bearer ${viewer.token}`);
    assert.equal(viewerRead.status, 404);

    // ...but the author can still see their own pending experience, both by
    // id and in their own "mine" feed.
    const authorRead = await request(app)
      .get(`/api/community/blog/posts/${experienceId}`)
      .set("Authorization", `Bearer ${author.token}`);
    assert.equal(authorRead.status, 200);
    assert.equal(authorRead.body.data.moderationStatus, "PENDING");

    const mineFeed = await request(app)
      .get("/api/community/blog/posts?mine=true")
      .set("Authorization", `Bearer ${author.token}`);
    assert.ok(mineFeed.body.data.items.some((item: { id: string }) => item.id === experienceId));
  });

  it("moves back to APPROVED when a coach anchor is removed on edit", async () => {
    const { token } = await signedInAs("Player");

    const createResponse = await request(app)
      .post("/api/community/blog/posts")
      .set("Authorization", `Bearer ${token}`)
      .send(validCreatePayload({ subject: coachSubject() }));
    const experienceId = createResponse.body.data.id;
    assert.equal(createResponse.body.data.moderationStatus, "PENDING");

    const updateResponse = await request(app)
      .patch(`/api/community/blog/posts/${experienceId}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ subject: null });

    assert.equal(updateResponse.status, 200);
    assert.equal(updateResponse.body.data.subject, null);
    assert.equal(updateResponse.body.data.moderationStatus, "APPROVED");

    const feed = await request(app).get("/api/community/blog/posts");
    assert.ok(feed.body.data.items.some((item: { id: string }) => item.id === experienceId));
  });

  it("moves to PENDING when a coach anchor is added on edit to an approved post", async () => {
    const { token } = await signedInAs("Player");
    const createResponse = await request(app)
      .post("/api/community/blog/posts")
      .set("Authorization", `Bearer ${token}`)
      .send(validCreatePayload());
    const experienceId = createResponse.body.data.id;
    assert.equal(createResponse.body.data.moderationStatus, "APPROVED");

    const updateResponse = await request(app)
      .patch(`/api/community/blog/posts/${experienceId}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ subject: coachSubject() });

    assert.equal(updateResponse.status, 200);
    assert.equal(updateResponse.body.data.moderationStatus, "PENDING");
  });

  it("ignores a malformed subject rather than failing the request", async () => {
    const { token } = await signedInAs("Player");

    const response = await request(app)
      .post("/api/community/blog/posts")
      .set("Authorization", `Bearer ${token}`)
      .send(
        validCreatePayload({
          subject: { kind: "TOURNAMENT", refId: "not-an-object-id", nameSnapshot: "X" },
        })
      );

    assert.equal(response.status, 201);
    assert.equal(response.body.data.subject, null);
    assert.equal(response.body.data.moderationStatus, "APPROVED");
  });

  it("publishes with no title at all, deriving one from the content", async () => {
    const { token } = await signedInAs("Player");

    const response = await request(app)
      .post("/api/community/blog/posts")
      .set("Authorization", `Bearer ${token}`)
      .send({
        content:
          "<p>Two lines and a photo is enough. This was a good week for footwork drills.</p>",
      });

    assert.equal(response.status, 201);
    assert.equal(response.body.data.title, "Two lines and a photo is enough.");
  });
});

describe("the right of reply", () => {
  const coachSubject = (coachId: unknown) => ({
    kind: "COACH",
    refId: String(coachId),
    nameSnapshot: "Coach Mehta",
    slugSnapshot: null,
  });

  /** A COACH-anchored experience, already past moderation. */
  const createApprovedCoachExperience = async (authorToken: string, coachId: unknown) => {
    const createResponse = await request(app)
      .post("/api/community/blog/posts")
      .set("Authorization", `Bearer ${authorToken}`)
      .send(validCreatePayload({ subject: coachSubject(coachId) }));
    const experienceId = createResponse.body.data.id;

    // Simulate the admin approval from Phase 6's moderation queue directly —
    // that endpoint has its own coverage; this test is about the reply, not
    // moderation.
    await Experience.updateOne({ _id: experienceId }, { $set: { moderationStatus: "APPROVED" } });
    return experienceId;
  };

  it("offers canReply only to the exact person the subject names", async () => {
    const author = await signedInAs("Player");
    const namedCoach = await signedInAs("Coach");
    const someoneElse = await signedInAs("Coach");

    const coachId = oid();
    await mongoose.connection.db
      .collection("coaches")
      .insertOne({ _id: coachId, userId: namedCoach.userId, isVerified: true });

    const experienceId = await createApprovedCoachExperience(author.token, coachId);

    const asNamedCoach = await request(app)
      .get(`/api/community/blog/posts/${experienceId}`)
      .set("Authorization", `Bearer ${namedCoach.token}`);
    assert.equal(asNamedCoach.body.data.canReply, true);

    const asSomeoneElse = await request(app)
      .get(`/api/community/blog/posts/${experienceId}`)
      .set("Authorization", `Bearer ${someoneElse.token}`);
    assert.equal(asSomeoneElse.body.data.canReply, false);

    const asAuthor = await request(app)
      .get(`/api/community/blog/posts/${experienceId}`)
      .set("Authorization", `Bearer ${author.token}`);
    assert.equal(asAuthor.body.data.canReply, false);

    const anonymous = await request(app).get(`/api/community/blog/posts/${experienceId}`);
    assert.equal(anonymous.body.data.canReply, false);
  });

  it("lets the named coach post one reply, and shows it to everyone", async () => {
    const author = await signedInAs("Player");
    const namedCoach = await signedInAs("Coach");

    const coachId = oid();
    await mongoose.connection.db
      .collection("coaches")
      .insertOne({ _id: coachId, userId: namedCoach.userId, isVerified: true });

    const experienceId = await createApprovedCoachExperience(author.token, coachId);

    const replyResponse = await request(app)
      .post(`/api/community/experiences/posts/${experienceId}/reply`)
      .set("Authorization", `Bearer ${namedCoach.token}`)
      .send({ content: "Thanks for the feedback — we've since fixed our sign-up process." });

    assert.equal(replyResponse.status, 200);
    assert.equal(
      replyResponse.body.data.subjectReply.content,
      "Thanks for the feedback — we've since fixed our sign-up process."
    );
    assert.equal(replyResponse.body.data.subjectReply.authorName, "Test Coach");
    assert.equal(replyResponse.body.data.canReply, false);

    // Visible to an anonymous visitor too — this is a public response, not a
    // private note.
    const anonymousRead = await request(app).get(`/api/community/blog/posts/${experienceId}`);
    assert.equal(
      anonymousRead.body.data.subjectReply.content,
      "Thanks for the feedback — we've since fixed our sign-up process."
    );
  });

  it("refuses a second reply", async () => {
    const author = await signedInAs("Player");
    const namedCoach = await signedInAs("Coach");

    const coachId = oid();
    await mongoose.connection.db
      .collection("coaches")
      .insertOne({ _id: coachId, userId: namedCoach.userId, isVerified: true });

    const experienceId = await createApprovedCoachExperience(author.token, coachId);

    await request(app)
      .post(`/api/community/experiences/posts/${experienceId}/reply`)
      .set("Authorization", `Bearer ${namedCoach.token}`)
      .send({ content: "First reply." });

    const second = await request(app)
      .post(`/api/community/experiences/posts/${experienceId}/reply`)
      .set("Authorization", `Bearer ${namedCoach.token}`)
      .send({ content: "Trying again." });

    assert.equal(second.status, 409);
  });

  it("refuses a reply from anyone other than the named coach", async () => {
    const author = await signedInAs("Player");
    const namedCoach = await signedInAs("Coach");
    const impostor = await signedInAs("Coach");

    const coachId = oid();
    await mongoose.connection.db
      .collection("coaches")
      .insertOne({ _id: coachId, userId: namedCoach.userId, isVerified: true });

    const experienceId = await createApprovedCoachExperience(author.token, coachId);

    const response = await request(app)
      .post(`/api/community/experiences/posts/${experienceId}/reply`)
      .set("Authorization", `Bearer ${impostor.token}`)
      .send({ content: "That's not what happened." });

    assert.equal(response.status, 403);
  });

  it("rejects an empty reply", async () => {
    const author = await signedInAs("Player");
    const namedCoach = await signedInAs("Coach");

    const coachId = oid();
    await mongoose.connection.db
      .collection("coaches")
      .insertOne({ _id: coachId, userId: namedCoach.userId, isVerified: true });

    const experienceId = await createApprovedCoachExperience(author.token, coachId);

    const response = await request(app)
      .post(`/api/community/experiences/posts/${experienceId}/reply`)
      .set("Authorization", `Bearer ${namedCoach.token}`)
      .send({ content: "   " });

    assert.equal(response.status, 400);
  });
});

describe("reporting an experience", () => {
  it("accepts a report against a real experience", async () => {
    const author = await signedInAs("Player");
    const reporter = await signedInAs("Parent");

    const createResponse = await request(app)
      .post("/api/community/blog/posts")
      .set("Authorization", `Bearer ${author.token}`)
      .send(validCreatePayload());
    const experienceId = createResponse.body.data.id;

    const response = await request(app)
      .post("/api/community/reports")
      .set("Authorization", `Bearer ${reporter.token}`)
      .send({ targetType: "EXPERIENCE", targetId: experienceId, reason: "Inappropriate content" });

    assert.equal(response.status, 201);
    assert.equal(response.body.data.targetType, "EXPERIENCE");
  });

  it("refuses a report against a made-up experience id", async () => {
    const { token } = await signedInAs("Parent");

    const response = await request(app)
      .post("/api/community/reports")
      .set("Authorization", `Bearer ${token}`)
      .send({ targetType: "EXPERIENCE", targetId: String(oid()), reason: "Spam" });

    // "experience not found" maps to 404 via the shared getStatusCode
    // classifier (community/controllers/communityController/shared.ts) — the
    // same rule every other "X not found" report-target error already uses.
    assert.equal(response.status, 404);
  });
});
