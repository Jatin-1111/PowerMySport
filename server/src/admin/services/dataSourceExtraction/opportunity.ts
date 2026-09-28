import type { DataSourceSubmissionDocument } from "../../../shared/models/DataSourceSubmission";
import { SUPPORTED_SPORTS } from "../../../shared/constants/supportedSports";
import {
  OPPORTUNITY_CATEGORIES,
  OWNER_TYPES,
  SELECTION_MODES,
  type OpportunityTrack,
} from "../../../shared/validation/opportunityFormat";
import { s3Service } from "../../../shared/services/S3Service";
import {
  getClient,
  jsonExtractionCall,
  urlContextExtraction,
  type ExtractionOutcome,
} from "./gemini";
import { fetchPageText, fetchPdfFromUrl, MAX_INLINE_PDF_BYTES } from "./http";

// ─── Reading an admission or scholarship out of a document ──────────────────
//
// The model reads the source cold. It is told what entry the document is
// meant to be about (so a state circular listing twelve schemes yields the
// one we asked for), but it is never shown our current values: an extraction
// that has seen the answer it is checking tends to agree with it. The review
// screen does the comparing.
//
// What comes back is cleaned here, not trusted. Every field is optional,
// anything of the wrong type or outside an allowed list is dropped with a
// warning, and nothing reaches the live entry until a person approves it.

export interface OpportunityExtraction {
  /** Cleaned fields, shaped like an Opportunity record. Any of them may be absent. */
  fields: Record<string, unknown>;
  /** Top-level field name → a short quote from the source supporting it. */
  citations: Record<string, string>;
  warnings: string[];
  /** When the document says it was issued, if it does. */
  sourcePublishedOn?: string;
}

const DATE = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;
const SPORT_SLUGS = SUPPORTED_SPORTS.map((sport) => sport.slug);

function promptRules(track: OpportunityTrack): string {
  const categories = OPPORTUNITY_CATEGORIES[track].join(" | ");
  return `Return a single JSON object with these keys. Leave a key out, or null, when the source does not state it.
- "title": the scheme's or admission route's own name.
- "category": one of ${categories}.
- "summary": 2-3 plain sentences a parent would understand: what it is and who it is for.
- "owner": {"name": string, "type": one of ${OWNER_TYPES.join(" | ")}}.
- "allSports": true if it is open to athletes of any sport.
- "sports": array of sport slugs it is limited to, from: ${SPORT_SLUGS.join(", ")}. Empty if allSports.
- "geography": {"scope": one of india | state | international | abroad, "state": string or null}.
- "eligibility": {"ageMin": integer, "ageMax": integer, "ageNote": how age is counted, "gender": any | female | male, "level": the sporting achievement required, in plain words, "academic": any academic requirement, "income": any income limit}.
- "selection": one of ${SELECTION_MODES.join(" | ")}. Use "nominated" or "scouted" when there is NO application form.
- "benefit": {"summary": what the athlete gets, one line, "amount": {"value": number, "currency": "INR" | "USD", "period": one-time | month | year | total, "note": string} or null}.
- "cycle": {"label": the year the rules are for, e.g. "2026-27", "opensOn": "YYYY-MM-DD", "closesOn": "YYYY-MM-DD", "keyDates": [{"label": string, "date": "YYYY-MM-DD"}]}.
- "steps": array of what an applicant does, in order.
- "keyFacts": array of short facts a parent should know (seat counts, weightage, amounts per level).
- "applyUrl": the official application link, only if the source gives it.
- "sourcePublishedOn": "YYYY-MM-DD" date the document was issued, if printed on it.
- "_citations": an object mapping each top-level key you filled in to a short direct quote (under 25 words) from the source that supports it.

Rules:
- Use ONLY what the source says. Never add figures, dates or rules from memory, even if you believe them.
- Dates must be real dates in the source. If only a month is given, leave the date out and put it in keyDates' label instead.
- Amounts must be numbers as printed ("₹6.28 lakh" is 628000). If there are several amounts by level, put them in keyFacts and leave "amount" out.
- Return ONLY the JSON object. No markdown fences, no commentary.`;
}

