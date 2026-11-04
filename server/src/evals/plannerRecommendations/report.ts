import type { RunRecord } from "./harness";
import { labelKey, type Labels } from "./labels";
import type { Diagnostics, Violations } from "./score";

/**
 * Turns a pile of runs into the few numbers worth reading, as markdown.
 *
 * The report separates what is WRONG (violations: must be zero) from what is merely
 * DESCRIBED (diagnostics). A run that has violations is a failure however good its
 * diagnostics look, so the violations come first and are never averaged away.
 */

const mean = (values: number[]): number =>
  values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
const fixed = (value: number, digits = 2): string => value.toFixed(digits);
const percent = (value: number): string => `${Math.round(value * 100)}%`;

export interface SystemSummary {
  system: "rules" | "model";
  runs: number;
  children: number;
  violationTotals: Violations;
  violationTotal: number;
  runsWithViolations: number;
  diagnostics: {
    recommended: number;
    consider: number;
    reachShare: number;
    reachCount: number;
    evidencedShare: number;
    stretchCount: number;
    distinctStates: number;
    distinctRungs: number;
    monthsSpanned: number;
    busiestThirtyDays: number;
    specificShare: number;
    reasonVariety: number;
    meanReasonWords: number;
    daysToFirst: number | null;
  };
  /** Only model runs. */
  model?: {
    answeredByModel: number;
    fellBack: number;
    fallbackReasons: Record<string, number>;
    picks: number;
    dropped: number;
    reasonsMissing: number;
    reasonsReplaced: number;
    reasonsReplacedShare: number;
    foreignNames: number;
    summaryReplaced: number;
    malformed: number;
    meanPromptTokens: number | null;
    meanOutputTokens: number | null;
    meanMs: number;
    modelsUsed: Record<string, number>;
    /** Mean overlap of the recommended sets between repeat runs of one child. */
    stability: number | null;
  };
  realism: { labelled: number; realistic: number; precision: number | null };
}

const VIOLATION_KEYS: Array<keyof Violations> = [
  "notOffered",
  "duplicate",
  "overlap",
  "tooClose",
  "onTopOfPlan",
  "insideBlocked",
  "entriesClosed",
  "overAllowance",
  "tooManyRecommended",
  "tooManyConsider",
  "suggestedWithNoAllowance",
  "recommendedUnrealistic",
  "ungroundedReason",
  "emptyWithRoom",
];

const recommendedSlugs = (run: RunRecord): Set<string> =>
  new Set(run.result.items.filter((item) => item.tier === "recommended").map((item) => item.slug));

const jaccard = (a: Set<string>, b: Set<string>): number => {
  if (a.size === 0 && b.size === 0) return 1;
  const shared = [...a].filter((slug) => b.has(slug)).length;
  return shared / (a.size + b.size - shared);
};

