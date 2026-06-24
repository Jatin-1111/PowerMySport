import dotenv from "dotenv";
import { GoogleGenAI } from "@google/genai";
import { Tournament } from "../models/Tournament";
import { Scholarship } from "../models/Scholarship";
import { University } from "../models/University";

dotenv.config();

type EntityType = "tournament" | "scholarship" | "university";

interface ScrapeContext {
  sportSlug: string;
  sportName: string;
  city?: string;
}

interface GroundedExtractionResult {
  items: any[];
  sourceUrls: string[];
}

const scraperModelCandidates = [
  process.env.GEMINI_SCRAPER_MODEL,
  "gemini-2.5",
  "gemini-2.5-flash",
  "gemini-2.5-flash-lite",
  "gemini-2.0-flash",
  "gemini-1.5-flash",
].filter(Boolean) as string[];

// ─── Prompts ──────────────────────────────────────────────────────────────────

function schemaBullets(type: EntityType): string {
  if (type === "tournament") {
    return `- name (string — the real, official tournament name)
- level (string: "Grassroots" | "District" | "State" | "National" | "International")
- description (string — what it is and where it's held)
- ageGroup (string, e.g. "Under-14", "Open")
- city (string, e.g. "Mumbai" or "National")
- typicalDates (string — when this tournament is typically held each year, e.g. "Usually held in January–February" or "October–November, annually". If you found a specific upcoming date include it, e.g. "Next edition: March 2026". Use null if unknown.)
- registrationDeadline (string — typical registration window relative to the event, e.g. "Registration closes 3–4 weeks before the event" or a specific upcoming deadline if found. Use null if unknown.)
- prerequisiteId (string — registration ID required, e.g. "<FEDERATION_ACRONYM>_ID")
- prerequisiteName (string — human-readable name of that ID/registration)
- prerequisiteGuide (array of 2-4 short steps to obtain that registration)
- documentChecklist (array of documents typically required to register)`;
  }

  if (type === "scholarship") {
    return `- name (string — the real scholarship/scheme name)
- provider (string, e.g. "Sports Authority of India", "Khelo India", a real corporate sponsor)
- description (string — what financial/training support it gives)
- eligibility (string — real eligibility criteria)
- city (string, e.g. "Mumbai" or "National")
- prerequisiteId (string — application form ID, e.g. "SAI_FORM_A")
- prerequisiteName (string — human-readable form name)
- prerequisiteGuide (array of 2-4 short steps to apply)
- documentChecklist (array of documents typically required)`;
  }

  return `- name (string — the real university name)
- location (string — "City, State")
- admissionCriteria (string — real sports-quota admission criteria)
- sportsQuotaDetails (string — what the quota provides, e.g. fee waiver, marks relaxation)
- city (string, e.g. "Mumbai")
- prerequisiteId (string — application ID, e.g. "SPORTS_QUOTA_APP")
- prerequisiteName (string — human-readable application name)
- prerequisiteGuide (array of 2-4 short steps to apply)
- documentChecklist (array of documents typically required)`;
}

function entityLabel(type: EntityType): string {
  if (type === "tournament") return "tournaments";
  if (type === "scholarship")
    return "scholarships or financial support schemes";
  return "universities/colleges offering admission via sports quota";
}

/**
 * Step 1 prompt — used WITH the googleSearch tool. Deliberately does NOT
 * demand strict JSON: when google_search is enabled, Gemini frequently
 * ignores "return only JSON" instructions in favour of a natural, cited
 * answer. Asking for JSON here was the original bug — every scrape silently
 * returned 0 results because the model's grounded prose never matched the
 * parser, with no thrown error to flag it. So this step just asks it to
 * research and report findings in whatever format it naturally produces;
 * step 2 below does the strict-JSON conversion in a tool-free call.
 */
function buildGroundingPrompt(type: EntityType, ctx: ScrapeContext): string {
  const cityClause = ctx.city
    ? ` specifically located in or highly relevant to players from ${ctx.city}`
    : "";

  if (type === "tournament") {
    return `Use Google Search to research REAL, CURRENTLY ACTIVE tennis tournaments in
India for the sport "${ctx.sportName}"${cityClause}. I need at least 6 DIFFERENT tournament series or
events, not 6 city editions of the same series.

Rules:
- Prefer genuinely different tournaments, organizers, circuits, or event names.
- If the same tournament series is held in multiple cities, collapse those into one
  canonical tournament entry instead of listing each city separately.
- Do not put the city in the name; keep the tournament name canonical and city-agnostic.
- Put any city / venue detail in the description if it helps identify the event.
- Only report things you actually find via search. Do not invent anything.

For each real item you find, report:
${schemaBullets(type)}

Return 6 distinct tournaments if you can find them. You can answer in plain text,
bullet points, or JSON — whatever is natural. Just make sure every fact is something you
actually found through search, not something you're recalling from memory or guessing.`;
  }

  return `Use Google Search to research REAL, CURRENTLY ACTIVE ${entityLabel(type)} in
India for the sport "${ctx.sportName}"${cityClause}. Only report things you actually find via search —
do not invent anything. If you genuinely find nothing relevant, say so plainly.

For each real item you find, report:
${schemaBullets(type)}

You can answer in plain text, bullet points, or JSON — whatever is natural. Just make sure
every fact is something you actually found through search, not something you're recalling
from memory or guessing.`;
}

