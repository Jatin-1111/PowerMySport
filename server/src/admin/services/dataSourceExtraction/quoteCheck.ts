// ─── Does the quote exist, and does it say what the model says it says? ──────
//
// A model asked for a field and a supporting quote can invent either. This is
// the mechanical guard against that: no AI, only text comparison, so it cannot
// be talked round by a plausible-sounding answer.
//
// Two independent checks, because they fail differently:
//
//   quote in page   Is the quote really on the page? Needs the page text, so it
//                   runs only for a web page we fetched ourselves. A PDF, or a
//                   page the model browsed on its own, has no text for us to
//                   compare with, and is reported as unchecked, never as fine.
//
//   figure in quote Does each number or date that was extracted (an age, an
//                   amount, a window date) appear in its own quote? This needs no
//                   page text, so it runs for every source.
//
// Both only label. They never remove a field: the review screen starts a row
// unticked when either check fails, and a person decides.
//
// A false alarm costs a reviewer a click; a missed invention costs a parent a
// wrong figure. So matching is forgiving about what a quote may legitimately
// differ in (case, punctuation, spacing, thousands separators, an elided middle
// marked with an ellipsis) and strict about words and numbers.

/**
 * Where a quote stands against its source's text.
 * - found, partial, missing: against a web page, whose text comes out in reading
 *   order, so a quote that is not there is not there.
 * - found, partial, scattered, unmatched: against a PDF's text layer, which a table
 *   or a two-column page can scramble. "scattered" is a quote whose words and
 *   numbers are all in the PDF but not in this order, which is what a table row
 *   looks like; "unmatched" is one with words or numbers the PDF's text does not
 *   have at all. Neither is ever grounds to untick a row: the text layer can miss
 *   a scanned page or a figure in an image.
 */
export type QuoteStatus = "found" | "partial" | "missing" | "scattered" | "unmatched";
export type FigureStatus = "ok" | "mismatch";

export interface CitationChecks {
  /** What the quotes were compared with. "none": nothing to compare, so no quote verdicts. */
  against: "page-text" | "pdf-text" | "none";
  /** Top-level field → whether its quote is in the source's text. Empty when `against` is "none". */
  quotes: Record<string, QuoteStatus>;
  /** Field path ("eligibility.ageMin", "benefit.amount") → whether its figure is in its quote. */
  figures: Record<string, FigureStatus>;
  /**
   * Top-level field → how many fields were given this very quote, for a quote
   * shared by SHARED_QUOTE_FIELDS or more. One sentence cannot support a title, a
   * summary and a benefit; the quote may be on the page and still prove nothing.
   */
  shared: Record<string, number>;
}

/** A quote offered for this many fields, or more, is flagged as shared. */
export const SHARED_QUOTE_FIELDS = 3;

/** The share of a quote's words that must lie in runs found on the page for it to count as partly found. */
const PARTIAL_COVERAGE = 0.8;
/** A quote shorter than this cannot be told from a coincidence by a partial match. */
const MIN_WORDS_FOR_PARTIAL = 5;

/**
 * One spelling for text that a quote and its page may spell differently: case,
 * punctuation, spacing, and the commas inside numbers ("1,00,000" is "100000").
 * A decimal point between digits is kept ("6.28").
 */
