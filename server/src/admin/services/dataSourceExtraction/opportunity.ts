import type { DataSourceSubmissionDocument } from "../../../shared/models/DataSourceSubmission";
import { SUPPORTED_SPORTS } from "../../../shared/constants/supportedSports";
import {
  OPPORTUNITY_CATEGORIES,
  OPPORTUNITY_COST_KINDS,
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
import { fetchPageForReading, fetchPdfFromUrl, MAX_INLINE_PDF_BYTES } from "./http";
import {
  documentLinksWithText,
  mergeExtractions,
  rankDocuments,
  readDocuments,
  type DocumentLink,
  type DocumentRecord,
  type FieldConflict,
  type ReadSource,
} from "./multiDocument";
import { extractPdfText } from "./pdfText";
import { staleCycleReason, stripCostWording } from "./opportunityChecks";
import { checkExtraction, type CitationChecks } from "./quoteCheck";

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
- "eligibility": {"summary": ONE line under 150 characters saying who can apply (age, level, grade, sport), in plain words a parent reads first. Do NOT put the cost or fees in it; those go in "cost", "ageMin": integer, "ageMax": integer, "ageNote": how age is counted, "gender": any | female | male, "level": the sporting achievement required, in plain words, "academic": any academic requirement, "income": any income limit}.
- "selection": one of ${SELECTION_MODES.join(" | ")}. Use "nominated" or "scouted" when there is NO application form.
- "benefit": {"summary": what the athlete gets, one line, "amount": {"value": number, "currency": "INR" | "USD", "period": one-time | month | year | total, "note": string} or null}.
- "cost": {"kind": free | fee | varies, "amount": number (a fee only), "currency": "INR" | "USD" (a fee only), "note": who pays what, one line}. Use "free" ONLY when the source says it is free. Use "fee" whenever the source states the amount a player pays, even if some players are exempt or later rounds are free: put the amount in "amount" and the exceptions in "note". Use "varies" only when there is no single amount (it depends on the city or the level), and say on what in "note". Leave "cost" out when the source does not say what it costs.
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
        // The cost has its own field; see stripCostWording for why this is not left to the prompt.
        summary: stripCostWording(str(eligRaw.summary, 160)),
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

  const costRaw = obj(r.cost);
  const costKind = oneOf(costRaw?.kind, OPPORTUNITY_COST_KINDS);
  if (costRaw && !costKind) dropped("cost.kind", costRaw.kind);
  const costAmount =
    typeof costRaw?.amount === "number" && costRaw.amount > 0 ? costRaw.amount : undefined;
  const costCurrency = oneOf(costRaw?.currency, ["INR", "USD"] as const);
  // A fee is only usable whole, as with the benefit amount: a figure with no
  // currency would print as a number with no meaning. A fee that cannot be had
  // whole is kept as "varies" rather than dropped, so the cost is not lost.
  const usableFee = costAmount !== undefined && costCurrency ? costAmount : undefined;
  const cost = costKind
    ? costKind === "fee" && usableFee === undefined
      ? compact({ kind: "varies" as const, note: str(costRaw?.note, 300) })
      : compact({
          kind: costKind,
          amount: costKind === "fee" ? usableFee : undefined,
          currency: costKind === "fee" ? costCurrency : undefined,
          note: str(costRaw?.note, 300),
        })
    : undefined;
  if (costKind === "fee" && usableFee === undefined) dropped("cost.amount", costRaw?.amount);

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
      cost,
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
  // An out-of-date source reads as fluently as a current one. Say so on the review
  // screen, and (for a draft made without a person) it stops the draft.
  const stale = staleCycleReason(
    typeof cycle?.label === "string" ? cycle.label : undefined,
    sourcePublishedOn
  );
  if (stale) warnings.push(stale);
  return { fields, citations, warnings, ...(sourcePublishedOn ? { sourcePublishedOn } : {}) };
}

// ─── Running it ──────────────────────────────────────────────────────────────

export interface OpportunityExtractionResult {
  status: "PENDING_REVIEW" | "EXTRACTION_FAILED";
  extractedData?: OpportunityExtraction["fields"] & { sourcePublishedOn?: string };
  citations?: Record<string, string>;
  /** Whether each quote is on the page and each figure is in its quote (quoteCheck.ts). */
  citationChecks?: CitationChecks;
  /** Set when documents the page links to were read too (multiDocument.ts): every source and what became of it. */
  documents?: DocumentRecord[];
  /** Top-level field → the address of the document its value came from. */
  fieldSources?: Record<string, string>;
  /** Top-level field → what the other documents say, where they differ. */
  conflicts?: Record<string, FieldConflict[]>;
  extractionError?: string;
  extractionWarnings?: string[];
  extractionModel?: string;
}