/**
 * Step 2 prompt — NO tools, so responseMimeType: "application/json" is fully
 * reliable here. Converts step 1's free-form grounded findings into strict
 * JSON, without adding anything not already present in the findings.
 */
function buildFormattingPrompt(
  type: EntityType,
  groundedFindings: string,
): string {
  return `Below is research about real ${entityLabel(type)}. Convert ONLY the real items
explicitly mentioned into a JSON array. Do not add, invent, or infer anything not present in
the research. If the research does not clearly mention any real items, return an empty array.

Each object must have exactly these keys:
${schemaBullets(type)}

Research:
"""
${groundedFindings}
"""

Return ONLY the JSON array. No markdown fences, no commentary.`;
}

// ─── Grounded extraction (single call: search + structured-ish JSON in prompt) ──

async function extractWithGrounding(
  genAI: GoogleGenAI,
  type: EntityType,
  ctx: ScrapeContext,
): Promise<GroundedExtractionResult> {
  const groundingPrompt = buildGroundingPrompt(type, ctx);

  for (const model of scraperModelCandidates) {
    try {
      const groundingResponse = await genAI.models.generateContent({
        model,
        contents: groundingPrompt,
        config: {
          tools: [{ googleSearch: {} }],
          temperature: 0.2,
        },
      });

      const groundedFindings = (groundingResponse.text ?? "").trim();
      const chunks =
        groundingResponse.candidates?.[0]?.groundingMetadata?.groundingChunks ??
        [];
      const sourceUrls = Array.from(
        new Set(
          chunks
            .map((c: any) => c?.web?.uri)
            .filter((uri: unknown): uri is string => typeof uri === "string"),
        ),
      );

      if (!groundedFindings) {
        continue;
      }

      const formattedResponse = await genAI.models.generateContent({
        model,
        contents: buildFormattingPrompt(type, groundedFindings),
        config: {
          temperature: 0,
          responseMimeType: "application/json",
        },
      });

      const rawText = (formattedResponse.text ?? "").trim();
      const jsonText = rawText
        .replace(/^```[a-z]*\n?/i, "")
        .replace(/```$/i, "")
        .trim();

      let items: any[] = [];
      try {
        const parsed = JSON.parse(jsonText);
        if (Array.isArray(parsed)) items = parsed;
      } catch {
        // Model occasionally wraps JSON in prose despite instructions — try to
        // salvage the first [...] block before giving up on this model.
        const match = jsonText.match(/\[[\s\S]*\]/);
        if (match) {
          try {
            const parsed = JSON.parse(match[0]);
            if (Array.isArray(parsed)) items = parsed;
          } catch {
            // give up on this model, try next candidate
          }
        }
      }

      if (items.length > 0) {
        return { items, sourceUrls };
      }
      // Empty but valid response (model genuinely found nothing) — don't
      // fall through to a different model just to force a result.
      if (jsonText === "[]") {
        return { items: [], sourceUrls };
      }
    } catch (error) {
      const statusCode = (error as { status?: number }).status;
      if (statusCode === 429) {
        console.warn(
          `[RealDataScraperService] ${type} model ${model} is rate-limited or over quota, trying next candidate.`,
        );
        continue;
      }

      console.error(
        `[RealDataScraperService] ${type} extraction failed with model ${model}:`,
        error,
      );
      // try next model
    }
  }

  return { items: [], sourceUrls: [] };
}

function canonicalizeTournamentName(name: string): string {
  return name
    .replace(/\s*\([^)]*\)\s*$/, "")
    .replace(/\s+/g, " ")
    .trim();
}

function dedupeTournamentItems(items: any[]): any[] {
  const seen = new Set<string>();
  const deduped: any[] = [];

  for (const item of items) {
    if (!item?.name) continue;
    const canonicalName = canonicalizeTournamentName(String(item.name));
    const key = canonicalName.toLowerCase();
    if (seen.has(key)) continue;

    seen.add(key);
    deduped.push({
      ...item,
      name: canonicalName,
    });
  }

  return deduped;
}

// ─── Upsert helpers (dedupe by sportSlug + name, so re-scraping updates facts in place) ──

async function upsertTournaments(
  sportSlug: string,
  items: any[],
  sourceUrls: string[],
) {
  for (const item of dedupeTournamentItems(items)) {
    if (!item?.name) continue;
    await Tournament.findOneAndUpdate(
      { sportSlug, name: item.name },
      {
        $set: {
          level: item.level || "National",
          description: item.description || "",
          ageGroup: item.ageGroup || "Open",
          city: item.city,
          typicalDates: item.typicalDates || undefined,
          registrationDeadline: item.registrationDeadline || undefined,
          prerequisiteId: item.prerequisiteId,
          prerequisiteName: item.prerequisiteName,
          prerequisiteGuide: item.prerequisiteGuide || [],
          documentChecklist: item.documentChecklist || [],
          sourceUrls,
          lastScrapedAt: new Date(),
        },
      },
      { upsert: true, new: true },
    );
  }
}

