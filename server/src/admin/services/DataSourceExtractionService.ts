import { lookup } from "node:dns/promises";
import { GoogleGenAI } from "@google/genai";
import { DataSourceSubmissionDocument } from "../../shared/models/DataSourceSubmission";
import { s3Service } from "../../shared/services/S3Service";

/**
 * AI extraction for admin-submitted federation/tournament data sources
 * (a link or an uploaded PDF). Replaces the retired Lane-A cron scraper —
 * this only ever writes onto the submission doc itself (`extractedData`,
 * `status`); nothing here touches the live Federation/Tournament/
 * TournamentEdition collections. That write only happens from an explicit
 * admin "approve" action in dataSourceAdminController.
 *
 * Gemini plumbing (getClient/modelCandidates/JSON parsing/urlContext
 * two-step) mirrors what tournamentCalendarService.ts used to do — that file
 * is being retired, so the pattern is duplicated here rather than imported.
 */

const isDev = process.env.NODE_ENV !== "production";
const log = {
  info: (...args: unknown[]) => {
    if (isDev) console.log(...args);
  },
  warn: (...args: unknown[]) => console.warn(...args),
  error: (...args: unknown[]) => console.error(...args),
};

/**
 * Tried in order, falling through on 404/quota errors (see jsonExtractionCall).
 *
 * Ordered by free-tier requests-per-day, NOT by capability — this pipeline is
 * quota-bound, not quality-bound. gemini-3.1-flash-lite allows 500 RPD where
 * the 2.5 models allow 20, and one LINK extraction spends 2 calls per model
 * tried, so leading with the 2.5 models exhausted a day in a handful of
 * submissions. The 2.5 pair stays as fallback.
 *
 * Both features this service depends on — `responseMimeType: application/json`
 * and the `urlContext` tool — are verified present on every model listed here.
 * Notably NOT usable: antigravity-preview-05-2026 (has generous quota and
 * supports generateContent, but rejects both JSON mode and urlContext), and
 * gemini-3.5-flash / 3.5-flash-lite (urlContext browsing is restricted).
 */
const modelCandidates = [
  "gemini-3.1-flash-lite",
  "gemini-2.5-flash",
  "gemini-2.5-flash-lite",
];

function getClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  if (!apiKey) return null;
  return new GoogleGenAI({ apiKey });
}

/** Strips markdown fences and salvages the first balanced [...]/{...} block on parse failure. */
function parseJsonValue(text: string, kind: "array" | "object"): unknown | null {
  const trimmed = text
    .replace(/^```[a-z]*\n?/i, "")
    .replace(/```$/i, "")
    .trim();
  const isRightShape = (v: unknown) =>
    kind === "array" ? Array.isArray(v) : v !== null && typeof v === "object" && !Array.isArray(v);

  try {
    const parsed = JSON.parse(trimmed);
    if (isRightShape(parsed)) return parsed;
  } catch {
    // fall through to salvage
  }
  const match = trimmed.match(kind === "array" ? /\[[\s\S]*\]/ : /\{[\s\S]*\}/);
  if (match) {
    try {
      const parsed = JSON.parse(match[0]);
      if (isRightShape(parsed)) return parsed;
    } catch {
      return null;
    }
  }
  return null;
}

interface ExtractionOutcome {
  data: unknown | null;
  model?: string;
  error?: string;
}

/**
 * Gemini surfaces failures as a raw JSON blob, which the admin UI then renders
 * verbatim in the "Error:" line — a full RESOURCE_EXHAUSTED dump tells a
 * reviewer nothing actionable. Map the cases we actually hit to plain language.
 *
 * Quota matters operationally here: the free tier allows only 20 requests per
 * day per model, and one LINK extraction spends two calls (urlContext read +
 * JSON format) per model tried — so a handful of submissions can exhaust a day.
 */
function humanizeGeminiError(raw: string): string {
  const lower = raw.toLowerCase();
  if (lower.includes("429") || lower.includes("quota") || lower.includes("resource_exhausted")) {
    const retry = raw.match(/retry in ([\d.]+)s/i)?.[1];
    const retryNote = retry ? ` Try again in about ${Math.ceil(Number(retry))}s.` : "";
    return `The AI provider's request quota is exhausted, so this source could not be read.${retryNote} No data was changed — use Re-extract once quota resets.`;
  }
  if (lower.includes("404") || lower.includes("not found")) {
    return "The configured AI model is unavailable. This needs a config fix, not a retry.";
  }
  if (lower.includes("api key") || lower.includes("permission") || lower.includes("401") || lower.includes("403")) {
    return "The AI provider rejected our credentials. This needs a config fix, not a retry.";
  }
  if (lower.includes("unparseable")) {
    return "The AI returned malformed JSON for this source. Re-extract to retry, or upload the PDF instead of the link.";
  }
  // Unrecognised — keep it, but truncated so the UI stays readable.
  return raw.length > 300 ? `${raw.slice(0, 300)}…` : raw;
}

// ─── Direct page fetch (preferred over the urlContext tool for LINK sources) ──

/**
 * Blocks SSRF targets before we fetch an admin-supplied URL server-side.
 *
 * This endpoint is admin-only, but "can submit a data source" must not become
 * "can read cloud instance metadata" — 169.254.169.254 would hand out IAM
 * credentials, and localhost/private ranges expose internal services. The check
 * resolves DNS first and tests the resolved address, so a public hostname
 * pointing at a private IP is still refused.
 */
