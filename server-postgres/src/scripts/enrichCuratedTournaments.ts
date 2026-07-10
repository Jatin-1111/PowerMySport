/**
 * Enrich curated tournament records with web-searched data.
 *
 * For each curated tournament, this script runs a two-step Gemini call:
 *   1. Gemini + Google Search grounding — researches the official federation
 *      website and returns free-form findings.
 *   2. Gemini (no tools) — converts the findings into strict JSON that maps
 *      to the 5 new enrichment fields on the Tournament model.
 *
 * Fields populated: entryFee, selectionCriteria, prizes, keyFacts, importantNotes
 *
 * Run: npx ts-node src/scripts/enrichCuratedTournaments.ts
 * Safe to re-run — uses $set so existing values are overwritten with fresher data.
 */

import dotenv from "dotenv";
dotenv.config();

import mongoose from "mongoose";
import { GoogleGenAI } from "@google/genai";
import { Tournament } from "../shared/models/Tournament";

const MONGO_URI = process.env.MONGO_URI || process.env.MONGODB_URI || "";
const MODEL_CANDIDATES = ["gemini-2.5-flash", "gemini-2.5-flash-lite"];

// ─── Types ────────────────────────────────────────────────────────────────────

interface EnrichmentResult {
  entryFee: string | null;
  selectionCriteria: string | null;
  prizes: string | null;
  keyFacts: string[];
  importantNotes: string[];
  circuitContext: string | null;
}

// ─── Prompts ─────────────────────────────────────────────────────────────────

function buildResearchPrompt(tournament: {
  name: string;
  sportSlug: string;
  level: string;
  ageGroup: string;
  federation?: { name: string; acronym: string; website?: string };
  sourceUrls?: string[];
}): string {
  const fed = tournament.federation;
  const officialSites = [
    fed?.website,
    ...(tournament.sourceUrls ?? []),
  ]
    .filter(Boolean)
    .join(", ");

  return `Use Google Search to research the "${tournament.name}" — a ${tournament.level} ${tournament.sportSlug} tournament in India for ${tournament.ageGroup} players, organised by ${fed?.name ?? "the national federation"} (${fed?.acronym ?? ""}).

Official sources to prioritise: ${officialSites || `${fed?.acronym ?? ""} official website`}

Find SPECIFIC, ACCURATE answers to these 5 questions. Only report what you actually find via search — never invent numbers or policies:

1. ENTRY FEE: What does it cost a player or family to participate? Include:
   - Registration/trial fees at state level (if any)
   - Entry fees for the tournament itself (if any)
   - Whether selected players receive match fees or stipends
   - If free, say so explicitly

2. SELECTION CRITERIA: Exactly how are players chosen? Include:
   - Who selects (selectors, committee, ranking algorithm)
   - What criteria (performance in specific feeder tournaments, rankings, trials)
   - State quota system if applicable
   - Minimum eligibility (number of matches played, ranking threshold)

3. PRIZES & AWARDS: What do participants actually receive? Include:
   - Cash prize for winner, runner-up, and other positions
   - Physical awards (trophy name, medals)
   - Non-cash benefits (ranking points, match fees per day, certificates)
   - Any government recognition (Arjuna Award consideration, etc.)

4. KEY FACTS: Give 5–6 specific, verifiable facts that help a parent understand the scale and importance of this tournament. Examples: year it started, number of teams/players, total rounds, geographic spread, notable alumni.

5. PARENT WARNINGS / IMPORTANT NOTES: What critical gotchas must parents know? Examples:
   - Mandatory federation registration before trials
   - Residency/domicile rules (must represent birth state, etc.)
   - Age proof document requirements (Aadhaar vs school certificate)
   - Deadlines that catch parents off guard
   - Common rejection reasons

6. CIRCUIT & RANKING SYSTEM: What is the complete competition ladder and ranking series for this sport that leads to or from this tournament? Be specific and factual — use the exact tier names the federation uses. Include:
   - The full named tier structure (e.g., for AITA tennis: Team Series TS → City Series CS → National Series NS → Super Series SS → National Championship; for BCCI cricket: district → U-16 Vijay Merchant → U-19 Cooch Behar → U-25 Vinoo Mankad → Ranji Trophy → Duleep/Irani → India team)
   - Where this specific tournament sits in that hierarchy (entry-level, mid-tier, apex)
   - What feeder tournaments/events a player typically competes in 1–2 years before reaching this tournament
   - What tournaments/opportunities open up after performing well here
   - Any ranking points system, grade system, or rating milestones that matter within this circuit

Answer in plain text. Be specific to THIS tournament and THIS sport's actual federation structure.`;
}