export function normaliseForMatch(text: string): string {
  return text
    .normalize("NFKC")
    .toLowerCase()
    .replace(/(?<=\d),(?=\d)/g, "")
    .replace(/[^\p{L}\p{N}.]+/gu, " ")
    .replace(/\.(?!\d)|(?<!\d)\./g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const padded = (normalised: string) => ` ${normalised} `;
const wordsOf = (normalised: string) => normalised.split(" ").filter(Boolean);

/** Elisions are how a model shortens a quote: "…", "...", "[...]". Each part must stand alone. */
const ELLIPSIS = /\[\s*(?:\.{3}|…)\s*\]|\.{3,}|…/;

/** A matching run shorter than this is the kind of coincidence any two sentences share. */
const MIN_RUN_WORDS = 3;

/**
 * A page prepared for matching: its normalised text, its words, and where every
 * run of three words occurs. Built once per page and shared by every quote, so
 * finding a run is a lookup, not a scan of a page that can be 300,000 characters.
 */
export interface PageIndex {
  text: string;
  words: string[];
  starts: Map<string, number[]>;
}

/** `normalised` is `normaliseForMatch(pageText)`, padded or not. */
export function indexPage(normalised: string): PageIndex {
  const words = wordsOf(normalised);
  const starts = new Map<string, number[]>();
  for (let i = 0; i + MIN_RUN_WORDS <= words.length; i += 1) {
    const key = words.slice(i, i + MIN_RUN_WORDS).join(" ");
    const at = starts.get(key);
    if (at) at.push(i);
    else starts.set(key, [i]);
  }
  return { text: padded(words.join(" ")), words, starts };
}

/**
 * How many of `words` (from `lo` up to, not including, `hi`) lie in runs that
 * appear on the page. Finds the longest matching run, then does the same on what
 * is left either side of it, like a diff. That way one changed word in the middle
 * of a quote costs one word, not the whole second half.
 */
function coveredWords(words: string[], page: PageIndex, lo = 0, hi = words.length): number {
  let bestLength = 0;
  let bestStart = -1;
  for (let start = lo; start + MIN_RUN_WORDS <= hi; start += 1) {
    if (hi - start <= bestLength) break; // nothing from here on can beat the best
    const hits = page.starts.get(words.slice(start, start + MIN_RUN_WORDS).join(" "));
    if (!hits) continue;
    for (const at of hits) {
      let length = MIN_RUN_WORDS; // the first three are the key, so they match
      while (
        start + length < hi &&
        at + length < page.words.length &&
        words[start + length] === page.words[at + length]
      ) {
        length += 1;
      }
      if (length > bestLength) {
        bestLength = length;
        bestStart = start;
      }
    }
  }
  if (bestLength < MIN_RUN_WORDS) return 0;
  return (
    bestLength +
    coveredWords(words, page, lo, bestStart) +
    coveredWords(words, page, bestStart + bestLength, hi)
  );
}

/**
 * Whether `quote` is on the page. `source` is the page as `indexPage` prepared it,
 * or its normalised text, which is indexed on the spot.
 */
export function checkQuoteAgainstPage(quote: string, source: string | PageIndex): QuoteStatus {
  const page = typeof source === "string" ? indexPage(source) : source;
  const fragments = quote
    .split(ELLIPSIS)
    .map(normaliseForMatch)
    .filter((fragment) => fragment.length > 0);
  if (fragments.length === 0) return "missing";

  let total = 0;
  let matched = 0;
  let allWhole = true;
  for (const fragment of fragments) {
    const words = wordsOf(fragment);
    total += words.length;
    if (page.text.includes(padded(fragment))) {
      matched += words.length;
      continue;
    }
    allWhole = false;
    if (words.length >= MIN_WORDS_FOR_PARTIAL) matched += coveredWords(words, page);
  }
  if (allWhole) return "found";
  return matched / total >= PARTIAL_COVERAGE ? "partial" : "missing";
}

// ─── Figures ─────────────────────────────────────────────────────────────────

const ONES = [
  "zero",
  "one",
  "two",
  "three",
  "four",
  "five",
  "six",
  "seven",
  "eight",
  "nine",
  "ten",
  "eleven",
  "twelve",
  "thirteen",
  "fourteen",
  "fifteen",
  "sixteen",
  "seventeen",
  "eighteen",
  "nineteen",
];
const TENS = ["", "", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety"];

/** "fourteen", "twenty one": how a quote might write a small number out. */
function numberWords(n: number): string | null {
  if (!Number.isInteger(n) || n < 0 || n > 99) return null;
  if (n < 20) return ONES[n]!;
  const tens = TENS[Math.floor(n / 10)]!;
  return n % 10 === 0 ? tens : `${tens} ${ONES[n % 10]}`;
}

const trimNumber = (n: number): string => String(Number(n.toFixed(2)));

/** Every way an amount might be written: as is, in lakh or crore, or in thousands. */
function amountForms(value: number): string[] {
  const forms = [String(value)];
  const lakh = trimNumber(value / 1e5);
  const crore = trimNumber(value / 1e7);
  const thousand = trimNumber(value / 1e3);
  if (value >= 1e5)
    for (const unit of ["lakh", "lakhs", "lac", "lacs"]) forms.push(`${lakh} ${unit}`);
  if (value >= 1e7) for (const unit of ["crore", "crores", "cr"]) forms.push(`${crore} ${unit}`);
  if (value >= 1e3) forms.push(`${thousand}k`, `${thousand} thousand`);
  return forms;
}

const anyForm = (forms: string[], quote: string): boolean =>
  forms.some((form) => quote.includes(padded(normaliseForMatch(form))));

const MONTHS = [
  "january",
  "february",
  "march",
  "april",
  "may",
  "june",
  "july",
  "august",
  "september",
  "october",
  "november",
  "december",
];

/** A date's day and month both appear in the quote, in any usual spelling. The year is optional: quotes often leave it to the heading. */
function dateAppears(iso: string, quote: string): boolean {
  const [, month, day] = iso.split("-").map(Number) as [number, number, number];
  // Split on dots as well: "03.08.2026" is one token to the matcher, which keeps
  // the point in "6.28", but it is three numbers here.
  const tokens = new Set(quote.split(/[\s.]+/).filter(Boolean));
  const dayForms = [
    String(day),
    String(day).padStart(2, "0"),
    ...["st", "nd", "rd", "th"].map((suffix) => `${day}${suffix}`),
  ];
  const name = MONTHS[month - 1]!;
  const monthForms = [
    name,
    name.slice(0, 3),
    ...(name === "september" ? ["sept"] : []),
    String(month),
    String(month).padStart(2, "0"),
  ];
  return dayForms.some((f) => tokens.has(f)) && monthForms.some((f) => tokens.has(f));
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

/**
 * Whether each extracted number and date is in the quote given for its field.
 * A field with no quote is skipped: the review screen already says so.
 */
export function checkFigures(
  fields: Record<string, unknown>,
  citations: Record<string, string>
): Record<string, FigureStatus> {
  const out: Record<string, FigureStatus> = {};
  const quoteFor = (top: string): string | null => {
    const raw = citations[top];
    return raw ? padded(normaliseForMatch(raw)) : null;
  };

  const eligibility = isRecord(fields.eligibility) ? fields.eligibility : null;
  const eligibilityQuote = quoteFor("eligibility");
  if (eligibility && eligibilityQuote) {
    for (const key of ["ageMin", "ageMax"] as const) {
      const value = eligibility[key];
      if (typeof value !== "number") continue;
      const forms = [String(value), numberWords(value)].filter((f): f is string => Boolean(f));
      out[`eligibility.${key}`] = anyForm(forms, eligibilityQuote) ? "ok" : "mismatch";
    }
  }

  const benefit = isRecord(fields.benefit) ? fields.benefit : null;
  const benefitQuote = quoteFor("benefit");
  const amount = benefit && isRecord(benefit.amount) ? benefit.amount : null;
  if (amount && benefitQuote && typeof amount.value === "number") {
    out["benefit.amount"] = anyForm(amountForms(amount.value), benefitQuote) ? "ok" : "mismatch";
  }

  // A fee's figure must be in the cost's own quote. The cost is one row on the
  // review screen, so its figure is checked under the whole path, "cost".
  const cost = isRecord(fields.cost) ? fields.cost : null;
  const costQuote = quoteFor("cost");
  if (cost && costQuote && typeof cost.amount === "number") {
    out.cost = anyForm(amountForms(cost.amount), costQuote) ? "ok" : "mismatch";
  }

  const cycle = isRecord(fields.cycle) ? fields.cycle : null;
  const cycleQuote = quoteFor("cycle");
  if (cycle && cycleQuote) {
    for (const key of ["opensOn", "closesOn"] as const) {
      const value = cycle[key];
      if (typeof value === "string") {
        out[`cycle.${key}`] = dateAppears(value, cycleQuote) ? "ok" : "mismatch";
      }
    }
    if (Array.isArray(cycle.keyDates) && cycle.keyDates.length > 0) {
      const dates = cycle.keyDates
        .map((item) => (isRecord(item) && typeof item.date === "string" ? item.date : null))
        .filter((d): d is string => Boolean(d));
      if (dates.length > 0) {
        out["cycle.keyDates"] = dates.every((d) => dateAppears(d, cycleQuote)) ? "ok" : "mismatch";
      }
    }
  }
  return out;
}

/**
 * Both checks for one extraction. `pageText` is the text the model was shown,
 * or null when there was none to compare with (a PDF, or a page the model
 * browsed itself), in which case only the figures are checked.
 */
export function checkExtraction(
  fields: Record<string, unknown>,
  citations: Record<string, string>,
  pageText: string | null,
  kind: "page" | "pdf" = "page"
): CitationChecks {
  const figures = checkFigures(fields, citations);
  const shared = sharedQuotes(citations);
  if (pageText === null) return { against: "none", quotes: {}, figures, shared };

  const page = indexPage(normaliseForMatch(pageText));
  const quotes: Record<string, QuoteStatus> = {};
  for (const [field, quote] of Object.entries(citations)) {
    quotes[field] =
      kind === "pdf" ? checkQuoteAgainstPdf(quote, page) : checkQuoteAgainstPage(quote, page);
  }
  return { against: kind === "pdf" ? "pdf-text" : "page-text", quotes, figures, shared };
}

/** A word that carries content: any number, and any word of five letters or more. */
const isContentToken = (token: string): boolean => /\d/.test(token) || token.length >= 5;

/** At least this share of a quote's content words must be in the PDF to call it scattered. */
const SCATTERED_COVERAGE = 0.9;

/**
 * A quote against a PDF's text layer. First as a web page is checked; and when
 * that fails, whether the quote's words and numbers are all in the PDF anyway,
 * which is how a table row reads once its columns have been pulled apart. Every
 * number must be present; a word may be missing (a hyphenated line break, a
 * ligature) so long as most are there.
 */
export function checkQuoteAgainstPdf(quote: string, source: string | PageIndex): QuoteStatus {
  const page = typeof source === "string" ? indexPage(source) : source;
  const exact = checkQuoteAgainstPage(quote, page);
  if (exact === "found" || exact === "partial") return exact;

  const present = new Set(page.words);
  const content = [...new Set(wordsOf(normaliseForMatch(quote)))].filter(isContentToken);
  if (content.length === 0) return "unmatched";
  const missingNumber = content.some((t) => /\d/.test(t) && !present.has(t));
  const found = content.filter((t) => present.has(t)).length;
  return !missingNumber && found / content.length >= SCATTERED_COVERAGE ? "scattered" : "unmatched";
}

/** Fields that were all given the same quote, when that is SHARED_QUOTE_FIELDS or more. */
export function sharedQuotes(citations: Record<string, string>): Record<string, number> {
  const byQuote = new Map<string, string[]>();
  for (const [field, quote] of Object.entries(citations)) {
    const key = normaliseForMatch(quote);
    if (!key) continue;
    byQuote.set(key, [...(byQuote.get(key) ?? []), field]);
  }
  const out: Record<string, number> = {};
  for (const fields of byQuote.values()) {
    if (fields.length >= SHARED_QUOTE_FIELDS)
      for (const field of fields) out[field] = fields.length;
  }
  return out;
}
