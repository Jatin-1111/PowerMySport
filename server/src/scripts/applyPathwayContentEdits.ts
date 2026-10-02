import "../config/env";

import fs from "node:fs";
import path from "node:path";

import mongoose from "mongoose";

import { revalidatePathway } from "../admin/services/ClientCacheRevalidationService";
import { PathwayGuide } from "../shared/models/PathwayGuide";
import { writeField, type FieldChange } from "./cleanPathwayRichText";
import { CHESS_FORMAT_EDITS, type ContentEdit } from "./pathwayChessFormatEdits";
import { TENNIS_POINTS_EDITS } from "./pathwayTennisPointsEdits";

// Which reviewed set to run: --set chess (default) or --set tennis.
const SETS: Record<string, { sportSlug: string; edits: ContentEdit[] }> = {
  chess: { sportSlug: "chess", edits: CHESS_FORMAT_EDITS },
  tennis: { sportSlug: "tennis", edits: TENNIS_POINTS_EDITS },
};

// ─── Lay out the long chess answers as paragraphs and lists ─────────────────
//
// Ten chess answers and overviews are a single block of 420 to 570 characters.
// This writes the reviewed rewrite of each (pathwayChessFormatEdits.ts): the
// same sentences split into paragraphs, bullet and numbered lists and bold
// lead-ins. It changes how the text is laid out, not what it says.
//
//   npx ts-node src/scripts/applyPathwayContentEdits.ts            (dry run: shows each change in full)
//   npx ts-node src/scripts/applyPathwayContentEdits.ts --apply    (writes, after saving a backup)
//
// Add `--set tennis` (placed before --apply) for the corrected AITA points table.
//
// To undo, use the cleanup script's revert, which reads the same backup file:
//   npx ts-node src/scripts/cleanPathwayRichText.ts --revert <backup file>
//
// Run it with npx, not `npm run … -- --apply`: PowerShell strips the `--`.
//
// Each write only applies if the field still holds exactly the text that was
// reviewed, so an answer an editor has changed since is skipped, never
// overwritten. Safe to run twice: a field already rewritten is reported and
// left alone. There is ONE database and it is production.

type Status =
  "will change" | "already applied" | "text has changed since it was reviewed" | "not found";

interface StageLike {
  key: string;
  overview?: string;
  questions?: Array<{ question: string; answer?: string }>;
}

/** What the database holds now for this edit's field. */
function currentText(edit: ContentEdit, stages: StageLike[]): string | undefined {
  const stage = stages.find((s) => s.key === edit.stageKey);
  if (!stage) return undefined;
  if (edit.kind === "overview") return stage.overview;
  return stage.questions?.find((q) => q.question === edit.heading)?.answer;
}

export function statusOf(edit: ContentEdit, current: string | undefined): Status {
  if (current === undefined) return "not found";
  if (current === edit.old) return "will change";
  if (current === edit.next) return "already applied";
  return "text has changed since it was reviewed";
}

const toFieldChange = (edit: ContentEdit): FieldChange => ({
  sportSlug: edit.sportSlug,
  stageKey: edit.stageKey,
  label: edit.label,
  kind: edit.kind,
  ...(edit.heading ? { heading: edit.heading } : {}),
  old: edit.old,
  next: edit.next,
  kinds: [],
});

async function main(): Promise<void> {
  const apply = process.argv.includes("--apply");
  const setIdx = process.argv.indexOf("--set");
  const setName = (setIdx >= 0 ? process.argv[setIdx + 1] : undefined) ?? "chess";
  const chosen = SETS[setName];
  if (!chosen) throw new Error(`Unknown --set "${setName}". Use: ${Object.keys(SETS).join(", ")}`);
  const { sportSlug, edits } = chosen;
  const uri = process.env.MONGO_URI || process.env.MONGODB_URI;
  if (!uri) throw new Error("Set MONGO_URI (or MONGODB_URI) before running this.");

  // Locally `autoIndex` is on, and connecting with the model loaded would
  // build indexes in production even on a dry run.
  await mongoose.connect(uri, { autoIndex: false, autoCreate: false });
  try {
    const guides = await PathwayGuide.find({ sportSlug }).select("sportSlug stages").lean();
    const stages = (guides[0]?.stages ?? []) as unknown as StageLike[];

    const rows = edits.map((edit) => ({
      edit,
      status: statusOf(edit, currentText(edit, stages)),
    }));

    for (const { edit, status } of rows) {
      console.log(
        `\n${sportSlug} / ${edit.stageKey} / ${edit.label}${edit.heading ? `  "${edit.heading}"` : ""}`
      );
      console.log(`  ${status.toUpperCase()}`);
      if (status === "will change") {
        console.log("  --- now ---");
        console.log(edit.old.replace(/^/gm, "  | "));
        console.log("  --- after ---");
        console.log(edit.next.replace(/^/gm, "  | "));
      }
    }

    const todo = rows.filter((r) => r.status === "will change");
    const count = (s: Status) => rows.filter((r) => r.status === s).length;
    console.log(
      `\n${rows.length} edit(s): ${todo.length} to change, ${count("already applied")} already applied, ` +
        `${count("text has changed since it was reviewed")} changed since review, ${count("not found")} not found.`
    );

    if (!apply) {
      console.log("Dry run: nothing was written. Re-run with --apply to write these.");
      return;
    }
    if (todo.length === 0) return;

    const backupFile = path.join(process.cwd(), `pathway-richtext-backup-${Date.now()}.json`);
    fs.writeFileSync(
      backupFile,
      JSON.stringify(
        { createdAt: new Date().toISOString(), changes: todo.map((r) => toFieldChange(r.edit)) },
        null,
        2
      )
    );
    console.log(`\nBackup of the old text saved to ${backupFile}`);
    console.log(
      `To undo: npx ts-node src/scripts/cleanPathwayRichText.ts --revert "${backupFile}"\n`
    );

    let written = 0;
    for (const { edit } of todo) {
      const ok = await writeField(toFieldChange(edit), edit.old, edit.next);
      console.log(
        `${ok ? "written" : "skipped (text has changed since it was read)"}  ${sportSlug} / ${edit.stageKey} / ${edit.label}`
      );
      if (ok) written += 1;
    }
    console.log(`\nWrote ${written} of ${todo.length} field(s).`);
    revalidatePathway(sportSlug);
  } finally {
    await mongoose.disconnect();
  }
}

// Importable by the tests without connecting to anything.
if (require.main === module) {
  void main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
