import { decodeAttributeEntities } from "./http";
import { checkExtraction, type CitationChecks } from "./quoteCheck";
import type { OpportunityExtraction } from "./opportunity";

// ─── Reading the documents a page links to, and merging what they say ───────
//
// An official page is often an index: a paragraph about the scheme and a column
// of circulars, brochures and guidelines. Reading only the page means the figures
// that matter, in the PDFs, are never read. This follows the page's PDF links,
// reads each, and merges the results into one draft.
//
// ── The one rule that matters: disagreement is shown, never resolved ─────────
// Two documents can state the same field differently: last year's circular and
// this year's, or a brochure and the rules. For each field the draft takes the
// value from the highest-priority document that states it (the newest dated one
// first, the web page last), and where another document states it differently
// that is recorded as a conflict beside the field. Nothing is averaged, nothing
// is dropped, and the review screen starts such a row unticked, because a figure
// two official documents disagree about is exactly the one to check by hand.
//
// ── Bounded ──────────────────────────────────────────────────────────────────
// Each document is one Gemini call, so at most MAX_DOCUMENTS are read, chosen by
// how relevant their link text and filename look, and only PDFs: the other kinds
// the page might link to (Word, Excel) cannot be read by this pipeline.

export const MAX_DOCUMENTS = 3;

export interface DocumentLink {
  url: string;
  /** The link's own text, or its filename when it has none. */
  label: string;
}

/** What happened to each source read for one submission, shown on the review screen. */
export interface DocumentRecord {
  url: string;
  label: string;
  kind: "page" | "document";
  status: "read" | "unreadable";
  /** When the document says it was issued, if it does. */
  sourcePublishedOn?: string;
  /** Why it could not be read. */
  error?: string;
}

/** One source's cleaned reading, before merging. */
export interface ReadSource {
  url: string;
  label: string;
  kind: "page" | "document";
  fields: OpportunityExtraction["fields"];
  citations: Record<string, string>;
  checks: CitationChecks;
  warnings: string[];
  sourcePublishedOn?: string | undefined;
}

// ─── Finding the documents ───────────────────────────────────────────────────

