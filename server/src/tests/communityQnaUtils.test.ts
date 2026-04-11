import assert from "node:assert/strict";
import test from "node:test";
import {
  getVoteTransitionDeltas,
  normalizeTags,
} from "../services/communityQnaUtils";

test("normalizeTags lowercases, dedupes, and caps to 8 tags", () => {
  const result = normalizeTags([
    " Badminton ",
    "badminton",
    "Fitness",
    "CARDIO",
    "city-league",
    "strategy",
    "recovery",
    "nutrition",
    "gear",
    "extra-tag",
  ]);

  assert.deepEqual(result, [
    "badminton",
    "fitness",
    "cardio",
    "city-league",
    "strategy",
    "recovery",
    "nutrition",
    "gear",
  ]);
});

test("normalizeTags drops empty and overlong tags", () => {
  const overlong = "a".repeat(41);
  const result = normalizeTags(["", "   ", overlong, "valid"]);
  assert.deepEqual(result, ["valid"]);
});

test("vote deltas handle first upvote", () => {
  assert.deepEqual(getVoteTransitionDeltas(null, 1), {
    upvoteCount: 1,
    downvoteCount: 0,
    voteScore: 1,
  });
});

test("vote deltas handle toggling existing upvote off", () => {
  assert.deepEqual(getVoteTransitionDeltas(1, null), {
    upvoteCount: -1,
    downvoteCount: 0,
    voteScore: -1,
  });
});

test("vote deltas handle switching upvote to downvote", () => {
  assert.deepEqual(getVoteTransitionDeltas(1, -1), {
    upvoteCount: -1,
    downvoteCount: 1,
    voteScore: -2,
  });
});
