import "dotenv/config";
import mongoose from "mongoose";

/**
 * Migration 64: remove `skillLevel` and `wizardCity` from every player row.
 *
 * Decided 2026-10-21 (Phase 4 of the child profile plan). Neither has a writer: no screen
 * ever sent `skillLevel` (rows carry an empty string, or a leftover "BEGINNER" from
 * migration 14's default) and nothing wrote `wizardCity`. The code that read them is
 * gone, so they are unset.
 *
 * Safe in either order with a deploy: old code reading them gets `undefined`, new code
 * ignores them. It is a plain `$unset`, so there is nothing to copy first.
 *
 * Raw collection only, no model import, for the same reason as migration 55: importing a
 * model on a laptop creates its indexes in production.
 *
 * USAGE (invoke ts-node directly; PowerShell strips `--` from `npm run`):
 *
 *   npx ts-node src/migrations/64_remove_dead_child_fields.ts
 *   npx ts-node src/migrations/64_remove_dead_child_fields.ts --apply
 *
 * The dry run counts rows and says how many hold a real (non-empty) value. Irreversible
 * by design: the values were either empty or a default nobody chose.
 */

type Db = mongoose.mongo.Db;

interface Options {
  apply?: boolean;
}

export const FIELDS = ["skillLevel", "wizardCity"];

const isReal = (value: unknown) => typeof value === "string" && value.trim() !== "";

export const up = async (
  options: Options = {},
  db: Db = mongoose.connection.db as unknown as Db
): Promise<{ rows: number }> => {
  const { apply = false } = options;
  const players = db.collection("players");

  const present = { $or: FIELDS.map((field) => ({ [field]: { $exists: true } })) };
  const rows = await players
    .find(present, { projection: { type: 1, ...Object.fromEntries(FIELDS.map((f) => [f, 1])) } })
    .toArray();

  for (const field of FIELDS) {
    const withField = rows.filter((row) => row[field] !== undefined);
    const real = withField.filter((row) => isReal(row[field]));
    const values = [...new Set(real.map((row) => String(row[field])))];
    console.log(
      `[unset]  ${field}: ${withField.length} row(s), ${real.length} with a value` +
        (values.length ? ` (${values.join(", ")})` : "")
    );
  }
  console.log(`         ${rows.length} row(s) in all`);

  if (apply && rows.length > 0) {
    await players.updateMany(present, {
      $unset: Object.fromEntries(FIELDS.map((field) => [field, ""])),
    });
  }
  console.log(apply ? "Done." : "Dry run complete. Re-run with --apply.");
  return { rows: rows.length };
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
      console.error("Migration 64 failed:", error);
      process.exit(1);
    });
}