export function summarize(
  system: "rules" | "model",
  runs: RunRecord[],
  labels: Labels
): SystemSummary {
  const totals = Object.fromEntries(VIOLATION_KEYS.map((key) => [key, 0])) as unknown as Violations;
  for (const run of runs) {
    for (const key of VIOLATION_KEYS) totals[key] += run.score.violations[key];
  }
  const diag = (pick: (d: Diagnostics) => number | null): number[] =>
    runs.map((run) => pick(run.score.diagnostics)).filter((v): v is number => v !== null);

  const labelled = runs.flatMap((run) =>
    run.result.items
      .filter((item) => item.tier === "recommended")
      .map((item) => labels.get(labelKey(run.childId, item.slug)))
      .filter((value): value is boolean => value !== undefined)
  );

  const summary: SystemSummary = {
    system,
    runs: runs.length,
    children: new Set(runs.map((run) => run.childId)).size,
    violationTotals: totals,
    violationTotal: runs.reduce((sum, run) => sum + run.score.violationTotal, 0),
    runsWithViolations: runs.filter((run) => run.score.violationTotal > 0).length,
    diagnostics: {
      recommended: mean(diag((d) => d.recommended)),
      consider: mean(diag((d) => d.consider)),
      reachShare: mean(diag((d) => d.reachShare)),
      reachCount: mean(diag((d) => d.reachCount)),
      evidencedShare: mean(diag((d) => d.evidencedShare)),
      stretchCount: mean(diag((d) => d.stretchCount)),
      distinctStates: mean(diag((d) => d.distinctStates)),
      distinctRungs: mean(diag((d) => d.distinctRungs)),
      monthsSpanned: mean(diag((d) => d.monthsSpanned)),
      busiestThirtyDays: mean(diag((d) => d.busiestThirtyDays)),
      specificShare: mean(diag((d) => d.specificShare)),
      reasonVariety: mean(diag((d) => d.reasonVariety)),
      meanReasonWords: mean(diag((d) => d.meanReasonWords)),
      daysToFirst: diag((d) => d.daysToFirst).length ? mean(diag((d) => d.daysToFirst)) : null,
    },
    realism: {
      labelled: labelled.length,
      realistic: labelled.filter(Boolean).length,
      precision: labelled.length ? labelled.filter(Boolean).length / labelled.length : null,
    },
  };

  if (system === "model") {
    const withModel = runs.filter((run) => run.model);
    const asked = withModel.filter((run) => run.candidates > 0);
    const stats = asked.map((run) => run.model!.stats).filter((s) => s !== null);
    const sum = (pick: (s: NonNullable<(typeof stats)[number]>) => number) =>
      stats.reduce((total, s) => total + pick(s!), 0);
    const picks = sum((s) => s.picks);
    const byChild = new Map<string, RunRecord[]>();
    for (const run of asked) byChild.set(run.childId, [...(byChild.get(run.childId) ?? []), run]);
    const overlaps: number[] = [];
    for (const group of byChild.values()) {
      for (let i = 0; i < group.length; i += 1) {
        for (let j = i + 1; j < group.length; j += 1) {
          overlaps.push(jaccard(recommendedSlugs(group[i]!), recommendedSlugs(group[j]!)));
        }
      }
    }
    const tokens = (pick: (u: NonNullable<RunRecord["model"]>["usage"]) => number | null) =>
      asked.map((run) => pick(run.model!.usage)).filter((value): value is number => value !== null);
    const fallbackReasons: Record<string, number> = {};
    const modelsUsed: Record<string, number> = {};
    for (const run of asked) {
      if (run.fallbackReason) {
        fallbackReasons[run.fallbackReason] = (fallbackReasons[run.fallbackReason] ?? 0) + 1;
      }
      const name = run.model!.usage?.model;
      if (name) modelsUsed[name] = (modelsUsed[name] ?? 0) + 1;
    }
    summary.model = {
      answeredByModel: asked.filter((run) => run.source === "ai").length,
      fellBack: asked.filter((run) => run.source !== "ai").length,
      fallbackReasons,
      picks,
      dropped: sum((s) => s.dropped),
      reasonsMissing: sum((s) => s.reasonsMissing),
      reasonsReplaced: sum((s) => s.reasonsReplaced),
      reasonsReplacedShare: picks ? sum((s) => s.reasonsReplaced) / picks : 0,
      foreignNames: sum((s) => s.foreignNames),
      summaryReplaced: stats.filter((s) => s!.summaryReplaced).length,
      malformed: stats.filter((s) => s!.malformed).length,
      meanPromptTokens: tokens((u) => u?.promptTokens ?? null).length
        ? mean(tokens((u) => u?.promptTokens ?? null))
        : null,
      meanOutputTokens: tokens((u) => u?.outputTokens ?? null).length
        ? mean(tokens((u) => u?.outputTokens ?? null))
        : null,
      meanMs: mean(asked.map((run) => run.model!.ms)),
      modelsUsed,
      stability: overlaps.length ? mean(overlaps) : null,
    };
  }
  return summary;
}

const row = (cells: Array<string | number>): string => `| ${cells.join(" | ")} |`;

