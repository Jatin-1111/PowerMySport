/* eslint-disable @typescript-eslint/no-var-requires */
// Integration tests for accepted answers. In-memory MongoDB — local dev points
// at the live cluster, so a test on the default connection would write to
// production.
process.env.JWT_SECRET = "test-secret-test-secret-test-secret-1234567890";

import assert = require("node:assert/strict");
const { after, before, beforeEach, describe, it } = require("node:test");
const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");

const { CommunityPost } = require("../community/models/CommunityPost");
const { CommunityAnswer } = require("../community/models/CommunityAnswer");
const { CommunityReputation } = require("../community/models/CommunityReputation");
const { CommunityService } = require("../community/services/CommunityService");
const { User } = require("../client/models/User");

let memoryServer: { getUri(): string; stop(): Promise<void> };

let userSeq = 0;
const createUser = async (name: string, role = "Parent") => {
  userSeq += 1;
  const user = await User.create({
    name,
    email: `accept-${userSeq}@example.com`,
    phone: `913000${String(userSeq).padStart(4, "0")}`,
    password: "test-password",
    role,
  });
  return String(user._id);
};

const points = async (userId: string): Promise<number> => {
  const row = await CommunityReputation.findOne({ userId }).select("totalPoints").lean();
  return row?.totalPoints || 0;
};

const ask = (userId: string, isAnonymous = false) =>
  CommunityService.createPost(userId, {
    title: "Which racket suits a ten year old starting out?",
    body: "Looking for something light enough for a beginner to swing properly.",
    tags: ["tennis"],
    isAnonymous,
  });

const answer = (userId: string, postId: string, content: string) =>
  CommunityService.createAnswer(userId, postId, content);

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
    CommunityReputation.deleteMany({}),
    User.deleteMany({}),
  ]);
});

