import { GoogleGenAI } from "@google/genai";
import { TournamentEdition } from "../models/TournamentEdition";
import {
  TOURNAMENT_SOURCE_REGISTRY,
  TournamentSource,
  SportTournamentSources,
  getTournamentSources,
} from "../config/tournamentSourceRegistry";

const isDev = process.env.NODE_ENV !== "production";
const log = {
  info: (...args: unknown[]) => {
    if (isDev) console.log(...args);
  },
  warn: (...args: unknown[]) => console.warn(...args),
  error: (...args: unknown[]) => console.error(...args),
};

const modelCandidates = [
  "gemini-2.5-flash",
  "gemini-3.5-flash",
  "gemini-2.5-flash-lite",
].filter(Boolean) as string[];

/** Raw shape the extraction prompt asks for */
interface ExtractedEdition {
  name: string;
  startDate: string;
  endDate?: string | null;
  registrationDeadlineDate?: string | null;
  venue?: string | null;
  city?: string | null;
  level?: string | null;
  ageGroups?: string[] | null;
}

export interface CalendarScrapeResult {
  sportSlug: string;
  sourcesTried: number;
  extracted: number;
  upserted: number;
  warnings: string[];
}

// ─── Fetching ─────────────────────────────────────────────────────────────────

const BROWSER_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.9",
};

/** Max characters of page HTML passed to the extraction model */
const MAX_CONTENT_CHARS = 400_000;

function resolveUrl(templateUrl: string, year: number): string {
  return templateUrl.replace(/\{\{YEAR\}\}/g, String(year));
}

/**
 * Fetch a server-rendered page and trim it down to the content that matters:
 * scripts/styles/head removed, table markup preserved (column positions carry
 * meaning on federation calendars, e.g. AITA's age-group columns).
 */
async function fetchDirect(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: BROWSER_HEADERS,
      signal: AbortSignal.timeout(30_000),
    });
    if (!res.ok) {
      log.warn(`[TournamentCalendar] ${url} returned HTTP ${res.status}`);
      return null;
    }
    let html = await res.text();
    if (!html || html.trim().length < 500) {
      log.warn(`[TournamentCalendar] ${url} returned near-empty body`);
      return null;
    }
    html = html
      .replace(/<script[\s\S]*?<\/script>/gi, "")
      .replace(/<style[\s\S]*?<\/style>/gi, "")
      .replace(/<head[\s\S]*?<\/head>/gi, "")
      .replace(/<!--[\s\S]*?-->/g, "")
      .replace(/\s{2,}/g, " ");
    return html.slice(0, MAX_CONTENT_CHARS);
  } catch (err) {
    log.warn(`[TournamentCalendar] Fetch failed for ${url}:`, err);
    return null;
  }
}

// ─── Prompts ──────────────────────────────────────────────────────────────────

function extractionRules(
  sportName: string,
  url: string,
  today: string,
): string {
  return `Each object must have exactly these keys:
- "name": short canonical event name. For series-code cells like "CS7 (Delhi)" produce "AITA CS7 (Delhi)" — organiser prefix + code + city. Never leave the city out of the name when the same series runs in many cities.
- "startDate": "YYYY-MM-DD". Infer the year from the page/URL context. Calendar tables often give week-start dates — use those.
- "endDate": "YYYY-MM-DD" or null.
- "registrationDeadlineDate": "YYYY-MM-DD" or null — only if the page explicitly states one.
- "venue": string or null.
- "city": string or null.
- "level": one of "District" | "State" | "National" | "International" or null. Only infer when obvious (ITF/Asian/World events = International, "Nationals"/"National Championship" = National); otherwise null.
- "ageGroups": array of strings like ["Under-14"] based on which age-group column/section the entry appears in; [] if unknown.

Rules:
- Extract ONLY entries actually present in the content. Never invent events or dates.
- If the same event on the same date appears under multiple age-group columns, output ONE object with all its age groups combined.
- Skip entries that ended more than 60 days before today (today is ${today}).
- Output at most 150 entries; if you must cut, keep the upcoming ones.
- The sport is ${sportName}; the content comes from ${url}.

Return ONLY the JSON array. No markdown fences, no commentary. If there are no qualifying entries, return [].`;
}