// The link text is bounded, not "everything up to the next </a>": this runs on
// HTML from other people's sites, and an unclosed anchor would otherwise make
// every anchor scan to the end of the page, which grows with the square of its size.
const ANCHOR = /<a\b[^>]*?\bhref\s*=\s*["']([^"']+)["'][^>]*>([\s\S]{0,600}?)<\/a>/gi;
/** More PDF links than this on one page is not a page worth reading documents from. */
const MAX_LINKS = 1000;
const IS_PDF = /\.pdf(?:[?#]|$)/i;

const stripTags = (html: string): string =>
  decodeAttributeEntities(html.replace(/<[^>]*>/g, " "))
    .replace(/\s+/g, " ")
    .trim();

const filenameOf = (url: string): string => {
  try {
    const last = new URL(url).pathname.split("/").filter(Boolean).pop() ?? url;
    return decodeURIComponent(last)
      .replace(/\.pdf$/i, "")
      .replace(/[_-]+/g, " ")
      .trim();
  } catch {
    return url;
  }
};

/** The PDFs a page links to, absolute, with the text of the link, each once. */
export function documentLinksWithText(html: string, baseUrl: string): DocumentLink[] {
  const found = new Map<string, DocumentLink>();
  for (const match of html.matchAll(ANCHOR)) {
    if (found.size >= MAX_LINKS) break;
    const href = decodeAttributeEntities(match[1]!.trim());
    if (!IS_PDF.test(href)) continue;
    let url: string;
    try {
      url = new URL(href, baseUrl).toString();
    } catch {
      continue; // A malformed href is not a document we can fetch anyway.
    }
    const text = stripTags(match[2]!).slice(0, 160);
    const existing = found.get(url);
    // The same file is often linked twice, once with text and once as an icon.
    if (!existing || (!existing.label && text)) found.set(url, { url, label: text || "" });
  }
  return [...found.values()].map((link) => ({
    ...link,
    label: link.label || filenameOf(link.url),
  }));
}

const KEYWORDS =
  /(guideline|notification|circular|bulletin|scheme|scholarship|admission|quota|brochure|prospectus|eligibility|selection|trial|policy|rules)/i;
const UNWANTED =
  /(result|merit list|cut[- ]?off|syllabus|archive|tender|vacanc|recruit|minutes|agenda)/i;

/** A page with at least this many candidate documents is an index, not a scheme page. */
const LARGE_INDEX = 8;
/** On an index, a word in more than this share of the links says nothing about any one of them. */
const GENERIC_SHARE = 0.2;

const wordsOf = (text: string): string[] =>
  text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length >= 4);

/**
 * The documents most worth reading.
 *
 * On a small page (a scheme with a guidelines PDF and a brochure) a document that
 * shares words with the entry's title, names the kind of document that holds
 * rules, or names this year is worth reading. On an index of dozens those signals
 * fire on nearly every link of the same site: every Delhi University circular says
 * "Delhi", "University", "admission" and the year. So on an index a word that
 * appears across a fifth of the links is ignored, the organisation's own name is
 * ignored, and a document must share two words specific to this entry (one, if
 * its title has only one) to be read at all. A year counts only as a whole word,
 * never inside a date-stamped filename like 10102026.
 *
 * A results list or minutes is never read, and neither is anything with nothing
 * to recommend it.
 */
export function rankDocuments(
  links: DocumentLink[],
  context: {
    title?: string | undefined;
    /** Who runs it. Its words name the organisation, not the scheme, and match every one of its documents. */
    owner?: string | undefined;
    year: number;
    exclude?: string[];
    max?: number;
  }
): DocumentLink[] {
  const exclude = new Set(context.exclude ?? []);
  const ownerWords = new Set(wordsOf(context.owner ?? ""));
  const candidates = links
    .filter((link) => !exclude.has(link.url))
    // A results list or a set of minutes is not the document that holds the rules,
    // however much of the entry's title it shares, so it is never read.
    .filter((link) => !UNWANTED.test(`${link.label} ${filenameOf(link.url)}`))
    .map((link, order) => {
      const haystack = `${link.label} ${filenameOf(link.url)}`.toLowerCase();
      return { link, order, haystack, tokens: haystack.split(/[^a-z0-9]+/).filter(Boolean) };
    });

  const startsWith = (word: string) => (tokens: string[]) => tokens.some((t) => t.startsWith(word));
  const share = (hasWord: (tokens: string[]) => boolean): number =>
    candidates.filter((c) => hasWord(c.tokens)).length / candidates.length;

  // The words that are about this scheme: not the organisation's name, which
  // appears in all of its documents and, being rare on a page that rarely names
  // it, looks specific.
  const aboutScheme = [...new Set(wordsOf(context.title ?? ""))].filter(
    (word) => !ownerWords.has(word)
  );

  // Many links make an index only if they are not all about this entry. When the
  // entry's own words are common across them, the page is the scheme's own page and
  // every document on it is relevant, so nothing is filtered out.
  const crowded = candidates.length >= LARGE_INDEX;
  const dedicated =
    crowded &&
    aboutScheme.length > 0 &&
    aboutScheme.filter((word) => share(startsWith(word)) > GENERIC_SHARE).length * 2 >=
      aboutScheme.length;
  const large = crowded && !dedicated;
  /** Whether a word is so common across an index's links that it tells them apart not at all. */
  const generic = (hasWord: (tokens: string[]) => boolean): boolean =>
    large && share(hasWord) > GENERIC_SHARE;

  const titleWords = aboutScheme.filter((word) => !generic(startsWith(word)));
  const years = [String(context.year), String(context.year + 1)];
  const yearCounts = !generic((tokens) => years.some((y) => tokens.includes(y)));

  const scored = candidates
    .map(({ link, order, haystack, tokens }) => {
      const titleHits = titleWords.filter((word) => startsWith(word)(tokens)).length;
      const keyword = KEYWORDS.exec(haystack)?.[0]?.toLowerCase();
      const keywordCounts = keyword !== undefined && !generic(startsWith(keyword));
      const yearHit = yearCounts && years.some((y) => tokens.includes(y));
      const score = 2 * Math.min(titleHits, 3) + (keywordCounts ? 1 : 0) + (yearHit ? 2 : 0);
      return { link, score, order, titleHits };
    })
    // On an index, nothing is read unless it shares words specific to this entry:
    // two where the title has two or more, because a single word ("quota") matches
    // other schemes' documents too, and it is the combination that picks one out.
    .filter((item) =>
      large
        ? titleWords.length > 0 && item.titleHits >= Math.min(2, titleWords.length)
        : item.score >= 1
    );

  scored.sort((a, b) => b.score - a.score || a.order - b.order);
  return scored.slice(0, context.max ?? MAX_DOCUMENTS).map((item) => item.link);
}

// ─── Reading them ────────────────────────────────────────────────────────────

export interface ReadDeps {
  /** The PDF's bytes, an error to show, or null when it could not be fetched as a PDF. */
  download: (url: string) => Promise<Buffer | { error: string } | null>;
  /** The model's raw JSON for this PDF. */
  extract: (
    buffer: Buffer,
    document: DocumentLink
  ) => Promise<{ data: unknown; error?: string | undefined }>;
  /** Cleans the model's JSON into fields, quotes and warnings. */
  clean: (raw: unknown) => OpportunityExtraction;
  /** The PDF's own text, to check the model's quotes against; null when it has none (a scan). */
  pdfText?: (buffer: Buffer) => Promise<string | null>;
  /**
   * Asks for the quotes the reading left out, against the document's text. Returns the
   * citations with any it got added. Not asked when the document has no text.
   */
  completeQuotes?: (
    fields: Record<string, unknown>,
    citations: Record<string, string>,
    text: string
  ) => Promise<Record<string, string>>;
}

/** Read each document in turn, one at a time so the model's quota is not hit in a burst. */
export async function readDocuments(
  documents: DocumentLink[],
  deps: ReadDeps
): Promise<{ sources: ReadSource[]; records: DocumentRecord[] }> {
  const sources: ReadSource[] = [];
  const records: DocumentRecord[] = [];

  for (const document of documents) {
    const base = { url: document.url, label: document.label, kind: "document" as const };
    const unreadable = (error: string) => records.push({ ...base, status: "unreadable", error });
    try {
      const downloaded = await deps.download(document.url);
      if (!downloaded) {
        unreadable(
          "Could not download it as a PDF: the site refused, it is not a PDF, or it is gone."
        );
        continue;
      }
      if ("error" in downloaded) {
        unreadable(downloaded.error);
        continue;
      }
      // The model reads the PDF while its text layer is read beside it, so the quotes
      // it gives can be checked against what the PDF actually says.
      const [outcome, text] = await Promise.all([
        deps.extract(downloaded, document),
        deps.pdfText ? deps.pdfText(downloaded) : Promise.resolve(null),
      ]);
      if (!outcome.data) {
        unreadable(outcome.error || "Nothing could be read from it.");
        continue;
      }
      const cleaned = deps.clean(outcome.data);
      if (Object.keys(cleaned.fields).length === 0) {
        unreadable("It does not describe this entry.");
        continue;
      }
      const citations =
        deps.completeQuotes && text
          ? await deps.completeQuotes(cleaned.fields, cleaned.citations, text)
          : cleaned.citations;
      sources.push({
        ...base,
        fields: cleaned.fields,
        citations,
        // Quotes are checked against the PDF's text layer when it has one; figures always are.
        checks: checkExtraction(cleaned.fields, citations, text, "pdf"),
        warnings: cleaned.warnings,
        sourcePublishedOn: cleaned.sourcePublishedOn,
      });
      records.push({
        ...base,
        status: "read",
        ...(cleaned.sourcePublishedOn ? { sourcePublishedOn: cleaned.sourcePublishedOn } : {}),
      });
    } catch (error) {
      unreadable(error instanceof Error ? error.message.slice(0, 200) : "It could not be read.");
    }
  }
  return { sources, records };
}

// ─── Merging them ────────────────────────────────────────────────────────────

/** Fields where two documents saying different things is a real disagreement. Prose differs naturally and is not flagged. */
export const HARD_FIELDS = new Set([
  "category",
  "owner",
  "allSports",
  "sports",
  "geography",
  "eligibility",
  "selection",
  "benefit",
  "cycle",
  "applyUrl",
]);

export interface FieldConflict {
  url: string;
  label: string;
  /** What this other document says for the field. */
  value: unknown;
  quote?: string | undefined;
}

export interface MergedExtraction {
  fields: OpportunityExtraction["fields"];
  citations: Record<string, string>;
  checks: CitationChecks;
  /** Top-level field → the address of the document its value came from. */
  fieldSources: Record<string, string>;
  /** Top-level field → what the other documents say, where they differ. */
  conflicts: Record<string, FieldConflict[]>;
  sourcePublishedOn?: string;
  warnings: string[];
}

/** A value reduced to what makes two statements the same: case, spacing and list order do not. */
function normal(value: unknown): unknown {
  if (typeof value === "string") return value.toLowerCase().replace(/\s+/g, " ").trim();
  if (Array.isArray(value)) {
    const items = value.map(normal);
    return items.every((i) => typeof i === "string") ? [...(items as string[])].sort() : items;
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([k, v]) => [k, normal(v)])
    );
  }
  return value;
}
const same = (a: unknown, b: unknown) => JSON.stringify(normal(a)) === JSON.stringify(normal(b));

