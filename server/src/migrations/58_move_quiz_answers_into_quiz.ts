import "dotenv/config";
import mongoose from "mongoose";

/**
 * Migration 58: move a child's sport-matching quiz answers into `Player.quiz`.
 *
 * The sixteen quiz inputs (height, weight, energy, motor, visual tracking,
 * eyesight, agility, team/individual, competitive response, focus, decision
 * style, pressure, repetition, contact, environment, water comfort) used to sit
 * on the profile one by one. They are now one `quiz` sub-document. The new code
 * reads and writes `quiz` only, and ignores the old top-level fields.
 *
 * Until that code is live the OLD fields are the truth: the old server keeps
 * writing them and knows nothing about `quiz`. Once it is live the truth flips,
 * and the old fields go stale. A migration that is safe on one side of that line
 * destroys data on the other, so each row carries `quizSource`: a snapshot of what
 * the old fields held when `quiz` was last built from them. With three values
 * (old fields L, quiz Q, snapshot S) the migration can tell which side changed:
 *
 *     no old values at all  the quiz came from the new code alone; leave it
 *     L equals Q            in sync
 *     L equals S, Q differs the quiz is newer (the new code wrote it); leave it
 *     Q equals S, L differs the old fields are newer (the old code wrote them); refresh
 *     neither equals S      both changed; a person decides, nothing is touched
 *     no S, L differs from Q  nobody can say which is newer; nothing is touched
 *                             unless --prefer-legacy says the old fields win
 *
 * Phases:
 *
 *   1. COPY (default). Builds `quiz` and `quizSource` for every row that has old
 *      values and no `quiz`. Old fields stay. Safe at any time, safe to repeat.
 *   2. REFRESH (`--refresh`). Does the copy, then brings `quiz` up to date for rows
 *      whose old fields are newer, and records a snapshot on rows that lack one.
 *      Run it just BEFORE the deploy and again just AFTER, to catch what the old
 *      server wrote during the deploy window. It never overwrites a newer quiz.
 *   3. UNSET (`--unset-legacy`). Removes the old fields and the snapshot, ONLY from
 *      rows where doing so loses nothing: the old fields equal the quiz, or they
 *      are unchanged since the copy (so the quiz is at least as new). Any other row
 *      is skipped and listed. Run it after the deploy is live and checked.
 *      Irreversible.
 *
 * Like migrations 50, 51, 55, 57 and 59 this does not import the model, so running
 * it on a laptop creates no collection or index in production.
 *
 * USAGE: invoke ts-node directly (PowerShell strips `--` from `npm run`).
 *
 *   npx ts-node src/migrations/58_move_quiz_answers_into_quiz.ts
 *   npx ts-node src/migrations/58_move_quiz_answers_into_quiz.ts --refresh --apply
 *   npx ts-node src/migrations/58_move_quiz_answers_into_quiz.ts --unset-legacy --apply
 *
 * Without --apply every phase only prints counts. `--prefer-legacy` is only for
 * --refresh, and only before the new code is live.
 */

type Db = mongoose.mongo.Db;

