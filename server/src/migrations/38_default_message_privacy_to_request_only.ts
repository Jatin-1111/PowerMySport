import "dotenv/config";
import mongoose from "mongoose";
import { CommunityProfile } from "../community/models/CommunityProfile";

/**
 * Migration 38: move existing community profiles from `messagePrivacy:
 * "EVERYONE"` to `"REQUEST_ONLY"`.
 *
 * The schema default changed to `REQUEST_ONLY`, but a Mongoose default only
 * applies to documents created after it — every profile that already exists
 * keeps `EVERYONE` and stays open to unsolicited DMs. Without this migration
 * the policy would apply only to people who join from now on, which is exactly
 * backwards: the accounts that have been in the community longest are the ones
 * most likely to have been found by a stranger.
 *
 * Only `EVERYONE` is rewritten. `NONE` is stricter than the new default and is
 * always a deliberate choice, so moving those to `REQUEST_ONLY` would *loosen*
 * a setting the user picked — the one outcome a privacy migration must never
 * have. Profiles already on `REQUEST_ONLY` are left alone.
 *
 * This does not touch `isIdentityPublic` or profile visibility. The change is
 * scoped to who may open a conversation.
 *
 * Note the reverse is lossy and says so: profiles that chose `EVERYONE`
 * deliberately are indistinguishable from those that merely inherited it, so
 * `down` returns every `REQUEST_ONLY` profile to `EVERYONE` — including any
 * that picked it themselves. It exists to undo a bad rollout, not as a routine
 * toggle.
 *
 * Idempotent: re-running finds nothing left on `EVERYONE`.
 *
 * USAGE
 *   npm run migrate:message-privacy                      # dry run (default)
 *   npm run migrate:message-privacy -- --apply           # apply
 *   npm run migrate:message-privacy -- --down --apply    # revert (lossy)
 */

interface Options {
  apply?: boolean;
}

export const up = async (options: Options = {}) => {
  const apply = Boolean(options.apply);
  console.log(
    `Starting migration 38: messagePrivacy EVERYONE -> REQUEST_ONLY (${apply ? "APPLY" : "DRY RUN"})...`
  );

  const [everyone, requestOnly, none] = await Promise.all([
    CommunityProfile.countDocuments({ messagePrivacy: "EVERYONE" }),
    CommunityProfile.countDocuments({ messagePrivacy: "REQUEST_ONLY" }),
    CommunityProfile.countDocuments({ messagePrivacy: "NONE" }),
  ]);

  console.log(`  EVERYONE:     ${everyone}  <- to be changed`);
  console.log(`  REQUEST_ONLY: ${requestOnly}  (already private)`);
  console.log(`  NONE:         ${none}  (stricter — left untouched)`);

  if (everyone === 0) {
    console.log("  nothing on EVERYONE — nothing to do.");
    return;
  }

  if (!apply) {
    console.log("Dry run complete — re-run with --apply.");
    return;
  }

  const result = await CommunityProfile.updateMany(
    { messagePrivacy: "EVERYONE" },
    { $set: { messagePrivacy: "REQUEST_ONLY" } }
  );

  console.log(`  updated ${result.modifiedCount} profile(s).`);
  console.log("Migration 38 complete.");
};

export const down = async (options: Options = {}) => {
  const apply = Boolean(options.apply);
  console.log(`Reverting migration 38 (${apply ? "APPLY" : "DRY RUN"})...`);
  console.log(
    "  WARNING: lossy — profiles that chose REQUEST_ONLY themselves cannot be told apart\n" +
      "  from those migrated into it, so this loosens both back to EVERYONE."
  );

  const affected = await CommunityProfile.countDocuments({ messagePrivacy: "REQUEST_ONLY" });
  console.log(`  REQUEST_ONLY: ${affected} -> EVERYONE`);

  if (!apply) {
    console.log("Dry run complete — re-run with --down --apply.");
    return;
  }

  const result = await CommunityProfile.updateMany(
    { messagePrivacy: "REQUEST_ONLY" },
    { $set: { messagePrivacy: "EVERYONE" } }
  );

  console.log(`  reverted ${result.modifiedCount} profile(s).`);
  console.log("Revert complete.");
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
      console.error("Migration 38 failed:", error);
      process.exit(1);
    });
}
