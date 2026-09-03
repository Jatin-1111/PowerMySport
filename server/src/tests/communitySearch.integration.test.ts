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
const { BlogPost } = require("../community/models/BlogPost");
const { CommunityService } = require("../community/services/CommunityService");
const migration27 = require("../migrations/27_widen_blog_text_index");

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
  BlogPost.create({
    authorId,
    title,
    excerpt,
    content,
    topic: "Training",
    tags: ["tennis"],
    status: "PUBLISHED",
  });

before(async () => {
  memoryServer = await MongoMemoryServer.create();
  await mongoose.connect(memoryServer.getUri());
  // Text indexes are declared on the schemas; build them before searching.
  await Promise.all([CommunityPost.syncIndexes(), BlogPost.syncIndexes()]);
});

after(async () => {
  await mongoose.disconnect();
  await memoryServer.stop();
});

beforeEach(async () => {
  await Promise.all([CommunityPost.deleteMany({}), BlogPost.deleteMany({})]);
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
    await BlogPost.create({
      authorId,
      title: "Draft racket story",
      excerpt: "Not published yet",
      content: "<p>A racket story still in draft.</p>",
      topic: "Training",
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
    await BlogPost.collection.dropIndexes();

    const { items } = await CommunityService.searchCommunity(undefined, "racket");

    assert.ok(items.length > 0, "questions should still come back");
    assert.ok(
      items.every((item: { kind: string }) => item.kind === "POST"),
      "only questions can answer while the blog index is gone"
    );

    await BlogPost.syncIndexes();
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

describe("migration 27: widen the blog text index", () => {
  const textIndexNames = async () => {
    const indexes = await BlogPost.collection.indexes();
    return indexes
      .filter((index: { key: Record<string, unknown> }) =>
        Object.values(index.key || {}).includes("text")
      )
      .map((index: { name: string }) => index.name);
  };

  it("replaces the old index rather than adding a second one", async () => {
    // MongoDB permits exactly one text index per collection, which is the
    // whole reason this needs a migration instead of a model edit.
    await BlogPost.collection.dropIndexes();
    await BlogPost.collection.createIndex({
      title: "text",
      excerpt: "text",
      tags: "text",
    });

    await migration27.up({ apply: true });

    const names = await textIndexNames();
    assert.equal(names.length, 1);
    assert.equal(names[0], "blog_search_v2");
  });

  it("does nothing on a second run", async () => {
    await migration27.up({ apply: true });
    await migration27.up({ apply: true });

    const names = await textIndexNames();
    assert.deepEqual(names, ["blog_search_v2"]);
  });

  it("writes nothing on a dry run", async () => {
    await BlogPost.collection.dropIndexes();
    await BlogPost.collection.createIndex({
      title: "text",
      excerpt: "text",
      tags: "text",
    });

    await migration27.up({});

    const names = await textIndexNames();
    assert.ok(!names.includes("blog_search_v2"));
  });
});
