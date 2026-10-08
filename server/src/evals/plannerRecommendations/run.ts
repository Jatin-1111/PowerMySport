/* eslint-disable no-console */
/**
 * Evaluate the planner's recommendations.
 *
 *   node dist/evals/plannerRecommendations/run.js [options]
 *
 *   --label <name>        Name of this run (default "rules-only"). Used in the file names.
 *   --model               Also run the model, for every child. Spends Gemini calls.
 *   --runs <n>            Model runs per child, to measure stability (default 2 with --model).
 *   --delay-ms <n>        Pause between model calls (default 6500: stays under 10 a minute).
 *   --only <child-id>     Run one profile.
 *   --out <dir>           Where reports go (default docs/planner-eval in the repo root).
 *   --review-sheet        Also write review-sheet.csv, for hand labelling realism.
 *
 * Without --model nothing leaves this machine: no database, no network. With --model the
 * only thing sent is the synthetic profiles and the public calendar, never anyone's data.
 *
 * Exit code is 1 when any answer breaks a rule, so this can gate a change.
 */
import fs = require("fs");
import path = require("path");
import { callPlannerModelDetailed } from "../../client/services/plannerRecommendations/gemini";
import { EVAL_CHILDREN } from "./children";
import { loadCalendar, runModel, runRules, type RunRecord } from "./harness";
import { loadLabels } from "./labels";
import { renderMarkdown, summarize } from "./report";

require("dotenv").config({ path: path.resolve(__dirname, "../../../.env") });

const flag = (name: string): boolean => process.argv.includes(name);
const value = (name: string): string | undefined => {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const csvCell = (cell: unknown): string => {
  const text = cell === null || cell === undefined ? "" : String(cell);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

async function main(): Promise<void> {
  const label = value("--label") ?? "rules-only";
  const withModel = flag("--model");
  const runsPerChild = Number(value("--runs") ?? (withModel ? 2 : 1));
  const delay = Number(value("--delay-ms") ?? 6500);
  const only = value("--only");
  const out = path.resolve(
    value("--out") ?? path.resolve(__dirname, "../../../../docs/planner-eval")
  );

  const calendar = loadCalendar();
  const children = EVAL_CHILDREN.filter((child) => !only || child.id === only);
  if (children.length === 0) throw new Error(`No profile called ${only}`);
  const labels = loadLabels();

  const rules: RunRecord[] = children.map((child) => runRules(child, calendar));
  const model: RunRecord[] = [];

  if (withModel) {
    console.log(
      `Running the model: ${children.length} children x ${runsPerChild} runs, ${delay} ms apart.`
    );
    let calls = 0;
    for (const child of children) {
      for (let run = 0; run < runsPerChild; run += 1) {
        if (calls > 0) await sleep(delay);
        calls += 1;
        const record = await runModel(child, calendar, callPlannerModelDetailed);
        model.push(record);
        console.log(
          `  ${child.id} run ${run + 1}: ${record.source}` +
            `${record.fallbackReason ? ` (${record.fallbackReason})` : ""}` +
            `${record.model?.error ? ` error: ${record.model.error.slice(0, 80)}` : ""}` +
            ` violations=${record.score.violationTotal}`
        );
      }
    }
  }

  const summaries = [
    summarize("rules", rules, labels),
    ...(withModel ? [summarize("model", model, labels)] : []),
  ];
  const notes = [
    `Run: ${new Date().toISOString()}`,
    withModel
      ? `Model runs per child: ${runsPerChild}. A "rules" source under a model run means it fell back.`
      : "Rules only: no model was called.",
    labels.size === 0
      ? "Realism has not been measured: there are no hand labels yet (fixtures/labels.csv). `reach` is the stand-in."
      : `${labels.size} hand labels loaded.`,
  ];

  const allRuns = [...rules, ...model];
  const markdown = renderMarkdown({
    label,
    frozenOn: calendar.frozenOn,
    summaries,
    runs: allRuns,
    notes,
  });

  fs.mkdirSync(out, { recursive: true });
  fs.writeFileSync(path.join(out, `${label}.md`), markdown);
  fs.writeFileSync(
    path.join(out, `${label}.json`),
    JSON.stringify({ label, frozenOn: calendar.frozenOn, summaries, runs: allRuns }, null, 2)
  );

  if (flag("--review-sheet")) {
    const byChild = new Map(children.map((child) => [child.id, child]));
    const events = new Map(calendar.editions.map((edition) => [edition.slug, edition]));
    const seen = new Map<
      string,
      { by: Set<string>; tier: string; childId: string; slug: string }
    >();
    for (const run of allRuns) {
      for (const item of run.result.items) {
        const key = `${run.childId}|${item.slug}`;
        const entry = seen.get(key) ?? {
          by: new Set(),
          tier: item.tier,
          childId: run.childId,
          slug: item.slug,
        };
        entry.by.add(run.source === "ai" ? "model" : "rules");
        seen.set(key, entry);
      }
    }
    const header = [
      "child_id",
      "event_slug",
      "realistic",
      "age_group",
      "rank",
      "goal",
      "state",
      "event_name",
      "level",
      "grade",
      "event_state",
      "start_date",
      "tier",
      "suggested_by",
    ];
    const lines = [header.join(",")];
    for (const entry of [...seen.values()].sort((a, b) => a.childId.localeCompare(b.childId))) {
      const child = byChild.get(entry.childId)!;
      const event = events.get(entry.slug);
      lines.push(
        [
          entry.childId,
          entry.slug,
          "",
          child.ageGroup,
          child.rank ?? "unranked",
          child.goal,
          child.state ?? "",
          event?.name,
          event?.ladder,
          event?.grade,
          event?.state,
          event?.startDate?.slice(0, 10),
          entry.tier,
          [...entry.by].join("+"),
        ]
          .map(csvCell)
          .join(",")
      );
    }
    fs.writeFileSync(path.join(out, "review-sheet.csv"), lines.join("\n") + "\n");
    console.log(`Wrote ${lines.length - 1} rows to ${path.join(out, "review-sheet.csv")}`);
  }

  for (const summary of summaries) {
    console.log(
      `${summary.system}: ${summary.runs} runs, ${summary.violationTotal} violations in ` +
        `${summary.runsWithViolations} runs, reach share ${Math.round(summary.diagnostics.reachShare * 100)}%`
    );
  }
  console.log(`Report: ${path.join(out, `${label}.md`)}`);
  process.exit(summaries.some((summary) => summary.violationTotal > 0) ? 1 : 0);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(2);
});
