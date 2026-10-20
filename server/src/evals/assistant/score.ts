import type { AssistantCase } from "./cases";
import type { CaseRun } from "./harness";

export type ViolationKind =
  | "errored"
  | "missingTool"
  | "forbiddenTool"
  | "missingToolArgs"
  | "missingInReply"
  | "forbiddenInReply"
  | "tooLong";

export interface Violation {
  kind: ViolationKind;
  detail: string;
}

/**
 * Judges one run by the rules on its case. Plain arithmetic and pattern matching, not another
 * model: a check that a model also had to interpret could not tell a regression from noise.
 */
export function scoreCase(c: AssistantCase, run: CaseRun): Violation[] {
  if (run.error) return [{ kind: "errored", detail: run.error }];

  const violations: Violation[] = [];
  const called = new Set(run.calls.map((call) => call.name));

  for (const tool of c.callsTools ?? []) {
    if (!called.has(tool)) violations.push({ kind: "missingTool", detail: `did not call ${tool}` });
  }
  for (const tool of c.neverCallsTools ?? []) {
    if (called.has(tool)) violations.push({ kind: "forbiddenTool", detail: `called ${tool}` });
  }
  for (const check of c.toolArgsInclude ?? []) {
    const callsToIt = run.calls.filter((call) => call.name === check.tool);
    if (callsToIt.length === 0) continue; // already reported as a missing tool
    const text = callsToIt
      .map((call) => JSON.stringify(call.args))
      .join(" ")
      .toLowerCase();
    if (!check.anyOf.some((needle) => text.includes(needle.toLowerCase()))) {
      violations.push({
        kind: "missingToolArgs",
        detail: `${check.tool} arguments had none of: ${check.anyOf.join(", ")}`,
      });
    }
  }
  for (const pattern of c.replyMatches ?? []) {
    if (!pattern.test(run.reply)) {
      violations.push({ kind: "missingInReply", detail: `reply does not match ${pattern}` });
    }
  }
  for (const pattern of c.replyNeverMatches ?? []) {
    const hit = run.reply.match(pattern);
    if (hit) {
      violations.push({
        kind: "forbiddenInReply",
        detail: `reply matches ${pattern}: "${hit[0].slice(0, 60)}"`,
      });
    }
  }
  if (c.maxChars && run.reply.length > c.maxChars) {
    violations.push({
      kind: "tooLong",
      detail: `${run.reply.length} characters, more than ${c.maxChars}`,
    });
  }
  return violations;
}
