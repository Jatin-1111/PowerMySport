import "dotenv/config";
import mongoose from "mongoose";
import { PlayerRankingLink } from "../client/models/PlayerRankingLink";

/**
 * Migration 44: create the indexes for the new `playerrankinglinks` collection.
 *
 * Production runs with `autoIndex` off, so a model's own `schema.index(...)`
 * calls create nothing there — the same reason migrations 34 to 37 exist. What
 * is different here, and worth saying out loud, is that two of these three are
 * UNIQUE and they are not a performance concern:
 *
 *   • `{ sportSlug, regNo }` is the rule that one account may speak for one
 *     ranked child. Without it, two families can both claim the same
 *     registration number and both receive that child's alerts.
 *   • `{ dependentId, sportSlug }` keeps "this player's rank" unambiguous.
 *
 * The service checks both conditions before writing, but that check is a race
 * with itself under concurrency and is only there to produce a better error
 * message. These indexes are the actual guard. Deploying the feature without
 * running this migration therefore ships the endpoint with its central safety
 * property missing, silently — so run it first. (See the deploy-ordering note:
 * pushing to master auto-deploys the server, and a migration run afterwards
 * loses the race.)
 *
 * Creating a unique index on a collection that already holds duplicates fails.
 * That cannot happen on a first deploy, when the collection does not exist, but
 * it can on a re-run after a partial rollout, so `up` reports the offending
 * pairs rather than letting Mongo's error stand alone.
 *
 * USAGE — invoke ts-node directly.
 *
 *   npx ts-node src/migrations/44_add_player_ranking_link_indexes.ts
 *   npx ts-node src/migrations/44_add_player_ranking_link_indexes.ts --apply
 *   npx ts-node src/migrations/44_add_player_ranking_link_indexes.ts --down --apply
 *
 * Not `npm run migrate:ranking-link-indexes -- --apply`. On Windows, PowerShell
 * strips the first bare `--` as its own end-of-parameters marker; npm then reads
 * `--apply` as a flag for itself and this file receives an empty argv. It prints
 * a dry run and creates nothing — which for THIS migration means the unique
 * indexes that stop two families claiming the same child silently never exist,
 * while the run looks like it succeeded. Re-running is safe and idempotent, so
 * when in doubt run it again and read the output: every line should say
 * `[skip] ... already present`.
 */

interface Options {
  apply?: boolean;
}

type IndexKeySpec = Record<string, 1 | -1>;

interface IndexTarget {
  label: string;
  spec: IndexKeySpec;
  unique?: boolean;
}

const keysMatch = (a: Record<string, unknown>, b: IndexKeySpec): boolean => {
  const aKeys = Object.keys(a);
  const bKeys = Object.keys(b);
  if (aKeys.length !== bKeys.length) return false;
  return bKeys.every((key, position) => aKeys[position] === key && a[key] === b[key]);
};

const TARGETS: IndexTarget[] = [
  {
    label: "PlayerRankingLink: sportSlug+regNo (one account per ranked player)",
    spec: { sportSlug: 1, regNo: 1 },
    unique: true,
  },
  {
    label: "PlayerRankingLink: dependentId+sportSlug (one standing per profile per sport)",
    spec: { dependentId: 1, sportSlug: 1 },
    unique: true,
  },
  {
    label: "PlayerRankingLink: userId+createdAt (the account's own list)",
    spec: { userId: 1, createdAt: -1 },
  },
];

/** Duplicate key groups that would make a unique index fail, so the failure can
 * be reported as data rather than as a Mongo error code. */
const duplicatesFor = async (spec: IndexKeySpec): Promise<Array<Record<string, unknown>>> => {
  const groupId = Object.fromEntries(Object.keys(spec).map((key) => [key, `$${key}`]));
  return PlayerRankingLink.collection
    .aggregate([
      { $group: { _id: groupId, count: { $sum: 1 } } },
      { $match: { count: { $gt: 1 } } },
      { $limit: 20 },
    ])
    .toArray();
};

export const up = async (options: Options = {}) => {
  const apply = Boolean(options.apply);
  console.log(
    `Starting migration 44: player ranking link indexes (${apply ? "APPLY" : "DRY RUN"})...`
  );

  const collection = PlayerRankingLink.collection;

  for (const target of TARGETS) {
    const existing = await collection.indexes().catch(() => []);
    if (existing.some((index) => keysMatch(index.key || {}, target.spec))) {
      console.log(`  [skip] ${target.label} — already present`);
      continue;
    }

    if (target.unique) {
      const dupes = await duplicatesFor(target.spec);
      if (dupes.length > 0) {
        console.error(`  [BLOCKED] ${target.label} — existing duplicates must be resolved first:`);
        for (const dupe of dupes) console.error(`    ${JSON.stringify(dupe)}`);
        throw new Error(`Cannot create unique index for ${target.label}: duplicates present`);
      }
    }

    if (!apply) {
      console.log(`  [would create] ${target.label}${target.unique ? " (unique)" : ""}`);
      continue;
    }

    console.log(`  [creating] ${target.label}...`);
    const name = Object.entries(target.spec)
      .map(([key, direction]) => `${key}_${direction}`)
      .join("_");
    await collection.createIndex(target.spec, {
      name,
      ...(target.unique ? { unique: true } : {}),
    });
  }

  console.log(apply ? "Migration 44 complete." : "Dry run complete — re-run with --apply.");
};

export const down = async (options: Options = {}) => {
  const apply = Boolean(options.apply);
  console.log(`Reverting migration 44 (${apply ? "APPLY" : "DRY RUN"})...`);

  const collection = PlayerRankingLink.collection;
  for (const target of TARGETS) {
    const existing = await collection.indexes().catch(() => []);
    const match = existing.find((index) => keysMatch(index.key || {}, target.spec));

    if (!match?.name) {
      console.log(`  [skip] ${target.label} — not present`);
      continue;
    }
    if (!apply) {
      console.log(`  [would drop] ${target.label} (${match.name})`);
      continue;
    }
    console.log(`  [dropping] ${target.label} (${match.name})...`);
    await collection.dropIndex(match.name);
  }

  console.log(apply ? "Revert complete." : "Dry run complete — re-run with --down --apply.");
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
      console.error("Migration 44 failed:", error);
      process.exit(1);
    });
}
