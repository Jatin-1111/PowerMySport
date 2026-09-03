import "dotenv/config";
import mongoose from "mongoose";
import { CommunityGroupMember } from "../community/models/CommunityGroupMember";

/**
 * Migration 31: add {groupId, createdAt} index on CommunityGroupMember.
 *
 * getGroupMembers() sorts by { createdAt: 1 } within a { groupId } filter.
 * The existing indexes on this collection are { groupId, userId } (unique)
 * and { groupId, role } — neither has createdAt as a second key, so once a
 * group's membership exceeds the in-memory sort limit the query falls back
 * to a non-indexed sort. This is purely additive (no existing index is
 * dropped, no conflict is possible), unlike the text-index migrations here
 * that have to drop-then-build.
 *
 * autoIndex is off in production (see config/database.ts), so this has to be
 * created explicitly rather than relying on the schema's `index()` call.
 *
 * Idempotent: checked by key shape rather than by name — a local dev run
 * against this same database (autoIndex is only off when NODE_ENV is
 * "production") may have already built this exact index under Mongo's
 * default auto-generated name, which would otherwise collide with a second
 * attempt to create it under a custom name (IndexOptionsConflict).
 *
 * USAGE
 *   npm run migrate:group-member-index
 */

const NEW_INDEX_NAME = "groupId_createdAt";
const NEW_INDEX_SPEC = { groupId: 1, createdAt: 1 } as const;

const keysMatch = (a: Record<string, unknown>, b: Record<string, 1 | -1>): boolean => {
  const aKeys = Object.keys(a);
  const bKeys = Object.keys(b);
  if (aKeys.length !== bKeys.length) return false;
  return bKeys.every((key, position) => aKeys[position] === key && a[key] === b[key]);
};

export const up = async () => {
  console.log("Starting migration 31: add groupId+createdAt index...");

  const collection = CommunityGroupMember.collection;
  const indexes = await collection.indexes();
  const existing = indexes.find((index) => keysMatch(index.key || {}, NEW_INDEX_SPEC));

  if (existing) {
    console.log(`  already present as "${existing.name}" — nothing to do.`);
    console.log("Migration 31 complete.");
    return;
  }

  await collection.createIndex(NEW_INDEX_SPEC, { name: NEW_INDEX_NAME });

  console.log(`  created index: ${NEW_INDEX_NAME}`);
  console.log("Migration 31 complete.");
};

export const down = async () => {
  console.log("Reverting migration 31 — dropping groupId+createdAt index...");

  const collection = CommunityGroupMember.collection;
  const indexes = await collection.indexes();
  for (const index of indexes.filter((i) => keysMatch(i.key || {}, NEW_INDEX_SPEC))) {
    if (index.name) {
      await collection.dropIndex(index.name);
      console.log(`  dropped index: ${index.name}`);
    }
  }

  console.log("Revert complete.");
};

const isDirectRun = require.main === module;

if (isDirectRun) {
  const argv = process.argv.slice(2);
  const isDown = argv.includes("--down");

  const uri = process.env.MONGO_URI || process.env.MONGODB_URI;
  if (!uri) {
    console.error("MONGO_URI is not set");
    process.exit(1);
  }

  void mongoose
    .connect(uri)
    .then(() => (isDown ? down() : up()))
    .then(() => mongoose.disconnect())
    .then(() => process.exit(0))
    .catch((error: unknown) => {
      console.error("Migration 31 failed:", error);
      process.exit(1);
    });
}
