import "dotenv/config";
import mongoose from "mongoose";

/**
 * Migration 57: remove child-profile fields the product no longer collects or reads.
 *
 * Dropped from the `Player` model:
 *  - `medicalConditions` (free text, scored contact sports down on any entry, had
 *    no stated purpose) and seven track-record / legacy fields: `bestResultTier`,
 *    `achievementsNote`, `academyName`, `sessionsPerWeek`, `trainingMonths`,
 *    `paymentHistory`, `pathwayState`.
 *  - `build` and `heightCategory`, which were derived from height, weight and age
 *    and are now derived where shown.
 *  - For CHILD rows only, `budgetTier`, `primaryObjective` and
 *    `weeklyTimeCommitment`, which duplicated `budgetRange`, `ambition` and
 *    `weeklyHoursCategory`. The adult player's own row keeps them.
 *
 * Before the duplicates are unset, a child who has only the old value gets the
 * finer one (budgetTier -> budgetRange, weeklyTimeCommitment ->
 * weeklyHoursCategory, "Recreational" -> ambition "fun"), so no answer is lost.
 * Other primaryObjective values do not map cleanly onto `ambition` and are not
 * carried over.
 *
 * The code already ignores the removed fields (Mongoose strict mode), so this only
 * changes stored values. Run order against a deploy does not matter.
 *
 * Read the counts before --apply: `$unset` cannot be undone.
 *
 * Like migrations 50, 51 and 55 this does not import the model, so running it
 * on a laptop creates no collection or index in production.
 *
 * USAGE: invoke ts-node directly (PowerShell strips `--` from `npm run`).
 *
 *   npx ts-node src/migrations/57_remove_unused_child_fields.ts
 *   npx ts-node src/migrations/57_remove_unused_child_fields.ts --apply
 *
 * Re-running is idempotent.
 */

type Db = mongoose.mongo.Db;

interface Options {
  apply?: boolean;
}

const COLLECTION = "players";

export const REMOVED_FIELDS = [
  "medicalConditions",
  "bestResultTier",
  "achievementsNote",
  "academyName",
  "sessionsPerWeek",
  "trainingMonths",
  "paymentHistory",
  "pathwayState",
  "build",
  "heightCategory",
] as const;

/** Removed for children only; the adult player's own row still uses these. */
export const REMOVED_CHILD_FIELDS = [
  "budgetTier",
  "primaryObjective",
  "weeklyTimeCommitment",
] as const;

const CHILD = { type: "DEPENDENT" };
const missing = (field: string) => ({ $or: [{ [field]: { $exists: false } }, { [field]: null }] });

/** Carries an answer from the old field to the finer one when only the old one is set. */
export const BACKFILLS: Array<{ label: string; filter: object; set: object }> = [
  ...(
    [
      ["Budget", "3k-7k"],
      ["Moderate", "7k-15k"],
      ["Premium", "15k-plus"],
    ] as const
  ).map(([tier, range]) => ({
    label: `budgetTier ${tier} -> budgetRange ${range}`,
    filter: { ...CHILD, budgetTier: tier, ...missing("budgetRange") },
    set: { budgetRange: range },
  })),
  ...(
    [
      [{ $lte: 3 }, "1-3"],
      [{ $gt: 3, $lte: 7 }, "4-7"],
      [{ $gt: 7, $lte: 12 }, "8-12"],
      [{ $gt: 12 }, "13-plus"],
    ] as const
  ).map(([cond, category]) => ({
    label: `weeklyTimeCommitment ${JSON.stringify(cond)} -> weeklyHoursCategory ${category}`,
    filter: { ...CHILD, weeklyTimeCommitment: cond, ...missing("weeklyHoursCategory") },
    set: { weeklyHoursCategory: category },
  })),
  {
    label: "primaryObjective Recreational -> ambition fun",
    filter: { ...CHILD, primaryObjective: "Recreational", ...missing("ambition") },
    set: { ambition: "fun" },
  },
];

export const up = async (
  options: Options = {},
  db: Db = mongoose.connection.db as unknown as Db
): Promise<void> => {
  const { apply = false } = options;
  const players = db.collection(COLLECTION);

  for (const { label, filter, set } of BACKFILLS) {
    const count = await players.countDocuments(filter);
    console.log(`[fill]   ${label}: ${count} row(s)`);
    if (apply && count > 0) await players.updateMany(filter, { $set: set });
  }

  const anywhere = { $or: REMOVED_FIELDS.map((field) => ({ [field]: { $exists: true } })) };
  const onChildren = {
    ...CHILD,
    $or: REMOVED_CHILD_FIELDS.map((field) => ({ [field]: { $exists: true } })),
  };

  for (const field of REMOVED_FIELDS) {
    const count = await players.countDocuments({ [field]: { $exists: true } });
    console.log(`[count]  ${field}: ${count} row(s) have the field`);
  }
  for (const field of REMOVED_CHILD_FIELDS) {
    const count = await players.countDocuments({ ...CHILD, [field]: { $exists: true } });
    console.log(`[count]  ${field} (children only): ${count} row(s) have the field`);
  }

  if (apply) {
    const unset = (fields: readonly string[]) =>
      Object.fromEntries(fields.map((field) => [field, ""]));
    const a = await players.updateMany(anywhere, { $unset: unset(REMOVED_FIELDS) });
    const b = await players.updateMany(onChildren, { $unset: unset(REMOVED_CHILD_FIELDS) });
    console.log(`Unset on ${a.modifiedCount} row(s), and on ${b.modifiedCount} child row(s).`);
  }
  console.log(apply ? "Done." : "Dry run complete. Re-run with --apply.");
};

if (require.main === module) {
  const argv = process.argv.slice(2);
  const options: Options = { apply: argv.includes("--apply") };

  const uri = process.env.MONGO_URI || process.env.MONGODB_URI;
  if (!uri) {
    console.error("MONGO_URI is not set");
    process.exit(1);
  }

  void mongoose
    .connect(uri, { autoIndex: false, autoCreate: false })
    .then(async () => {
      console.log(`Target database: ${mongoose.connection.name} on ${mongoose.connection.host}`);
      await up(options);
    })
    .then(() => mongoose.disconnect())
    .then(() => process.exit(0))
    .catch((error: unknown) => {
      console.error("Migration 57 failed:", error);
      process.exit(1);
    });
}