interface Options {
  apply?: boolean;
  unsetLegacy?: boolean;
  refresh?: boolean;
  preferLegacy?: boolean;
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

const canonical = (value: unknown): string => {
  const record = (value && typeof value === "object" ? value : {}) as Record<string, unknown>;
  return JSON.stringify(
    Object.keys(record)
      .sort()
      .map((key) => [key, record[key]])
  );
};

/** True when two answer sets hold the same answers, whatever the key order. */
export const sameAnswers = (a: unknown, b: unknown): boolean => canonical(a) === canonical(b);

export type RowState =
  | "copy" // old values, no quiz yet
  | "in-sync" // old fields equal the quiz
  | "refresh" // the old fields are newer than the quiz
  | "quiz-newer" // the quiz is newer than the old fields
  | "conflict" // both changed since the snapshot
  | "unknown" // they differ and there is no snapshot to say which is newer
  | "none"; // nothing to move

/** Which side of one row is newer, from the three values described in the header. */
export const classify = (row: Record<string, unknown>): RowState => {
  const legacy = buildQuiz(row);
  const hasLegacy = Object.keys(legacy).length > 0;
  const quiz = row.quiz as Record<string, unknown> | undefined | null;
  const source = row.quizSource as Record<string, unknown> | undefined | null;

  if (!quiz) return hasLegacy ? "copy" : "none";
  // A quiz with no old values behind it was written by the new code alone. There is
  // nothing to refresh it from, and an empty set must never overwrite it.
  if (!hasLegacy) return "quiz-newer";
  if (sameAnswers(legacy, quiz)) return "in-sync";
  if (!source) return "unknown";
  if (sameAnswers(legacy, source)) return "quiz-newer";
  if (sameAnswers(quiz, source)) return "refresh";
  return "conflict";
};

/** True when removing a row's old fields loses no answer. */
export const safeToUnset = (row: Record<string, unknown>): boolean => {
  const state = classify(row);
  if (state === "none") return true; // nothing real in the old fields
  return state === "in-sync" || state === "quiz-newer";
};

const unsetFields = () => Object.fromEntries([...QUIZ_FIELDS, "quizSource"].map((f) => [f, ""]));

const anyOldField = { $or: QUIZ_FIELDS.map((field) => ({ [field]: { $exists: true } })) };

export const up = async (
  options: Options = {},
  db: Db = mongoose.connection.db as unknown as Db
): Promise<void> => {
  const { apply = false, unsetLegacy = false, refresh = false, preferLegacy = false } = options;
  const players = db.collection(COLLECTION);

  if (unsetLegacy) {
    const rows = await players
      .find({ $or: [...anyOldField.$or, { quizSource: { $exists: true } }] })
      .toArray();
    const safe = rows.filter((row) => safeToUnset(row));
    const skipped = rows.filter((row) => !safeToUnset(row));
    const reasons: Record<string, number> = {};
    for (const row of skipped) reasons[classify(row)] = (reasons[classify(row)] ?? 0) + 1;

    console.log(
      `[unset]  ${safe.length} row(s) can lose their old fields without losing an answer`
    );
    console.log(
      `[skip]   ${skipped.length} row(s) held back ${JSON.stringify(reasons)}` +
        (skipped.length ? " (run --refresh, or look at them)" : "")
    );
    if (apply && safe.length) {
      const result = await players.updateMany(
        { _id: { $in: safe.map((row) => row._id) } },
        { $unset: unsetFields() }
      );
      console.log(`Unset on ${result.modifiedCount} row(s).`);
    }
    console.log(apply ? "Done." : "Dry run complete. Re-run with --unset-legacy --apply.");
    return;
  }

  const rows = await players
    .find({ $or: [...anyOldField.$or, { quiz: { $exists: true } }] })
    .toArray();
  const tally: Record<string, number> = {};
  let snapshots = 0;

  for (const row of rows) {
    let state = classify(row);
    if (state === "unknown" && preferLegacy && refresh) state = "refresh";
    tally[state] = (tally[state] ?? 0) + 1;
    const legacy = buildQuiz(row);

    if (state === "copy") {
      if (apply) {
        await players.updateOne({ _id: row._id }, { $set: { quiz: legacy, quizSource: legacy } });
      }
      continue;
    }
    if (!refresh) continue;

    if (state === "refresh") {
      if (apply) {
        await players.updateOne({ _id: row._id }, { $set: { quiz: legacy, quizSource: legacy } });
      }
    } else if (state === "in-sync" && !row.quizSource) {
      snapshots += 1;
      if (apply) await players.updateOne({ _id: row._id }, { $set: { quizSource: legacy } });
    }
  }

  console.log(`[rows]   ${JSON.stringify(tally)}`);
  if (refresh) {
    console.log(
      `[snap]   ${snapshots} in-sync row(s) get a snapshot so the unset can tell sides apart`
    );
    const held = (tally.conflict ?? 0) + (tally.unknown ?? 0);
    if (held && !(preferLegacy && refresh)) {
      console.log(
        `[hold]   ${held} row(s) not touched: both sides changed, or no snapshot to compare` +
          " (--prefer-legacy says the old fields win; only before the new code is live)"
      );
    }
  } else if ((tally.refresh ?? 0) + (tally.unknown ?? 0) + (tally.conflict ?? 0) > 0) {
    console.log("[note]   some rows are out of sync; run with --refresh to see and fix them");
  }
  console.log(apply ? "Done." : "Dry run complete. Re-run with --apply.");
};

if (require.main === module) {
  const argv = process.argv.slice(2);
  const options: Options = {
    apply: argv.includes("--apply"),
    unsetLegacy: argv.includes("--unset-legacy"),
    refresh: argv.includes("--refresh"),
    preferLegacy: argv.includes("--prefer-legacy"),
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