const BLOCKED_IP_PATTERNS = [
  /^127\./, // loopback
  /^10\./, // private
  /^192\.168\./, // private
  /^172\.(1[6-9]|2\d|3[01])\./, // private
  /^169\.254\./, // link-local — cloud metadata
  /^0\./, // this-network
  /^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./, // CGNAT
];

async function resolveSafeHttpUrl(raw: string): Promise<string | null> {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return null;

  try {
    const { address, family } = await lookup(url.hostname);
    if (family === 6) {
      const v6 = address.toLowerCase();
      // ::1 loopback, fc00::/7 unique-local, fe80::/10 link-local
      if (v6 === "::1" || /^f[cd]/.test(v6) || /^fe[89ab]/.test(v6)) return null;
    } else if (BLOCKED_IP_PATTERNS.some((re) => re.test(address))) {
      return null;
    }
  } catch {
    return null; // unresolvable host
  }
  return url.toString();
}

/** Flattens HTML to text, keeping row/cell boundaries so table-shaped calendars stay readable. */
function htmlToText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    // AITA renders date cells as "04,<br>May" — the break must become a space,
    // not vanish, or the day and month fuse into "04,May".
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<\/t[dh]>/gi, " | ")
    .replace(/<\/(tr|div|p|li|h[1-6]|table|section)>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#0?39;|&apos;/gi, "'")
    .replace(/[ \t]+/g, " ")
    // Deliberately NOT collapsing runs of empty cells: calendar tables encode
    // the age group by column position ("WEEK | Under 10 | Under 12 | ..."), so
    // "| | | CS7 (Jind) |" is the only thing distinguishing an Under-14 entry
    // from an Under-10 one. Collapsing the pipes discards that.
    .replace(/\n[ ]*\n+/g, "\n")
    .trim();
}

const MAX_PAGE_TEXT_CHARS = 300_000;

const MONTH_ABBREVS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];

/**
 * Cuts a chronological full-year calendar down to its upcoming portion.
 *
 * Federation calendars list the entire year, and the stale majority crowds out
 * the model's attention: given the whole AITA 2026 page as text, extraction
 * returned 4 events even though ~120 upcoming ones were present, all 4 from the
 * current week. Telling the model to "skip past entries" doesn't help — it
 * still has to read them first. Removing them server-side does.
 *
 * Guarded two ways: it needs enough month mentions to be a real calendar, and
 * they must appear in ascending order (i.e. the page is genuinely chronological)
 * before anything is cut. The leading slice is kept so column headers — which
 * carry the age-group labels — survive.
 */
function trimPageTextToUpcoming(text: string): string {
  const hits: Array<{ month: number; index: number }> = [];
  const re = /\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\b/gi;
  let match: RegExpExecArray | null;
  while ((match = re.exec(text)) !== null) {
    hits.push({ month: MONTH_ABBREVS.indexOf(match[1]!.toLowerCase()), index: match.index });
  }
  if (hits.length < 24) return text;

  const third = Math.floor(hits.length / 3);
  const avg = (slice: typeof hits) => slice.reduce((sum, h) => sum + h.month, 0) / slice.length;
  if (avg(hits.slice(0, third)) >= avg(hits.slice(-third))) return text; // not chronological

  // Start from ~2 weeks back rather than the 1st of the month, so a read late in
  // the month doesn't re-include three weeks of finished events. Recently-ended
  // ones are still accepted downstream if they land in the kept slice.
  const from = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
  const fromMonth = from.getUTCMonth();
  const fromDay = from.getUTCDate();
  const firstUpcoming = hits.find((h) => {
    if (h.month > fromMonth) return true;
    if (h.month < fromMonth) return false;
    // Same month — the day sits just before the month name ("28, Jul").
    const day = Number(text.slice(Math.max(0, h.index - 5), h.index).match(/(\d{1,2})\D*$/)?.[1]);
    return Number.isFinite(day) ? day >= fromDay : true;
  });
  if (!firstUpcoming || firstUpcoming.index < 2_000) return text; // nothing meaningful to cut

  const header = text.slice(0, 800);
  return `${header}\n[...earlier months omitted...]\n${text.slice(firstUpcoming.index)}`;
}

/**
 * Splits calendar text into small chunks, each carrying the column header.
 *
 * One call for a whole calendar under-delivers badly: the model transcribes the
 * first ~2000 characters and stops regardless of how much is left (a Jul-6 start
 * yielded 38 events, a Jul-20 start 19 — both roughly the leading third, not
 * "everything from July"). Raising maxOutputTokens and disabling thinking didn't
 * change it. Bounding each call to a couple of dozen rows keeps every request
 * inside the range the model completes reliably.
 *
 * The header goes on every chunk because it holds the age-group column labels,
 * which are meaningless to a chunk that doesn't include them.
 */
function chunkCalendarText(text: string, maxChars = 2_500): string[] {
  const headerEnd = text.indexOf("[...earlier months omitted...]");
  const header = (headerEnd > 0 ? text.slice(0, headerEnd) : text.slice(0, 400)).trim();
  const body = headerEnd > 0 ? text.slice(headerEnd + "[...earlier months omitted...]".length) : text;

  const chunks: string[] = [];
  let current = "";
  for (const line of body.split("\n")) {
    if (current && current.length + line.length + 1 > maxChars) {
      chunks.push(current);
      current = "";
    }
    current += `${line}\n`;
  }
  if (current.trim()) chunks.push(current);

  return chunks.map((chunk) => `${header}\n${chunk}`);
}

