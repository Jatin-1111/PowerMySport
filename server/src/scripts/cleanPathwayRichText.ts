import "../config/env";

import fs from "node:fs";
import path from "node:path";

import mongoose from "mongoose";

import { revalidatePathway } from "../admin/services/ClientCacheRevalidationService";
import { PathwayGuide } from "../shared/models/PathwayGuide";
import { PathwayStageSchema } from "../shared/validation/pathwayGuideFormat";

// ─── Tidy the pathway text that was pasted before the editor could ──────────
//
// Pathway answers are now read as Markdown (packages/rich-text). Text already
// in the database was pasted from Word before that, and carries Word's habits:
// "•<tab>" bullets, trailing spaces, a line that appears twice, and one answer
// (the AITA point system) that is a table written as numbered blocks.
//
// This rewrites exactly those things and nothing else. It does not touch a
// number, a word or a sentence: what a parent reads is the same, only drawn
// properly. Content questions (the two AITA points answers disagree with each
// other, the long chess answers want breaking up) are deliberately NOT here:
// they need someone to decide what is true.
//
//   npx ts-node src/scripts/cleanPathwayRichText.ts                   (dry run: shows every change)
//   npx ts-node src/scripts/cleanPathwayRichText.ts --apply           (writes, after saving a backup)
//   npx ts-node src/scripts/cleanPathwayRichText.ts --revert <file>   (puts a backup's old text back)
//
// Run it with npx, not `npm run … -- --apply`: PowerShell strips the `--` and
// the flag with it, which silently turns the write into another dry run.
//
// Safe to run twice (the second run finds nothing), and safe against a
// concurrent edit: each write only applies if the text is still what was read,
// so an answer an editor changed in the meantime is skipped, never overwritten.
//
// There is ONE database and it is production, so a dry run is the first thing
// to do and --apply writes live content.

// ─── The text rules (pure, and tested) ───────────────────────────────────────

/** What a rewrite did: Word bullets and stray spaces, a line repeated twice, or the points table. */
export type ChangeKind = "word-paste" | "repeated-line" | "table";

/** Word's bullets and trailing spaces. The same rules as normalizeRichText in packages/rich-text. */
export function tidyWordText(text: string): string {
  return text
    .replace(/\r\n?/g, "\n")
    .replace(/ /g, " ")
    .replace(/^[ \t]*[•◦▪▫‣⁃·][ \t]*/gm, "- ")
    .replace(/[ \t]+$/gm, "")
    .trim();
}

/** A line without its list number or bullet: "3. Super Series (SS)" is "Super Series (SS)". */
const withoutMarker = (line: string) => line.trim().replace(/^(?:\d+[.)]|[-*•])\s+/, "");

/**
 * A line repeated straight after itself, or straight after its own numbered or
 * bulleted version ("3. Super Series (SS)" then "Super Series (SS)"): a
 * copy-paste slip, never meant.
 */
export function dropRepeatedLines(text: string): string {
  const out: string[] = [];
  for (const line of text.split("\n")) {
    const previous = out[out.length - 1];
    const repeated =
      line.trim() !== "" &&
      previous !== undefined &&
      (previous.trim() === line.trim() || withoutMarker(previous) === line.trim());
    if (repeated) continue;
    out.push(line);
  }
  return out.join("\n");
}

/**
 * "1. Talent Series (TS)\nWinner: 10 Points\nRunner-up: 7 Points ...", repeated
 * for each series, as a table. Returns null unless every block has the same
 * results in the same order: an irregular answer is left for a person.
 */
export function pointsBlocksToTable(text: string): string | null {
  const blocks: Array<{ name: string; results: Array<[string, string]> }> = [];
  for (const raw of text.split("\n")) {
    const line = raw.trim();
    if (!line) continue;
    const heading = /^\d+\.\s+(.+)$/.exec(line);
    if (heading) {
      blocks.push({ name: heading[1]!.trim(), results: [] });
      continue;
    }
    const result = /^([A-Za-z][A-Za-z -]*?):\s*(\d+)\s*points?$/i.exec(line);
    const current = blocks[blocks.length - 1];
    if (!result || !current) return null;
    current.results.push([result[1]!.trim(), result[2]!]);
  }
  if (blocks.length < 2) return null;

  const labels = blocks[0]!.results.map(([label]) => label);
  if (labels.length < 2) return null;
  const same = blocks.every(
    (block) =>
      block.results.length === labels.length &&
      block.results.every(([label], i) => label.toLowerCase() === labels[i]!.toLowerCase())
  );
  if (!same) return null;

  return [
    "Points awarded for each result:",
    "",
    `| Series | ${labels.join(" | ")} |`,
    `| --- | ${labels.map(() => "---").join(" | ")} |`,
    ...blocks.map((block) => `| ${block.name} | ${block.results.map(([, v]) => v).join(" | ")} |`),
  ].join("\n");
}

