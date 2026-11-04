import "dotenv/config";
import mongoose from "mongoose";
import { SeasonPlan } from "../client/models/SeasonPlan";

/**
 * Migration 46: the one index `seasonplans` needs.
 *
 * Production runs with `autoIndex` off, so a model's own `schema.index(...)`
 * creates nothing there. `{userId, dependentId}` unique is what enforces one
 * plan per child; without it two concurrent adds can create two plans for the
 * same profile and a parent's tournaments split silently across both.
 *
 * ── One index, deliberately ────────────────────────────────────────────────
 * Its `userId` prefix also answers "every plan I own", so a second index for
 * that would buy nothing. Nothing queries by edition slug either: "who planned
 * this tournament" is not a question this product asks, and the cluster is at
 * 492MB of a 512MB cap that already blocked writes once. An index costs quota
 * whether or not a query ever uses it.
 *
 * USAGE
 *   npx ts-node src/migrations/46_add_season_plan_index.ts
 *   npx ts-node src/migrations/46_add_season_plan_index.ts --apply
 *   npx ts-node src/migrations/46_add_season_plan_index.ts --down --apply
 *
 * Not `npm run migrate:... -- --apply`: PowerShell eats the first bare `--`,
 * npm takes the flag for itself, and this reports a dry run having created
 * nothing — which for a unique index means shipping without the guarantee.
 */

interface Options {
  apply?: boolean;
}

const SPEC = { userId: 1, dependentId: 1 } as const;
const NAME = "userId_1_dependentId_1";

const keysMatch = (key: Record<string, unknown>): boolean => {
  const keys = Object.keys(key);
  return keys.length === 2 && keys[0] === "userId" && keys[1] === "dependentId";
};

export const up = async (options: Options = {}) => {
  const apply = Boolean(options.apply);
  console.log(`Migration 46: season plan index (${apply ? "APPLY" : "DRY RUN"})`);

  const collection = SeasonPlan.collection;
  const existing = await collection.indexes().catch(() => []);
  if (existing.some((index) => keysMatch(index.key || {}))) {
    console.log("  [skip] already present");
    return;
  }

  // A unique index cannot be built over existing duplicates. There should be
  // none on a first deploy, but a partial rollout could leave some, and a
  // Mongo error code is a worse report than the offending pairs.
  const dupes = await collection
    .aggregate([
      { $group: { _id: { userId: "$userId", dependentId: "$dependentId" }, count: { $sum: 1 } } },
      { $match: { count: { $gt: 1 } } },
      { $limit: 20 },
    ])
    .toArray()
    .catch(() => []);
  if (dupes.length > 0) {
    console.error("  [BLOCKED] duplicate plans exist and must be merged first:");
    for (const dupe of dupes) console.error(`    ${JSON.stringify(dupe)}`);
    throw new Error("Cannot create the unique index: duplicate plans present");
  }

  if (!apply) {
    console.log(`  [would create] ${NAME} (unique)`);
    return;
  }
  await collection.createIndex(SPEC, { name: NAME, unique: true });
  console.log(`  [created] ${NAME}`);
};

export const down = async (options: Options = {}) => {
  const apply = Boolean(options.apply);
  console.log(`Reverting migration 46 (${apply ? "APPLY" : "DRY RUN"})`);

  const collection = SeasonPlan.collection;
  const existing = await collection.indexes().catch(() => []);
  const match = existing.find((index) => keysMatch(index.key || {}));
  if (!match?.name) {
    console.log("  [skip] not present");
    return;
  }
  if (!apply) {
    console.log(`  [would drop] ${match.name}`);
    return;
  }
  await collection.dropIndex(match.name);
  console.log(`  [dropped] ${match.name}`);
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
    .catch(async (error: unknown) => {
      console.error("Migration 46 failed:", error);
      await mongoose.disconnect().catch(() => undefined);
      process.exit(1);
    });
}
