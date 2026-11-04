import "dotenv/config";
import mongoose from "mongoose";
import { EditionAcceptance } from "../shared/models/EditionAcceptance";

/**
 * Migration 54: the two indexes `editionacceptances` needs.
 *
 * The deployed server runs with `autoIndex` off, so the model's own
 * `schema.index(...)` creates nothing there. Without the unique pair
 * `{externalId, category}` a repeated capture could store one finished event
 * twice and skew every "who got in before" verdict. The second index serves the
 * planner's lookup: same level, age group and gender, newest first.
 *
 * USAGE
 *   npx ts-node src/migrations/54_add_edition_acceptance_indexes.ts
 *   npx ts-node src/migrations/54_add_edition_acceptance_indexes.ts --apply
 *   npx ts-node src/migrations/54_add_edition_acceptance_indexes.ts --down --apply
 *
 * Not `npm run ... -- --apply`: PowerShell eats the bare `--` and this would
 * report a dry run having created nothing.
 */

interface Options {
  apply?: boolean;
}

type Spec = { name: string; key: Record<string, 1 | -1>; unique: boolean };

const SPECS: Spec[] = [
  { name: "externalId_1_category_1", key: { externalId: 1, category: 1 }, unique: true },
  {
    name: "ladder_1_ageGroup_1_gender_1_startDate_-1",
    key: { ladder: 1, ageGroup: 1, gender: 1, startDate: -1 },
    unique: false,
  },
];

const sameKey = (a: Record<string, unknown>, b: Record<string, unknown>): boolean =>
  JSON.stringify(Object.entries(a)) === JSON.stringify(Object.entries(b));

export const up = async (options: Options = {}) => {
  const apply = Boolean(options.apply);
  console.log(`Migration 54: edition acceptance indexes (${apply ? "APPLY" : "DRY RUN"})`);

  const collection = EditionAcceptance.collection;
  const existing = await collection.indexes().catch(() => []);

  for (const spec of SPECS) {
    if (existing.some((index) => sameKey(index.key || {}, spec.key))) {
      console.log(`  [skip] ${spec.name} already present`);
      continue;
    }
    if (!apply) {
      console.log(`  [would create] ${spec.name}${spec.unique ? " (unique)" : ""}`);
      continue;
    }
    await collection.createIndex(spec.key, { name: spec.name, unique: spec.unique });
    console.log(`  [created] ${spec.name}`);
  }
};

export const down = async (options: Options = {}) => {
  const apply = Boolean(options.apply);
  console.log(`Reverting migration 54 (${apply ? "APPLY" : "DRY RUN"})`);

  const collection = EditionAcceptance.collection;
  const existing = await collection.indexes().catch(() => []);

  for (const spec of SPECS) {
    const match = existing.find((index) => sameKey(index.key || {}, spec.key));
    if (!match?.name) {
      console.log(`  [skip] ${spec.name} not present`);
      continue;
    }
    if (!apply) {
      console.log(`  [would drop] ${match.name}`);
      continue;
    }
    await collection.dropIndex(match.name);
    console.log(`  [dropped] ${match.name}`);
  }
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
      console.error("Migration 54 failed:", error);
      await mongoose.disconnect().catch(() => undefined);
      process.exit(1);
    });
}