/**
 * Fetches the page ourselves and returns its text.
 *
 * Preferred over Gemini's urlContext tool for LINK sources, because that tool
 * *summarises* long pages instead of transcribing them: four reads of the AITA
 * 2026 calendar (~260KB) returned 151 stale entries, then 0, then 7, then 0,
 * and one ended with "view the source link directly". The same page fetched
 * directly yields every row deterministically — the dates are all in the
 * server-rendered HTML.
 *
 * Returns null when the fetch is blocked/fails, so callers can fall back to
 * urlContext for genuinely bot-gated or JS-rendered sources.
 */
async function fetchPageText(url: string): Promise<string | null> {
  const safeUrl = await resolveSafeHttpUrl(url);
  if (!safeUrl) {
    log.warn("[DataSourceExtraction] refused to fetch unsafe/unresolvable URL");
    return null;
  }
  try {
    const res = await fetch(safeUrl, {
      redirect: "follow",
      headers: {
        // Some federation sites 403 an unrecognised agent.
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml,*/*",
      },
      signal: AbortSignal.timeout(25_000),
    });
    if (!res.ok) {
      log.warn(`[DataSourceExtraction] direct fetch got HTTP ${res.status}`);
      return null;
    }
    const contentType = res.headers.get("content-type") ?? "";
    if (!/text\/html|text\/plain|application\/xhtml/i.test(contentType)) {
      log.warn(`[DataSourceExtraction] direct fetch got non-HTML content-type: ${contentType}`);
      return null;
    }
    const text = htmlToText(await res.text());
    return text.length > MAX_PAGE_TEXT_CHARS ? text.slice(0, MAX_PAGE_TEXT_CHARS) : text;
  } catch (err) {
    log.warn(`[DataSourceExtraction] direct fetch failed: ${(err as Error).message.slice(0, 120)}`);
    return null;
  }
}

/** Single-step JSON extraction call — used for the format-conversion step and for PDF input. */
async function jsonExtractionCall(
  genAI: GoogleGenAI,
  contents: string | Array<{ role: string; parts: Array<Record<string, unknown>> }>,
  kind: "array" | "object",
): Promise<ExtractionOutcome> {
  let lastError = "";
  for (const model of modelCandidates) {
    try {
      const res = await genAI.models.generateContent({
        model,
        contents,
        config: {
          responseMimeType: "application/json",
          temperature: 0.1,
          // A full calendar is 100+ objects; the default ceiling truncated the
          // array mid-year (38 of ~120 events came back before this was set).
          maxOutputTokens: 32768,
          // Transcribing a table needs no deliberation, and on Gemini 3.x
          // thinking tokens are drawn from the same output budget as the answer.
          thinkingConfig: { thinkingBudget: 0 },
        },
      });
      const parsed = parseJsonValue((res.text ?? "").trim(), kind);
      if (parsed) return { data: parsed, model };
      lastError = "Model returned unparseable JSON.";
      log.warn(`[DataSourceExtraction] ${model} returned unparseable JSON — trying next.`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      lastError = msg;
      log.warn(`[DataSourceExtraction] ${model} failed:`, msg.slice(0, 200));
      const lower = msg.toLowerCase();
      if (!lower.includes("404") && !lower.includes("not found") && !lower.includes("429") && !lower.includes("quota")) {
        break; // unexpected error — don't burn remaining candidates
      }
    }
  }
  return { data: null, error: humanizeGeminiError(lastError || "All models failed.") };
}

/** Two-step urlContext extraction — step 1 lets Gemini fetch the URL itself (handles JS-rendered/bot-gated pages), step 2 formats the free-form findings into strict JSON. */
async function urlContextExtraction(
  genAI: GoogleGenAI,
  url: string,
  formatPrompt: (findings: string) => string,
  kind: "array" | "object",
  focusHint?: string,
): Promise<ExtractionOutcome> {
  let lastError = "";
  for (const model of modelCandidates) {
    try {
      const step1 = await genAI.models.generateContent({
        model,
        contents:
          `Open and read this page/document using your URL context tool: ${url}\n\n` +
          `Report everything relevant you find on it in plain text or bullets — do not add anything from memory or guesswork. ` +
          `If it fails to load or has nothing relevant, say so plainly.` +
          (focusHint ? `\n\n${focusHint}` : ""),
        config: { tools: [{ urlContext: {} }], temperature: 0.1 },
      });
      const findings = (step1.text ?? "").trim();
      if (!findings || findings.length < 50) {
        lastError = "urlContext returned no usable findings.";
        continue;
      }
      return await jsonExtractionCall(genAI, formatPrompt(findings), kind);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      lastError = msg;
      log.warn(`[DataSourceExtraction] urlContext via ${model} failed:`, msg.slice(0, 200));
    }
  }
  return { data: null, error: humanizeGeminiError(lastError || "All models failed.") };
}

// ─── Prompts ──────────────────────────────────────────────────────────────────

function federationPromptRules(): string {
  return `Return a single JSON object (not an array) with exactly these keys:
- "name": full official name of the federation.
- "acronym": short acronym, e.g. "BAI".
- "type": one of "govt" | "national" | "hybrid".
- "about": 2-4 sentence overview — history, remit, notable achievements.
- "founded": year founded as a number, or null.
- "headquarters": city, or null.
- "website": official website URL, or null.
- "officialCalendarUrl": URL of the tournament/event calendar page, or null.
- "affiliations": array of strings (international bodies it's affiliated with).
- "stateAssociations": array of {"name": string, "state": string, "website": string|null} — only ones explicitly named in the source.
- "keyFacts": array of 4-8 short, verifiable fact strings.
- "eligibilityCriteria": {"ageCutoffRule": string|null, "categories": [{"name": string, "maxAge": number, "genders": string[], "minRanking": string|null, "notes": string|null}], "registrationRequired": boolean, "stateAssociationFirst": boolean, "notes": string|null}.
- "registrationSteps": array of ordered step strings.
- "requiredDocuments": array of strings.
- "contact": {"email": string|null, "phone": string|null, "address": string|null}.
- "_citations": an object mapping each top-level field name above that you filled in to a short direct quote or close paraphrase (under 25 words) from the source that supports it. Only include keys for fields you actually filled in — omit fields you left null/empty.

Rules:
- Use ONLY information explicitly present in the source. Never invent facts, dates, or numbers.
- Omit/null any field not stated in the source rather than guessing.
- Return ONLY the JSON object. No markdown fences, no commentary.`;
}

function curatedTournamentPromptRules(): string {
  return `Return a single JSON object (not an array) with exactly these keys:
- "name": tournament name.
- "level": one of "District" | "State" | "National" | "International".
- "description": 2-4 sentence overview of what this tournament is and why it matters.
- "ageGroup": e.g. "Open (18+)" or "Under-19 (U-13, U-15, U-17, U-19 categories)".
- "typicalDates": e.g. "January" or "September-October", or null.
- "registrationDeadline": short description of when entries close, or null.
- "participationGuide": array of ordered step strings for how a player enters.
- "qualificationPath": one sentence describing the pathway leading up to this event, or null.
- "circuitContext": a paragraph explaining where this event sits in the broader competitive ladder, or null.
- "format": e.g. "Single elimination", or null.
- "prestige": one of "flagship" | "ranking" | "developmental", or null.
- "prizePool": string, or null.
- "registrationUrl": URL, or null.
- "_citations": an object mapping each top-level field name above that you filled in to a short direct quote or close paraphrase (under 25 words) from the source that supports it. Only include keys for fields you actually filled in — omit fields you left null/empty.

Rules:
- Use ONLY information explicitly present in the source. Never invent facts, dates, or numbers.
- Return ONLY the JSON object. No markdown fences, no commentary.`;
}

/** Verbatim from the retired tournamentCalendarService.ts — proven extraction rules for dated calendar entries. */
function calendarPromptRules(sportName: string, url: string, today: string): string {
  return `Each object must have exactly these keys:
- "name": short canonical event name. For series-code cells like "CS7 (Delhi)" produce "AITA CS7 (Delhi)" — organiser prefix + code + city. Never leave the city out of the name when the same series runs in many cities.
- "startDate": "YYYY-MM-DD". Infer the year from the page/URL context. Calendar tables often give week-start dates — use those.
- "endDate": "YYYY-MM-DD" or null.
- "registrationDeadlineDate": "YYYY-MM-DD" or null — only if the page explicitly states one.
- "venue": string or null.
- "city": string or null.
- "level": one of "District" | "State" | "National" | "International" or null. Only infer when obvious (ITF/Asian/World events = International, "Nationals"/"National Championship" = National); otherwise null.
- "ageGroups": array of strings like ["Under-14"] based on which age-group column/section the entry appears in; [] if unknown.
- "sourceQuote": a short direct quote or close paraphrase (under 25 words) from the source that supports this entry, or null.

Rules:
- Extract ONLY entries actually present in the content. Never invent events or dates.
- If the same event on the same date appears under multiple age-group columns, output ONE object with all its age groups combined.
- Skip entries that ended more than 60 days before today (today is ${today}).
- Output at most 150 entries; if you must cut, keep the upcoming ones.
- The sport is ${sportName}; the content comes from ${url}.

Return ONLY the JSON array. No markdown fences, no commentary. If there are no qualifying entries, return [].`;
}

function buildFederationLinkFormatPrompt(findings: string): string {
  return `Below are findings read from a page about a sports federation. Convert them into the required JSON object — do not add, invent, or infer anything not present.\n\n${federationPromptRules()}\n\nFindings:\n"""\n${findings}\n"""`;
}

function buildCuratedTournamentLinkFormatPrompt(findings: string): string {
  return `Below are findings read from a page about a tournament. Convert them into the required JSON object — do not add, invent, or infer anything not present.\n\n${curatedTournamentPromptRules()}\n\nFindings:\n"""\n${findings}\n"""`;
}

/**
 * Steers step 1 of the urlContext read toward UPCOMING entries.
 *
 * Federation calendars are full-year pages (the AITA 2026 one is ~260KB with
 * over 1000 date cells). Without this, the model enumerates from January, runs
 * out of response budget around mid-year, and signs off with "view the source
 * directly" — so a read in late July returned 151 entries all dated Jan–Jun,
 * every one of them stale enough to be rejected downstream, and none of the
 * August-onward events that were actually on the page.
 *
 * The stale-entry cutoff also exists in the step-2 prompt and in
 * validateEditions, but neither can help: by then the upcoming rows were never
 * read. It has to be stated here, where the truncation happens.
 */
function buildCalendarStep1FocusHint(): string {
  const today = new Date().toISOString().slice(0, 10);
  // Cutoff is today, not validateEditions' 60-days-back window: asking for the
  // back-window made the model spend its budget enumerating already-finished
  // weeks and stop before reaching the upcoming months. Recently-ended events
  // are still accepted downstream if the model happens to include them.
  return `IMPORTANT — this page covers a whole year and is far too long to report in full, so you must not waste your response on the parts that do not matter. Today is ${today}.

Report ONLY events starting on or after ${today}. Skip every earlier event completely — do not describe, count, or summarise them.

Start at ${today} and work FORWARD, month by month, all the way to the last event on the page. List each qualifying event on its own line with its date, name, city/venue and age group. Do NOT stop after the first week or month, and do NOT finish with a summary or a "see the source for more details" note — an incomplete list of the upcoming months is the one outcome that makes this useless.`;
}

function buildCalendarLinkFormatPrompt(sportName: string, url: string, findings: string): string {
  const today = new Date().toISOString().slice(0, 10);
  return `Below are findings read from the official ${sportName} tournament calendar page (${url}). Convert ONLY the tournaments explicitly mentioned into a JSON array — do not add, invent, or infer anything not present.\n\n${calendarPromptRules(sportName, url, today)}\n\nFindings:\n"""\n${findings}\n"""`;
}

function buildPdfPrompt(kind: "FEDERATION" | "CURATED_TOURNAMENT" | "TOURNAMENT_CALENDAR", sportName: string): string {
  if (kind === "FEDERATION") {
    return `You are a precise data-extraction engine. The attached PDF is an official document about a sports federation (sport: ${sportName}). Extract its information.\n\n${federationPromptRules()}`;
  }
  if (kind === "CURATED_TOURNAMENT") {
    return `You are a precise data-extraction engine. The attached PDF is an official document about a tournament (sport: ${sportName}). Extract its information.\n\n${curatedTournamentPromptRules()}`;
  }
  const today = new Date().toISOString().slice(0, 10);
  return `You are a precise data-extraction engine. The attached PDF is an official tournament calendar for ${sportName} in India. Extract every tournament entry that has at least an identifiable event name/series and a start date, as a JSON array.\n\n${calendarPromptRules(sportName, "the attached PDF", today)}`;
}

// ─── Calendar validation (moved verbatim from the retired tournamentCalendarService.ts) ──

export interface ExtractedEdition {
  name: string;
  startDate: string;
  endDate?: string | null;
  registrationDeadlineDate?: string | null;
  venue?: string | null;
  city?: string | null;
  level?: string | null;
  ageGroups?: string[] | null;
  sourceQuote?: string | null;
}

export interface ValidEdition {
  name: string;
  startDate: string;
  endDate?: string | undefined;
  registrationDeadlineDate?: string | undefined;
  venue?: string | undefined;
  city?: string | undefined;
  level?: string | undefined;
  ageGroups: string[];
  sourceQuote?: string | undefined;
}

function parseDateStrict(value: unknown): Date | undefined {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined;
  const d = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(d.getTime()) ? undefined : d;
}

/**
 * Repairs the two name malformations the extraction reliably produces, so the
 * stored (and displayed) name is clean: a doubled organiser prefix
 * ("AITA AITA Rs 1 Lakh" -> "AITA Rs 1 Lakh") and a missing space before a
 * bracket ("AITA CS7(Sonipat)" -> "AITA CS7 (Sonipat)"). Cosmetic only —
 * applied independently of dedup, since a malformed name can exist without a
 * clean twin to be deduped against.
 *
 * The doubled token is only collapsed when it's an acronym (2-6 caps), because
 * plenty of legitimate names genuinely repeat a word — real examples from this
 * dataset: "Ten Ten Chess Academy" (the academy's name) and "V V Balaram
 * Memorial" (a person's initials). This mutates stored data, so it stays
 * deliberately conservative.
 */
export function cleanEditionName(name: string): string {
  const tokens = name.trim().replace(/\s+/g, " ").split(" ");
  while (
    tokens.length >= 2 &&
    tokens[0]!.toLowerCase() === tokens[1]!.toLowerCase() &&
    /^[A-Z]{2,6}$/.test(tokens[0]!.replace(/[^A-Za-z]/g, ""))
  ) {
    tokens.shift();
  }
  return tokens.join(" ").replace(/(\S)\(/g, "$1 (");
}

/** Case/punctuation/whitespace-insensitive form — "AITA CS7(Sonipat)" and "AITA CS7 (Sonipat)" collapse to one string. */
function normalizeEditionName(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

/** "aita aita rs 1 lakh" -> "aita rs 1 lakh" — the extraction prompt asks for an organiser prefix and sometimes applies it twice. */
function collapseRepeatedPrefix(normalized: string): string {
  return normalized.replace(/^(\S+)(?: \1)+(?= |$)/, "$1");
}

/**
 * Dedup keys for one edition. The extraction prompt asks Gemini to prefix event
 * names with the organiser, which it applies inconsistently — producing twins
 * like "Nationals (Chennai)" / "AITA Nationals (Chennai)" and
 * "AITA Rs 1 Lakh (Gudur)" / "AITA AITA Rs 1 Lakh (Gudur)" that a plain
 * name-equality check treats as distinct events.
 *
 * So an edition is a duplicate if EITHER its normalized name OR that name minus
 * its leading organiser token has already been seen on the same start date.
 *
 * The leading token is only dropped when it's an ACRONYM in the original name
 * (AITA, ITF, BAI, BWF) and 2+ tokens remain. Both guards matter: without the
 * acronym check, ordinals collapse genuinely different events — real example
 * from this dataset, "First Chola Chennai" and "Second Chola Chennai" both
 * reduce to "chola chennai".
 */
export function editionDedupKeys(name: string, startDate: string): string[] {
  const base = collapseRepeatedPrefix(normalizeEditionName(name));
  const keys = [`${base}|${startDate}`];
  const originalFirstToken = (name.trim().split(/\s+/)[0] ?? "").replace(/[^A-Za-z]/g, "");
  const isAcronymPrefix = /^[A-Z]{2,6}$/.test(originalFirstToken);
  const tokens = base.split(" ");
  if (isAcronymPrefix && tokens.length >= 3) {
    keys.push(`${tokens.slice(1).join(" ")}|${startDate}`);
  }
  return keys;
}

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

export function validateEditions(raw: unknown): { valid: ValidEdition[]; errors: string[] } {
  const errors: string[] = [];
  if (!Array.isArray(raw)) return { valid: [], errors: ["Extraction did not return a list."] };
  // Distinct from "entries were rejected" — here the model read the page and
  // listed nothing, which points at the source (JS-rendered, or too long to
  // enumerate) rather than at our validation rules.
  if (raw.length === 0) {
    return {
      valid: [],
      errors: [
        "The AI read the source but listed no tournament entries. The page may build its calendar with JavaScript, or be too long for the model to enumerate — try uploading the official PDF instead of the link.",
      ],
    };
  }

  const now = Date.now();
  const minStart = now - 60 * 24 * 60 * 60 * 1000; // 60 days back
  const maxStart = now + 550 * 24 * 60 * 60 * 1000; // ~18 months ahead
  const seen = new Set<string>();
  const valid: ValidEdition[] = [];

  // Per-reason tallies: a bare "N entries were dropped" is undiagnosable when N
  // equals the whole batch — the admin can't tell a wrong-year extraction from
  // genuine duplicates. Note a 100% drop rate can never be duplicates alone,
  // since the first occurrence of any key is always kept.
  const drops = { badName: 0, badDate: 0, outOfWindow: 0, endBeforeStart: 0, duplicate: 0 };
  const observedDates: string[] = [];

  for (const item of raw as ExtractedEdition[]) {
    const name = typeof item?.name === "string" ? cleanEditionName(item.name) : "";
    const startDate = parseDateStrict(item?.startDate);
    if (typeof item?.startDate === "string" && ISO_DAY.test(item.startDate)) {
      observedDates.push(item.startDate);
    }
    if (!name || name.length < 3) {
      drops.badName++;
      continue;
    }
    if (!startDate) {
      drops.badDate++;
      continue;
    }
    if (startDate.getTime() < minStart || startDate.getTime() > maxStart) {
      drops.outOfWindow++;
      continue;
    }
    const endDate = parseDateStrict(item?.endDate ?? undefined);
    if (endDate && endDate.getTime() < startDate.getTime()) {
      drops.endBeforeStart++;
      continue;
    }
    const keys = editionDedupKeys(name, item.startDate);
    if (keys.some((k) => seen.has(k))) {
      drops.duplicate++;
      continue;
    }
    for (const k of keys) seen.add(k);

    valid.push({
      name,
      startDate: item.startDate,
      endDate: endDate ? (item.endDate as string) : undefined,
      registrationDeadlineDate: parseDateStrict(item?.registrationDeadlineDate ?? undefined)
        ? (item.registrationDeadlineDate as string)
        : undefined,
      venue: typeof item?.venue === "string" ? item.venue.trim() || undefined : undefined,
      city: typeof item?.city === "string" ? item.city.trim() || undefined : undefined,
      level: typeof item?.level === "string" ? item.level.trim() || undefined : undefined,
      ageGroups: Array.isArray(item?.ageGroups)
        ? item.ageGroups.filter((a): a is string => typeof a === "string" && a.trim().length > 0)
        : [],
      sourceQuote: typeof item?.sourceQuote === "string" ? item.sourceQuote.trim() || undefined : undefined,
    });
  }

  const totalDropped =
    drops.badName + drops.badDate + drops.outOfWindow + drops.endBeforeStart + drops.duplicate;

  if (totalDropped > 0) {
    const parts: string[] = [];
    if (drops.outOfWindow) parts.push(`${drops.outOfWindow} dated outside the accepted window`);
    if (drops.badDate) parts.push(`${drops.badDate} with an unusable start date`);
    if (drops.badName) parts.push(`${drops.badName} with a missing/too-short name`);
    if (drops.endBeforeStart) parts.push(`${drops.endBeforeStart} whose end date precedes its start`);
    if (drops.duplicate) parts.push(`${drops.duplicate} duplicates`);
    errors.push(`${totalDropped} of ${raw.length} entries were dropped: ${parts.join(", ")}.`);

    // The out-of-window case is nearly always a wrong-year extraction, so show
    // the range the model actually returned next to the window we accept.
    if (drops.outOfWindow > 0 && observedDates.length > 0) {
      const sorted = [...observedDates].sort();
      errors.push(
        `Extracted dates span ${sorted[0]} to ${sorted[sorted.length - 1]}; accepted window is ` +
          `${new Date(minStart).toISOString().slice(0, 10)} to ${new Date(maxStart).toISOString().slice(0, 10)}.`,
      );
    }
  }
  if (valid.length === 0) errors.push("No valid calendar entries were found in the source.");
  return { valid, errors };
}

// ─── Federation / curated-tournament validation (whitelist + required-field gate) ──

function asString(v: unknown): string | undefined {
  return typeof v === "string" && v.trim() ? v.trim() : undefined;
}
function asStringArray(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string" && x.trim().length > 0) : [];
}
/** Pulls Gemini's optional "_citations" map — only string values survive. */
function asCitations(v: unknown): Record<string, string> {
  if (!v || typeof v !== "object" || Array.isArray(v)) return {};
  const out: Record<string, string> = {};
  for (const [key, val] of Object.entries(v as Record<string, unknown>)) {
    if (typeof val === "string" && val.trim()) out[key] = val.trim();
  }
  return out;
}

export interface FieldPayloadResult {
  valid: Record<string, unknown> | null;
  errors: string[];
  citations: Record<string, string>;
}

export function validateFederationPayload(raw: unknown): FieldPayloadResult {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { valid: null, errors: ["Extraction did not return an object."], citations: {} };
  }
  const r = raw as Record<string, unknown>;
  const citations = asCitations(r._citations);
  const errors: string[] = [];
  const name = asString(r.name);
  const acronym = asString(r.acronym);
  const about = asString(r.about);
  const type = asString(r.type);
  if (!name) errors.push("Missing federation name.");
  if (!acronym) errors.push("Missing acronym.");
  if (!about) errors.push("Missing about/overview text.");
  if (!type || !["govt", "national", "hybrid"].includes(type)) errors.push('Missing/invalid type (must be "govt", "national", or "hybrid").');
  if (errors.length) return { valid: null, errors, citations };

  const eligibility = r.eligibilityCriteria as Record<string, unknown> | undefined;
  const valid: Record<string, unknown> = {
    name,
    acronym,
    about,
    type,
    founded: typeof r.founded === "number" ? r.founded : undefined,
    headquarters: asString(r.headquarters),
    website: asString(r.website),
    officialCalendarUrl: asString(r.officialCalendarUrl),
    affiliations: asStringArray(r.affiliations),
    stateAssociations: Array.isArray(r.stateAssociations)
      ? r.stateAssociations
          .filter((s): s is Record<string, unknown> => !!s && typeof s === "object")
          .map((s) => ({ name: asString(s.name) || "", state: asString(s.state) || "", website: asString(s.website) }))
          .filter((s) => s.name && s.state)
      : [],
    keyFacts: asStringArray(r.keyFacts),
    eligibilityCriteria: eligibility
      ? {
          ageCutoffRule: asString(eligibility.ageCutoffRule),
          categories: Array.isArray(eligibility.categories)
            ? eligibility.categories
                .filter((c): c is Record<string, unknown> => !!c && typeof c === "object")
                .map((c) => ({
                  name: asString(c.name) || "",
                  maxAge: typeof c.maxAge === "number" ? c.maxAge : 0,
                  genders: asStringArray(c.genders),
                  minRanking: asString(c.minRanking),
                  notes: asString(c.notes),
                }))
                .filter((c) => c.name)
            : [],
          registrationRequired: typeof eligibility.registrationRequired === "boolean" ? eligibility.registrationRequired : true,
          stateAssociationFirst: typeof eligibility.stateAssociationFirst === "boolean" ? eligibility.stateAssociationFirst : true,
          notes: asString(eligibility.notes),
        }
      : undefined,
    registrationSteps: asStringArray(r.registrationSteps),
    requiredDocuments: asStringArray(r.requiredDocuments),
    contact:
      r.contact && typeof r.contact === "object"
        ? {
            email: asString((r.contact as Record<string, unknown>).email),
            phone: asString((r.contact as Record<string, unknown>).phone),
            address: asString((r.contact as Record<string, unknown>).address),
          }
        : undefined,
  };
  return { valid, errors: [], citations };
}

export function validateCuratedTournamentPayload(raw: unknown): FieldPayloadResult {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { valid: null, errors: ["Extraction did not return an object."], citations: {} };
  }
  const r = raw as Record<string, unknown>;
  const citations = asCitations(r._citations);
  const errors: string[] = [];
  const name = asString(r.name);
  const level = asString(r.level);
  const description = asString(r.description);
  const ageGroup = asString(r.ageGroup);
  if (!name) errors.push("Missing tournament name.");
  if (!level) errors.push("Missing level.");
  if (!description) errors.push("Missing description.");
  if (!ageGroup) errors.push("Missing age group.");
  if (errors.length) return { valid: null, errors, citations };

  const prestige = asString(r.prestige);
  const valid: Record<string, unknown> = {
    name,
    level,
    description,
    ageGroup,
    typicalDates: asString(r.typicalDates),
    registrationDeadline: asString(r.registrationDeadline),
    participationGuide: asStringArray(r.participationGuide),
    qualificationPath: asString(r.qualificationPath),
    circuitContext: asString(r.circuitContext),
    format: asString(r.format),
    prestige: prestige && ["flagship", "ranking", "developmental"].includes(prestige) ? prestige : undefined,
    prizePool: asString(r.prizePool),
    registrationUrl: asString(r.registrationUrl),
  };
  return { valid, errors: [], citations };
}

// ─── Orchestration ────────────────────────────────────────────────────────────

/** Best-effort human-readable sport name from a slug (Title Case, hyphens to spaces) — good enough for prompt text. */
function sportNameFromSlug(sportSlug: string): string {
  return sportSlug
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

export interface ExtractionResult {
  status: "PENDING_REVIEW" | "EXTRACTION_FAILED";
  extractedData?: unknown;
  citations?: Record<string, string>;
  extractionError?: string;
  /** Non-fatal notes — e.g. entries dropped by validation on an otherwise successful extraction. */
  extractionWarnings?: string[];
  extractionModel?: string;
}

/**
 * Runs extraction for a submission and returns the result to be saved onto
 * it. Does NOT write to Federation/Tournament/TournamentEdition — that only
 * happens on admin approval.
 */
export async function extractForSubmission(
  submission: DataSourceSubmissionDocument,
): Promise<ExtractionResult> {
  const genAI = getClient();
  if (!genAI) {
    return { status: "EXTRACTION_FAILED", extractionError: "No GEMINI_API_KEY/GOOGLE_API_KEY configured." };
  }

  const sportName = sportNameFromSlug(submission.sportSlug);
  const kind = submission.targetType;

  let outcome: ExtractionOutcome;
  if (submission.sourceKind === "LINK") {
    if (!submission.sourceUrl) {
      return { status: "EXTRACTION_FAILED", extractionError: "No source URL on this submission." };
    }
    const url = submission.sourceUrl;
    const shape = kind === "TOURNAMENT_CALENDAR" ? "array" : "object";
    const formatPrompt = (findings: string): string =>
      kind === "FEDERATION"
        ? buildFederationLinkFormatPrompt(findings)
        : kind === "CURATED_TOURNAMENT"
          ? buildCuratedTournamentLinkFormatPrompt(findings)
          : buildCalendarLinkFormatPrompt(sportName, url, findings);

    // Strategy 1: fetch the page ourselves and extract from its text. One
    // Gemini call instead of two, deterministic content, and no summarising
    // browser in the middle — see fetchPageText for why that matters here.
    const rawPageText = await fetchPageText(url);
    outcome = { data: null };
    if (rawPageText && rawPageText.length >= 200) {
      if (kind === "TOURNAMENT_CALENDAR") {
        const trimmed = trimPageTextToUpcoming(rawPageText);
        const chunks = chunkCalendarText(trimmed);
        log.info(
          `[DataSourceExtraction] direct fetch OK (${rawPageText.length} chars -> ${trimmed.length} trimmed -> ${chunks.length} chunks)`,
        );
        const merged: unknown[] = [];
        let usedModel: string | undefined;
        let lastChunkError: string | undefined;
        for (const [i, chunk] of chunks.entries()) {
          const part = await jsonExtractionCall(genAI, formatPrompt(chunk), "array");
          if (Array.isArray(part.data)) {
            merged.push(...part.data);
            usedModel ??= part.model;
            log.info(`[DataSourceExtraction]   chunk ${i + 1}/${chunks.length}: ${part.data.length} entries`);
          } else {
            lastChunkError = part.error;
            log.warn(`[DataSourceExtraction]   chunk ${i + 1}/${chunks.length} failed: ${part.error?.slice(0, 100)}`);
          }
        }
        // Partial success is still success — validateEditions dedupes across
        // chunks, so overlapping or repeated rows collapse.
        outcome = merged.length
          ? { data: merged, ...(usedModel ? { model: usedModel } : {}) }
          : { data: null, ...(lastChunkError ? { error: lastChunkError } : {}) };
      } else {
        log.info(`[DataSourceExtraction] direct fetch OK (${rawPageText.length} chars) — extracting from page text`);
        outcome = await jsonExtractionCall(genAI, formatPrompt(rawPageText), shape);
      }
    }

    // Strategy 2: let Gemini browse. Needed for bot-gated or genuinely
    // JS-rendered pages, where the direct fetch returns nothing usable.
    if (!outcome.data) {
      log.info("[DataSourceExtraction] falling back to urlContext browsing");
      const fallback = await urlContextExtraction(
        genAI,
        url,
        formatPrompt,
        shape,
        kind === "TOURNAMENT_CALENDAR" ? buildCalendarStep1FocusHint() : undefined,
      );
      // Keep the direct-fetch error only if the fallback produced nothing either.
      const carriedError = fallback.error ?? outcome.error;
      outcome = fallback.data
        ? fallback
        : { data: null, ...(carriedError ? { error: carriedError } : {}) };
    }
  } else {
    if (!submission.s3Key) {
      return { status: "EXTRACTION_FAILED", extractionError: "No uploaded file on this submission." };
    }
    let buffer: Buffer;
    try {
      buffer = await s3Service.getDocumentBuffer(submission.s3Key);
    } catch (err) {
      return {
        status: "EXTRACTION_FAILED",
        extractionError: err instanceof Error ? err.message : "Failed to fetch the uploaded PDF from storage.",
      };
    }
    const prompt = buildPdfPrompt(kind, sportName);
    const contents = [
      {
        role: "user",
        parts: [{ text: prompt }, { inlineData: { mimeType: "application/pdf", data: buffer.toString("base64") } }],
      },
    ];
    outcome = await jsonExtractionCall(genAI, contents, kind === "TOURNAMENT_CALENDAR" ? "array" : "object");
  }

  if (!outcome.data) {
    return {
      status: "EXTRACTION_FAILED",
      extractionError: outcome.error || "Extraction produced no usable data.",
    };
  }

  const validated =
    kind === "FEDERATION"
      ? validateFederationPayload(outcome.data)
      : kind === "CURATED_TOURNAMENT"
        ? validateCuratedTournamentPayload(outcome.data)
        : validateEditions(outcome.data);

  if ("valid" in validated && (validated.valid === null || (Array.isArray(validated.valid) && validated.valid.length === 0))) {
    return {
      status: "EXTRACTION_FAILED",
      extractionError: validated.errors.join(" ") || "Extraction failed validation.",
      ...(outcome.model ? { extractionModel: outcome.model } : {}),
    };
  }

  return {
    status: "PENDING_REVIEW",
    extractedData: validated.valid,
    ...("citations" in validated ? { citations: validated.citations } : {}),
    ...(outcome.model ? { extractionModel: outcome.model } : {}),
    // Validation can discard most of a batch and still "succeed" on the
    // remainder. Carry those notes through instead of dropping them, so a
    // reviewer sees "149 of 151 dropped" rather than a quietly tiny result.
    ...(validated.errors.length > 0 ? { extractionWarnings: validated.errors } : {}),
  };
}
