/**
 * Generate SportBasePath documents for all 10 supported sports.
 * Each base path contains sport-universal content (overview, levels stripped of
 * state-specific fields, equipment, careers) — generated once and shared across
 * all 28 state variants, saving ~50% of Gemini tokens on per-state regeneration.
 *
 * Run: npx ts-node src/scripts/generateSportBasePaths.ts [--sport cricket]
 * Options:
 *   --sport <slug>   Generate only for this sport (default: all 10)
 *   --force          Regenerate even if a base path already exists
 */

import dotenv from "dotenv";
dotenv.config();

import mongoose from "mongoose";
import { GoogleGenAI } from "@google/genai";
import { SportBasePath } from "../shared/models/SportBasePath";
import { SUPPORTED_SPORTS } from "../shared/constants/supportedSports";

const MONGO_URI = process.env.MONGO_URI || process.env.MONGODB_URI || "";
const GEMINI_KEY = process.env.GEMINI_API_KEY || "";
const MODEL_NAME = "gemini-2.0-flash";

const args = process.argv.slice(2);
const forceSport = args.includes("--sport")
  ? args[args.indexOf("--sport") + 1]
  : null;
const forceRegen = args.includes("--force");

function buildBasePathPrompt(sportName: string): string {
  return `You are a professional Indian sports development consultant with deep knowledge of competitive sports pathways in India.

Generate a comprehensive UNIVERSAL (non-state-specific) development pathway for "${sportName}" in India.

Return ONLY a valid JSON object — no markdown, no code fences. The JSON must have exactly these fields:

{
  "overview": "2-3 sentence overview of ${sportName} as a career/competitive sport in India",
  "category": "Individual | Team | Racquet | Combat | Water | Board",
  "equipment": [
    { "level": "Beginner (Level 1-2)", "items": ["item1", "item2"], "estimatedCost": "₹X,XXX – ₹X,XXX" },
    { "level": "Intermediate (Level 3-4)", "items": ["item1", "item2"], "estimatedCost": "₹X,XXX – ₹X,XXX" },
    { "level": "Advanced (Level 5)", "items": ["item1", "item2"], "estimatedCost": "₹X,XXX – ₹X,XXX" }
  ],
  "careers": [
    { "role": "Professional Player", "description": "...", "demand": "High | Medium | Low" },
    { "role": "Coach / Trainer", "description": "...", "demand": "High | Medium | Low" },
    { "role": "Sports Administrator", "description": "...", "demand": "..." },
    { "role": "Sports Journalist / Commentator", "description": "...", "demand": "..." },
    { "role": "Sports Science / Physio", "description": "...", "demand": "..." }
  ],
  "levels": [
    {
      "level": 1,
      "label": "Grassroots",
      "title": "Level 1 title for ${sportName}",
      "description": "What this level is about",
      "keyFocus": "Core focus for this level",
      "ageRange": "e.g. 6–10 years",
      "competitions": "Types of competitions available at this level",
      "steps": ["Step 1", "Step 2", "Step 3", "Step 4", "Step 5"],
      "governingBody": "National federation or body",
      "benchmarks": {
        "description": "What mastery looks like",
        "metrics": [
          { "metric": "Skill metric", "target": "Target value" },
          { "metric": "Fitness metric", "target": "Target value" }
        ]
      },
      "trialInfo": {
        "typicalMonths": "e.g. August–September",
        "registrationProcess": "How to register",
        "eligibilityAge": "e.g. 6–10 years",
        "selectionCriteria": ["Criterion 1", "Criterion 2"],
        "tips": ["Preparation tip 1", "Preparation tip 2"]
      },
      "injuryRisks": {
        "commonInjuries": ["Injury 1", "Injury 2"],
        "preventionTips": ["Tip 1", "Tip 2"],
        "warningSignsToWatch": ["Sign 1", "Sign 2"]
      },
      "talentSignals": {
        "physicalMarkers": ["Marker 1", "Marker 2"],
        "cognitiveMarkers": ["Marker 1", "Marker 2"],
        "behavioralMarkers": ["Marker 1", "Marker 2"]
      },
      "mentalSkillsFocus": ["Mental skill 1", "Mental skill 2"],
      "coachSelectionGuide": {
        "mustHave": ["Must-have quality 1", "Must-have quality 2"],
        "niceToHave": ["Nice quality 1"],
        "redFlags": ["Red flag 1", "Red flag 2"],
        "questionsToAsk": ["Question 1?", "Question 2?"]
      },
      "academicIntegration": "How to balance academics at this level",
      "proactiveDocuments": ["Document 1", "Document 2"]
    }
  ]
}

Generate exactly 5 levels (1=Grassroots, 2=District, 3=State, 4=National, 5=International).
Do NOT include localResources, governmentSchemes, or any state-specific content in the levels — those go in SportStatePath.
All content must be specific to ${sportName} in India, not generic.
Return ONLY the JSON object.`;
}

async function generateBasePath(sportSlug: string, sportName: string): Promise<void> {
  if (!forceRegen) {
    const existing = await SportBasePath.findOne({ sportSlug });
    if (existing) {
      console.log(`  ⏭  ${sportName} — base path already exists, skipping (use --force to regenerate)`);
      return;
    }
  }

  console.log(`  ⟳  Generating base path for ${sportName}...`);

  const genAI = new GoogleGenAI({ apiKey: GEMINI_KEY });

  const prompt = buildBasePathPrompt(sportName);
  const result = await genAI.models.generateContent({
    model: MODEL_NAME,
    contents: prompt,
  });
  const raw = (result.text ?? "").trim();

  // Strip markdown fences if present
  const jsonStr = raw.startsWith("```")
    ? raw.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "")
    : raw;

  let parsed: any;
  try {
    parsed = JSON.parse(jsonStr);
  } catch (err) {
    console.error(`  ✗  ${sportName} — JSON parse error:`, err);
    console.error("  Raw response (first 400 chars):", raw.slice(0, 400));
    return;
  }

  await SportBasePath.findOneAndUpdate(
    { sportSlug },
    {
      $set: {
        sportSlug,
        sportName,
        overview: parsed.overview,
        category: parsed.category,
        levels: parsed.levels,
        equipment: parsed.equipment,
        careers: parsed.careers,
        generatedAt: new Date(),
      },
    },
    { upsert: true, new: true },
  );

  console.log(`  ✓  ${sportName} — base path saved`);
}

async function main() {
  if (!MONGO_URI) { console.error("MONGO_URI not set"); process.exit(1); }
  if (!GEMINI_KEY) { console.error("GEMINI_API_KEY not set"); process.exit(1); }

  await mongoose.connect(MONGO_URI);
  console.log("Connected to MongoDB\n");

  const targets = forceSport
    ? SUPPORTED_SPORTS.filter((s) => s.slug === forceSport)
    : SUPPORTED_SPORTS;

  if (targets.length === 0) {
    console.error(`No sport found matching slug "${forceSport}"`);
    process.exit(1);
  }

  for (const sport of targets) {
    try {
      await generateBasePath(sport.slug, sport.name);
      // 2-second pause between Gemini calls to avoid rate limits
      if (targets.length > 1) await new Promise((r) => setTimeout(r, 2000));
    } catch (err) {
      console.error(`  ✗  ${sport.name} — generation failed:`, err);
    }
  }

  console.log("\nDone.");
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