function buildContentExtractionPrompt(
  sportName: string,
  url: string,
  content: string,
): string {
  const today = new Date().toISOString().slice(0, 10);
  return `You are a precise data-extraction engine. Below is the HTML content of the official tournament calendar page for ${sportName} in India (source: ${url}).

Extract EVERY tournament entry that has at least an identifiable event name/series and a start date, as a JSON array.

${extractionRules(sportName, url, today)}

Page content:
"""
${content}
"""`;
}

/**
 * Step-1 prompt for JS-rendered/bot-gated pages — uses Gemini's urlContext
 * tool so the page is fetched on Google's side. Like the search-grounding
 * pipeline, tool calls + strict JSON don't mix reliably, so this step asks
 * for plain findings and step 2 formats them.
 */
function buildUrlContextPrompt(sportName: string, url: string): string {
  return `Open and read this page using your URL context tool: ${url}

It is the official tournament calendar/listing for ${sportName} in India. List every tournament entry you can find on it, with for each one: event name, start date (with year), end date if shown, registration deadline if shown, city/venue, age groups, and level (district/state/national/international) if identifiable.

Report only what is actually on the page — do not add anything from memory or guesswork. If the page fails to load or lists nothing, say so plainly. Plain text or bullets is fine.`;
}

function buildFindingsFormattingPrompt(
  sportName: string,
  url: string,
  findings: string,
): string {
  const today = new Date().toISOString().slice(0, 10);
  return `Below are findings read from the official ${sportName} tournament calendar page (${url}). Convert ONLY the tournaments explicitly mentioned into a JSON array — do not add, invent, or infer anything not present.

${extractionRules(sportName, url, today)}

Findings:
"""
${findings}
"""`;
}

// ─── Gemini calls ─────────────────────────────────────────────────────────────

function getClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  if (!apiKey) return null;
  return new GoogleGenAI({ apiKey });
}

function parseJsonArray(text: string): ExtractedEdition[] | null {
  const trimmed = text
    .replace(/^```[a-z]*\n?/i, "")
    .replace(/```$/i, "")
    .trim();
  try {
    const parsed = JSON.parse(trimmed);
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    // Salvage the first [...] block if the model wrapped it in prose
    const match = trimmed.match(/\[[\s\S]*\]/);
    if (match) {
      try {
        const parsed = JSON.parse(match[0]);
        return Array.isArray(parsed) ? parsed : null;
      } catch {
        return null;
      }
    }
    return null;
  }
}

async function jsonExtractionCall(
  genAI: GoogleGenAI,
  prompt: string,
): Promise<ExtractedEdition[] | null> {
  for (const model of modelCandidates) {
    try {
      const res = await genAI.models.generateContent({
        model,
        contents: prompt,
        config: { responseMimeType: "application/json", temperature: 0.1 },
      });
      const items = parseJsonArray((res.text ?? "").trim());
      if (items) return items;
      log.warn(
        `[TournamentCalendar] Model ${model} returned unparseable JSON — trying next.`,
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message.toLowerCase() : "";
      log.warn(
        `[TournamentCalendar] Model ${model} failed:`,
        msg.slice(0, 200),
      );
      if (
        !msg.includes("404") &&
        !msg.includes("not found") &&
        !msg.includes("429") &&
        !msg.includes("quota")
      ) {
        // Unexpected error — don't burn remaining candidates
        return null;
      }
    }
  }
  return null;
}

async function urlContextExtraction(
  genAI: GoogleGenAI,
  sportName: string,
  url: string,
): Promise<ExtractedEdition[] | null> {
  for (const model of modelCandidates) {
    try {
      const step1 = await genAI.models.generateContent({
        model,
        contents: buildUrlContextPrompt(sportName, url),
        config: { tools: [{ urlContext: {} }], temperature: 0.1 },
      });
      const findings = (step1.text ?? "").trim();
      if (!findings || findings.length < 100) continue;

      return await jsonExtractionCall(
        genAI,
        buildFindingsFormattingPrompt(sportName, url, findings),
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message.toLowerCase() : "";
      log.warn(
        `[TournamentCalendar] urlContext via ${model} failed:`,
        msg.slice(0, 200),
      );
    }
  }
  return null;
}

// ─── Validation ───────────────────────────────────────────────────────────────

interface ValidEdition {
  name: string;
  startDate: Date;
  endDate?: Date | undefined;
  registrationDeadlineDate?: Date | undefined;
  venue?: string | undefined;
  city?: string | undefined;
  level?: string | undefined;
  ageGroups: string[];
}

function parseDateStrict(value: unknown): Date | undefined {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value))
    return undefined;
  const d = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(d.getTime()) ? undefined : d;
}

