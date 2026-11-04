import "dotenv/config";
import mongoose from "mongoose";

/**
 * Migration 65: move an adult's own sport details from their `type: "SELF"` Player row onto
 * the user (`athleteProfile`), then delete every SELF row, so `players` holds children only.
 *
 * Decided 2026-10-21 (Phase 5 of the child profile plan). Measured the same day: 43 SELF
 * rows, none referenced by any of the 13 fields that name a child, and the 3 holding any
 * sport details belonged to deleted users, so there is nothing live to preserve. The copy
 * is still done, so the migration is correct for any row that is not empty.
 *
 * What it does, per SELF row:
 *   - an owner that exists, no `athleteProfile` yet, and some real value: copy it over;
 *   - an owner that already has an `athleteProfile`: keep the user's, copy nothing;
 *   - then delete the row.
 * It REFUSES to delete a row that anything points at, and says which collection.
 *
 * RUN IT BEFORE the code that stops filtering on `type` is deployed, and again right after:
 * the new code treats every row in `players` as a child, so a SELF row left behind would
 * show up as a child. It is idempotent. (`type` itself is removed later, by migration 66,
 * once the new code is live.)
 *
 * Raw collections only, no model import, for the same reason as migration 55.
 *
 * USAGE (invoke ts-node directly; PowerShell strips `--` from `npm run`):
 *
 *   npx ts-node src/migrations/65_move_adult_sport_details_to_user.ts
 *   npx ts-node src/migrations/65_move_adult_sport_details_to_user.ts --apply
 */

type Db = mongoose.mongo.Db;

interface Options {
  apply?: boolean;
}

/** Every field that stores a child's id, by raw collection name. Kept in step with CHILD_RECORDS. */
export const REFERENCES: Array<[string, string]> = [
  ["expertsessions", "playerId"],
  ["plancheckins", "dependentId"],
  ["guidancesubmissions", "request.dependent_id"],
  ["bookings", "participantId"],
  ["playerrankinglinks", "dependentId"],
  ["seasonplans", "dependentId"],
  ["screeningrequests", "dependentId"],
  ["coachenrollments", "playerId"],
  ["coachwaitlistentries", "playerId"],
  ["coachsessioncredits", "playerId"],
  ["coachsubscriptions", "dependentId"],
  ["coachsubscriptionpaymenttransactions", "dependentId"],
  ["coachsessionoccurrences", "roster.playerId"],
];

const present = (value: unknown) =>
  Array.isArray(value)
    ? value.length > 0
    : value !== undefined && value !== null && String(value).trim() !== "";

/** The athlete fields of a SELF row that hold a real value, in the shape stored on the user. */
export const buildAthleteProfile = (row: Record<string, any>): Record<string, unknown> | null => {
  const profile: Record<string, unknown> = {};
  for (const field of [
    "sportsFocus",
    "yearsPlaying",
    "personalityTags",
    "primaryObjective",
    "weeklyTimeCommitment",
    "budgetTier",
    "location",
  ]) {
    if (present(row[field])) profile[field] = row[field];
  }
  return Object.keys(profile).length > 0 ? profile : null;
};

export interface Result {
  selfRows: number;
  copied: number;
  keptUsers: number;
  ownerless: number;
  empty: number;
  blocked: number;
  deleted: number;
}

export const up = async (
  options: Options = {},
  db: Db = mongoose.connection.db as unknown as Db
): Promise<Result> => {
  const { apply = false } = options;
  const players = db.collection("players");
  const users = db.collection("users");

  const rows = await players.find({ type: "SELF" }).toArray();
  const result: Result = {
    selfRows: rows.length,
    copied: 0,
    keptUsers: 0,
    ownerless: 0,
    empty: 0,
    blocked: 0,
    deleted: 0,
  };

  const ids = rows.map((row) => row._id);
  const referenced = new Set<string>();
  for (const [collection, field] of REFERENCES) {
    const hit = await db.collection(collection).distinct(field, { [field]: { $in: ids } });
    if (hit.length > 0) {
      console.log(`[blocked] ${collection}.${field}: ${hit.length} SELF row(s) are pointed at`);
      for (const id of hit) referenced.add(String(id));
    }
  }

  const deletable: mongoose.Types.ObjectId[] = [];
  for (const row of rows) {
    if (referenced.has(String(row._id))) {
      result.blocked += 1;
      continue;
    }
    const profile = buildAthleteProfile(row);
    const owner = await users.findOne({ _id: row.userId }, { projection: { athleteProfile: 1 } });
    if (!owner) {
      result.ownerless += 1;
    } else if (!profile) {
      result.empty += 1;
    } else if (owner.athleteProfile) {
      result.keptUsers += 1;
    } else {
      result.copied += 1;
      if (apply) await users.updateOne({ _id: owner._id }, { $set: { athleteProfile: profile } });
    }
    deletable.push(row._id);
  }

  console.log(
    `[move]   ${result.selfRows} SELF row(s): ${result.copied} copied to the user, ` +
      `${result.keptUsers} user already had one, ${result.empty} empty, ` +
      `${result.ownerless} owner no longer exists, ${result.blocked} blocked`
  );
  if (apply && deletable.length > 0) {
    const deleted = await players.deleteMany({ _id: { $in: deletable } });
    result.deleted = deleted.deletedCount ?? 0;
  }
  console.log(
    apply
      ? `Done. Deleted ${result.deleted} SELF row(s).`
      : `Dry run complete: ${deletable.length} row(s) would be deleted. Re-run with --apply.`
  );
  return result;
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
      console.error("Migration 65 failed:", error);
      process.exit(1);
    });
}
