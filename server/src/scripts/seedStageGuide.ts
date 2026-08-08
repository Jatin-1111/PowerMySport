/**
 * Load a stage-guide JSON file straight into the database.
 *
 *   npx tsx src/scripts/seedStageGuide.ts <path-to-json> [--state delhi] [--draft]
 *   npx tsx src/scripts/seedStageGuide.ts --example
 *
 * Same validation and the same upsert the admin endpoint performs — this is the
 * command-line door to it, for seeding and for local checks before the admin
 * upload screen exists. It refuses an invalid file exactly as the API would.
 */
import { readFileSync } from "node:fs";
import path from "node:path";

import mongoose from "mongoose";

import { SportStageGuide } from "../shared/models/SportStageGuide";
import {
  formatStageGuideIssues,
  StageGuideSchema,
} from "../shared/validation/stageGuideFormat";

const EXAMPLE = path.join(
  __dirname,
  "../shared/validation/stageGuide.tennis.example.json",
);

async function main() {
  const args = process.argv.slice(2);
  const file = args.includes("--example")
    ? EXAMPLE
    : args.find((a) => !a.startsWith("--"));

  if (!file) {
    console.error("Usage: seedStageGuide.ts <file.json> [--state x] [--draft]");
    process.exit(1);
  }

  const stateArg = args.indexOf("--state");
  const stateSlug =
    stateArg >= 0 && args[stateArg + 1]
      ? args[stateArg + 1]!.trim().toLowerCase()
      : null;
  const status = args.includes("--draft") ? "draft" : "published";

  const parsed = StageGuideSchema.safeParse(
    JSON.parse(readFileSync(file, "utf8")),
  );
  if (!parsed.success) {
    console.error(`✖ ${path.basename(file)} does not match the format:\n`);
    for (const issue of formatStageGuideIssues(parsed.error)) {
      console.error(`   ${issue}`);
    }
    process.exit(1);
  }

  const guide = parsed.data;
  const uri = process.env.MONGO_URI;
  if (!uri) {
    console.error("MONGO_URI is not set — is .env loaded?");
    process.exit(1);
  }

  await mongoose.connect(uri);
  await SportStageGuide.findOneAndUpdate(
    { sportSlug: guide.sport.slug, stateSlug },
    {
      $set: {
        sportSlug: guide.sport.slug,
        stateSlug,
        status,
        formatVersion: guide.formatVersion,
        sportName: guide.sport.name,
        stageCount: guide.stages.length,
        verifiedOn: guide.verifiedOn,
        guide,
        uploadedAt: new Date(),
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );

  console.log(
    `✔ ${guide.sport.name}${stateSlug ? ` (${stateSlug})` : ""} — ${guide.stages.length} stages, ${status}`,
  );
  await mongoose.disconnect();
}

void main();
