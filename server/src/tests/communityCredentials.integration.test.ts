/* eslint-disable @typescript-eslint/no-var-requires */
// Integration tests for community credential badges. In-memory MongoDB — local
// dev points at the live cluster, so a test on the default connection would
// write to production.
process.env.JWT_SECRET = "test-secret-test-secret-test-secret-1234567890";

import assert = require("node:assert/strict");
const { after, before, beforeEach, describe, it } = require("node:test");
const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");

const { CommunityPost } = require("../community/models/CommunityPost");
const { CommunityAnswer } = require("../community/models/CommunityAnswer");
const { CommunityService } = require("../community/services/CommunityService");
const {
  resolveCommunityCredentials,
} = require("../community/services/communityCredentials");
const { User } = require("../client/models/User");
const { Coach } = require("../client/models/Coach");
const { Expert } = require("../client/models/ExpertProfile");

let memoryServer: { getUri(): string; stop(): Promise<void> };

let seq = 0;
const createUser = async (name: string, role = "Parent") => {
  seq += 1;
  const user = await User.create({
    name,
    email: `cred-${seq}@example.com`,
    phone: `914000${String(seq).padStart(4, "0")}`,
    password: "test-password",
    role,
  });
  return String(user._id);
};

const makeCoach = (userId: string, isVerified: boolean) =>
  Coach.create({
    userId,
    bio: "Coaching juniors for a decade.",
    sports: ["Tennis"],
    hourlyRate: 500,
    serviceMode: "FREELANCE",
    isVerified,
  });

const makeExpert = (
  userId: string,
  verificationStatus: string,
  isActive: boolean,
) =>
  Expert.create({
    userId,
    bio: "Pathway guidance for junior athletes.",
    sports: ["Tennis"],
    expertise: ["Pathway"],
    sessionFee: 1000,
    sessionMode: "ONLINE",
    verificationStatus,
    isActive,
  });

before(async () => {
  memoryServer = await MongoMemoryServer.create();
  await mongoose.connect(memoryServer.getUri());
});

after(async () => {
  await mongoose.disconnect();
  await memoryServer.stop();
});

beforeEach(async () => {
  await Promise.all([
    CommunityPost.deleteMany({}),
    CommunityAnswer.deleteMany({}),
    User.deleteMany({}),
    Coach.deleteMany({}),
    Expert.deleteMany({}),
  ]);
});

describe("who counts as verified", () => {
  it("does not badge a coach account that was never verified", async () => {
    const userId = await createUser("Unvetted Coach", "Coach");
    await makeCoach(userId, false);

    const credentials = await resolveCommunityCredentials([userId]);
    // The old rule was `user.role === "Coach"`, which badged this person as
    // "Verified Coach" on a public page without any review having happened.
    assert.equal(credentials.get(userId), undefined);
  });

  it("badges a verified coach", async () => {
    const userId = await createUser("Vetted Coach", "Coach");
    await makeCoach(userId, true);

    const credentials = await resolveCommunityCredentials([userId]);
    assert.equal(credentials.get(userId).kind, "VERIFIED_COACH");
    assert.equal(credentials.get(userId).title, "Verified Coach");
  });

  it("badges an approved, live expert", async () => {
    const userId = await createUser("Approved Expert");
    await makeExpert(userId, "APPROVED", true);

    const credentials = await resolveCommunityCredentials([userId]);
    assert.equal(credentials.get(userId).kind, "VERIFIED_EXPERT");
    assert.equal(credentials.get(userId).title, "Verified Expert");
  });

  it("ignores an expert still awaiting review", async () => {
    const pending = await createUser("Pending Expert");
    const rejected = await createUser("Rejected Expert");
    await makeExpert(pending, "PENDING", false);
    await makeExpert(rejected, "REJECTED", false);

    const credentials = await resolveCommunityCredentials([pending, rejected]);
    assert.equal(credentials.get(pending), undefined);
    assert.equal(credentials.get(rejected), undefined);
  });

  it("ignores an approved expert who has been deactivated", async () => {
    const userId = await createUser("Paused Expert");
    await makeExpert(userId, "APPROVED", false);

    const credentials = await resolveCommunityCredentials([userId]);
    assert.equal(credentials.get(userId), undefined);
  });

  it("prefers expert over coach when someone is both", async () => {
    const userId = await createUser("Both", "Coach");
    await makeCoach(userId, true);
    await makeExpert(userId, "APPROVED", true);

    const credentials = await resolveCommunityCredentials([userId]);
    assert.equal(credentials.get(userId).kind, "VERIFIED_EXPERT");
  });

  it("returns nothing for an empty input", async () => {
    assert.equal((await resolveCommunityCredentials([])).size, 0);
  });
});

describe("credentials on Q&A payloads", () => {
  it("carries the badge onto an answer", async () => {
    const asker = await createUser("Asker");
    const coach = await createUser("Coach", "Coach");
    await makeCoach(coach, true);

    const post = await CommunityService.createPost(asker, {
      title: "How do I pick a first racket for my daughter?",
      body: "She is nine and just started weekly lessons at school.",
    });
    await CommunityService.createAnswer(coach, post.id, "Start light, 25 inch.");

    const detail = await CommunityService.getPostDetails(asker, post.id);
    assert.equal(detail.answers[0].author.isVerifiedExpert, true);
    assert.equal(detail.answers[0].author.expertTitle, "Verified Coach");
    assert.equal(detail.answers[0].author.credentialKind, "VERIFIED_COACH");
  });

  it("withholds the badge on an anonymous answer", async () => {
    const asker = await createUser("Asker");
    const coach = await createUser("Coach", "Coach");
    await makeCoach(coach, true);

    const post = await CommunityService.createPost(asker, {
      title: "How do I pick a first racket for my daughter?",
      body: "She is nine and just started weekly lessons at school.",
    });
    await CommunityService.createAnswer(
      coach,
      post.id,
      "Start light, 25 inch.",
      true,
    );

    const detail = await CommunityService.getPostDetails(asker, post.id);
    // A credential is an identity claim; showing it would narrow who wrote an
    // answer they chose to publish anonymously.
    assert.equal(detail.answers[0].author.isVerifiedExpert, false);
    assert.equal(detail.answers[0].author.expertTitle, undefined);
  });

  it("still shows the author their own badge on their anonymous answer", async () => {
    const asker = await createUser("Asker");
    const coach = await createUser("Coach", "Coach");
    await makeCoach(coach, true);

    const post = await CommunityService.createPost(asker, {
      title: "How do I pick a first racket for my daughter?",
      body: "She is nine and just started weekly lessons at school.",
    });
    await CommunityService.createAnswer(
      coach,
      post.id,
      "Start light, 25 inch.",
      true,
    );

    const asAuthor = await CommunityService.getPostDetails(coach, post.id);
    assert.equal(asAuthor.answers[0].author.isVerifiedExpert, true);
  });

  it("carries the badge onto the feed", async () => {
    const coach = await createUser("Coach", "Coach");
    await makeCoach(coach, true);
    await CommunityService.createPost(coach, {
      title: "Sharing what I look for in a junior player",
      body: "A few notes from ten years of coaching under-14s locally.",
    });

    const feed = await CommunityService.listPosts(coach, 1, 10);
    assert.equal(feed.items[0].author.expertTitle, "Verified Coach");
  });
});