function focusLine(submission: DataSourceSubmissionDocument, focusTitle?: string): string {
  const track = submission.opportunityTrack ?? "scholarship";
  return focusTitle
    ? `This source is being checked for one entry: "${focusTitle}". If it covers several schemes, extract only that one.`
    : `This source describes a sports ${track === "admission" ? "admission route" : "scholarship or funding scheme"} for young athletes in India or abroad.`;
}

// ─── Cleaning ────────────────────────────────────────────────────────────────

const str = (value: unknown, max: number): string | undefined => {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, max) : undefined;
};

const strList = (value: unknown, max: number, limit: number): string[] | undefined => {
  if (!Array.isArray(value)) return undefined;
  const out = value
    .map((item) => str(item, max))
    .filter((item): item is string => Boolean(item))
    .slice(0, limit);
  return out.length ? out : undefined;
};

const date = (value: unknown): string | undefined => {
  const s = str(value, 10);
  return s && DATE.test(s) ? s : undefined;
};

const int = (value: unknown, min: number, max: number): number | undefined =>
  typeof value === "number" && Number.isInteger(value) && value >= min && value <= max
    ? value
    : undefined;

const oneOf = <T extends string>(value: unknown, allowed: readonly T[]): T | undefined =>
  typeof value === "string" && (allowed as readonly string[]).includes(value)
    ? (value as T)
    : undefined;

const obj = (value: unknown): Record<string, unknown> | undefined =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;

/** Drop keys whose value is undefined; undefined for an object left with none. */
const compact = (value: Record<string, unknown>): Record<string, unknown> | undefined => {
  const out = Object.fromEntries(Object.entries(value).filter(([, v]) => v !== undefined));
  return Object.keys(out).length ? out : undefined;
};

