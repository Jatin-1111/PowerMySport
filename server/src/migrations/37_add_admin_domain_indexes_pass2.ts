import "dotenv/config";
import mongoose from "mongoose";
import { Dispute } from "../client/models/Dispute";
import Academy from "../admin/models/Academy";

/**
 * Migration 37: add indexes found during the second, deeper pass of the
 * admin-backend performance audit (the sibling to migration 36, round 1).
 *
 * Purely additive — no existing index is dropped. Idempotent: each index is
 * checked by key shape before creating it.
 *
 * USAGE
 *   npm run migrate:admin-domain-indexes-pass2                # dry run (default)
 *   npm run migrate:admin-domain-indexes-pass2 -- --apply      # create missing indexes
 *   npm run migrate:admin-domain-indexes-pass2 -- --down --apply   # drop the new ones
 */

interface Options {
  apply?: boolean;
}

type IndexKeySpec = Record<string, 1 | -1>;

interface IndexTarget {
  label: string;
  model: mongoose.Model<any>;
  spec: IndexKeySpec;
}

const keysMatch = (a: Record<string, unknown>, b: IndexKeySpec): boolean => {
  const aKeys = Object.keys(a);
  const bKeys = Object.keys(b);
  if (aKeys.length !== bKeys.length) return false;
  return bKeys.every((key, position) => aKeys[position] === key && a[key] === b[key]);
};

const TARGETS: IndexTarget[] = [
  {
    label: "Dispute: status+createdAt (admin getPendingCounts nav badge)",
    model: Dispute,
    spec: { status: 1, createdAt: -1 },
  },
  {
    label: "Academy: onboardingCompleted+isApproved+createdAt (admin getPendingAcademies + getPendingCounts)",
    model: Academy,
    spec: { onboardingCompleted: 1, isApproved: 1, createdAt: -1 },
  },
];

export const up = async (options: Options = {}) => {
  const apply = Boolean(options.apply);
  console.log(
    `Starting migration 37: add admin domain indexes, pass 2 (${apply ? "APPLY" : "DRY RUN"})...`,
  );

  for (const target of TARGETS) {
    const collection = target.model.collection;
    const existing = await collection.indexes();
    const already = existing.some((index) => keysMatch(index.key || {}, target.spec));

    if (already) {
      console.log(`  [skip] ${target.label} — already present`);
      continue;
    }

    if (!apply) {
      console.log(`  [would create] ${target.label}`);
      continue;
    }

    console.log(`  [creating] ${target.label}...`);
    const name = Object.entries(target.spec)
      .map(([k, d]) => `${k}_${d}`)
      .join("_");
    await collection.createIndex(target.spec, { name });
  }

  console.log(apply ? "Migration 37 complete." : "Dry run complete — re-run with --apply.");
};

export const down = async (options: Options = {}) => {
  const apply = Boolean(options.apply);
  console.log(
    `Reverting migration 37 (${apply ? "APPLY" : "DRY RUN"}) — dropping these indexes...`,
  );

  for (const target of TARGETS) {
    const collection = target.model.collection;
    const existing = await collection.indexes();
    const match = existing.find((index) => keysMatch(index.key || {}, target.spec));

    if (!match || !match.name) {
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
      console.error("Migration 37 failed:", error);
      process.exit(1);
    });
}