export function renderMarkdown(params: {
  label: string;
  frozenOn: string;
  summaries: SystemSummary[];
  runs: RunRecord[];
  notes: string[];
}): string {
  const { label, frozenOn, summaries, runs, notes } = params;
  const lines: string[] = [];
  lines.push(`# Planner recommendation evaluation: ${label}`);
  lines.push("");
  lines.push(
    `Calendar frozen ${frozenOn}. ${summaries[0]?.children ?? 0} synthetic children. ` +
      `Violations are rule breaks and must be 0. Diagnostics describe, they do not judge.`
  );
  for (const note of notes) lines.push(`- ${note}`);
  lines.push("");

  lines.push("## Violations (must be zero)");
  lines.push("");
  lines.push(row(["", ...summaries.map((s) => s.system)]));
  lines.push(row(["---", ...summaries.map(() => "---")]));
  lines.push(row(["runs", ...summaries.map((s) => s.runs)]));
  lines.push(row(["runs with any violation", ...summaries.map((s) => s.runsWithViolations)]));
  for (const key of VIOLATION_KEYS) {
    lines.push(row([key, ...summaries.map((s) => s.violationTotals[key])]));
  }
  lines.push("");

  lines.push("## Diagnostics (means per answer)");
  lines.push("");
  lines.push(row(["", ...summaries.map((s) => s.system)]));
  lines.push(row(["---", ...summaries.map(() => "---")]));
  const d = (name: string, pick: (s: SystemSummary) => string) =>
    lines.push(row([name, ...summaries.map(pick)]));
  d("recommended", (s) => fixed(s.diagnostics.recommended, 1));
  d("consider", (s) => fixed(s.diagnostics.consider, 1));
  d("recommended above Championship Series (reach)", (s) => fixed(s.diagnostics.reachCount, 2));
  d("reach share of recommended", (s) => percent(s.diagnostics.reachShare));
  d("recommended that past draws say would have got in", (s) =>
    percent(s.diagnostics.evidencedShare)
  );
  d("shown apart as a stretch", (s) => fixed(s.diagnostics.stretchCount, 2));
  d("distinct states", (s) => fixed(s.diagnostics.distinctStates, 1));
  d("distinct levels", (s) => fixed(s.diagnostics.distinctRungs, 1));
  d("months spanned", (s) => fixed(s.diagnostics.monthsSpanned, 1));
  d("most recommended in any 30 days", (s) => fixed(s.diagnostics.busiestThirtyDays, 1));
  d("reasons stating a concrete fact", (s) => percent(s.diagnostics.specificShare));
  d("reason variety (1 = all different)", (s) => fixed(s.diagnostics.reasonVariety, 2));
  d("words per reason", (s) => fixed(s.diagnostics.meanReasonWords, 1));
  d("days to first recommended event", (s) =>
    s.diagnostics.daysToFirst === null ? "n/a" : fixed(s.diagnostics.daysToFirst, 1)
  );
  d("realism (hand labels)", (s) =>
    s.realism.precision === null
      ? "not measured"
      : `${percent(s.realism.precision)} of ${s.realism.labelled} labelled`
  );
  lines.push("");

  const model = summaries.find((s) => s.model)?.model;
  if (model) {
    lines.push("## The model");
    lines.push("");
    lines.push(row(["measure", "value"]));
    lines.push(row(["---", "---"]));
    lines.push(row(["answered by the model", model.answeredByModel]));
    lines.push(
      row(["fell back to the rules", `${model.fellBack} ${JSON.stringify(model.fallbackReasons)}`])
    );
    lines.push(row(["model picks returned", model.picks]));
    lines.push(row(["sentences ignored (not in the season, or twice)", model.dropped]));
    lines.push(row(["events the model wrote nothing for", model.reasonsMissing]));
    lines.push(
      row([
        "reasons replaced by the validator",
        `${model.reasonsReplaced} (${percent(model.reasonsReplacedShare)} of picks)`,
      ])
    );
    lines.push(row(["of those, naming another event's place or level", model.foreignNames]));
    lines.push(row(["summaries replaced", model.summaryReplaced]));
    lines.push(row(["malformed answers", model.malformed]));
    lines.push(
      row([
        "mean tokens in / out",
        `${model.meanPromptTokens === null ? "n/a" : Math.round(model.meanPromptTokens)} / ${model.meanOutputTokens === null ? "n/a" : Math.round(model.meanOutputTokens)}`,
      ])
    );
    lines.push(row(["mean latency", `${Math.round(model.meanMs)} ms`]));
    lines.push(row(["models used", JSON.stringify(model.modelsUsed)]));
    lines.push(
      row([
        "stability (same child, repeat runs, overlap of recommended)",
        model.stability === null ? "n/a (one run each)" : percent(model.stability),
      ])
    );
    lines.push("");
  }

  lines.push("## Per child");
  lines.push("");
  lines.push(
    row([
      "child",
      "system",
      "source",
      "candidates",
      "rec",
      "consider",
      "reach",
      "violations",
      "first event in (days)",
    ])
  );
  lines.push(row(Array.from({ length: 9 }, () => "---")));
  for (const run of runs) {
    const dg = run.score.diagnostics;
    lines.push(
      row([
        run.childId,
        run.system,
        run.source + (run.fallbackReason ? ` (${run.fallbackReason})` : ""),
        run.candidates,
        dg.recommended,
        dg.consider,
        dg.reachCount,
        run.score.violationTotal,
        dg.daysToFirst === null ? "n/a" : dg.daysToFirst,
      ])
    );
  }
  lines.push("");
  return lines.join("\n");
}