function validateEditions(raw: ExtractedEdition[]): {
  valid: ValidEdition[];
  dropped: number;
} {
  const now = Date.now();
  const minStart = now - 60 * 24 * 60 * 60 * 1000; // 60 days back
  const maxStart = now + 550 * 24 * 60 * 60 * 1000; // ~18 months ahead
  const seen = new Set<string>();
  const valid: ValidEdition[] = [];
  let dropped = 0;

  for (const item of raw) {
    const name = typeof item?.name === "string" ? item.name.trim() : "";
    const startDate = parseDateStrict(item?.startDate);
    if (!name || name.length < 3 || !startDate) {
      dropped++;
      continue;
    }
    if (startDate.getTime() < minStart || startDate.getTime() > maxStart) {
      dropped++;
      continue;
    }
    const endDate = parseDateStrict(item?.endDate ?? undefined);
    if (endDate && endDate.getTime() < startDate.getTime()) {
      dropped++;
      continue;
    }
    const key = `${name.toLowerCase()}|${item.startDate}`;
    if (seen.has(key)) {
      dropped++;
      continue;
    }
    seen.add(key);

    valid.push({
      name,
      startDate,
      endDate,
      registrationDeadlineDate: parseDateStrict(
        item?.registrationDeadlineDate ?? undefined,
      ),
      venue:
        typeof item?.venue === "string"
          ? item.venue.trim() || undefined
          : undefined,
      city:
        typeof item?.city === "string"
          ? item.city.trim() || undefined
          : undefined,
      level:
        typeof item?.level === "string"
          ? item.level.trim() || undefined
          : undefined,
      ageGroups: Array.isArray(item?.ageGroups)
        ? item.ageGroups.filter(
            (a): a is string => typeof a === "string" && a.trim().length > 0,
          )
        : [],
    });
  }

  return { valid, dropped };
}

function deriveStatus(e: ValidEdition): "announced" | "ongoing" | "completed" {
  const now = Date.now();
  const end = (e.endDate ?? e.startDate).getTime();
  if (end < now) return "completed";
  if (e.startDate.getTime() <= now) return "ongoing";
  return "announced";
}

// ─── Upsert ───────────────────────────────────────────────────────────────────

