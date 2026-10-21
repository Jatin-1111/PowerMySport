import "dotenv/config";
import mongoose from "mongoose";

/**
 * Migration 66: unset `type` on every player row. Every row is a child now.
 *
 * Run it ONLY after migration 65 has deleted the SELF rows AND the code that stops
 * filtering on `type` is live in production. Until then, the previous server code still
 * filters `type: "DEPENDENT"`, so unsetting it earlier would make every child disappear
 * from the profile, the booking page and the expert page. For the same reason it refuses
 * to run while any SELF row exists.
 *
 * After it has run, remove the `type` field from `Player.ts` (it is kept, defaulting to
 * DEPENDENT, so rows created in the meantime still match the old filter).
 *
 * Raw collection only, no model import, for the same reason as migration 55.
 *
 * USAGE (invoke ts-node directly; PowerShell strips `--` from `npm run`):
 *
 *   npx ts-node src/migrations/66_remove_player_type.ts
 *   npx ts-node src/migrations/66_remove_player_type.ts --apply
 */

type Db = mongoose.mongo.Db;

interface Options {
  apply?: boolean;
}

export interface Result {
  withType: number;
  selfRows: number;
  refused: boolean;
  changed: number;
}

export const up = async (
  options: Options = {},
  db: Db = mongoose.connection.db as unknown as Db
): Promise<Result> => {
  const { apply = false } = options;
  const players = db.collection("players");

  const withType = await players.countDocuments({ type: { $exists: true } });
  const selfRows = await players.countDocuments({ type: "SELF" });
  const result: Result = { withType, selfRows, refused: false, changed: 0 };

  console.log(`[unset]  type: ${withType} row(s) carry it, ${selfRows} of them SELF`);
  if (selfRows > 0) {
    result.refused = true;
    console.log("[refuse] SELF rows still exist. Run migration 65 first.");
    return result;
  }

  if (apply && withType > 0) {
    const updated = await players.updateMany({ type: { $exists: true } }, { $unset: { type: "" } });
    result.changed = updated.modifiedCount;
  }
  console.log(
    apply ? `Done. Unset on ${result.changed} row(s).` : "Dry run complete. Re-run with --apply."
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
      console.error("Migration 66 failed:", error);
      process.exit(1);
    });
}
