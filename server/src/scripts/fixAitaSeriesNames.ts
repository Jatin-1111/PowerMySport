/**
 * Corrects the AITA tier names in already-seeded curated Tournament records.
 *
 * Report only (safe):  npx ts-node src/scripts/fixAitaSeriesNames.ts
 * Actually write:      npx ts-node src/scripts/fixAitaSeriesNames.ts --apply
 *
 * The original seed data had two AITA series names wrong — "City Series" for CS
 * (it is Championship Series) and "Team Series" for TS (it is Talent Series) —
 * and, worse, described CS as the beginner entry point, which is actually TS's
 * role. That text is user-facing on the federation Tournaments tab.
 *
 * seedCuratedTournaments.ts has been corrected too, but re-running it is not the
 * fix here: it does `updateOne($set: wholeRecord, upsert)`, so it would also
 * revert any edits an admin has since made through the data-source review flow.
 * This patches only the affected substrings in the affected fields.
 */

import "dotenv/config";
import mongoose from "mongoose";
import { Tournament } from "../shared/models/Tournament";

const MONGO_URI = process.env.MONGO_URI || process.env.DATABASE_URL || "";
if (!MONGO_URI) {
  console.error("MONGO_URI not set in .env");
  process.exit(1);
}

const APPLY = process.argv.includes("--apply");

/**
 * Applied in order — the long prose rewrites must run before the plain renames,
 * otherwise the renames alter the text the prose patterns are matching against.
 */
const REPLACEMENTS: Array<[string, string]> = [
  [
    "AITA organises a tiered domestic ranking circuit. City Series (CS): city-level events, the accessible entry point for beginners. National Series (NS): national-level events with significantly higher ranking points.",
    "AITA organises a tiered domestic ranking circuit. Talent Series (TS): the accessible entry point for beginners. Championship Series (CS): the broad ranking tier held across India. National Series (NS): national-level events with significantly higher ranking points.",
  ],
  [
    "The AITA Senior Ranking Circuit runs four tiers. City Series (CS): held dozens of times per year across India — the correct starting point. National Series (NS): higher points, stronger field, national venue.",
    "The AITA Senior Ranking Circuit runs four tiers. Talent Series (TS): the entry rung for players new to the circuit. Championship Series (CS): held dozens of times per year across India — the main ranking tier. National Series (NS): higher points, stronger field, national venue.",
  ],
  [
    "AITA's junior circuit mirrors the senior system across four tiers. Junior City Series (CS): city-level events for beginners — the correct starting point. Junior National Series (NS): national events for established state-level juniors.",
    "AITA's junior circuit mirrors the senior system across four tiers. Junior Talent Series (TS): entry-level events for beginners — the correct starting point. Junior Championship Series (CS): the main junior ranking tier, held across India. Junior National Series (NS): national events for established state-level juniors.",
  ],
  [
    "across four tiers: Super Series (SS), National Series (NS), City Series (CS), and Team Series (TS).",
    "across four tiers: Super Series (SS), National Series (NS), Championship Series (CS), and Talent Series (TS).",
  ],
  [
    "start with City Series if new to the circuit",
    "start with Talent Series if new to the circuit",
  ],
  ["Team Series (TS)", "Talent Series (TS)"],
  ["Junior City Series (CS)", "Junior Championship Series (CS)"],
  ["AITA City Series (CS)", "AITA Championship Series (CS)"],
  ["City Series (CS)", "Championship Series (CS)"],
  ["City Series: ₹500", "Championship Series: ₹500"],
];

function fixValue(value: unknown): unknown {
  if (typeof value === "string") {
    let out = value;
    for (const [from, to] of REPLACEMENTS) out = out.split(from).join(to);
    return out;
  }
  if (Array.isArray(value)) return value.map(fixValue);
  return value;
}

/** Only text fields are touched — never names, slugs, levels or any identity field. */
const TEXT_FIELDS = [
  "description",
  "circuitContext",
  "qualificationPath",
  "participationGuide",
  "keyFacts",
  "importantNotes",
  "entryFee",
  "selectionCriteria",
  "prizes",
  "registrationDeadline",
  "typicalDates",
  "format",
] as const;

async function main(): Promise<void> {
  await mongoose.connect(MONGO_URI);
  console.log(`Connected. Mode: ${APPLY ? "APPLY (will write)" : "REPORT ONLY (no writes)"}\n`);

  const docs = (await Tournament.find({}).lean()) as unknown as Array<Record<string, unknown>>;
  let changedDocs = 0;
  let changedFields = 0;

  for (const doc of docs) {
    const update: Record<string, unknown> = {};
    for (const field of TEXT_FIELDS) {
      const before = doc[field];
      if (before === undefined || before === null) continue;
      const after = fixValue(before);
      if (JSON.stringify(before) !== JSON.stringify(after)) update[field] = after;
    }
    if (Object.keys(update).length === 0) continue;

    changedDocs++;
    changedFields += Object.keys(update).length;
    console.log(`${doc.sportSlug}/${doc.slug ?? "(no slug)"} — "${doc.name}"`);
    for (const [field, after] of Object.entries(update)) {
      const beforeStr = JSON.stringify(doc[field]);
      const afterStr = JSON.stringify(after);
      console.log(`   ${field}`);
      console.log(`     - ${beforeStr.slice(0, 150)}${beforeStr.length > 150 ? "…" : ""}`);
      console.log(`     + ${afterStr.slice(0, 150)}${afterStr.length > 150 ? "…" : ""}`);
    }

    if (APPLY) {
      await Tournament.updateOne({ _id: doc._id }, { $set: update });
    }
  }

  console.log(
    `\n─── ${changedFields} field(s) across ${changedDocs} record(s) ${APPLY ? "updated" : "would change"} ───`
  );
  if (!APPLY) console.log("Report only — nothing written. Re-run with --apply.");

  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error("Failed:", err);
  await mongoose.disconnect();
  process.exit(1);
});
