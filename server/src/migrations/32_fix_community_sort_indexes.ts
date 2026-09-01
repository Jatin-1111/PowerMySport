import "dotenv/config";
import mongoose from "mongoose";
import { CommunityReputation } from "../community/models/CommunityReputation";
import { CommunityAnswer } from "../community/models/CommunityAnswer";

/**
 * Migration 32: fix two indexes whose sort direction didn't match the query
 * they exist to serve.
 *
 * A compound index only serves a sort whose per-field directions match it
 * exactly, or are its exact reverse on every field. Both indexes below were
 * built with a direction that satisfies neither test against the query they
 * were meant for, so both queries fell back to an in-memory sort despite an
 * index existing:
 *
 *  - CommunityReputation: index was { totalPoints: -1, updatedAt: -1 },
 *    listLeaderboard sorts { totalPoints: -1, updatedAt: 1 }.
 *  - CommunityAnswer: index was { postId: 1, voteScore: -1, createdAt: -1 },
 *    getPostDetails' non-accepted-answers query sorts
 *    { postId, voteScore: -1, createdAt: 1 } (oldest first when tied).
 *
 * Both are drop-then-recreate: unlike the blog text index (only one text
 * index allowed per collection), there's no hard conflict here — Mongo would
 * happily keep both the stale and corrected index side by side — but the
 * stale one would then just be dead weight on every write with no query ever
 * using it again, so it is dropped rather than left behind.
 *
 * Indexes are matched by their key shape rather than an assumed default
 * name — Mongoose/MongoDB's auto-generated names are a implementation
 * detail this migration shouldn't depend on.
 *
 * Idempotent: checks for the corrected shape by key before creating it.
 *
 * USAGE
 *   npm run migrate:community-sort-indexes                # dry run (default)
 *   npm run migrate:community-sort-indexes -- --apply      # drop stale, build corrected
 *   npm run migrate:community-sort-indexes -- --down --apply   # restore the stale directions
 */

interface Options {
  apply?: boolean;
}

type IndexKeySpec = Record<string, 1 | -1>;

const keysMatch = (a: Record<string, unknown>, b: IndexKeySpec): boolean => {
  const aKeys = Object.keys(a);
  const bKeys = Object.keys(b);
  if (aKeys.length !== bKeys.length) return false;
  return bKeys.every((key, position) => aKeys[position] === key && a[key] === b[key]);
};

const REPUTATION_OLD_SPEC: IndexKeySpec = { totalPoints: -1, updatedAt: -1 };
const REPUTATION_NEW_SPEC: IndexKeySpec = { totalPoints: -1, updatedAt: 1 };
const REPUTATION_NEW_NAME = "totalPoints_-1_updatedAt_1_fixed";

const ANSWER_OLD_SPEC: IndexKeySpec = { postId: 1, voteScore: -1, createdAt: -1 };
const ANSWER_NEW_SPEC: IndexKeySpec = { postId: 1, voteScore: -1, createdAt: 1 };
const ANSWER_NEW_NAME = "postId_1_voteScore_-1_createdAt_1_fixed";

export const up = async (options: Options = {}) => {
  const apply = Boolean(options.apply);
  console.log(
    `Starting migration 32: fix community sort indexes (${apply ? "APPLY" : "DRY RUN"})...`,
  );

  const reputationCollection = CommunityReputation.collection;
  const answerCollection = CommunityAnswer.collection;

  const [reputationIndexes, answerIndexes] = await Promise.all([
    reputationCollection.indexes(),
    answerCollection.indexes(),
  ]);

  const reputationStale = reputationIndexes.filter((index) =>
    keysMatch(index.key || {}, REPUTATION_OLD_SPEC),
  );
  const reputationHasNew = reputationIndexes.some((index) =>
    keysMatch(index.key || {}, REPUTATION_NEW_SPEC),
  );

  const answerStale = answerIndexes.filter((index) =>
    keysMatch(index.key || {}, ANSWER_OLD_SPEC),
  );
  const answerHasNew = answerIndexes.some((index) =>
    keysMatch(index.key || {}, ANSWER_NEW_SPEC),
  );

  console.log(
    `  reputation: stale=${reputationStale.map((i) => i.name).join(",") || "none"} corrected-present=${reputationHasNew}`,
  );
  console.log(
    `  answer:     stale=${answerStale.map((i) => i.name).join(",") || "none"} corrected-present=${answerHasNew}`,
  );

  if (reputationHasNew && answerHasNew && !reputationStale.length && !answerStale.length) {
    console.log("  both indexes already corrected, no stale duplicates — nothing to do.");
    return;
  }

  if (!apply) {
    console.log("Dry run complete — re-run with --apply.");
    return;
  }

  // A local dev run against this same database (autoIndex is only off when
  // NODE_ENV is "production") can leave both the stale and corrected index
  // sitting side by side — drop the stale one regardless of whether the
  // corrected index still needs building, rather than only checking that in
  // the branch that builds it.
  for (const index of reputationStale) {
    if (index.name) {
      console.log(`  dropping ${index.name}...`);
      await reputationCollection.dropIndex(index.name);
    }
  }
  if (!reputationHasNew) {
    console.log(`  building ${REPUTATION_NEW_NAME}...`);
    await reputationCollection.createIndex(REPUTATION_NEW_SPEC, {
      name: REPUTATION_NEW_NAME,
    });
  }

  for (const index of answerStale) {
    if (index.name) {
      console.log(`  dropping ${index.name}...`);
      await answerCollection.dropIndex(index.name);
    }
  }
  if (!answerHasNew) {
    console.log(`  building ${ANSWER_NEW_NAME}...`);
    await answerCollection.createIndex(ANSWER_NEW_SPEC, {
      name: ANSWER_NEW_NAME,
    });
  }

  console.log("Migration 32 complete.");
};

export const down = async (options: Options = {}) => {
  const apply = Boolean(options.apply);
  console.log(
    `Reverting migration 32 (${apply ? "APPLY" : "DRY RUN"}) — restoring stale index directions...`,
  );

  const reputationCollection = CommunityReputation.collection;
  const answerCollection = CommunityAnswer.collection;

  if (!apply) {
    console.log("  would drop the corrected indexes and rebuild the stale ones");
    return;
  }

  const [reputationIndexes, answerIndexes] = await Promise.all([
    reputationCollection.indexes(),
    answerCollection.indexes(),
  ]);

  for (const index of reputationIndexes.filter((i) =>
    keysMatch(i.key || {}, REPUTATION_NEW_SPEC),
  )) {
    if (index.name) await reputationCollection.dropIndex(index.name);
  }
  await reputationCollection.createIndex(REPUTATION_OLD_SPEC);

  for (const index of answerIndexes.filter((i) =>
    keysMatch(i.key || {}, ANSWER_NEW_SPEC),
  )) {
    if (index.name) await answerCollection.dropIndex(index.name);
  }
  await answerCollection.createIndex(ANSWER_OLD_SPEC);

  console.log("Revert complete.");
};

const isDirectRun = require.main === module;

if (isDirectRun) {
  const argv = process.argv.slice(2);
  const options: Options = { apply: argv.includes("--apply") };
  const isDown = argv.includes("--down");

  const uri = process.env.MONGO_URI || process.env.MONGODB_URI;
  if (!uri) {
    console.error("MONGO_URI is not set");
    process.exit(1);
  }

  void mongoose
    .connect(uri)
    .then(() => (isDown ? down(options) : up(options)))
    .then(() => mongoose.disconnect())
    .then(() => process.exit(0))
    .catch((error: unknown) => {
      console.error("Migration 32 failed:", error);
      process.exit(1);
    });
}
