/**
 * Generate SportStatePath documents for all 280 sport×state combinations.
 * Each state path contains only the state-specific overlay:
 *   stateAssociation, topAcademies, feeRange, governmentSchemes, regionalCalendar
 *
 * Run: npx ts-node src/scripts/generateSportStatePaths.ts [options]
 * Options:
 *   --sport <slug>   Generate only for this sport (default: all 10)
 *   --state <slug>   Generate only for this state (default: all 28)
 *   --force          Regenerate even if a state path already exists
 *   --concurrency N  Max parallel Gemini calls (default: 3, max: 5)
 */

import dotenv from "dotenv";
dotenv.config();

import mongoose from "mongoose";
import { GoogleGenAI } from "@google/genai";
import { SportStatePath } from "../shared/models/SportStatePath";
import { SUPPORTED_SPORTS } from "../shared/constants/supportedSports";
import { INDIAN_STATES_AND_UTS } from "../shared/utils/states";

const MONGO_URI = process.env.MONGO_URI || process.env.MONGODB_URI || "";
const GEMINI_KEY = process.env.GEMINI_API_KEY || "";
const MODEL_NAME = "gemini-2.0-flash";

// ─── CLI args ─────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);

function argVal(flag: string): string | null {
  const idx = args.indexOf(flag);
  return idx >= 0 ? args[idx + 1] ?? null : null;
}

const forceSport = argVal("--sport");
const forceState = argVal("--state");
const forceRegen = args.includes("--force");
const concurrency = Math.min(5, Math.max(1, Number(argVal("--concurrency")) || 3));

// ─── State slugs (derived from INDIAN_STATES_AND_UTS display names) ───────────

function toStateSlug(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

// ─── Prompt ───────────────────────────────────────────────────────────────────

function buildStatePathPrompt(sportName: string, stateName: string): string {
  return `You are a professional Indian sports development consultant.

Generate STATE-SPECIFIC information for "${sportName}" in "${stateName}", India.

Return ONLY a valid JSON object — no markdown, no code fences:

{
  "stateAssociation": {
    "name": "Full name of the state ${sportName} association",
    "acronym": "e.g. KSCA",
    "website": "https://... (if known, else omit)",
    "address": "City, State",
    "affiliatedWith": "National federation name"
  },
  "topAcademies": [
    {
      "name": "Academy name",
      "city": "City in ${stateName}",
      "coachName": "Head coach name if known",
      "speciality": "What makes this academy notable",
      "feeRange": "₹X,XXX – ₹X,XXX per month",
      "ageGroups": ["Under-10", "Under-14", "Under-18"]
    }
  ],
  "feeRange": {
    "stateAssociation": "₹X,XXX – ₹X,XXX per year",
    "nationalRegistration": "₹X,XXX – ₹X,XXX per year",
    "coaching": "₹X,XXX – ₹X,XXX per month",
    "equipment": "₹X,XXX – ₹X,XXX total"
  },
  "governmentSchemes": [
    {
      "name": "Scheme name",
      "body": "Organising govt body (e.g. ${stateName} Sports Authority)",
      "eligibility": "Who qualifies",
      "benefit": "What is provided",
      "howToApply": "Application process",
      "verifiedAsOf": "2025"
    }
  ],
  "regionalCalendar": [
    {
      "month": "e.g. October",
      "event": "Name of typical state-level event or season milestone",
      "level": "State | District | Inter-district"
    }
  ]
}

Rules:
- topAcademies: Include 3–5 real, well-known academies in ${stateName} for ${sportName}. If fewer than 3 exist, include the ones you know.
- governmentSchemes: Include 2–4 real state government or central government sports schemes applicable to ${stateName} athletes.
- regionalCalendar: Include 4–6 calendar items showing the typical competitive year for ${sportName} in ${stateName}.
- All monetary values in Indian Rupees (₹).
- Return ONLY the JSON object, no commentary.`;
}

// ─── Pool-based concurrency ───────────────────────────────────────────────────

async function pool<T>(
  items: T[],
  maxConcurrent: number,
  fn: (item: T, idx: number) => Promise<void>,
): Promise<void> {
  let idx = 0;

  async function worker() {
    while (idx < items.length) {
      const i = idx++;
      const item = items[i];
      if (item !== undefined) await fn(item, i);
    }
  }

  await Promise.all(Array.from({ length: maxConcurrent }, worker));
}

// ─── Generate one state path ──────────────────────────────────────────────────

async function generateStatePath(
  genAI: GoogleGenAI,
  sportSlug: string,
  sportName: string,
  stateName: string,
): Promise<void> {
  const stateSlug = toStateSlug(stateName);
  const label = `${sportName} / ${stateName}`;

  if (!forceRegen) {
    const existing = await SportStatePath.findOne({ sportSlug, stateSlug });
    if (existing) {
      console.log(`  ⏭  ${label} — exists, skipping`);
      return;
    }
  }

  const prompt = buildStatePathPrompt(sportName, stateName);

  let parsed: any;
  try {
    const result = await genAI.models.generateContent({
      model: MODEL_NAME,
      contents: prompt,
    });
    const raw = (result.text ?? "").trim();
    const jsonStr = raw.startsWith("```")
      ? raw.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "")
      : raw;
    parsed = JSON.parse(jsonStr);
  } catch (err) {
    console.error(`  ✗  ${label} — failed:`, err instanceof Error ? err.message : err);
    return;
  }

  await SportStatePath.findOneAndUpdate(
    { sportSlug, stateSlug },
    {
      $set: {
        sportSlug,
        stateSlug,
        stateName,
        stateAssociation: parsed.stateAssociation,
        topAcademies: parsed.topAcademies ?? [],
        feeRange: parsed.feeRange,
        governmentSchemes: parsed.governmentSchemes ?? [],
        regionalCalendar: parsed.regionalCalendar ?? [],
        generatedAt: new Date(),
      },
    },
    { upsert: true, new: true },
  );

  console.log(`  ✓  ${label}`);
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  if (!MONGO_URI) { console.error("MONGO_URI not set"); process.exit(1); }
  if (!GEMINI_KEY) { console.error("GEMINI_API_KEY not set"); process.exit(1); }

  await mongoose.connect(MONGO_URI);
  console.log("Connected to MongoDB\n");

  const targetSports = forceSport
    ? SUPPORTED_SPORTS.filter((s) => s.slug === forceSport)
    : SUPPORTED_SPORTS;

  const allStates: string[] = [...INDIAN_STATES_AND_UTS];
  const targetStates = forceState
    ? allStates.filter(
        (s) => toStateSlug(s) === forceState || s.toLowerCase() === forceState.toLowerCase(),
      )
    : allStates;

  if (targetSports.length === 0) {
    console.error(`No sport found matching "${forceSport}"`);
    process.exit(1);
  }

  const pairs: Array<{ sport: typeof targetSports[0]; state: string }> = [];
  for (const sport of targetSports) {
    for (const state of targetStates) {
      pairs.push({ sport, state });
    }
  }

  console.log(
    `Generating ${pairs.length} state paths (concurrency: ${concurrency})...\n`,
  );

  const genAI = new GoogleGenAI({ apiKey: GEMINI_KEY });

  await pool(pairs, concurrency, async ({ sport, state }) => {
    try {
      await generateStatePath(genAI, sport.slug, sport.name, state);
      // Small pause to respect Gemini rate limits
      await new Promise((r) => setTimeout(r, 500));
    } catch (err) {
      console.error(`  ✗  ${sport.name} / ${state}:`, err);
    }
  });

  console.log("\nDone.");
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
