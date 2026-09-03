import { DataSourceSubmissionDocument } from "../../../shared/models/DataSourceSubmission";
import { s3Service } from "../../../shared/services/S3Service";
import {
  log,
  getClient,
  jsonExtractionCall,
  urlContextExtraction,
  ExtractionOutcome,
} from "./gemini";
import { fetchPageText } from "./http";
import { asString, sportNameFromSlug } from "./valueParsing";
import { validateEditions } from "./editions";

const MONTH_ABBREVS = [
  "jan",
  "feb",
  "mar",
  "apr",
  "may",
  "jun",
  "jul",
  "aug",
  "sep",
  "oct",
  "nov",
  "dec",
];

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
  const body =
    headerEnd > 0 ? text.slice(headerEnd + "[...earlier months omitted...]".length) : text;

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
- "detailUrl": if the event name is followed by a URL in parentheses, copy that URL here EXACTLY as written, character for character. Otherwise null. Never invent, shorten, or "correct" it.
- "sourceQuote": a short direct quote or close paraphrase (under 25 words) from the source that supports this entry, or null.

Rules:
- Extract ONLY entries actually present in the content. Never invent events or dates.
- The parenthesised URL after a name is that event's own page — it is NOT part of the name. Keep the name clean and put the URL in "detailUrl".
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

function buildPdfPrompt(
  kind: "FEDERATION" | "CURATED_TOURNAMENT" | "TOURNAMENT_CALENDAR",
  sportName: string
): string {
  if (kind === "FEDERATION") {
    return `You are a precise data-extraction engine. The attached PDF is an official document about a sports federation (sport: ${sportName}). Extract its information.\n\n${federationPromptRules()}`;
  }
  if (kind === "CURATED_TOURNAMENT") {
    return `You are a precise data-extraction engine. The attached PDF is an official document about a tournament (sport: ${sportName}). Extract its information.\n\n${curatedTournamentPromptRules()}`;
  }
  const today = new Date().toISOString().slice(0, 10);
  return `You are a precise data-extraction engine. The attached PDF is an official tournament calendar for ${sportName} in India. Extract every tournament entry that has at least an identifiable event name/series and a start date, as a JSON array.\n\n${calendarPromptRules(sportName, "the attached PDF", today)}`;
}

function asStringArray(v: unknown): string[] {
  return Array.isArray(v)
    ? v.filter((x): x is string => typeof x === "string" && x.trim().length > 0)
    : [];
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
  if (!type || !["govt", "national", "hybrid"].includes(type))
    errors.push('Missing/invalid type (must be "govt", "national", or "hybrid").');
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
          .map((s) => ({
            name: asString(s.name) || "",
            state: asString(s.state) || "",
            website: asString(s.website),
          }))
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
          registrationRequired:
            typeof eligibility.registrationRequired === "boolean"
              ? eligibility.registrationRequired
              : true,
          stateAssociationFirst:
            typeof eligibility.stateAssociationFirst === "boolean"
              ? eligibility.stateAssociationFirst
              : true,
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
    prestige:
      prestige && ["flagship", "ranking", "developmental"].includes(prestige)
        ? prestige
        : undefined,
    prizePool: asString(r.prizePool),
    registrationUrl: asString(r.registrationUrl),
  };
  return { valid, errors: [], citations };
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
  submission: DataSourceSubmissionDocument
): Promise<ExtractionResult> {
  const genAI = getClient();
  if (!genAI) {
    return {
      status: "EXTRACTION_FAILED",
      extractionError: "No GEMINI_API_KEY/GOOGLE_API_KEY configured.",
    };
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
          `[DataSourceExtraction] direct fetch OK (${rawPageText.length} chars -> ${trimmed.length} trimmed -> ${chunks.length} chunks)`
        );
        const merged: unknown[] = [];
        let usedModel: string | undefined;
        let lastChunkError: string | undefined;
        for (const [i, chunk] of chunks.entries()) {
          const part = await jsonExtractionCall(genAI, formatPrompt(chunk), "array");
          if (Array.isArray(part.data)) {
            merged.push(...part.data);
            usedModel ??= part.model;
            log.info(
              `[DataSourceExtraction]   chunk ${i + 1}/${chunks.length}: ${part.data.length} entries`
            );
          } else {
            lastChunkError = part.error;
            log.warn(
              `[DataSourceExtraction]   chunk ${i + 1}/${chunks.length} failed: ${part.error?.slice(0, 100)}`
            );
          }
        }
        // Partial success is still success — validateEditions dedupes across
        // chunks, so overlapping or repeated rows collapse.
        outcome = merged.length
          ? { data: merged, ...(usedModel ? { model: usedModel } : {}) }
          : { data: null, ...(lastChunkError ? { error: lastChunkError } : {}) };
      } else {
        log.info(
          `[DataSourceExtraction] direct fetch OK (${rawPageText.length} chars) — extracting from page text`
        );
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
        kind === "TOURNAMENT_CALENDAR" ? buildCalendarStep1FocusHint() : undefined
      );
      // Keep the direct-fetch error only if the fallback produced nothing either.
      const carriedError = fallback.error ?? outcome.error;
      outcome = fallback.data
        ? fallback
        : { data: null, ...(carriedError ? { error: carriedError } : {}) };
    }
  } else {
    if (!submission.s3Key) {
      return {
        status: "EXTRACTION_FAILED",
        extractionError: "No uploaded file on this submission.",
      };
    }
    let buffer: Buffer;
    try {
      buffer = await s3Service.getDocumentBuffer(submission.s3Key);
    } catch (err) {
      return {
        status: "EXTRACTION_FAILED",
        extractionError:
          err instanceof Error ? err.message : "Failed to fetch the uploaded PDF from storage.",
      };
    }
    const prompt = buildPdfPrompt(kind, sportName);
    const contents = [
      {
        role: "user",
        parts: [
          { text: prompt },
          { inlineData: { mimeType: "application/pdf", data: buffer.toString("base64") } },
        ],
      },
    ];
    outcome = await jsonExtractionCall(
      genAI,
      contents,
      kind === "TOURNAMENT_CALENDAR" ? "array" : "object"
    );
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

  if (
    "valid" in validated &&
    (validated.valid === null || (Array.isArray(validated.valid) && validated.valid.length === 0))
  ) {
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