export interface CleanResult {
  text: string;
  /** What actually changed the text, in the order applied. Empty = nothing to do. */
  kinds: ChangeKind[];
}

/** Apply every rule to one field. `isPointSystem` allows the table conversion for that one answer. */
export function cleanFieldText(
  original: string,
  options: { isPointSystem?: boolean } = {}
): CleanResult {
  const kinds: ChangeKind[] = [];
  let text = original;

  const tidied = tidyWordText(text);
  if (tidied !== text) {
    text = tidied;
    kinds.push("word-paste");
  }

  const deduped = dropRepeatedLines(text);
  if (deduped !== text) {
    text = deduped;
    kinds.push("repeated-line");
  }

  if (options.isPointSystem) {
    const table = pointsBlocksToTable(text);
    if (table && table !== text) {
      text = table;
      kinds.push("table");
    }
  }

  return { text, kinds: text === original ? [] : kinds };
}

// ─── Finding the changes in a guide ──────────────────────────────────────────

export interface FieldChange {
  sportSlug: string;
  stageKey: string;
  /** "questions[11].answer", for people. */
  label: string;
  kind: "answer" | "overview" | "signal" | "decision";
  /** The question or point title this belongs to (the write is matched on it). */
  heading?: string;
  old: string;
  next: string;
  kinds: ChangeKind[];
}

interface GuideLike {
  sportSlug: string;
  stages?: Array<{
    key: string;
    overview?: string;
    questions?: Array<{ question: string; answer?: string }>;
    signals?: Array<{ title: string; detail?: string }>;
    decisions?: Array<{ title: string; detail?: string }>;
  }>;
}

export function findChanges(guide: GuideLike): FieldChange[] {
  const changes: FieldChange[] = [];
  const add = (change: Omit<FieldChange, "sportSlug" | "kinds" | "next">, result: CleanResult) => {
    if (result.kinds.length) {
      changes.push({
        ...change,
        sportSlug: guide.sportSlug,
        next: result.text,
        kinds: result.kinds,
      });
    }
  };

  for (const stage of guide.stages ?? []) {
    if (stage.overview) {
      add(
        { stageKey: stage.key, label: "overview", kind: "overview", old: stage.overview },
        cleanFieldText(stage.overview)
      );
    }
    (stage.questions ?? []).forEach((q, i) => {
      if (!q.answer) return;
      add(
        {
          stageKey: stage.key,
          label: `questions[${i}].answer`,
          kind: "answer",
          heading: q.question,
          old: q.answer,
        },
        cleanFieldText(q.answer, { isPointSystem: /point system/i.test(q.question) })
      );
    });
    (["signals", "decisions"] as const).forEach((group) => {
      (stage[group] ?? []).forEach((p, i) => {
        if (!p.detail) return;
        add(
          {
            stageKey: stage.key,
            label: `${group}[${i}].detail`,
            kind: group === "signals" ? "signal" : "decision",
            heading: p.title,
            old: p.detail,
          },
          cleanFieldText(p.detail)
        );
      });
    });
  }
  return changes;
}

/** The server's own length limits for a field, so a rewrite can never be one the CMS would refuse. */
function fitsLimit(change: FieldChange): boolean {
  const shape = PathwayStageSchema.shape;
  if (change.kind === "overview") return shape.overview.safeParse(change.next).success;
  // answers and details share the 2000-character limit
  return change.next.length <= 2000;
}

// ─── Writing, and undoing ────────────────────────────────────────────────────

