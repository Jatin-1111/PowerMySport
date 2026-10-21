import type { AssistantCase, CaseCategory } from "./cases";
import type { CaseRun } from "./harness";
import type { Violation } from "./score";

export interface ScoredRun {
  case: AssistantCase;
  run: CaseRun;
  violations: Violation[];
}

const pct = (part: number, whole: number): string =>
  whole === 0 ? "n/a" : `${Math.round((part / whole) * 100)}%`;

const clip = (text: string, max: number): string =>
  text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text;

export function summarize(runs: ScoredRun[]) {
  const failed = runs.filter((r) => r.violations.length > 0);
  const byCategory = new Map<CaseCategory, { runs: number; failed: number }>();
  for (const r of runs) {
    const row = byCategory.get(r.case.category) ?? { runs: 0, failed: 0 };
    row.runs += 1;
    if (r.violations.length > 0) row.failed += 1;
    byCategory.set(r.case.category, row);
  }
  const toolCalls = new Map<string, number>();
  for (const r of runs)
    for (const call of r.run.calls) toolCalls.set(call.name, (toolCalls.get(call.name) ?? 0) + 1);

  const whatsapp = runs.filter((r) => r.case.channel === "whatsapp");
  return {
    runs: runs.length,
    failed: failed.length,
    byCategory,
    toolCalls,
    formatterRepaired: whatsapp.filter((r) => r.run.formatterRepaired).length,
    whatsappRuns: whatsapp.length,
    averageMs: runs.length
      ? Math.round(runs.reduce((sum, r) => sum + r.run.ms, 0) / runs.length)
      : 0,
  };
}

export function renderMarkdown(label: string, runs: ScoredRun[]): string {
  const s = summarize(runs);
  const lines: string[] = [];
  lines.push(`# Assistant evaluation: ${label}`, "");
  lines.push(
    `${s.runs - s.failed} of ${s.runs} runs passed every rule (${pct(s.runs - s.failed, s.runs)}). ` +
      `Average ${s.averageMs} ms per case. Tool data is synthetic; nothing here read a database.`,
    ""
  );

  lines.push("## By category", "", "| Category | Runs | Failed |", "|---|---|---|");
  for (const [category, row] of s.byCategory)
    lines.push(`| ${category} | ${row.runs} | ${row.failed} |`);
  lines.push("");

  lines.push("## Diagnostics", "");
  lines.push(
    `- WhatsApp replies the formatter had to repair: ${s.formatterRepaired} of ${s.whatsappRuns}. ` +
      "Each is a place the model ignored the channel rules and the formatter caught it."
  );
  lines.push(
    `- Tool calls: ${[...s.toolCalls].map(([name, n]) => `${name} ${n}`).join(", ") || "none"}.`,
    ""
  );

  const failures = runs.filter((r) => r.violations.length > 0);
  lines.push(`## Failures (${failures.length})`, "");
  if (failures.length === 0) lines.push("None.", "");
  for (const r of failures) {
    lines.push(`### ${r.case.id}`, "", `*${r.case.why}*`, "", `Question: ${r.case.message}`, "");
    for (const v of r.violations) lines.push(`- **${v.kind}**: ${v.detail}`);
    lines.push("", "Reply:", "", "```", clip(r.run.reply || "(no reply)", 700), "```", "");
  }

  lines.push("## Every reply, for reading", "");
  for (const r of runs) {
    lines.push(
      `**${r.case.id}** (${r.violations.length === 0 ? "pass" : "fail"}; tools: ${r.run.calls.map((c) => c.name).join(", ") || "none"})`,
      "",
      "```",
      clip(r.run.reply || "(no reply)", 500),
      "```",
      ""
    );
  }
  return lines.join("\n");
}
