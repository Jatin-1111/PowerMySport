import "dotenv/config";
import mongoose from "mongoose";

/**
 * Migration 58: move a child's sport-matching quiz answers into `Player.quiz`.
 *
 * The sixteen quiz inputs (height, weight, energy, motor, visual tracking,
 * eyesight, agility, team/individual, competitive response, focus, decision
 * style, pressure, repetition, contact, environment, water comfort) used to sit
 * on the profile one by one. They are now one `quiz` sub-document that a retake
 * replaces whole. The code reads and writes `quiz` only, and ignores the old
 * top-level fields.
 *
 * Two phases, so the deploy cannot lose anyone's answers:
 *
 *   1. COPY (default phase, run BEFORE the deploy). Builds `quiz` from the
 *      top-level fields for every row that has any of them and no `quiz` yet.
 *      Old fields are left in place, and the old code ignores `quiz`, so this is
 *      safe to run at any time and safe to repeat.
 *   2. UNSET (`--unset-legacy`, run AFTER the deploy is live and checked). Removes
 *      the old top-level fields, only from rows that already have `quiz`.
 *      Irreversible.
 *
 * Like migrations 50, 51, 55 and 57 this does not import the model, so running it
 * on a laptop creates no collection or index in production.
 *
 * USAGE: invoke ts-node directly (PowerShell strips `--` from `npm run`).
 *
 *   npx ts-node src/migrations/58_move_quiz_answers_into_quiz.ts
 *   npx ts-node src/migrations/58_move_quiz_answers_into_quiz.ts --apply
 *   npx ts-node src/migrations/58_move_quiz_answers_into_quiz.ts --unset-legacy
 *   npx ts-node src/migrations/58_move_quiz_answers_into_quiz.ts --unset-legacy --apply
 *
 * Without --apply each phase only prints counts.
 */

type Db = mongoose.mongo.Db;

interface Options {
  apply?: boolean;
  unsetLegacy?: boolean;
}

const COLLECTION = "players";

export const QUIZ_FIELDS = [
  "heightCm",
  "weightKg",
  "energyType",
  "motorType",
  "visualTracking",
  "eyesight",
  "agility",
  "teamIndividual",
  "competitiveResponse",
  "focusStyle",
  "decisionStyle",
  "pressureResponse",
  "repetitionTolerance",
  "contactComfort",
  "environment",
  "waterComfort",
] as const;

const hasLegacy = { $or: QUIZ_FIELDS.map((field) => ({ [field]: { $exists: true } })) };

/** The quiz sub-document for one row: only fields that hold a value. */
export const buildQuiz = (row: Record<string, unknown>): Record<string, unknown> => {
  const quiz: Record<string, unknown> = {};
  for (const field of QUIZ_FIELDS) {
    const value = row[field];
    if (value !== undefined && value !== null && value !== "") quiz[field] = value;
  }
  return quiz;
};

export const up = async (
  options: Options = {},
  db: Db = mongoose.connection.db as unknown as Db
): Promise<void> => {
  const { apply = false, unsetLegacy = false } = options;
  const players = db.collection(COLLECTION);

  if (!unsetLegacy) {
    const filter = { ...hasLegacy, quiz: { $exists: false } };
    const rows = await players.find(filter).toArray();
    let copied = 0;
    let empty = 0;
    for (const row of rows) {
      const quiz = buildQuiz(row);
      if (Object.keys(quiz).length === 0) {
        empty += 1;
        continue;
      }
      copied += 1;
      if (apply) await players.updateOne({ _id: row._id }, { $set: { quiz } });
    }
    console.log(
      `[copy]   ${copied} row(s) get a quiz sub-document; ${empty} row(s) have only empty old fields`
    );
    console.log(apply ? "Done." : "Dry run complete. Re-run with --apply.");
    return;
  }

  const unset = Object.fromEntries(QUIZ_FIELDS.map((field) => [field, ""]));
  const withQuiz = { ...hasLegacy, quiz: { $exists: true } };
  const ready = await players.countDocuments(withQuiz);

  // A row with old fields, no quiz and nothing but empty values has nothing to
  // lose; a row with real values and no quiz has not been copied yet.
  const stragglers = await players.find({ ...hasLegacy, quiz: { $exists: false } }).toArray();
  const emptyIds = stragglers
    .filter((row) => Object.keys(buildQuiz(row)).length === 0)
    .map((row) => row._id);
  const notCopied = stragglers.length - emptyIds.length;

  console.log(`[unset]  ${ready} row(s) have a quiz and still carry the old fields`);
  console.log(`[unset]  ${emptyIds.length} row(s) carry only empty old fields`);
  console.log(`[skip]   ${notCopied} row(s) have answers but no quiz yet (run the copy first)`);
  if (apply) {
    const a = await players.updateMany(withQuiz, { $unset: unset });
    const b = emptyIds.length
      ? await players.updateMany({ _id: { $in: emptyIds } }, { $unset: unset })
      : { modifiedCount: 0 };
    console.log(`Unset on ${a.modifiedCount + b.modifiedCount} row(s).`);
  }
  console.log(apply ? "Done." : "Dry run complete. Re-run with --unset-legacy --apply.");
};

if (require.main === module) {
  const argv = process.argv.slice(2);
  const options: Options = {
    apply: argv.includes("--apply"),
    unsetLegacy: argv.includes("--unset-legacy"),
  };

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
      console.error("Migration 58 failed:", error);
      process.exit(1);
    });
}
