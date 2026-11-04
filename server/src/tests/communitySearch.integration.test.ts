/* eslint-disable @typescript-eslint/no-var-requires */
// Integration tests for community search. In-memory MongoDB — local dev points
// at the live cluster, so a test on the default connection would write to
// production.
process.env.JWT_SECRET = "test-secret-test-secret-test-secret-1234567890";

import assert = require("node:assert/strict");
const { after, before, beforeEach, describe, it } = require("node:test");
const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");

const { CommunityPost } = require("../community/models/CommunityPost");
const { Experience } = require("../community/models/Experience");
const { ExperienceComment } = require("../community/models/ExperienceComment");
const { ExperienceLike } = require("../community/models/ExperienceLike");
const { CommunityService } = require("../community/services/CommunityService");
const migration39 = require("../migrations/39_blog_to_experience");

let memoryServer: { getUri(): string; stop(): Promise<void> };

const authorId = new mongoose.Types.ObjectId();

const seedPost = (title: string, body: string, extra = {}) =>
  CommunityPost.create({
    authorId,
    title,
    body,
    tags: ["tennis"],
    category: "General",
    status: "OPEN",
    ...extra,
  });

const seedBlog = (title: string, excerpt: string, content: string) =>
  Experience.create({
    authorId,
    title,
    excerpt,
    content,
    category: "training",
    tags: ["tennis"],
    status: "PUBLISHED",
  });

before(async () => {
  memoryServer = await MongoMemoryServer.create();
  await mongoose.connect(memoryServer.getUri());
  // Text indexes are declared on the schemas; build them before searching.
  await Promise.all([CommunityPost.syncIndexes(), Experience.syncIndexes()]);
});

after(async () => {
  await mongoose.disconnect();
  await memoryServer.stop();
});

beforeEach(async () => {
  await Promise.all([CommunityPost.deleteMany({}), Experience.deleteMany({})]);
});

describe("community search", () => {
  it("finds a question by a word in its body", async () => {
    await seedPost(
      "Racket advice for a beginner",
      "We are looking at a graphite frame for a nine year old."
    );

    const { items } = await CommunityService.searchCommunity(undefined, "graphite");
    assert.equal(items.length, 1);
    assert.equal(items[0].kind, "POST");
  });

  it("finds a story by a word in the article body", async () => {
    await seedBlog(
      "A season of small wins",
      "Notes from a year on court",
      "<p>The turning point was a drill we called the ladder shuffle.</p>"
    );

    const { items } = await CommunityService.searchCommunity(undefined, "ladder shuffle");
    // The old index covered title/excerpt/tags only, so this found nothing.
    assert.equal(items.length, 1);
    assert.equal(items[0].kind, "BLOG");
  });

  it("returns questions and stories together", async () => {
    await seedPost("Badminton racket advice", "Which badminton racket suits a beginner?");
    await seedBlog(
      "Badminton beginnings",
      "How we started with badminton",
      "<p>Badminton was the sport that stuck.</p>"
    );

    const { items } = await CommunityService.searchCommunity(undefined, "badminton");
    const kinds = new Set(items.map((item: { kind: string }) => item.kind));
    assert.ok(kinds.has("POST"));
    assert.ok(kinds.has("BLOG"));
  });

  it("can be narrowed to one kind", async () => {
    await seedPost("Badminton racket advice", "Which badminton racket suits a beginner?");
    await seedBlog(
      "Badminton beginnings",
      "How we started with badminton",
      "<p>Badminton was the sport that stuck.</p>"
    );

    const posts = await CommunityService.searchCommunity(undefined, "badminton", {
      type: "POST",
    });
    const blogs = await CommunityService.searchCommunity(undefined, "badminton", {
      type: "BLOG",
    });

    assert.ok(posts.items.every((item: { kind: string }) => item.kind === "POST"));
    assert.ok(blogs.items.every((item: { kind: string }) => item.kind === "BLOG"));
  });

  it("leaves deleted and unpublished content out", async () => {
    await seedPost("Deleted racket question", "A racket question that was removed.", {
      isDeleted: true,
    });
    await Experience.create({
      authorId,
      title: "Draft racket story",
      excerpt: "Not published yet",
      content: "<p>A racket story still in draft.</p>",
      category: "training",
      status: "DRAFT",
    });

    const { items } = await CommunityService.searchCommunity(undefined, "racket");
    assert.equal(items.length, 0);
  });

  it("ignores a query below the floor", async () => {
    await seedPost("Racket advice", "A body about rackets.");

    const { items } = await CommunityService.searchCommunity(undefined, "a");
    // Below two characters, a query matches most of the corpus; the results
    // are noise and the scan is not worth running.
    assert.equal(items.length, 0);
  });

  it("strips markup out of story snippets", async () => {
    await seedBlog(
      "Formatting heavy story",
      "",
      "<p>The <strong>ladder shuffle</strong> drill&nbsp;worked.</p>"
    );

    const { items } = await CommunityService.searchCommunity(undefined, "ladder shuffle");
    assert.ok(!items[0].snippet.includes("<"), "snippet must not carry markup");
    assert.ok(items[0].snippet.includes("ladder shuffle"));
  });

  it("marks a solved question in the results", async () => {
    const post = await seedPost("Solved racket question", "A racket question that got answered.");
    await CommunityPost.updateOne(
      { _id: post._id },
      { $set: { acceptedAnswerId: new mongoose.Types.ObjectId() } }
    );

    const { items } = await CommunityService.searchCommunity(undefined, "racket");
    assert.equal(items[0].isSolved, true);
  });

  it("still returns questions when the blog index is missing", async () => {
    await seedPost("Racket advice", "A question about rackets.");
    await seedBlog("Racket story", "About rackets", "<p>Rackets again.</p>");

    // A `$text` query with no text index is rejected by MongoDB, not degraded
    // to a scan. Both halves run in one Promise.all, so without per-side
    // handling an unbuilt or mid-rebuild blog index takes down the whole
    // endpoint — including the questions that could have answered.
    await Experience.collection.dropIndexes();

    const { items } = await CommunityService.searchCommunity(undefined, "racket");

    assert.ok(items.length > 0, "questions should still come back");
    assert.ok(
      items.every((item: { kind: string }) => item.kind === "POST"),
      "only questions can answer while the blog index is gone"
    );

    await Experience.syncIndexes();
  });

  it("respects the result limit", async () => {
    for (let i = 0; i < 8; i += 1) {
      await seedPost(`Racket question ${i}`, "Another question about rackets.");
    }

    const { items } = await CommunityService.searchCommunity(undefined, "racket", {
      limit: 3,
    });
    assert.equal(items.length, 3);
  });
});

