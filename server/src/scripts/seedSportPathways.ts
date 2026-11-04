/**
 * Seed the Cricket, Football and Badminton pathways.
 *
 *   npx tsx src/scripts/seedSportPathways.ts --check                       # validate only, no database
 *   npx tsx -r dotenv/config src/scripts/seedSportPathways.ts              # all three, as drafts
 *   npx tsx -r dotenv/config src/scripts/seedSportPathways.ts cricket      # one sport, as a draft
 *   npx tsx -r dotenv/config src/scripts/seedSportPathways.ts --publish    # all three, live
 *
 * Draft by default, like the Tennis and Chess seeds. This database is the live
 * one, so publishing is a separate, deliberate flag.
 *
 * Idempotent: it upserts on sportSlug and rewrites the stages, so re-running it
 * DISCARDS any prose edits made in the CMS since the last run. The content
 * lives in `./pathwayContent/`, one file per sport.
 *
 * Use `--check` first. It runs the format validation and a wording check
 * (no dashes used as punctuation) without touching the database.
 */

import mongoose from "mongoose";

import { PathwayGuide } from "../shared/models/PathwayGuide";
import { parsePathwayGuide, type PathwayGuideInput } from "../shared/validation/pathwayGuideFormat";
import { BADMINTON_GUIDE } from "./pathwayContent/badminton";
import { CRICKET_GUIDE } from "./pathwayContent/cricket";
import { FOOTBALL_GUIDE } from "./pathwayContent/football";

const GUIDES: PathwayGuideInput[] = [CRICKET_GUIDE, FOOTBALL_GUIDE, BADMINTON_GUIDE];

/** Em dash, en dash and spaced hyphen all read as machine-written; ages use a plain hyphen. */
const BANNED_DASH = /[–—]| - /;

function collectStrings(value: unknown, path: string, out: Array<[string, string]>): void {
  if (typeof value === "string") out.push([path, value]);
  else if (Array.isArray(value)) value.forEach((v, i) => collectStrings(v, `${path}[${i}]`, out));
  else if (value && typeof value === "object")
    for (const [k, v] of Object.entries(value)) collectStrings(v, `${path}.${k}`, out);
}

function wordingProblems(guide: PathwayGuideInput): string[] {
  const strings: Array<[string, string]> = [];
  collectStrings(guide, guide.sport.slug, strings);
  return strings
    .filter(([, text]) => BANNED_DASH.test(text))
    .map(([path]) => `${path}: dash used as punctuation`);
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const publish = args.includes("--publish");
  const checkOnly = args.includes("--check");
  const wanted = args.filter((a) => !a.startsWith("--"));

  const selected = wanted.length ? GUIDES.filter((g) => wanted.includes(g.sport.slug)) : GUIDES;
  if (selected.length === 0) throw new Error(`No pathway matches: ${wanted.join(", ")}`);

  const valid = [];
  let failed = false;
  for (const input of selected) {
    const parsed = parsePathwayGuide(input);
    const problems = [...(parsed.ok ? [] : parsed.errors), ...wordingProblems(input)];
    if (problems.length > 0) {
      failed = true;
      console.error(`${input.sport.name} has problems:`);
      for (const p of problems) console.error(`  ${p}`);
    } else if (parsed.ok) {
      valid.push(parsed.guide);
      console.log(`${input.sport.name}: ${parsed.guide.stages.length} stages OK`);
    }
  }
  if (failed) {
    process.exitCode = 1;
    return;
  }
  if (checkOnly) return;

  const uri = process.env.MONGO_URI || process.env.MONGODB_URI;
  if (!uri) throw new Error("Set MONGO_URI (or MONGODB_URI) before running this.");

  await mongoose.connect(uri);
  try {
    for (const guide of valid) {
      const saved = await PathwayGuide.findOneAndUpdate(
        { sportSlug: guide.sport.slug },
        {
          $set: {
            sportSlug: guide.sport.slug,
            sportName: guide.sport.name,
            formatVersion: guide.formatVersion,
            intro: guide.intro,
            sportIntro: guide.sportIntro,
            stages: guide.stages.map((stage, index) => ({ ...stage, order: index + 1 })),
            status: publish ? "published" : "draft",
            publishedAt: publish ? new Date() : null,
          },
        },
        { new: true, upsert: true, setDefaultsOnInsert: true }
      ).lean();
      console.log(
        `Seeded ${saved?.sportName}: ${saved?.stages?.length} stages, status "${saved?.status}".`
      );
    }
    if (!publish) {
      console.log("Saved as DRAFTS: not visible to parents.");
      console.log("Publish from Admin > Content > Pathways, or re-run with --publish.");
    }
  } finally {
    await mongoose.disconnect();
  }
}

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