async function upsertEditions(
  sportSlug: string,
  sourceUrl: string,
  editions: ValidEdition[],
): Promise<number> {
  let upserted = 0;
  for (const e of editions) {
    try {
      await TournamentEdition.findOneAndUpdate(
        { sportSlug, name: e.name, startDate: e.startDate },
        {
          $set: {
            editionYear: e.startDate.getUTCFullYear(),
            endDate: e.endDate ?? null,
            registrationDeadlineDate: e.registrationDeadlineDate ?? null,
            venue: e.venue ?? null,
            city: e.city ?? null,
            level: e.level ?? null,
            ageGroups: e.ageGroups,
            sourceUrl,
            status: deriveStatus(e),
            lastCheckedAt: new Date(),
          },
        },
        { upsert: true, new: true },
      );
      upserted++;
    } catch (err) {
      log.warn(`[TournamentCalendar] Upsert failed for "${e.name}":`, err);
    }
  }
  return upserted;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/** Which calendar-year pages to fetch: current year, plus next year from October */
function yearsToFetch(): number[] {
  const now = new Date();
  const year = now.getUTCFullYear();
  return now.getUTCMonth() >= 9 ? [year, year + 1] : [year];
}

async function scrapeSource(
  genAI: GoogleGenAI,
  entry: SportTournamentSources,
  source: TournamentSource,
  warnings: string[],
): Promise<{ extracted: number; upserted: number }> {
  let extracted = 0;
  let upserted = 0;

  const urls = source.url.includes("{{YEAR}}")
    ? yearsToFetch().map((y) => resolveUrl(source.url, y))
    : [source.url];

  for (const url of urls) {
    let items: ExtractedEdition[] | null = null;

    if (source.fetchStrategy === "direct") {
      const content = await fetchDirect(url);
      if (content) {
        items = await jsonExtractionCall(
          genAI,
          buildContentExtractionPrompt(entry.sportName, url, content),
        );
      } else {
        // Direct fetch failed — fall back to Google-side fetching
        log.info(
          `[TournamentCalendar] Direct fetch failed for ${url} — trying urlContext fallback`,
        );
        items = await urlContextExtraction(genAI, entry.sportName, url);
      }
    } else {
      items = await urlContextExtraction(genAI, entry.sportName, url);
    }

    if (!items) {
      warnings.push(
        `Extraction produced nothing for ${url} — page may have moved (check registry).`,
      );
      continue;
    }

    const { valid, dropped } = validateEditions(items);
    if (dropped > 0) {
      log.info(
        `[TournamentCalendar] ${url}: dropped ${dropped} invalid/duplicate entries`,
      );
    }
    if (valid.length === 0) {
      warnings.push(
        `0 valid editions extracted from ${url} — possible source rot.`,
      );
      continue;
    }

    extracted += valid.length;
    upserted += await upsertEditions(entry.sportSlug, url, valid);
  }

  return { extracted, upserted };
}

export async function scrapeCalendarSport(
  sportSlug: string,
): Promise<CalendarScrapeResult> {
  const entry = getTournamentSources(sportSlug);
  const result: CalendarScrapeResult = {
    sportSlug,
    sourcesTried: 0,
    extracted: 0,
    upserted: 0,
    warnings: [],
  };

  if (!entry) {
    result.warnings.push(`No registry entry for ${sportSlug}`);
    return result;
  }

  const genAI = getClient();
  if (!genAI) {
    result.warnings.push(
      "No GEMINI_API_KEY/GOOGLE_API_KEY configured — skipping.",
    );
    return result;
  }

  for (const source of entry.sources) {
    result.sourcesTried++;
    const { extracted, upserted } = await scrapeSource(
      genAI,
      entry,
      source,
      result.warnings,
    );
    result.extracted += extracted;
    result.upserted += upserted;
  }

  log.info(
    `[TournamentCalendar] ${sportSlug}: ${result.upserted} editions upserted (${result.warnings.length} warnings)`,
  );
  for (const w of result.warnings)
    log.warn(`[TournamentCalendar] ⚠ ${sportSlug}: ${w}`);

  return result;
}

/** Refresh every registry sport sequentially (respects Gemini rate limits). */
export async function refreshAllCalendarSports(): Promise<
  CalendarScrapeResult[]
> {
  const results: CalendarScrapeResult[] = [];
  for (const entry of TOURNAMENT_SOURCE_REGISTRY) {
    results.push(await scrapeCalendarSport(entry.sportSlug));
    await new Promise((r) => setTimeout(r, 2000));
  }
  return results;
}

/**
 * The chat-facing query: next upcoming editions for a sport, soonest first.
 */
export async function getUpcomingEditions(
  sportSlug: string,
  limit: number = 3,
): Promise<
  Array<{
    name: string;
    startDate: Date;
    endDate?: Date;
    registrationDeadlineDate?: Date;
    city?: string;
    venue?: string;
    level?: string;
    ageGroups?: string[];
    sourceUrl: string;
    lastCheckedAt: Date;
  }>
> {
  const startOfToday = new Date();
  startOfToday.setUTCHours(0, 0, 0, 0);
  return TournamentEdition.find({
    sportSlug,
    startDate: { $gte: startOfToday },
    status: { $ne: "cancelled" },
  })
    .sort({ startDate: 1 })
    .limit(limit)
    .lean() as any;
}
