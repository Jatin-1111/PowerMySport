import dotenv from "dotenv";
import { GoogleGenAI } from "@google/genai";
import { Tournament } from "../models/Tournament";
import { Scholarship } from "../models/Scholarship";
import { University } from "../models/University";
import { AthleteStory } from "../models/AthleteStory";

dotenv.config();

type EntityType = "tournament" | "scholarship" | "university" | "story";

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
  if (type === "story") {
    return `- name (string — the athlete's real full name as publicly known, e.g. "Saina Nehwal")
- location (string — the Indian state they represent or are from, e.g. "Haryana")
- achievement (string — their single most verifiable notable achievement, concise, max 10 words, e.g. "Won National Junior Badminton Championship 2018")
- quote (string — exactly 2 sentences written in first person, grounded ONLY in publicly known facts about this athlete's real journey. This is a factual narrative paraphrase, NOT a fabricated interview quote. E.g. "I started training at a local court in Patiala when I was 10. By 15, I was playing state-level tournaments for Punjab.")
- parentNote (string — exactly 2 sentences written from a parent's perspective, grounded in what is publicly known about this athlete's background. E.g. "We never imagined badminton could become a career. Seeing her win the district championship changed everything for our family.")
- level (number — 1, 2, 3, 4, or 5. Assign based on the athlete's HIGHEST 
  ACHIEVEMENT, not where they started. Every athlete starts as a beginner — 
  ignore the starting point entirely.
  1 = highest level is school/local club only
  2 = highest level is district championship
  3 = highest level is state championship or state team
  4 = highest level is national ranking, national championship, or national team
  5 = highest level is international ranking, international tournament, or 
      national team at international events
  Ribhav Saroha (All India No. 1 Under-16) = 4. Karman Kaur Thandi (WTA top 200) = 5.)
- tags (array of 1–3 short strings describing what makes this athlete's journey notable, e.g. ["rural background", "self-funded", "late starter"])`;
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
  if (type === "story") return "real Indian athletes with notable journeys";
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

  if (type === "story") {
    const stateClause = ctx.city
      ? ` from the Indian state of ${ctx.city} or who represent ${ctx.city}`
      : " from across India";

    return `Use Google Search to find 2 to 3 REAL, NAMED Indian athletes who play or have played "${ctx.sportName}"${stateClause} and have a publicly documented journey worth sharing with parents considering this sport for their child.

CRITICAL RULES — read before searching:
- Only return athletes who ACTUALLY EXIST and whose achievements are findable via search. A real athlete with a modest achievement is far better than a fabricated one.
- Do NOT invent athletes, fabricate achievements, or fill gaps with assumptions. If you cannot find 2 real athletes, return 1 or even 0. Empty is correct; invented is harmful.
- Prefer athletes who started at grassroots or school level and progressed upward — not only already-famous stars. The goal is "this could be your child", not "here is a celebrity."
- If the state was specified, strongly prefer athletes who are from or represent that state. If you genuinely cannot find any, you may include national-level athletes and note their home state.
- Do NOT include the same athlete twice. Do NOT include international athletes who are not Indian.

For each real athlete you find, report:
${schemaBullets(type)}

You can answer in plain text, bullet points, or any format — just make sure every fact
is something you actually found through search, not recalled from memory or guessed.
If you find nothing credible, say so plainly — "I could not find verifiable athletes for this sport from this state."`;
  }

  if (type === "tournament") {
    return `Use Google Search to research REAL, CURRENTLY ACTIVE ${ctx.sportName} tournaments in
India${cityClause}. I need at least 6 DIFFERENT tournament series or
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

async function upsertStories(
  sportSlug: string,
  items: any[],
  sourceUrls: string[],
) {
  for (const item of items) {
    if (!item?.name) continue;
    await AthleteStory.findOneAndUpdate(
      { sportSlug, name: item.name },
      {
        $set: {
          location: item.location || "",
          achievement: item.achievement || "",
          quote: item.quote || "",
          parentNote: item.parentNote || "",
          level: Number(item.level) || 1,
          tags: Array.isArray(item.tags) ? item.tags : [],
          isAiGenerated: true,
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

  async scrapeStoriesForSport(ctx: ScrapeContext): Promise<number> {
    if (!this.genAI) return 0;
    const result = await extractWithGrounding(this.genAI, "story", ctx);
    await upsertStories(ctx.sportSlug, result.items, result.sourceUrls);
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
    stories: number;
  }> {
    if (!this.genAI) {
      console.warn(
        "[RealDataScraperService] No GEMINI_API_KEY/GOOGLE_API_KEY set — skipping.",
      );
      return { tournaments: 0, scholarships: 0, universities: 0, stories: 0 };
    }

    const [tournamentResult, scholarshipResult, universityResult, storyResult] =
      await Promise.all([
        extractWithGrounding(this.genAI, "tournament", ctx),
        extractWithGrounding(this.genAI, "scholarship", ctx),
        extractWithGrounding(this.genAI, "university", ctx),
        extractWithGrounding(this.genAI, "story", ctx),
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
    await upsertStories(
      ctx.sportSlug,
      storyResult.items,
      storyResult.sourceUrls,
    );

    return {
      tournaments: dedupedTournamentItems.length,
      scholarships: scholarshipResult.items.length,
      universities: universityResult.items.length,
      stories: storyResult.items.length,
    };
  }
}

export const realDataScraperService = new RealDataScraperService();