/** Turn the model's JSON into fields the Opportunity schema can accept. */
export function cleanOpportunityExtraction(
  raw: unknown,
  track: OpportunityTrack
): OpportunityExtraction {
  const warnings: string[] = [];
  const r = obj(raw);
  if (!r) {
    return { fields: {}, citations: {}, warnings: ["The source did not yield an entry."] };
  }

  const dropped = (field: string, value: unknown) => {
    if (value !== undefined && value !== null && value !== "") {
      warnings.push(
        `Dropped "${field}": ${JSON.stringify(value).slice(0, 80)} is not a valid value.`
      );
    }
  };

  const category = oneOf(r.category, OPPORTUNITY_CATEGORIES[track]);
  if (!category) dropped("category", r.category);

  const ownerRaw = obj(r.owner);
  const ownerName = str(ownerRaw?.name, 160);
  const ownerType = oneOf(ownerRaw?.type, OWNER_TYPES);
  if (ownerRaw && !ownerType) dropped("owner.type", ownerRaw.type);

  const sports = Array.isArray(r.sports)
    ? r.sports.filter((s): s is string => typeof s === "string" && SPORT_SLUGS.includes(s))
    : [];
  const allSports = r.allSports === true;

  const geoRaw = obj(r.geography);
  const scope = oneOf(geoRaw?.scope, ["india", "state", "international", "abroad"] as const);
  if (geoRaw && !scope) dropped("geography.scope", geoRaw.scope);

  const eligRaw = obj(r.eligibility);
  const eligibility = eligRaw
    ? compact({
        ageMin: int(eligRaw.ageMin, 3, 40),
        ageMax: int(eligRaw.ageMax, 3, 40),
        ageNote: str(eligRaw.ageNote, 300),
        gender: oneOf(eligRaw.gender, ["any", "female", "male"] as const),
        level: str(eligRaw.level, 600),
        academic: str(eligRaw.academic, 400),
        income: str(eligRaw.income, 300),
      })
    : undefined;

  const selection = oneOf(r.selection, SELECTION_MODES);
  if (!selection) dropped("selection", r.selection);

  const benefitRaw = obj(r.benefit);
  const amountRaw = obj(benefitRaw?.amount);
  const amount = amountRaw
    ? compact({
        value:
          typeof amountRaw.value === "number" && amountRaw.value > 0 ? amountRaw.value : undefined,
        currency: oneOf(amountRaw.currency, ["INR", "USD"] as const),
        period: oneOf(amountRaw.period, ["one-time", "month", "year", "total"] as const),
        note: str(amountRaw.note, 200),
      })
    : undefined;
  // An amount is only usable whole: a value without its currency or period
  // would print as a number with no meaning.
  const usableAmount = amount?.value && amount.currency && amount.period ? amount : undefined;
  if (amount && !usableAmount) dropped("benefit.amount", amountRaw);
  const benefitSummary = str(benefitRaw?.summary, 300);

  const cycleRaw = obj(r.cycle);
  const keyDates = Array.isArray(cycleRaw?.keyDates)
    ? (cycleRaw!.keyDates as unknown[])
        .map((d) => obj(d))
        .map((d) => ({ label: str(d?.label, 120), date: date(d?.date) }))
        .filter((d): d is { label: string; date: string } => Boolean(d.label && d.date))
        .slice(0, 10)
    : [];
  const cycle = cycleRaw
    ? compact({
        label: str(cycleRaw.label, 40),
        opensOn: date(cycleRaw.opensOn),
        closesOn: date(cycleRaw.closesOn),
        keyDates: keyDates.length ? keyDates : undefined,
      })
    : undefined;

  const applyUrl = str(r.applyUrl, 500);
  const fields =
    compact({
      title: str(r.title, 160),
      category,
      summary: str(r.summary, 700),
      owner: ownerName && ownerType ? { name: ownerName, type: ownerType } : undefined,
      allSports: allSports || undefined,
      sports: !allSports && sports.length ? sports : undefined,
      geography: scope
        ? compact({ scope, state: scope === "state" ? str(geoRaw?.state, 60) : undefined })
        : undefined,
      eligibility,
      selection,
      benefit: benefitSummary
        ? compact({ summary: benefitSummary, amount: usableAmount })
        : undefined,
      cycle,
      steps: strList(r.steps, 500, 12),
      keyFacts: strList(r.keyFacts, 400, 12),
      applyUrl: applyUrl && /^https?:\/\//i.test(applyUrl) ? applyUrl : undefined,
    }) ?? {};

  const citationsRaw = obj(r._citations) ?? {};
  const citations: Record<string, string> = {};
  for (const [key, value] of Object.entries(citationsRaw)) {
    const quote = str(value, 300);
    if (quote && key in fields) citations[key] = quote;
  }

  const sourcePublishedOn = date(r.sourcePublishedOn);
  return { fields, citations, warnings, ...(sourcePublishedOn ? { sourcePublishedOn } : {}) };
}

// ─── Running it ──────────────────────────────────────────────────────────────

export interface OpportunityExtractionResult {
  status: "PENDING_REVIEW" | "EXTRACTION_FAILED";
  extractedData?: OpportunityExtraction["fields"] & { sourcePublishedOn?: string };
  citations?: Record<string, string>;
  extractionError?: string;
  extractionWarnings?: string[];
  extractionModel?: string;
}

const pdfContents = (prompt: string, buffer: Buffer) => [
  {
    role: "user",
    parts: [
      { text: prompt },
      { inlineData: { mimeType: "application/pdf", data: buffer.toString("base64") } },
    ],
  },
];

/**
 * Reads the submission's source: an uploaded PDF, a link that is a PDF, or a
 * web page (fetched directly first, then browsed by the model if the site
 * blocks a plain fetch). Writes nothing but the result it returns.
 */