/**
 * A link's text comes from another site's HTML and goes into the prompt as the
 * document's name. It is flattened to one short line without quotes, so it can
 * name the document but not close the sentence it sits in and add instructions.
 * Anything the model returns is cleaned and reviewed by a person regardless.
 */
const promptSafe = (text: string): string =>
  text
    .replace(/["\r\n]+/g, " ")
    .trim()
    .slice(0, 160);

const pdfContents = (prompt: string, buffer: Buffer) => [
  {
    role: "user",
    parts: [
      { text: prompt },
      { inlineData: { mimeType: "application/pdf", data: buffer.toString("base64") } },
    ],
  },
];

/** What the reading needs to know, and the network and model it uses, replaceable so it can be tested without either. */
export interface ExtractionOptions {
  /** Who runs the entry being checked, so its name is not mistaken for the scheme's when choosing documents. */
  ownerName?: string | undefined;
  client?: ReturnType<typeof getClient>;
  call?: typeof jsonExtractionCall;
  browse?: typeof urlContextExtraction;
  fetchPage?: typeof fetchPageForReading;
  fetchPdf?: typeof fetchPdfFromUrl;
  /** The text layer of a PDF, to check the model's quotes against. */
  pdfText?: typeof extractPdfText;
}

/**
 * Reads the submission's source: an uploaded PDF, a link that is a PDF, or a
 * web page (fetched directly first, then browsed by the model if the site
 * blocks a plain fetch). Writes nothing but the result it returns.
 */
export async function extractOpportunityForSubmission(
  submission: DataSourceSubmissionDocument,
  focusTitle?: string,
  options: ExtractionOptions = {}
): Promise<OpportunityExtractionResult> {
  const genAI = options.client !== undefined ? options.client : getClient();
  const call = options.call ?? jsonExtractionCall;
  const browse = options.browse ?? urlContextExtraction;
  const fetchPage = options.fetchPage ?? fetchPageForReading;
  const fetchPdf = options.fetchPdf ?? fetchPdfFromUrl;
  const readPdfText = options.pdfText ?? extractPdfText;
  /** The text of a PDF, or null when it has none worth using (a scan, or it could not be read). */
  const textOf = async (buffer: Buffer): Promise<string | null> =>
    (await readPdfText(buffer))?.text ?? null;
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
  // The text the model was shown, when we have it to compare its quotes with. A
  // PDF is sent whole and a browsed page is read by the model alone, so for
  // those there is none.
  let pageText: string | null = null;
  // Whether that text is a web page's or a PDF's: a PDF's text layer can scramble a
  // table, so its verdicts are weaker (see quoteCheck.ts).
  let textKind: "page" | "pdf" = "page";
  // Whether the main source is a web page (which may link to documents) and, if
  // it was read and asked for, the PDFs it links to.
  let primaryIsPage = false;
  let linkedDocuments: DocumentLink[] = [];
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
    // The model reads the PDF while its text layer is read beside it.
    const [read, text] = await Promise.all([
      call(genAI, pdfContents(`${intro}\n\n${rules}`, buffer), "object"),
      textOf(buffer),
    ]);
    outcome = read;
    pageText = text;
    textKind = "pdf";
  } else {
    const url = submission.sourceUrl;
    if (!url)
      return { status: "EXTRACTION_FAILED", extractionError: "No source URL on this submission." };

    const pdf = await fetchPdf(url);
    if (pdf && "error" in pdf) {
      return { status: "EXTRACTION_FAILED", extractionError: pdf.error };
    }
    if (pdf) {
      const [read, text] = await Promise.all([
        call(
          genAI,
          pdfContents(`${intro} The attached PDF is from ${url}.\n\n${rules}`, pdf.buffer),
          "object"
        ),
        textOf(pdf.buffer),
      ]);
      outcome = read;
      pageText = text;
      textKind = "pdf";
    } else {
      const page = await fetchPage(url, { stripChrome: true, identify: true });
      const text = page?.text ?? null;
      primaryIsPage = true;
      // The page's own PDF links, only when asked: reading them costs a model call each.
      if (submission.followDocuments && page) {
        linkedDocuments = documentLinksWithText(page.html, page.finalUrl);
      }
      outcome = { data: null };
      if (text && text.length >= 200) {
        outcome = await call(
          genAI,
          `${intro} Below is the text of ${url}.\n\n${rules}\n\nPage text:\n"""\n${text}\n"""`,
          "object"
        );
        // The model read exactly this text, so its quotes can be checked against it.
        if (outcome.data) pageText = text;
      }
      if (!outcome.data) {
        // Bot-gated or built in the browser: let the model open it itself.
        const fallback = await browse(
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

  // The main source, cleaned, or why it yielded nothing. A page that yields
  // nothing is not the end when it links to documents: an index of circulars
  // describes no scheme itself, and its documents do.
  const ownUrl = submission.originUrl || submission.sourceUrl || "";
  const ownLabel = submission.sourceLabel || "Source";
  let primary: ReadSource | null = null;
  let primaryFailure: string | null = null;
  if (!outcome.data) {
    primaryFailure = outcome.error || "Nothing usable could be read from this source.";
  } else {
    const cleaned = cleanOpportunityExtraction(outcome.data, track);
    if (Object.keys(cleaned.fields).length === 0) {
      primaryFailure =
        cleaned.warnings.join(" ") ||
        "The source was read but described no admission or scholarship.";
    } else {
      primary = {
        url: ownUrl,
        label: ownLabel,
        kind: primaryIsPage ? "page" : "document",
        fields: cleaned.fields,
        citations: cleaned.citations,
        checks: checkExtraction(cleaned.fields, cleaned.citations, pageText, textKind),
        warnings: cleaned.warnings,
        sourcePublishedOn: cleaned.sourcePublishedOn,
      };
    }
  }

  // The documents the page links to, when asked for.
  const toRead = rankDocuments(linkedDocuments, {
    title: focusTitle ?? (primary?.fields.title as string | undefined),
    owner: options.ownerName ?? (primary?.fields.owner as { name?: string } | undefined)?.name,
    year: new Date().getFullYear(),
    exclude: [ownUrl],
  });
  const documents =
    toRead.length > 0
      ? await readDocuments(toRead, {
          download: async (documentUrl) => {
            const pdf = await fetchPdf(documentUrl);
            if (!pdf) return null;
            return "error" in pdf ? { error: pdf.error } : pdf.buffer;
          },
          extract: async (buffer, document) => {
            const read = await call(
              genAI,
              pdfContents(
                `${intro} The attached PDF is "${promptSafe(document.label)}" from ${document.url}.\n\n${rules}`,
                buffer
              ),
              "object"
            );
            return { data: read.data, error: read.error };
          },
          clean: (raw) => cleanOpportunityExtraction(raw, track),
          pdfText: textOf,
        })
      : { sources: [], records: [] };

  const sources = [...(primary ? [primary] : []), ...documents.sources];
  if (sources.length === 0) {
    const why = documents.records.map((r) => `${r.label}: ${r.error}`);
    return {
      status: "EXTRACTION_FAILED",
      extractionError:
        [primaryFailure, ...why].filter(Boolean).join(" ") ||
        "Nothing usable could be read from this source.",
      ...(outcome.model ? { extractionModel: outcome.model } : {}),
    };
  }

  // One source and no documents attempted: exactly as it was before documents.
  if (primary && documents.records.length === 0) {
    return {
      status: "PENDING_REVIEW",
      extractedData: {
        ...primary.fields,
        ...(primary.sourcePublishedOn ? { sourcePublishedOn: primary.sourcePublishedOn } : {}),
      },
      citations: primary.citations,
      citationChecks: primary.checks,
      ...(primary.warnings.length ? { extractionWarnings: primary.warnings } : {}),
      ...(outcome.model ? { extractionModel: outcome.model } : {}),
    };
  }

  const merged = mergeExtractions(sources);
  const mainRecord: DocumentRecord = primary
    ? {
        url: ownUrl,
        label: ownLabel,
        kind: primary.kind,
        status: "read",
        ...(primary.sourcePublishedOn ? { sourcePublishedOn: primary.sourcePublishedOn } : {}),
      }
    : {
        url: ownUrl,
        label: ownLabel,
        kind: "page",
        status: "unreadable",
        error: primaryFailure ?? "It described no scheme itself.",
      };
  return {
    status: "PENDING_REVIEW",
    extractedData: {
      ...merged.fields,
      ...(merged.sourcePublishedOn ? { sourcePublishedOn: merged.sourcePublishedOn } : {}),
    },
    citations: merged.citations,
    citationChecks: merged.checks,
    documents: [mainRecord, ...documents.records],
    fieldSources: merged.fieldSources,
    ...(Object.keys(merged.conflicts).length ? { conflicts: merged.conflicts } : {}),
    ...(merged.warnings.length ? { extractionWarnings: merged.warnings } : {}),
    ...(outcome.model ? { extractionModel: outcome.model } : {}),
  };
}