/** Newest dated document first; then documents before the page, in the order given. */
function byPriority(sources: ReadSource[]): ReadSource[] {
  return sources
    .map((source, order) => ({ source, order }))
    .sort((a, b) => {
      const da = a.source.sourcePublishedOn ?? "";
      const db = b.source.sourcePublishedOn ?? "";
      if (da !== db) return da < db ? 1 : -1;
      if (a.source.kind !== b.source.kind) return a.source.kind === "document" ? -1 : 1;
      return a.order - b.order;
    })
    .map((item) => item.source);
}

export function mergeExtractions(sources: ReadSource[]): MergedExtraction {
  const ordered = byPriority(sources);
  const fields: Record<string, unknown> = {};
  const citations: Record<string, string> = {};
  const fieldSources: Record<string, string> = {};
  const conflicts: Record<string, FieldConflict[]> = {};
  const checks: CitationChecks = { against: "none", quotes: {}, figures: {}, shared: {} };

  const keys = [...new Set(ordered.flatMap((s) => Object.keys(s.fields)))];
  for (const key of keys) {
    const supplier = ordered.find((s) => s.fields[key] !== undefined)!;
    fields[key] = supplier.fields[key];
    fieldSources[key] = supplier.url;
    if (supplier.citations[key]) citations[key] = supplier.citations[key]!;

    if (HARD_FIELDS.has(key)) {
      const others = ordered
        .filter((s) => s !== supplier && s.fields[key] !== undefined)
        .filter((s) => !same(s.fields[key], supplier.fields[key]));
      if (others.length > 0) {
        conflicts[key] = others.map((s) => ({
          url: s.url,
          label: s.label,
          value: s.fields[key],
          quote: s.citations[key],
        }));
      }
    }

    // The checks for a field are the supplying source's own: its quote against its
    // own text (if it had any), its figures against its own quote.
    if (supplier.checks.quotes[key]) {
      checks.quotes[key] = supplier.checks.quotes[key]!;
      // A web page's text is the stronger comparison, so it names the merged source
      // when both kinds are present.
      if (checks.against !== "page-text") checks.against = supplier.checks.against;
    }
    if (supplier.checks.shared[key]) checks.shared[key] = supplier.checks.shared[key]!;
    for (const [path, status] of Object.entries(supplier.checks.figures)) {
      if (path.split(".")[0] === key) checks.figures[path] = status;
    }
  }

  const newest = ordered.map((s) => s.sourcePublishedOn).find(Boolean);
  return {
    fields,
    citations,
    checks,
    fieldSources,
    conflicts,
    ...(newest ? { sourcePublishedOn: newest } : {}),
    warnings: sources.flatMap((s) =>
      s.warnings.map((w) => (sources.length > 1 ? `${s.label}: ${w}` : w))
    ),
  };
}

