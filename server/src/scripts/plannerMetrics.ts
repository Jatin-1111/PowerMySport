/* eslint-disable no-console */
/**
 * Prints the planner recommender's daily counters. READ ONLY: one Redis hash read per day.
 *
 *   node dist/scripts/plannerMetrics.js [--days 7]
 *
 * The counters are written by the running server (see `plannerRecommendations/metrics.ts`).
 * Run against local Redis they show only what local requests did; against the deployed
 * Redis, point REDIS_URL at it.
 */
import path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../../.env") });

import { istDay, readMetrics } from "../client/services/plannerRecommendations/metrics";

async function main(): Promise<void> {
  const index = process.argv.indexOf("--days");
  const days = Math.max(1, Number(index >= 0 ? process.argv[index + 1] : 7) || 7);

  const rows: Array<{ day: string; counts: Record<string, number> }> = [];
  for (let back = 0; back < days; back += 1) {
    const day = istDay(new Date(Date.now() - back * 24 * 60 * 60 * 1000));
    rows.push({ day, counts: await readMetrics(day) });
  }

  const names = [...new Set(rows.flatMap((row) => Object.keys(row.counts)))].sort();
  if (names.length === 0) {
    console.log(`No counters in the last ${days} days.`);
  } else {
    console.log(["metric", ...rows.map((row) => row.day)].join("\t"));
    for (const name of names) {
      console.log([name, ...rows.map((row) => row.counts[name] ?? 0)].join("\t"));
    }
    const total = (name: string) => rows.reduce((sum, row) => sum + (row.counts[name] ?? 0), 0);
    const picks = total("model_picks");
    console.log("");
    console.log(
      `asked ${total("asked")}, from cache ${total("cache_hit")}, forced ${total("forced")}`
    );
    console.log(
      `model called ${total("model_called")}, used ${total("answered_by_model")}, ` +
        `fell back ${total("fallback_ai-unavailable") + total("fallback_invalid-output")}`
    );
    if (picks > 0) {
      console.log(
        `reasons replaced ${Math.round((total("model_reasons_replaced") / picks) * 100)}% of ${picks} picks`
      );
    }
    const added = total("added_from_suggestion") + total("added_other");
    if (added > 0) {
      console.log(
        `adds from a suggestion ${Math.round((total("added_from_suggestion") / added) * 100)}% of ${added}`
      );
    }
  }
  process.exit(0);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
