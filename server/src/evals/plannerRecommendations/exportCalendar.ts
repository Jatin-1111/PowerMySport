/* eslint-disable @typescript-eslint/no-var-requires */
/**
 * Freezes the upcoming tennis calendar into `fixtures/calendar.json`, so an evaluation
 * run always judges the same events, whatever the live calendar has become.
 *
 *   node dist/evals/plannerRecommendations/exportCalendar.js [--today YYYY-MM-DD]
 *
 * READ ONLY, and deliberately careful about it: this repo runs scripts against the
 * production database, and importing a model while autoIndex is on creates its
 * collection and indexes there. So autoIndex is switched off BEFORE any model is
 * required, and the one query is a plain `find` that writes nothing.
 *
 * What it keeps is public tournament data (names, dates, places, levels, deadlines, the
 * event's own fact-sheet fields). No child, parent or account data is read.
 */
import path = require("path");
import fs = require("fs");

const mongoose = require("mongoose");
mongoose.set("autoIndex", false);
require("dotenv").config({ path: path.resolve(__dirname, "../../../.env") });

const argIndex = process.argv.indexOf("--today");
const todayArg = argIndex >= 0 ? process.argv[argIndex + 1] : undefined;

async function main(): Promise<void> {
  const uri = process.env.MONGO_URI;
  if (!uri) throw new Error("MONGO_URI is not set");

  const { toPlannerEdition } = require("../../client/services/PlannerService");
  const { TournamentEdition } = require("../../shared/models/TournamentEdition");

  await mongoose.connect(uri, { autoIndex: false });
  const start = new Date(`${todayArg ?? new Date().toISOString().slice(0, 10)}T00:00:00.000Z`);

  const rows = await TournamentEdition.find({
    sportSlug: "tennis",
    startDate: { $gte: start },
    status: { $ne: "cancelled" },
    mergedInto: { $in: [null, undefined] },
  })
    .select(
      "slug name startDate endDate city state venue registrationDeadlineDate ageGroups ladder grade kind " +
        "externalId detailUrl lastCheckedAt entryOpensDate withdrawalDeadlineDate freezeDeadlineDate " +
        "deadlineTimes feeSingles feeDoubles dailyAllowance surface qualifyingStartDate mainDrawStartDate " +
        "officialDetailsSource"
    )
    .sort({ startDate: 1 })
    .limit(200)
    .lean();

  // The detail page address is a signed link on a platform AITA left: never kept.
  const editions = rows.map((row: Record<string, unknown>) => {
    const edition = toPlannerEdition(row);
    if (edition.official) delete edition.official.pageUrl;
    return edition;
  });

  const out = path.resolve(__dirname, "../../../src/evals/plannerRecommendations/fixtures");
  fs.mkdirSync(out, { recursive: true });
  const file = path.join(out, "calendar.json");
  fs.writeFileSync(
    file,
    JSON.stringify({ frozenOn: start.toISOString().slice(0, 10), editions }, null, 2) + "\n"
  );
  // eslint-disable-next-line no-console
  console.log(
    `Wrote ${editions.length} editions from ${start.toISOString().slice(0, 10)} to ${file}`
  );
  await mongoose.disconnect();
}

main().catch((error) => {
  // eslint-disable-next-line no-console
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
