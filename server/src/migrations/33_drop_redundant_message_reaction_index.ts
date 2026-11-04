import "dotenv/config";
import mongoose from "mongoose";
import { CommunityMessageReaction } from "../community/models/CommunityMessageReaction";

/**
 * Migration 33: drop the redundant standalone { messageId: 1 } index on
 * CommunityMessageReaction.
 *
 * The collection also carries a unique { messageId: 1, userId: 1 } index.
 * Any query that filters on `messageId` alone (the read path — "every
 * reaction on the messages of one page") can already use that compound
 * index's leading field, so the single-field index served no read the
 * compound one didn't already cover — it only added index-maintenance cost
 * on every reaction insert/update/delete.
 *
 * Indexes are matched by key shape rather than an assumed default name.
 *
 * Idempotent: no-ops if the redundant index is already gone.
 *
 * USAGE
 *   npm run migrate:drop-reaction-index                # dry run (default)
 *   npm run migrate:drop-reaction-index -- --apply      # drop it
 *   npm run migrate:drop-reaction-index -- --down --apply   # recreate it
 */

interface Options {
  apply?: boolean;
}

const REDUNDANT_SPEC: Record<string, 1 | -1> = { messageId: 1 };

const isExactSingleFieldMatch = (
  key: Record<string, unknown>,
  spec: Record<string, 1 | -1>
): boolean => {
  const keyFields = Object.keys(key);
  const specFields = Object.keys(spec);
  if (keyFields.length !== specFields.length) return false;
  return specFields.every(
    (field, position) => keyFields[position] === field && key[field] === spec[field]
  );
};

export const up = async (options: Options = {}) => {
  const apply = Boolean(options.apply);
  console.log(
    `Starting migration 33: drop redundant reaction index (${apply ? "APPLY" : "DRY RUN"})...`
  );

  const collection = CommunityMessageReaction.collection;
  const indexes = await collection.indexes();
  const redundant = indexes.filter((index) =>
    isExactSingleFieldMatch(index.key || {}, REDUNDANT_SPEC)
  );

  if (!redundant.length) {
    console.log("  no redundant index present — nothing to do.");
    return;
  }

  console.log(`  found: ${redundant.map((index) => index.name).join(", ")}`);

  if (!apply) {
    console.log("Dry run complete — re-run with --apply.");
    return;
  }

  for (const index of redundant) {
    if (index.name) {
      console.log(`  dropping ${index.name}...`);
      await collection.dropIndex(index.name);
    }
  }

  console.log("Migration 33 complete.");
};

export const down = async (options: Options = {}) => {
  const apply = Boolean(options.apply);
  console.log(
    `Reverting migration 33 (${apply ? "APPLY" : "DRY RUN"}) — recreating the redundant index...`
  );

  if (!apply) {
    console.log("  would recreate { messageId: 1 }");
    return;
  }

  await CommunityMessageReaction.collection.createIndex(REDUNDANT_SPEC);
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
      console.error("Migration 33 failed:", error);
      process.exit(1);
    });
}