function buildFormattingPrompt(researchFindings: string): string {
  return `Below is research about a specific Indian sports tournament. Convert the findings into a JSON object with exactly these keys. Use null for fields the research did not cover. Use empty arrays [] for list fields with no data found.

Keys:
- entryFee (string or null) — plain English description of participation costs. Max 120 chars.
- selectionCriteria (string or null) — how players are selected. Max 250 chars.
- prizes (string or null) — full prize/award breakdown. Max 200 chars.
- keyFacts (array of strings) — 4–6 specific factual bullets. Each under 80 chars. Empty array if none found.
- importantNotes (array of strings) — 3–5 critical notes for parents. Each under 120 chars. Empty array if none found.
- circuitContext (string or null) — the full competition ladder and ranking series for this sport, explaining where this tournament sits and what comes before and after it. Use the exact tier/grade/series names the federation uses. Max 400 chars. null if not found.

Research:
"""
${researchFindings}
"""

Return ONLY the JSON object. No markdown fences, no commentary.`;
}

// ─── Core enrichment call ─────────────────────────────────────────────────────

async function enrichTournament(
  genAI: GoogleGenAI,
  tournament: InstanceType<typeof Tournament>,
): Promise<EnrichmentResult | null> {
  const researchPrompt = buildResearchPrompt({
    name: tournament.name,
    sportSlug: tournament.sportSlug,
    level: tournament.level,
    ageGroup: tournament.ageGroup,
    federation: tournament.federation as any,
    sourceUrls: tournament.sourceUrls,
  });

  for (const model of MODEL_CANDIDATES) {
    try {
      // Step 1: web-grounded research
      const groundingRes = await genAI.models.generateContent({
        model,
        contents: researchPrompt,
        config: {
          tools: [{ googleSearch: {} }],
          temperature: 0.2,
        },
      });

      const findings = (groundingRes.text ?? "").trim();
      if (!findings) continue;

      // Step 2: strict JSON formatting (no tools)
      const formattingRes = await genAI.models.generateContent({
        model,
        contents: buildFormattingPrompt(findings),
        config: {
          temperature: 0,
          responseMimeType: "application/json",
        },
      });

      const raw = (formattingRes.text ?? "")
        .trim()
        .replace(/^```[a-z]*\n?/i, "")
        .replace(/```$/i, "")
        .trim();

      let parsed: any;
      try {
        parsed = JSON.parse(raw);
      } catch {
        const match = raw.match(/\{[\s\S]*\}/);
        if (match) {
          try { parsed = JSON.parse(match[0]); } catch { continue; }
        } else {
          continue;
        }
      }

      return {
        entryFee: parsed.entryFee ?? null,
        selectionCriteria: parsed.selectionCriteria ?? null,
        prizes: parsed.prizes ?? null,
        keyFacts: Array.isArray(parsed.keyFacts) ? parsed.keyFacts : [],
        importantNotes: Array.isArray(parsed.importantNotes) ? parsed.importantNotes : [],
        circuitContext: parsed.circuitContext ?? null,
      };
    } catch (err: any) {
      if (err?.status === 429) {
        console.warn(`  [rate-limited] model ${model}, trying next`);
        continue;
      }
      console.error(`  [error] model ${model}:`, err?.message ?? err);
    }
  }
  return null;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  if (!MONGO_URI) {
    console.error("MONGO_URI not set in .env");
    process.exit(1);
  }

  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  if (!apiKey) {
    console.error("GEMINI_API_KEY not set in .env");
    process.exit(1);
  }

  await mongoose.connect(MONGO_URI);
  console.log("Connected to MongoDB");

  const genAI = new GoogleGenAI({ apiKey });

  const tournaments = await Tournament.find({ isCurated: true }).lean();
  console.log(`Found ${tournaments.length} curated tournaments to enrich\n`);

  let enriched = 0;
  let failed = 0;

  for (const t of tournaments) {
    process.stdout.write(`→ ${t.name} (${t.sportSlug}) ... `);

    const result = await enrichTournament(genAI, t as any);

    if (!result) {
      console.log("FAILED");
      failed++;
      continue;
    }

    // Only update fields that came back non-empty
    const updateFields: Record<string, any> = {};
    if (result.entryFee) updateFields.entryFee = result.entryFee;
    if (result.selectionCriteria) updateFields.selectionCriteria = result.selectionCriteria;
    if (result.prizes) updateFields.prizes = result.prizes;
    if (result.keyFacts.length > 0) updateFields.keyFacts = result.keyFacts;
    if (result.importantNotes.length > 0) updateFields.importantNotes = result.importantNotes;
    // Only overwrite circuitContext from web research if the seeder didn't already provide one
    // (enrichment may add more specific details, seeder has authoritative base knowledge)
    if (result.circuitContext) updateFields.circuitContext = result.circuitContext;

    if (Object.keys(updateFields).length > 0) {
      await Tournament.updateOne(
        { _id: t._id },
        { $set: updateFields },
      );
    }

    console.log(
      `OK (${Object.keys(updateFields).length} fields, ` +
      `${result.keyFacts.length} facts, ${result.importantNotes.length} notes)`,
    );
    enriched++;

    // Small delay to stay within rate limits
    await new Promise((r) => setTimeout(r, 3000));
  }

  await mongoose.disconnect();
  console.log(`\nDone. Enriched: ${enriched}, Failed: ${failed}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
