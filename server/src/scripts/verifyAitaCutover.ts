/**
 * Read-only verification that the rewritten source and parser agree with the
 * live site and with what we already hold.
 *
 * The assumption worth proving before anything is ingested: the registration
 * number recovered from the new platform's base64 player key is the *same*
 * identifier the old PDFs printed as `REG NO.`. The primary key
 * (asOnDate, category, subcategory, regNo) rests on it, and so does every
 * week-over-week comparison against the 468k rows already archived. If the two
 * disagree, the first sweep silently starts a parallel history for every player.
 *
 * Touches the network and reads the database. Writes nothing.
 *
 *   npx ts-node src/scripts/verifyAitaCutover.ts
 */

import "dotenv/config";
import mongoose from "mongoose";
import { aitaRankingSource } from "../shared/services/aita/AitaRankingSource";
import { parseRankingList } from "../shared/services/aita/rankingListParser";
import { reconcileStates } from "../shared/services/aita/stateCodes";
import { listByCode } from "../shared/services/aita/types";
import { RankingEntry } from "../shared/models/RankingEntry";

const MONGO_URI = process.env.MONGO_URI || process.env.DATABASE_URL || "";

async function main(): Promise<void> {
  const list = listByCode("BS12")!;

  console.log("── week list ───────────────────────────────────────────────");
  const week = await aitaRankingSource.latestWeek();
  if (!week) throw new Error("No weeks published");
  console.log(`latest week   wid=${week.wid} -> ${week.asOnDate} ("${week.label}")`);

  console.log("\n── state table ─────────────────────────────────────────────");
  const states = await aitaRankingSource.listStates();
  const problems = reconcileStates(states);
  console.log(`${states.length} states published`);
  console.log(
    problems.length === 0
      ? "no drift against our canonical names or zones"
      : problems.map((p) => `  ! ${p}`).join("\n"),
  );

  console.log("\n── parse one list ──────────────────────────────────────────");
  const fetched = await aitaRankingSource.fetchList(list, week.wid);
  const parsed = parseRankingList(fetched.html, {
    requestedPageSize: aitaRankingSource.listPageSize,
  });
  console.log(`${list.code} (${list.category}/${list.subcategory}) ${week.asOnDate}`);
  console.log(`  html         ${(fetched.byteSize / 1_048_576).toFixed(2)} MB`);
  console.log(`  rows         ${parsed.rows.length}`);
  console.log(`  echoed       week=${parsed.sourceWeekof} list=${parsed.sourceCategory}`);
  console.log(`  malformed    ${parsed.diagnostics.malformedRows}`);
  console.log(`  no birthYear ${parsed.diagnostics.missingDob}`);
  console.log(
    `  unmapped st. ${parsed.diagnostics.unknownStateRows} ` +
      `(${parsed.diagnostics.unknownStateCodes.join(", ") || "none"})`,
  );
  console.log(`  warnings     ${parsed.diagnostics.warnings.length}`);
  const first = parsed.rows[0];
  const last = parsed.rows[parsed.rows.length - 1];
  console.log(`  rank 1       ${JSON.stringify(first)}`);
  console.log(`  last         rank=${last?.rank} regNo=${last?.regNo}`);

  // Every row must carry the fields the primary key and the insights layer need.
  const missingRegNo = parsed.rows.filter((r) => !r.regNo).length;
  const missingState = parsed.rows.filter((r) => !r.stateCode).length;
  const dupRegNo = parsed.rows.length - new Set(parsed.rows.map((r) => r.regNo)).size;
  console.log(`  no regNo     ${missingRegNo}`);
  console.log(`  no state     ${missingState}`);
  console.log(`  dup regNo    ${dupRegNo}`);

  console.log("\n── point breakdown, rank 1 ─────────────────────────────────");
  if (first) {
    const { parsePointBreakdown } = await import(
      "../shared/services/aita/rankingListParser"
    );
    const fragment = await aitaRankingSource.fetchPointBreakdown(
      list,
      week.wid,
      first.playerKey,
      first.rank,
    );
    const breakdown = parsePointBreakdown(fragment);
    const scoring = breakdown.slices
      .filter((s) => !s.isInformational && !s.isDeduction)
      .reduce((sum, s) => sum + s.value, 0);
    for (const s of breakdown.slices) {
      const tags = [
        s.isInformational ? "informational" : "",
        s.isDeduction ? "deduction" : "",
        s.isRollDown ? "ROLL-DOWN" : "",
      ]
        .filter(Boolean)
        .join(" ");
      console.log(`  ${s.label.padEnd(20)} ${String(s.value).padStart(9)}  ${tags}`);
    }
    console.log(`  ${"scoring sum".padEnd(20)} ${String(scoring).padStart(9)}`);
    console.log(`  ${"printed total".padEnd(20)} ${String(breakdown.totalPoints).padStart(9)}`);
    console.log(
      `  reconciles?  ${Math.abs(scoring - (breakdown.totalPoints ?? 0)) < 0.01 ? "YES" : "NO"}`,
    );
  }

  if (!MONGO_URI) {
    console.log("\n(no MONGO_URI — skipping the archive continuity check)");
    return;
  }

  console.log("\n── THE ONE THAT MATTERS: continuity with the archive ───────");
  await mongoose.connect(MONGO_URI);
  try {
    const held = await RankingEntry.find({
      category: list.category,
      subcategory: list.subcategory,
      isLatest: true,
    })
      .select("regNo rank fullName")
      .lean();

    if (held.length === 0) {
      console.log("no archived rows for this list — cannot verify continuity");
      return;
    }

    const heldByRegNo = new Map(held.map((r) => [r.regNo, r]));
    const matched = parsed.rows.filter((r) => heldByRegNo.has(r.regNo));
    const rate = (matched.length / parsed.rows.length) * 100;

    console.log(`archived rows  ${held.length} (latest published week we hold)`);
    console.log(`live rows      ${parsed.rows.length}`);
    console.log(`regNo matches  ${matched.length} (${rate.toFixed(1)}% of live rows)`);

    // A name agreeing on a matched regNo is the real proof: the same number
    // pointing at the same person means the key is the same key.
    const sample = matched.slice(0, 5);
    for (const row of sample) {
      const archived = heldByRegNo.get(row.regNo)!;
      console.log(
        `  ${row.regNo}  live "${row.fullName}" (rank ${row.rank})` +
          `  vs archived "${archived.fullName}" (rank ${archived.rank})`,
      );
    }
    console.log(
      rate > 80
        ? "\nVERDICT: the key is continuous — movement against the archive will work."
        : "\nVERDICT: LOW MATCH RATE. Do not ingest; investigate before publishing.",
    );
  } finally {
    await mongoose.disconnect();
  }
}

main().catch((error) => {
  console.error("verification failed:", error);
  process.exitCode = 1;
});