describe("migration 39: blog -> experience", () => {
  const db = () => mongoose.connection.db;

  const legacyBlog = (overrides = {}) => ({
    authorId,
    title: "Racket story",
    excerpt: "About rackets",
    content: "<p>Rackets again.</p>",
    topic: "Training",
    tags: ["tennis"],
    status: "PUBLISHED",
    likeCount: 0,
    commentCount: 0,
    viewCount: 0,
    isDeleted: false,
    createdAt: new Date("2026-04-01T00:00:00.000Z"),
    updatedAt: new Date("2026-04-01T00:00:00.000Z"),
    ...overrides,
  });

  /** Rebuild the pre-migration world: blog-named collections, blog-shaped rows. */
  const seedLegacy = async () => {
    for (const name of [
      "experiences",
      "experiencecomments",
      "experiencelikes",
      "blogposts",
      "blogcomments",
      "bloglikes",
    ]) {
      await db()
        .collection(name)
        .drop()
        .catch(() => {});
    }

    const posts = db().collection("blogposts");
    await posts.insertMany([
      legacyBlog(),
      legacyBlog({ title: "Court report", topic: "Tennis" }),
      legacyBlog({ title: "New shoes", topic: "Gear" }),
    ]);
    await posts.createIndex(
      { title: "text", excerpt: "text", tags: "text", content: "text" },
      { name: "blog_search_v2", weights: { title: 10, tags: 6, excerpt: 4, content: 1 } }
    );
    await posts.createIndex({ topic: 1, createdAt: -1 });

    const blogId = (await posts.findOne({ title: "Racket story" }))!._id;
    await db()
      .collection("blogcomments")
      .insertOne({ blogId, authorId, content: "Agreed", parentId: null, isDeleted: false });
    await db()
      .collection("bloglikes")
      .insertOne({ userId: authorId, targetType: "BLOG", targetId: blogId });
  };

  const textIndexNames = async (collection: string) => {
    const indexes = await db().collection(collection).indexes();
    return indexes
      .filter((index: { key: Record<string, unknown> }) =>
        Object.values(index.key || {}).includes("text")
      )
      .map((index: { name: string }) => index.name);
  };

  beforeEach(seedLegacy);

  after(async () => {
    // Later files share the process; leave the collections as the models expect.
    await Experience.syncIndexes();
  });

  it("renames the collections and moves every row across", async () => {
    await migration39.up({ apply: true });

    const names = new Set(
      (await db().listCollections({}, { nameOnly: true }).toArray()).map(
        (entry: { name: string }) => entry.name
      )
    );
    assert.ok(names.has("experiences"), "blogposts should now be experiences");
    assert.ok(!names.has("blogposts"), "the old collection should be gone");
    assert.equal(await Experience.countDocuments({}), 3);
    assert.equal(await ExperienceComment.countDocuments({}), 1);
    assert.equal(await ExperienceLike.countDocuments({}), 1);
  });

  it("splits topic into sport and category without losing a value", async () => {
    await migration39.up({ apply: true });

    const bySport = await Experience.findOne({ title: "Court report" }).lean();
    assert.equal(bySport.sport, "Tennis", "a sport topic becomes the sport");
    assert.equal(bySport.category, "general");

    const byTheme = await Experience.findOne({ title: "Racket story" }).lean();
    assert.equal(byTheme.sport, null, "a themed topic is not a sport");
    assert.equal(byTheme.category, "training");

    const gear = await Experience.findOne({ title: "New shoes" }).lean();
    assert.equal(gear.category, "gear");

    const leftovers = await db()
      .collection("experiences")
      .countDocuments({ topic: { $exists: true } });
    assert.equal(leftovers, 0, "topic should be unset once it has been split");
  });

  it("backfills the new fields and dates attendance from the write date", async () => {
    await migration39.up({ apply: true });

    const doc = await Experience.findOne({ title: "Racket story" }).lean();
    assert.equal(doc.subject, null);
    assert.equal(doc.moderationStatus, "APPROVED");
    assert.deepEqual(doc.attendedAt, doc.createdAt);
  });

  it("renames blogId on comments and rewrites BLOG likes", async () => {
    await migration39.up({ apply: true });

    const comment = await db().collection("experiencecomments").findOne({});
    assert.ok(comment.experienceId, "the comment should point at an experienceId");
    assert.equal(comment.blogId, undefined, "the old field should be gone");

    const like = await db().collection("experiencelikes").findOne({});
    assert.equal(like.targetType, "EXPERIENCE");
  });

  it("leaves exactly one text index — the new one", async () => {
    await migration39.up({ apply: true });

    // MongoDB permits exactly one text index per collection, which is the whole
    // reason this is a migration and not a model edit.
    assert.deepEqual(await textIndexNames("experiences"), ["experience_search_v1"]);
  });

  it("drops the indexes whose fields no longer exist", async () => {
    await migration39.up({ apply: true });

    const indexes = await db().collection("experiences").indexes();
    const names = indexes.map((index: { name: string }) => index.name);
    assert.ok(!names.includes("topic_1_createdAt_-1"), "the topic index should be gone");
    assert.ok(names.includes("subject_feed"), "the entity-page index should exist");
  });

  it("does nothing on a second run", async () => {
    await migration39.up({ apply: true });
    await migration39.up({ apply: true });

    assert.equal(await Experience.countDocuments({}), 3);
    assert.deepEqual(await textIndexNames("experiences"), ["experience_search_v1"]);
  });

  it("writes nothing on a dry run", async () => {
    await migration39.up({});

    const names = new Set(
      (await db().listCollections({}, { nameOnly: true }).toArray()).map(
        (entry: { name: string }) => entry.name
      )
    );
    assert.ok(names.has("blogposts"), "the dry run must not rename anything");
    assert.ok(!names.has("experiences"));
  });

  it("reverses cleanly", async () => {
    await migration39.up({ apply: true });
    await migration39.down({ apply: true });

    const posts = await db().collection("blogposts").find({}).toArray();
    assert.equal(posts.length, 3);
    const topics = posts.map((post: { topic: string }) => post.topic).sort();
    assert.deepEqual(topics, ["Gear", "Tennis", "Training"]);

    const like = await db().collection("bloglikes").findOne({});
    assert.equal(like.targetType, "BLOG");
  });
});
