/* eslint-disable @typescript-eslint/no-var-requires */
// Integration tests for comments on answers. In-memory MongoDB — local dev
// points at the live cluster, so a test on the default connection would write
// to production.
process.env.JWT_SECRET = "test-secret-test-secret-test-secret-1234567890";

import assert = require("node:assert/strict");
const { after, before, beforeEach, describe, it } = require("node:test");
const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");

const { CommunityPost } = require("../community/models/CommunityPost");
const { CommunityAnswer } = require("../community/models/CommunityAnswer");
const { CommunityAnswerComment } = require("../community/models/CommunityAnswerComment");
const { CommunityReputation } = require("../community/models/CommunityReputation");
const { CommunityService } = require("../community/services/CommunityService");
const { User } = require("../client/models/User");

let memoryServer: { getUri(): string; stop(): Promise<void> };

let seq = 0;
const createUser = async (name: string) => {
  seq += 1;
  const user = await User.create({
    name,
    email: `comment-${seq}@example.com`,
    phone: `915000${String(seq).padStart(4, "0")}`,
    password: "test-password",
    role: "Parent",
  });
  return String(user._id);
};

const setup = async () => {
  const asker = await createUser("Asker");
  const answerer = await createUser("Answerer");
  const post = await CommunityService.createPost(asker, {
    title: "Which racket suits a ten year old starting out?",
    body: "Looking for something light enough for a beginner to swing properly.",
  });
  const ans = await CommunityService.createAnswer(
    answerer,
    post.id,
    "A 25-inch aluminium racket is the usual starting point."
  );
  return { asker, answerer, post, ans };
};

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
    CommunityAnswerComment.deleteMany({}),
    CommunityReputation.deleteMany({}),
    User.deleteMany({}),
  ]);
});

describe("commenting on an answer", () => {
  it("posts a comment and returns it with the thread", async () => {
    const { asker, ans, post } = await setup();

    await CommunityService.createAnswerComment(asker, ans.id, "Which model?");

    const detail = await CommunityService.getPostDetails(asker, post.id);
    assert.equal(detail.answers[0].comments.length, 1);
    assert.equal(detail.answers[0].comments[0].content, "Which model?");
  });

  it("earns no reputation", async () => {
    const { asker, ans } = await setup();

    const before = await CommunityReputation.findOne({ userId: asker }).lean();
    await CommunityService.createAnswerComment(asker, ans.id, "Which model?");
    const after = await CommunityReputation.findOne({ userId: asker }).lean();

    // Comments carry no score precisely so there is nothing to farm — anything
    // worth points belongs in an answer, where it can be voted on.
    assert.equal(after?.totalPoints || 0, before?.totalPoints || 0);
  });

  it("refuses an empty comment", async () => {
    const { asker, ans } = await setup();

    await assert.rejects(
      () => CommunityService.createAnswerComment(asker, ans.id, "   "),
      /Comment cannot be empty/
    );
  });

  it("refuses a comment on an answer that does not exist", async () => {
    const { asker } = await setup();
    const missing = new mongoose.Types.ObjectId().toString();

    await assert.rejects(
      () => CommunityService.createAnswerComment(asker, missing, "Hello?"),
      /answer not found/
    );
  });

  it("does not count comments toward answerCount", async () => {
    const { asker, ans, post } = await setup();

    await CommunityService.createAnswerComment(asker, ans.id, "Which model?");
    await CommunityService.createAnswerComment(asker, ans.id, "And what size?");

    const stored = await CommunityPost.findById(post.id).lean();
    // The whole point of comments is that they do not dilute the answer list.
    assert.equal(stored.answerCount, 1);
  });
});

describe("deleting a comment", () => {
  it("lets the author remove their own", async () => {
    const { asker, ans, post } = await setup();
    const comment = await CommunityService.createAnswerComment(asker, ans.id, "Which model?");

    await CommunityService.deleteAnswerComment(asker, comment.id);

    const detail = await CommunityService.getPostDetails(asker, post.id);
    assert.equal(detail.answers[0].comments.length, 0);
  });

  it("lets the person who asked clear noise off their thread", async () => {
    const { asker, answerer, ans, post } = await setup();
    const comment = await CommunityService.createAnswerComment(
      answerer,
      ans.id,
      "Off-topic remark."
    );

    await CommunityService.deleteAnswerComment(asker, comment.id);

    const detail = await CommunityService.getPostDetails(asker, post.id);
    assert.equal(detail.answers[0].comments.length, 0);
  });

  it("refuses everyone else", async () => {
    const { answerer, ans } = await setup();
    const stranger = await createUser("Stranger");
    const comment = await CommunityService.createAnswerComment(answerer, ans.id, "A useful note.");

    await assert.rejects(
      () => CommunityService.deleteAnswerComment(stranger, comment.id),
      /cannot delete this comment/
    );
  });

  it("reports canDelete truthfully per viewer", async () => {
    const { asker, answerer, ans, post } = await setup();
    const stranger = await createUser("Stranger");
    await CommunityService.createAnswerComment(answerer, ans.id, "A note.");

    const asAuthor = await CommunityService.getPostDetails(answerer, post.id);
    const asAsker = await CommunityService.getPostDetails(asker, post.id);
    const asStranger = await CommunityService.getPostDetails(stranger, post.id);

    assert.equal(asAuthor.answers[0].comments[0].canDelete, true);
    assert.equal(asAsker.answers[0].comments[0].canDelete, true);
    assert.equal(asStranger.answers[0].comments[0].canDelete, false);
  });
});

describe("comments and their answer", () => {
  it("go away when the answer is deleted", async () => {
    const { asker, answerer, ans } = await setup();
    await CommunityService.createAnswerComment(asker, ans.id, "Which model?");

    await CommunityService.deleteAnswer(answerer, ans.id);

    const remaining = await CommunityAnswerComment.countDocuments({
      answerId: ans.id,
      isDeleted: false,
    });
    // Otherwise the discussion outlives the answer it was about.
    assert.equal(remaining, 0);
  });

  it("hides the commenter's name when they comment anonymously", async () => {
    const { asker, answerer, ans, post } = await setup();
    await CommunityService.createAnswerComment(
      answerer,
      ans.id,
      "Prefer not to say who I am.",
      true
    );

    const asOther = await CommunityService.getPostDetails(asker, post.id);
    assert.equal(asOther.answers[0].comments[0].author.displayName, "Anonymous");
    assert.equal(asOther.answers[0].comments[0].author.id, "anon");
  });
});
