/* eslint-disable no-console */
/**
 * Evaluate the assistant.
 *
 *   node dist/evals/assistant/run.js [options]
 *
 *   --model               Also run every case through the real model. Spends Gemini calls.
 *   --only <case-id>      Run one case.
 *   --category <name>     Run one category.
 *   --runs <n>            Runs per case, to see how stable an answer is (default 1).
 *   --delay-ms <n>        Pause between model calls (default 7000, to stay under the rate limit).
 *   --label <name>        Name of this run (default "static"). Used in the file names.
 *   --out <dir>           Where reports go (default docs/assistant-eval in the repo root).
 *
 * Without --model nothing leaves this machine: it checks the case file and that the prompt
 * and the tool registry agree. With --model the only things sent to Gemini are the fixed
 * questions in cases.ts and the real system prompt; the tools return invented data.
 *
 * It never connects to a database. The tool definitions are imported for their names and
 * schemas, and every execute is replaced by a fixture.
 *
 * Exit code is 1 when a check fails, so this can gate a change to the prompt or the tools.
 */
import fs = require("fs");
import path = require("path");

// Before anything is imported: the key is read when the chat service loads, and the redis
// client must not try to connect.
require("dotenv").config({ path: path.resolve(__dirname, "../../../.env") });
process.env.REDIS_ENABLED = "false";

import type { ScoredRun } from "./report";

const flag = (name: string): boolean => process.argv.includes(name);
const value = (name: string): string | undefined => {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
};
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function main(): Promise<void> {
  const {
    ASSISTANT_CHAT_TOOLS,
    WEB_CHAT_TOOLS,
    WHATSAPP_CHAT_TOOLS,
  } = require("../../shared/services/chatToolsService");
  const { streamAgenticChatResponse } = require("../../shared/services/agenticChatService");
  const { ASSISTANT_CASES } = require("./cases") as typeof import("./cases");
  const { runCase, staticChecks } = require("./harness") as typeof import("./harness");
  const { scoreCase } = require("./score") as typeof import("./score");
  const { renderMarkdown } = require("./report") as typeof import("./report");

  const label = value("--label") ?? (flag("--model") ? "model" : "static");

  const problems = staticChecks(ASSISTANT_CHAT_TOOLS);
  if (problems.length > 0) {
    console.error("Static checks failed:");
    for (const problem of problems) console.error(`  - ${problem}`);
    process.exitCode = 1;
  } else {
    console.log(
      `Static checks passed: ${ASSISTANT_CASES.length} cases, ${ASSISTANT_CHAT_TOOLS.length} tools, prompt and registry agree.`
    );
  }

  if (!flag("--model")) return;
  if (!process.env.GEMINI_API_KEY && !process.env.GOOGLE_API_KEY) {
    console.error("--model needs GEMINI_API_KEY or GOOGLE_API_KEY in server/.env");
    process.exitCode = 1;
    return;
  }

  const only = value("--only");
  const category = value("--category");
  const runsPerCase = Number(value("--runs") ?? 1);
  const delayMs = Number(value("--delay-ms") ?? 7000);
  const cases = ASSISTANT_CASES.filter(
    (c) => (!only || c.id === only) && (!category || c.category === category)
  );
  if (cases.length === 0) {
    console.error("No case matches that filter.");
    process.exitCode = 1;
    return;
  }

  const scored: ScoredRun[] = [];
  let first = true;
  for (const c of cases) {
    for (let i = 0; i < runsPerCase; i += 1) {
      if (!first) await sleep(delayMs);
      first = false;
      const run = await runCase(
        c,
        c.channel === "whatsapp" ? WHATSAPP_CHAT_TOOLS : WEB_CHAT_TOOLS,
        (system, history, message, tools) =>
          streamAgenticChatResponse(system, history, message, tools)
      );
      const violations = scoreCase(c, run);
      scored.push({ case: c, run, violations });
      console.log(
        `${violations.length === 0 ? "pass" : "FAIL"}  ${c.id}${runsPerCase > 1 ? ` #${i + 1}` : ""}`
      );
      for (const v of violations) console.log(`        ${v.kind}: ${v.detail}`);
    }
  }

  const out = path.resolve(
    value("--out") ?? path.resolve(__dirname, "../../../../docs/assistant-eval")
  );
  fs.mkdirSync(out, { recursive: true });
  fs.writeFileSync(path.join(out, `${label}.md`), renderMarkdown(label, scored));
  fs.writeFileSync(
    path.join(out, `${label}.json`),
    JSON.stringify(
      scored.map((r) => ({
        id: r.case.id,
        category: r.case.category,
        reply: r.run.reply,
        calls: r.run.calls,
        formatterRepaired: r.run.formatterRepaired,
        ms: r.run.ms,
        violations: r.violations,
      })),
      null,
      2
    )
  );

  const failed = scored.filter((r) => r.violations.length > 0).length;
  console.log(
    `\n${scored.length - failed} of ${scored.length} runs passed. Report: ${path.join(out, `${label}.md`)}`
  );
  if (failed > 0) process.exitCode = 1;
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => {
    // The imported services may hold open handles (redis client, mongoose models).
    setTimeout(() => process.exit(process.exitCode ?? 0), 50);
  });
