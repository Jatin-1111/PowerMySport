/**
 * Print the pathway stage-guide contract.
 *
 *   npx tsx src/scripts/printStageGuideSchema.ts                  → JSON Schema
 *   npx tsx src/scripts/printStageGuideSchema.ts --prompt         → generic brief + schema
 *   npx tsx src/scripts/printStageGuideSchema.ts --sport tennis   → that sport's full prompt
 *
 * The schema is generated from the same Zod schema the upload endpoint validates
 * against, so a prompt printed here cannot ask for something the server will
 * reject. Sport prompts live in `prompts/<sport>-stage-guide.md` and carry a
 * `{{SCHEMA}}` placeholder that this fills in.
 */
import { readFileSync } from "node:fs";
import path from "node:path";

import { z } from "zod";

import { StageGuideSchema } from "../shared/validation/stageGuideFormat";

const BRIEF = `
You are writing a sports pathway guide for PowerMySport, for INDIAN parents.

Return ONE JSON object matching the schema below. No markdown, no commentary.

Ground rules:
1. INDIA ONLY. Describe how the sport actually works in India — the national
   federation and its age categories, the state association step, the district →
   state → national → international ladder, the school route (SGFI and school
   nationals), and the real government schemes (Khelo India, SAI, TOPS, state
   schemes). Do not describe a generic or American pathway.
2. NEVER INVENT A NUMBER. Every fee, age, ranking threshold, scheme value and
   eligibility rule must come from a source you list in "sources". If you cannot
   source it, omit the field — every field except the few marked required is
   optional, and an omitted field renders as nothing rather than as a wrong fact.
3. Money in rupees. Give both the numeric range and a human label
   ("₹30,000 – ₹80,000"). Say plainly that costs are indicative.
4. Keep the two gates apart. "gates.administrative" is paperwork — membership,
   age proof, nomination. "gates.competitive" is the standard actually needed to
   belong there. A rung where anyone may enter but almost nobody can compete must
   show that gap; put the honest cost of trying too early in movingUp.warning.
5. Stages run 1..n in order, no gaps. 6–10 stages is the useful range: from
   "should my child play this at all" through to life in the sport after playing.
6. "shortDescription" is the two-line note in the stage list. "summary" is the
   line under the stage heading — it must NOT restate shortDescription; the
   validator rejects the file if it does.
7. Write for a parent who has never dealt with a federation. Short sentences,
   no jargon without explaining it once.
`.trim();

function main() {
  const args = process.argv.slice(2);
  const schema = JSON.stringify(
    z.toJSONSchema(StageGuideSchema, { io: "input" }),
    null,
    2,
  );

  const sportArg = args.indexOf("--sport");
  if (sportArg >= 0) {
    const sport = args[sportArg + 1]?.trim().toLowerCase();
    if (!sport) {
      console.error("Usage: --sport <slug>   e.g. --sport tennis");
      process.exit(1);
    }
    const file = path.join(__dirname, "prompts", `${sport}-stage-guide.md`);
    let template: string;
    try {
      template = readFileSync(file, "utf8");
    } catch {
      console.error(
        `No prompt for "${sport}". Add src/scripts/prompts/${sport}-stage-guide.md ` +
          `(copy the tennis one and swap the federation, tiers and schemes).`,
      );
      process.exit(1);
    }
    process.stdout.write(`${template.replace("{{SCHEMA}}", schema)}\n`);
    return;
  }

  if (args.includes("--prompt")) {
    process.stdout.write(`${BRIEF}\n\nJSON Schema:\n`);
  }
  process.stdout.write(`${schema}\n`);
}

main();