async function upsertScholarships(
  sportSlug: string,
  items: any[],
  sourceUrls: string[],
) {
  for (const item of items) {
    if (!item?.name) continue;
    await Scholarship.findOneAndUpdate(
      { sportSlug, name: item.name },
      {
        $set: {
          provider: item.provider || "",
          description: item.description || "",
          eligibility: item.eligibility || "",
          city: item.city,
          prerequisiteId: item.prerequisiteId,
          prerequisiteName: item.prerequisiteName,
          prerequisiteGuide: item.prerequisiteGuide || [],
          documentChecklist: item.documentChecklist || [],
          sourceUrls,
          lastScrapedAt: new Date(),
        },
      },
      { upsert: true, new: true },
    );
  }
}

async function upsertUniversities(
  sportSlug: string,
  items: any[],
  sourceUrls: string[],
) {
  for (const item of items) {
    if (!item?.name) continue;
    await University.findOneAndUpdate(
      { sportSlug, name: item.name },
      {
        $set: {
          location: item.location || "",
          admissionCriteria: item.admissionCriteria || "",
          sportsQuotaDetails: item.sportsQuotaDetails || "",
          city: item.city,
          prerequisiteId: item.prerequisiteId,
          prerequisiteName: item.prerequisiteName,
          prerequisiteGuide: item.prerequisiteGuide || [],
          documentChecklist: item.documentChecklist || [],
          sourceUrls,
          lastScrapedAt: new Date(),
        },
      },
      { upsert: true, new: true },
    );
  }
}

// ─── Service ──────────────────────────────────────────────────────────────────

export class RealDataScraperService {
  private genAI: GoogleGenAI | null = null;

  constructor() {
    const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
    if (apiKey) {
      this.genAI = new GoogleGenAI({ apiKey });
    }
  }

  /**
   * Scrapes real tournaments, scholarships, and universities for one sport
   * and upserts them into the canonical collections. Safe to re-run — it
   * refreshes existing records in place rather than duplicating them.
   */
  /**
   * Scrapes only real tournaments for one sport. Used by scrapeTournaments.ts.
   */
  async scrapeTournamentsForSport(ctx: ScrapeContext): Promise<number> {
    if (!this.genAI) return 0;
    const result = await extractWithGrounding(this.genAI, "tournament", ctx);
    const dedupedItems = dedupeTournamentItems(result.items);
    await upsertTournaments(ctx.sportSlug, dedupedItems, result.sourceUrls);
    return dedupedItems.length;
  }

  /**
   * Scrapes only real scholarships for one sport. Used by scrapeScholarships.ts.
   */
  async scrapeScholarshipsForSport(ctx: ScrapeContext): Promise<number> {
    if (!this.genAI) return 0;
    const result = await extractWithGrounding(this.genAI, "scholarship", ctx);
    await upsertScholarships(ctx.sportSlug, result.items, result.sourceUrls);
    return result.items.length;
  }

  /**
   * Scrapes only real universities for one sport. Used by scrapeUniversities.ts.
   */
  async scrapeUniversitiesForSport(ctx: ScrapeContext): Promise<number> {
    if (!this.genAI) return 0;
    const result = await extractWithGrounding(this.genAI, "university", ctx);
    await upsertUniversities(ctx.sportSlug, result.items, result.sourceUrls);
    return result.items.length;
  }

  /**
   * Scrapes all three entity types for one sport in parallel. Used for
   * manual/admin "refresh this sport now" actions.
   */
  async scrapeSport(ctx: ScrapeContext): Promise<{
    tournaments: number;
    scholarships: number;
    universities: number;
  }> {
    if (!this.genAI) {
      console.warn(
        "[RealDataScraperService] No GEMINI_API_KEY/GOOGLE_API_KEY set — skipping.",
      );
      return { tournaments: 0, scholarships: 0, universities: 0 };
    }

    const [tournamentResult, scholarshipResult, universityResult] =
      await Promise.all([
        extractWithGrounding(this.genAI, "tournament", ctx),
        extractWithGrounding(this.genAI, "scholarship", ctx),
        extractWithGrounding(this.genAI, "university", ctx),
      ]);

    const dedupedTournamentItems = dedupeTournamentItems(
      tournamentResult.items,
    );

    await upsertTournaments(
      ctx.sportSlug,
      dedupedTournamentItems,
      tournamentResult.sourceUrls,
    );
    await upsertScholarships(
      ctx.sportSlug,
      scholarshipResult.items,
      scholarshipResult.sourceUrls,
    );
    await upsertUniversities(
      ctx.sportSlug,
      universityResult.items,
      universityResult.sourceUrls,
    );

    return {
      tournaments: dedupedTournamentItems.length,
      scholarships: scholarshipResult.items.length,
      universities: universityResult.items.length,
    };
  }
}

export const realDataScraperService = new RealDataScraperService();