// ─── Citing them ─────────────────────────────────────────────────────────────

/**
 * The sources an approval should add to the entry: each document that supplied a
 * field the reviewer kept, newest first. When nothing kept came from a document
 * (or nothing was kept), the submission's own source, as before.
 */
export function sourcesToCite(
  records: DocumentRecord[],
  fieldSources: Record<string, string>,
  keptFields: Iterable<string>,
  own: { label: string; url: string; publishedOn?: string | undefined }
): Array<{ label: string; url: string; publishedOn?: string }> {
  const kept = new Set([...keptFields].map((path) => path.split(".")[0]!));
  const urls = new Set([...kept].map((field) => fieldSources[field]).filter(Boolean));
  const cited = records
    .filter((r) => r.status === "read" && urls.has(r.url))
    .sort((a, b) => (b.sourcePublishedOn ?? "").localeCompare(a.sourcePublishedOn ?? ""))
    .map((r) => ({
      label: r.label,
      url: r.url,
      ...(r.sourcePublishedOn ? { publishedOn: r.sourcePublishedOn } : {}),
    }));
  if (cited.length === 0) {
    return [
      {
        label: own.label,
        url: own.url,
        ...(own.publishedOn ? { publishedOn: own.publishedOn } : {}),
      },
    ];
  }
  return cited;
}