describe("accepting an answer", () => {
  it("marks it and rewards its author", async () => {
    const asker = await createUser("Asker");
    const helper = await createUser("Helper");
    const post = await ask(asker);
    const a = await answer(helper, post.id, "A light aluminium 25-inch works.");

    const before = await points(helper);
    const result = await CommunityService.acceptAnswer(asker, post.id, a.id);

    assert.equal(result.accepted, true);
    assert.equal(result.acceptedAnswerId, a.id);
    assert.equal((await points(helper)) - before, 15);
  });

  it("is reversible, and takes the points back", async () => {
    const asker = await createUser("Asker");
    const helper = await createUser("Helper");
    const post = await ask(asker);
    const a = await answer(helper, post.id, "A light aluminium 25-inch works.");

    const before = await points(helper);
    await CommunityService.acceptAnswer(asker, post.id, a.id);
    const second = await CommunityService.acceptAnswer(asker, post.id, a.id);

    assert.equal(second.accepted, false);
    assert.equal(second.acceptedAnswerId, null);
    assert.equal(await points(helper), before);
  });

  it("cannot be farmed by accepting the same answer repeatedly", async () => {
    const asker = await createUser("Asker");
    const helper = await createUser("Helper");
    const post = await ask(asker);
    const a = await answer(helper, post.id, "A light aluminium 25-inch works.");

    const before = await points(helper);
    for (let i = 0; i < 5; i += 1) {
      await CommunityService.acceptAnswer(asker, post.id, a.id); // accept
      await CommunityService.acceptAnswer(asker, post.id, a.id); // unaccept
    }
    await CommunityService.acceptAnswer(asker, post.id, a.id); // leave accepted

    assert.equal((await points(helper)) - before, 15);
  });

  it("moves the points when a different answer is accepted instead", async () => {
    const asker = await createUser("Asker");
    const first = await createUser("First");
    const second = await createUser("Second");
    const post = await ask(asker);
    const a1 = await answer(first, post.id, "Try a 25-inch aluminium racket.");
    const a2 = await answer(second, post.id, "Go to a shop and test the grip.");

    const base1 = await points(first);
    const base2 = await points(second);

    await CommunityService.acceptAnswer(asker, post.id, a1.id);
    await CommunityService.acceptAnswer(asker, post.id, a2.id);

    assert.equal(await points(first), base1, "first author loses the points");
    assert.equal((await points(second)) - base2, 15);

    const stored = await CommunityPost.findById(post.id).lean();
    assert.equal(String(stored.acceptedAnswerId), a2.id);
  });

  it("refuses anyone who did not ask the question", async () => {
    const asker = await createUser("Asker");
    const helper = await createUser("Helper");
    const stranger = await createUser("Stranger");
    const post = await ask(asker);
    const a = await answer(helper, post.id, "A light aluminium 25-inch works.");

    await assert.rejects(
      () => CommunityService.acceptAnswer(stranger, post.id, a.id),
      /Only the person who asked/
    );
    await assert.rejects(
      () => CommunityService.acceptAnswer(helper, post.id, a.id),
      /Only the person who asked/
    );
  });

  it("still lets the asker accept on their own anonymous question", async () => {
    const asker = await createUser("Asker");
    const helper = await createUser("Helper");
    const post = await ask(asker, true);
    const a = await answer(helper, post.id, "A light aluminium 25-inch works.");

    const result = await CommunityService.acceptAnswer(asker, post.id, a.id);
    assert.equal(result.accepted, true);

    // And the asker is told they may accept, despite the post being anonymous.
    const detail = await CommunityService.getPostDetails(asker, post.id);
    assert.equal(detail.post.canAccept, true);
  });

  it("does not offer the accept control to anyone else", async () => {
    const asker = await createUser("Asker");
    const helper = await createUser("Helper");
    const post = await ask(asker);
    await answer(helper, post.id, "A light aluminium 25-inch works.");

    const asHelper = await CommunityService.getPostDetails(helper, post.id);
    const asGuest = await CommunityService.getPostDetails(undefined, post.id);
    assert.equal(asHelper.post.canAccept, false);
    assert.equal(asGuest.post.canAccept, false);
  });

  it("refuses an answer that belongs to another question", async () => {
    const asker = await createUser("Asker");
    const helper = await createUser("Helper");
    const post = await ask(asker);
    const other = await ask(asker);
    const strayAnswer = await answer(helper, other.id, "Unrelated advice here.");

    await assert.rejects(
      () => CommunityService.acceptAnswer(asker, post.id, strayAnswer.id),
      /answer not found/
    );
  });

  it("sorts the accepted answer to the top regardless of votes", async () => {
    const asker = await createUser("Asker");
    const popular = await createUser("Popular");
    const accepted = await createUser("Accepted");
    const post = await ask(asker);
    const loud = await answer(popular, post.id, "The loudest answer in here.");
    const right = await answer(accepted, post.id, "The one that actually helped.");

    // The asker upvotes it — voting on your own content is refused, so the
    // upvote has to come from someone else for this to set up the case.
    await CommunityService.vote(asker, {
      targetType: "ANSWER",
      targetId: loud.id,
      value: 1,
    });
    await CommunityService.acceptAnswer(asker, post.id, right.id);

    const detail = await CommunityService.getPostDetails(asker, post.id);
    assert.equal(detail.answers[0].id, right.id);
    assert.equal(detail.answers[0].isAccepted, true);
    assert.equal(detail.answers[1].isAccepted, false);
  });

  it("clears the mark when the accepted answer is deleted", async () => {
    const asker = await createUser("Asker");
    const helper = await createUser("Helper");
    const post = await ask(asker);
    const a = await answer(helper, post.id, "A light aluminium 25-inch works.");

    const before = await points(helper);
    await CommunityService.acceptAnswer(asker, post.id, a.id);
    await CommunityService.deleteAnswer(helper, a.id);

    const stored = await CommunityPost.findById(post.id).lean();
    // Otherwise the thread keeps a "solved" badge pointing at content nobody
    // can read, and its author keeps the points.
    assert.equal(stored.acceptedAnswerId, null);
    assert.equal(await points(helper), before);
  });

  it("never drives reputation negative", async () => {
    const asker = await createUser("Asker");
    const helper = await createUser("Helper");
    const post = await ask(asker);
    const a = await answer(helper, post.id, "A light aluminium 25-inch works.");

    await CommunityService.acceptAnswer(asker, post.id, a.id);
    // Simulate a historical accept whose points were never recorded.
    await CommunityReputation.updateOne({ userId: helper }, { $set: { totalPoints: 3 } });
    await CommunityService.acceptAnswer(asker, post.id, a.id);

    assert.equal(await points(helper), 0);
  });
});
