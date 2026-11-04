/**
 * Gives existing TournamentEdition rows a public slug.
 *
 * Report only (safe):  npx ts-node src/scripts/backfillEditionSlugs.ts
 * Actually write:      npx ts-node src/scripts/backfillEditionSlugs.ts --apply
 *
 * Why this exists: slugs are minted at approval time, so every edition approved
 * before /tournaments/[slug] shipped has none — and an edition without a slug
 * never links out from the federation calendar. Without this they would stay
 * unreachable until each calendar source happened to be re-approved.
 *
 * It mints through the same resolveEditionSlug() the approval path uses, so a
 * row backfilled here and the same row re-approved later resolve to one URL.
 *
 * Note this only assigns slugs. Fact sheets and the rest of the detail data
 * come from the admin "Fetch tournament details" action, which needs the
 * per-tournament links that only a re-extraction captures.
 */

import "dotenv/config";
import mongoose from "mongoose";
import { TournamentEdition } from "../shared/models/TournamentEdition";
import { resolveEditionSlug } from "../shared/services/editionSlug";

const MONGO_URI = process.env.MONGO_URI || process.env.DATABASE_URL || "";
if (!MONGO_URI) {
  console.error("MONGO_URI not set in .env");
  process.exit(1);
}

const APPLY = process.argv.includes("--apply");

async function main(): Promise<void> {
  await mongoose.connect(MONGO_URI);
  console.log(`Connected. Mode: ${APPLY ? "APPLY (writes)" : "REPORT ONLY (no writes)"}\n`);

  const rows = await TournamentEdition.find({
    $or: [{ slug: { $exists: false } }, { slug: null }, { slug: "" }],
  })
    .select("_id sportSlug name startDate")
    .sort({ startDate: 1 })
    .lean();

  if (rows.length === 0) {
    console.log("Every edition already has a slug. Nothing to do.");
    await mongoose.disconnect();
    return;
  }

  console.log(`${rows.length} edition(s) without a slug.\n`);
  let written = 0;

  for (const row of rows) {
    // Sequential on purpose: resolveEditionSlug checks the collection for
    // collisions, so concurrent writers could both pick the same candidate.
    const slug = await resolveEditionSlug({
      sportSlug: row.sportSlug,
      name: row.name,
      startDate: row.startDate,
    });

    console.log(`  ${row.sportSlug.padEnd(10)} ${row.name.slice(0, 44).padEnd(46)} -> ${slug}`);

    if (APPLY) {
      await TournamentEdition.updateOne({ _id: row._id }, { $set: { slug } });
      written++;
    }
  }

  console.log(
    APPLY
      ? `\nDone. ${written} edition(s) updated.`
      : `\nReport only — nothing written. Re-run with --apply to write ${rows.length} slug(s).`
  );
  await mongoose.disconnect();
}

main().catch(async (error) => {
  console.error("Backfill failed:", error);
  await mongoose.disconnect();
  process.exit(1);
});
