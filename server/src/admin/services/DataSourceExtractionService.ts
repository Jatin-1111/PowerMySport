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

const modelCandidates = ["gemini-2.5-flash", "gemini-2.5-flash-lite"];

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
        config: { responseMimeType: "application/json", temperature: 0.1 },
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
  return { data: null, error: lastError || "All models failed." };
}

/** Two-step urlContext extraction — step 1 lets Gemini fetch the URL itself (handles JS-rendered/bot-gated pages), step 2 formats the free-form findings into strict JSON. */
async function urlContextExtraction(
  genAI: GoogleGenAI,
  url: string,
  formatPrompt: (findings: string) => string,
  kind: "array" | "object",
): Promise<ExtractionOutcome> {
  let lastError = "";
  for (const model of modelCandidates) {
    try {
      const step1 = await genAI.models.generateContent({
        model,
        contents: `Open and read this page/document using your URL context tool: ${url}\n\nReport everything relevant you find on it in plain text or bullets — do not add anything from memory or guesswork. If it fails to load or has nothing relevant, say so plainly.`,
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
  return { data: null, error: lastError || "All models failed." };
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

export function validateEditions(raw: unknown): { valid: ValidEdition[]; errors: string[] } {
  const errors: string[] = [];
  if (!Array.isArray(raw)) return { valid: [], errors: ["Extraction did not return a list."] };

  const now = Date.now();
  const minStart = now - 60 * 24 * 60 * 60 * 1000; // 60 days back
  const maxStart = now + 550 * 24 * 60 * 60 * 1000; // ~18 months ahead
  const seen = new Set<string>();
  const valid: ValidEdition[] = [];
  let dropped = 0;

  for (const item of raw as ExtractedEdition[]) {
    const name = typeof item?.name === "string" ? cleanEditionName(item.name) : "";
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
    const keys = editionDedupKeys(name, item.startDate);
    if (keys.some((k) => seen.has(k))) {
      dropped++;
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

  if (dropped > 0) errors.push(`${dropped} invalid/duplicate entries were dropped.`);
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
    if (kind === "FEDERATION") {
      outcome = await urlContextExtraction(genAI, url, buildFederationLinkFormatPrompt, "object");
    } else if (kind === "CURATED_TOURNAMENT") {
      outcome = await urlContextExtraction(genAI, url, buildCuratedTournamentLinkFormatPrompt, "object");
    } else {
      outcome = await urlContextExtraction(
        genAI,
        url,
        (findings) => buildCalendarLinkFormatPrompt(sportName, url, findings),
        "array",
      );
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
  };
}