/** Replace one field's text, only if it is still exactly `from`. Returns whether it was written. */
export async function writeField(change: FieldChange, from: string, to: string): Promise<boolean> {
  const stage = { "s.key": change.stageKey };
  let result;
  if (change.kind === "overview") {
    result = await PathwayGuide.updateOne(
      { sportSlug: change.sportSlug },
      { $set: { "stages.$[s].overview": to } },
      { arrayFilters: [{ ...stage, "s.overview": from }] }
    );
  } else if (change.kind === "answer") {
    result = await PathwayGuide.updateOne(
      { sportSlug: change.sportSlug },
      { $set: { "stages.$[s].questions.$[q].answer": to } },
      { arrayFilters: [stage, { "q.question": change.heading, "q.answer": from }] }
    );
  } else {
    const group = change.kind === "signal" ? "signals" : "decisions";
    result = await PathwayGuide.updateOne(
      { sportSlug: change.sportSlug },
      { $set: { [`stages.$[s].${group}.$[p].detail`]: to } },
      { arrayFilters: [stage, { "p.title": change.heading, "p.detail": from }] }
    );
  }
  return result.modifiedCount === 1;
}

const short = (text: string, max = 150) => {
  const flat = text.replace(/\n/g, "⏎");
  return flat.length > max ? `${flat.slice(0, max)}…` : flat;
};

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const apply = args.includes("--apply");
  const revertAt = args.indexOf("--revert");
  const revertFile = revertAt >= 0 ? args[revertAt + 1] : undefined;
  if (revertAt >= 0 && !revertFile) throw new Error("--revert needs the backup file's path.");

  const uri = process.env.MONGO_URI || process.env.MONGODB_URI;
  if (!uri) throw new Error("Set MONGO_URI (or MONGODB_URI) before running this.");

  // Locally `autoIndex` is on (it keys off NODE_ENV), and connecting with the
  // model loaded would build indexes in production even on a dry run.
  await mongoose.connect(uri, { autoIndex: false, autoCreate: false });
  try {
    if (revertFile) {
      const backup = JSON.parse(fs.readFileSync(revertFile, "utf8")) as { changes: FieldChange[] };
      let restored = 0;
      for (const change of backup.changes) {
        const ok = await writeField(change, change.next, change.old);
        console.log(
          `${ok ? "restored" : "skipped (text has changed since)"}  ${change.sportSlug} / ${change.stageKey} / ${change.label}`
        );
        if (ok) restored += 1;
      }
      console.log(`\nRestored ${restored} of ${backup.changes.length} field(s).`);
      for (const sport of new Set(backup.changes.map((c) => c.sportSlug))) revalidatePathway(sport);
      return;
    }

    const guides = await PathwayGuide.find({}).select("sportSlug stages").lean();
    const changes = guides.flatMap((guide) => findChanges(guide as unknown as GuideLike));
    const tooLong = changes.filter((change) => !fitsLimit(change));
    const writable = changes.filter((change) => fitsLimit(change));

    for (const change of changes) {
      const skipped = !fitsLimit(change);
      console.log(
        `\n${change.sportSlug} / ${change.stageKey} / ${change.label}${change.heading ? `  "${change.heading}"` : ""}`
      );
      console.log(
        `  change: ${change.kinds.join(", ")}${skipped ? "   (SKIPPED: result would be over the length limit)" : ""}`
      );
      console.log(`  - ${short(change.old)}`);
      console.log(
        `  + ${change.kinds.includes("table") ? change.next.replace(/\n/g, "\n    ") : short(change.next)}`
      );
    }

    console.log(
      `\n${guides.length} guide(s) read. ${writable.length} field(s) to change` +
        `${tooLong.length ? `, ${tooLong.length} skipped as too long` : ""}.`
    );

    if (!apply) {
      console.log("Dry run: nothing was written. Re-run with --apply to write these.");
      return;
    }
    if (writable.length === 0) return;

    const backupFile = path.join(process.cwd(), `pathway-richtext-backup-${Date.now()}.json`);
    fs.writeFileSync(
      backupFile,
      JSON.stringify({ createdAt: new Date().toISOString(), changes: writable }, null, 2)
    );
    console.log(`\nBackup of the old text saved to ${backupFile}`);
    console.log(
      `To undo: npx ts-node src/scripts/cleanPathwayRichText.ts --revert "${backupFile}"\n`
    );

    let written = 0;
    for (const change of writable) {
      const ok = await writeField(change, change.old, change.next);
      console.log(
        `${ok ? "written" : "skipped (text has changed since it was read)"}  ${change.sportSlug} / ${change.stageKey} / ${change.label}`
      );
      if (ok) written += 1;
    }
    console.log(`\nWrote ${written} of ${writable.length} field(s).`);
    for (const sport of new Set(writable.map((c) => c.sportSlug))) revalidatePathway(sport);
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