export async function extractOpportunityForSubmission(
  submission: DataSourceSubmissionDocument,
  focusTitle?: string
): Promise<OpportunityExtractionResult> {
  const genAI = getClient();
  if (!genAI) {
    return {
      status: "EXTRACTION_FAILED",
      extractionError: "No GEMINI_API_KEY/GOOGLE_API_KEY configured.",
    };
  }
  const track = submission.opportunityTrack ?? "scholarship";
  const intro = `You are a precise data-extraction engine. ${focusLine(submission, focusTitle)}`;
  const rules = promptRules(track);

  let outcome: ExtractionOutcome;
  if (submission.sourceKind === "PDF") {
    if (!submission.s3Key) {
      return {
        status: "EXTRACTION_FAILED",
        extractionError: "No uploaded file on this submission.",
      };
    }
    let buffer: Buffer;
    try {
      buffer = await s3Service.getDocumentBuffer(submission.s3Key, MAX_INLINE_PDF_BYTES);
    } catch (err) {
      return {
        status: "EXTRACTION_FAILED",
        extractionError: err instanceof Error ? err.message : "Could not read the uploaded PDF.",
      };
    }
    if (buffer.length > MAX_INLINE_PDF_BYTES) {
      return {
        status: "EXTRACTION_FAILED",
        extractionError:
          "That PDF is too large to read in one go (over 18MB). Upload only the relevant pages.",
      };
    }
    outcome = await jsonExtractionCall(
      genAI,
      pdfContents(`${intro}\n\n${rules}`, buffer),
      "object"
    );
  } else {
    const url = submission.sourceUrl;
    if (!url)
      return { status: "EXTRACTION_FAILED", extractionError: "No source URL on this submission." };

    const pdf = await fetchPdfFromUrl(url);
    if (pdf && "error" in pdf) {
      return { status: "EXTRACTION_FAILED", extractionError: pdf.error };
    }
    if (pdf) {
      outcome = await jsonExtractionCall(
        genAI,
        pdfContents(`${intro} The attached PDF is from ${url}.\n\n${rules}`, pdf.buffer),
        "object"
      );
    } else {
      const text = await fetchPageText(url, { stripChrome: true });
      outcome = { data: null };
      if (text && text.length >= 200) {
        outcome = await jsonExtractionCall(
          genAI,
          `${intro} Below is the text of ${url}.\n\n${rules}\n\nPage text:\n"""\n${text}\n"""`,
          "object"
        );
      }
      if (!outcome.data) {
        // Bot-gated or built in the browser: let the model open it itself.
        const fallback = await urlContextExtraction(
          genAI,
          url,
          (findings) =>
            `${intro} Below are findings read from ${url}. Convert them; add nothing that is not in them.\n\n${rules}\n\nFindings:\n"""\n${findings}\n"""`,
          "object"
        );
        const carried = fallback.error ?? outcome.error;
        outcome = fallback.data ? fallback : { data: null, ...(carried ? { error: carried } : {}) };
      }
    }
  }

  if (!outcome.data) {
    return {
      status: "EXTRACTION_FAILED",
      extractionError: outcome.error || "Nothing usable could be read from this source.",
    };
  }

  const cleaned = cleanOpportunityExtraction(outcome.data, track);
  if (Object.keys(cleaned.fields).length === 0) {
    return {
      status: "EXTRACTION_FAILED",
      extractionError:
        cleaned.warnings.join(" ") ||
        "The source was read but described no admission or scholarship.",
      ...(outcome.model ? { extractionModel: outcome.model } : {}),
    };
  }

  return {
    status: "PENDING_REVIEW",
    extractedData: {
      ...cleaned.fields,
      ...(cleaned.sourcePublishedOn ? { sourcePublishedOn: cleaned.sourcePublishedOn } : {}),
    },
    citations: cleaned.citations,
    ...(cleaned.warnings.length ? { extractionWarnings: cleaned.warnings } : {}),
    ...(outcome.model ? { extractionModel: outcome.model } : {}),
  };
}
