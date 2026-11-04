import { EditionDocument, EditionDocumentKind, ValidEdition } from "./editions";
import {
  decodeAttributeEntities,
  htmlToText,
  stripSiteChrome,
  fetchPageHtml,
  mapWithConcurrency,
} from "./http";
import { getClient, jsonExtractionCall } from "./gemini";
import { asString, sportNameFromSlug } from "./valueParsing";

// ─── Detail-page enrichment ───────────────────────────────────────────────────
//
// A federation calendar is an index, not a record: each cell links to the
// event's own page, and that page is the ONLY place the fact sheet, acceptance
// lists, host academy and exact category exist. This pass follows those links.
//
// It runs as its own admin-triggered step rather than inside extraction,
// because extraction happens synchronously inside the HTTP request and a full
// tennis calendar is ~150 detail pages — enough Gemini calls to run past the
// load balancer's timeout. Splitting it also means quota is only spent on
// submissions a reviewer actually intends to keep.

/** Fetches at most this many detail pages per run; anything beyond is reported, never silently dropped. */
const MAX_DETAIL_PAGES = 150;

const DETAIL_FETCH_CONCURRENCY = 5;

/** Detail pages read together in one Gemini call — each is ~1.5K chars after chrome-stripping. */
const DETAIL_BATCH_SIZE = 6;

const DETAIL_BATCH_CONCURRENCY = 4;

const DETAIL_TEXT_CHARS = 2_000;

/** Anchors pointing at a downloadable file count as documents whatever their label says. */
const DOCUMENT_EXTENSION = /\.(pdf|docx?|xlsx?|pptx?|csv)(?:$|\?|#)/i;

/**
 * …as do anchors whose label OR url names one.
 *
 * Both halves are load-bearing. The label alone catches ITF events, which link
 * an HTML fact sheet page rather than a PDF. The url alone catches AITA's
 * acceptance lists, where "Acceptance List" is a heading ABOVE the links and
 * the links themselves read "Girls Under 18" — only `/acceptancelist?…` in the
 * href identifies them.
 */
const DOCUMENT_LABEL =
  /fact\s*sheet|acceptance|entry\s*(?:form|list)|entries|\bdraws?\b|\bresults?\b|schedule|brochure|prospectus|circular|hotel|rules?\b/i;

/** Chrome that survives stripping — a bare social link is not a tournament document. */
const NON_DOCUMENT_HOSTS =
  /(?:^|\.)(?:twitter|x|facebook|instagram|youtube|youtu|linkedin|whatsapp|pinterest|google|goo)\.[a-z.]+$/i;

function classifyDocumentKind(label: string, url: string): EditionDocumentKind {
  const haystack = `${label} ${url}`;
  if (/fact\s*sheet/i.test(haystack)) return "factSheet";
  if (/acceptance/i.test(haystack)) return "acceptanceList";
  if (/entry|entries|registration/i.test(haystack)) return "entryForm";
  if (/\bdraws?\b/i.test(haystack)) return "draw";
  if (/\bresults?\b/i.test(haystack)) return "results";
  return "other";
}

/**
 * Pulls document links straight out of the detail page's HTML.
 *
 * Deliberately deterministic and independent of the AI pass: fact sheets are
 * the single thing this feature exists to surface, so they must still land when
 * the Gemini quota is exhausted — the failure mode that already bites this
 * pipeline hardest. Parsed from HTML rather than from the flattened text so the
 * href is exact, which matters for AITA's signed blob URLs.
 */
export function harvestDocuments(html: string, baseUrl: string): EditionDocument[] {
  const documents: EditionDocument[] = [];
  const seen = new Set<string>();
  const anchor = /<a\b[^>]*\bhref\s*=\s*("([^"]*)"|'([^']*)')[^>]*>([\s\S]*?)<\/a>/gi;

  let match: RegExpExecArray | null;
  while ((match = anchor.exec(html)) !== null) {
    const href = decodeAttributeEntities((match[2] ?? match[3] ?? "").trim());
    const label = decodeAttributeEntities(
      (match[4] ?? "")
        .replace(/<[^>]+>/g, " ")
        .replace(/\s+/g, " ")
        .trim()
    );
    if (!href || !label) continue;

    let absolute: URL;
    try {
      absolute = new URL(href, baseUrl);
    } catch {
      continue;
    }
    if (absolute.protocol !== "http:" && absolute.protocol !== "https:") continue;
    if (NON_DOCUMENT_HOSTS.test(absolute.hostname)) continue;

    const url = absolute.toString();
    if (!DOCUMENT_EXTENSION.test(absolute.pathname) && !DOCUMENT_LABEL.test(`${label} ${url}`)) {
      continue;
    }
    if (seen.has(url)) continue;
    seen.add(url);
    documents.push({ label, url, kind: classifyDocumentKind(label, url) });
  }

  // Rank before capping. Chrome-stripping is imperfect, and whatever nav
  // survives it sits ABOVE the content in source order — on a raw AITA page the
  // site-wide Forms menu alone contributes twelve generic PDFs (constitution,
  // code of conduct, circuit rules), which under a positional cap would push
  // out the one fact sheet the page exists to publish.
  const rank: Record<EditionDocumentKind, number> = {
    factSheet: 0,
    acceptanceList: 1,
    entryForm: 2,
    draw: 3,
    results: 4,
    other: 5,
  };
  return documents
    .map((document, index) => ({ document, index }))
    .sort((a, b) => rank[a.document.kind] - rank[b.document.kind] || a.index - b.index)
    .slice(0, 12)
    .map((entry) => entry.document);
}

/**
 * True when the page names a date within a week of the one we already hold.
 *
 * Guards against a mis-linked or recycled detail page grafting another event's
 * venue and fact sheet onto this edition. Every candidate reading is tried
 * (DD-MM-YYYY and MM-DD-YYYY are indistinguishable in the source, and AITA
 * prints the ambiguous form), so this only rejects a page when NO reading lands
 * near the calendar date. A page stating no date at all is accepted — plenty of
 * federation pages omit it, and rejecting those would lose real fact sheets.
 */
export function detailPageDateAgrees(text: string, startDate: string): boolean {
  const expected = new Date(`${startDate}T00:00:00.000Z`).getTime();
  if (Number.isNaN(expected)) return true;
  const weekMs = 7 * 24 * 60 * 60 * 1000;

  const candidates: number[] = [];
  for (const [, a, b, c] of text.matchAll(/\b(\d{1,4})[-/.](\d{1,2})[-/.](\d{2,4})\b/g)) {
    const [x, y, z] = [Number(a), Number(b), Number(c)];
    // DD-MM-YYYY, MM-DD-YYYY, YYYY-MM-DD — whichever the source meant.
    candidates.push(Date.UTC(z, y - 1, x), Date.UTC(z, x - 1, y), Date.UTC(x, y - 1, z));
  }
  if (candidates.length === 0) return true;
  return candidates.some((t) => !Number.isNaN(t) && Math.abs(t - expected) <= weekMs);
}

function detailPromptRules(): string {
  return `Return a JSON array with one object per page you could read, each with exactly these keys:
- "page": the integer from that page's "### PAGE" marker.
- "officialName": the event's full official title as printed on the page, or null.
- "organiser": the club, academy or association hosting the event, or null.
- "venue": the ground/stadium, if named separately from the organiser, or null.
- "city": city, or null.
- "state": state or union territory, or null.
- "category": the age/gender category exactly as printed, e.g. "Under 12 Under 16" or "Men Women", or null.

Rules:
- Use ONLY what that page states. NEVER carry a value from one page onto another — the pages describe different events that often share a series name.
- Omit a page entirely if it contains no tournament information.
- Ignore navigation, news headlines, social feeds and footer/contact text.
- Do not include dates, links or file names — those are handled separately.
- Return ONLY the JSON array. No markdown fences, no commentary.`;
}

function buildDetailBatchPrompt(
  sportName: string,
  pages: Array<{ page: number; text: string }>
): string {
  const body = pages.map((p) => `### PAGE ${p.page}\n${p.text}`).join("\n\n");
  return `Below are individual tournament pages from the official ${sportName} federation website in India. Extract each one's details.\n\n${detailPromptRules()}\n\n${body}`;
}

export interface DetailEnrichmentResult {
  editions: ValidEdition[];
  /** Editions that gained at least one document. */
  documentsFound: number;
  enriched: number;
  warnings: string[];
}

/**
 * Follows each edition's `detailUrl` and merges what that page adds.
 *
 * `name` and `startDate` are never touched: together with sportSlug they are
 * the TournamentEdition upsert key, so rewriting them here would orphan the
 * live row instead of updating it. The full title from the detail page is kept
 * alongside as `officialName`.
 */
export async function enrichEditionsWithDetailPages(
  editions: ValidEdition[],
  sportSlug: string,
  { refresh = false }: { refresh?: boolean } = {}
): Promise<DetailEnrichmentResult> {
  const warnings: string[] = [];
  // Editions already read are skipped, so a second run costs only the ones a
  // failed batch left behind. This is not an optimisation — the AI quota
  // genuinely runs out mid-run (observed: 4 of 19 batches lost to 429s), and
  // without it "run it again to fill in the rest" would re-spend the whole
  // budget on pages already done and never reach the stragglers.
  // `officialName` is the marker because only the AI pass sets it; documents
  // are a weaker signal since a page may legitimately publish none.
  const alreadyRead = refresh ? 0 : editions.filter((e) => e.detailUrl && e.officialName).length;
  const linked = editions.filter((e) => e.detailUrl && (refresh || !e.officialName));

  if (alreadyRead > 0) {
    warnings.push(`${alreadyRead} entry(s) already had their details and were skipped.`);
  }
  if (linked.length === 0 && alreadyRead > 0) {
    return {
      editions,
      documentsFound: editions.filter((e) => e.documents?.length).length,
      enriched: 0,
      warnings,
    };
  }
  if (linked.length === 0) {
    return {
      editions,
      documentsFound: 0,
      enriched: 0,
      warnings: [
        "No entry carried a per-tournament link, so there were no detail pages to follow. Re-extract this source first — links are only captured by extractions run after this feature was added.",
      ],
    };
  }

  const targets = linked.slice(0, MAX_DETAIL_PAGES);
  if (linked.length > targets.length) {
    warnings.push(
      `Only the first ${targets.length} of ${linked.length} linked entries were followed this run. Run it again to continue with the rest.`
    );
  }

  // ── Fetch every detail page, harvesting documents as we go ──
  interface FetchedDetail {
    edition: ValidEdition;
    text: string | null;
    mismatched: boolean;
  }

  const fetched = await mapWithConcurrency<ValidEdition, FetchedDetail>(
    targets,
    DETAIL_FETCH_CONCURRENCY,
    async (edition) => {
      const page = await fetchPageHtml(edition.detailUrl!);
      if (!page) return { edition, text: null, mismatched: false };

      const stripped = stripSiteChrome(page.html);
      const text = htmlToText(stripped, page.finalUrl).slice(0, DETAIL_TEXT_CHARS);

      if (!detailPageDateAgrees(text, edition.startDate)) {
        return { edition, text: null, mismatched: true };
      }
      const documents = harvestDocuments(stripped, page.finalUrl);
      if (documents.length) edition.documents = documents;
      return { edition, text, mismatched: false };
    }
  );

  const unreachable = fetched.filter((f) => !f.text && !f.mismatched).length;
  const mismatched = fetched.filter((f) => f.mismatched).length;
  if (unreachable)
    warnings.push(`${unreachable} detail page(s) could not be fetched and were left as-is.`);
  if (mismatched) {
    warnings.push(
      `${mismatched} detail page(s) named a date more than a week from the calendar entry and were skipped as probable mis-links.`
    );
  }

  // Counted across the whole draft, not just this run's slice — after a
  // partial re-run the admin needs the running total, not "3 of 110".
  const documentsFound = editions.filter((e) => e.documents?.length).length;

  // ── Read the prose fields the AI is actually needed for ──
  const readable = fetched
    .map((f, index) => ({ index, edition: f.edition, text: f.text }))
    .filter((f): f is { index: number; edition: ValidEdition; text: string } => Boolean(f.text));

  const genAI = getClient();
  if (!genAI) {
    warnings.push("No AI credentials configured, so only document links were collected.");
    return { editions, documentsFound, enriched: 0, warnings };
  }

  const batches: Array<Array<{ index: number; edition: ValidEdition; text: string }>> = [];
  for (let i = 0; i < readable.length; i += DETAIL_BATCH_SIZE) {
    batches.push(readable.slice(i, i + DETAIL_BATCH_SIZE));
  }

  const sportName = sportNameFromSlug(sportSlug);
  let enriched = 0;
  let failedBatches = 0;

  const batchResults = await mapWithConcurrency(
    batches,
    DETAIL_BATCH_CONCURRENCY,
    async (batch) => {
      const prompt = buildDetailBatchPrompt(
        sportName,
        batch.map((b) => ({ page: b.index, text: b.text }))
      );
      return { batch, outcome: await jsonExtractionCall(genAI, prompt, "array") };
    }
  );

  for (const { batch, outcome } of batchResults) {
    if (!Array.isArray(outcome.data)) {
      failedBatches++;
      continue;
    }
    const byIndex = new Map(batch.map((b) => [b.index, b.edition]));
    for (const row of outcome.data as Array<Record<string, unknown>>) {
      const edition = byIndex.get(Number(row?.page));
      if (!edition) continue;
      // The calendar is authoritative for anything it already stated; the
      // detail page only fills gaps and adds fields the calendar never had.
      edition.officialName = asString(row.officialName) ?? edition.officialName;
      edition.organiser = asString(row.organiser) ?? edition.organiser;
      edition.venue = edition.venue ?? asString(row.venue) ?? asString(row.organiser);
      edition.city = edition.city ?? asString(row.city);
      edition.state = asString(row.state) ?? edition.state;
      edition.category = asString(row.category) ?? edition.category;
      if (!edition.ageGroups.length) {
        edition.ageGroups = parseCategoryToAgeGroups(asString(row.category));
      }
      enriched++;
    }
  }

  if (failedBatches) {
    warnings.push(
      `${failedBatches} of ${batches.length} detail batches failed to read (usually AI quota) — their document links were still saved. Run it again to fill in the rest.`
    );
  }

  return { editions, documentsFound, enriched, warnings };
}

/**
 * Turns a printed category into age-group tags — "Under 12 Under 16" is two
 * groups run-on with no delimiter, which is how AITA prints a shared event.
 * Only used when the calendar gave no age columns to work from.
 */
export function parseCategoryToAgeGroups(category: string | undefined): string[] {
  if (!category) return [];
  const groups = [...category.matchAll(/under[\s-]*(\d{1,2})/gi)].map((m) => `Under-${m[1]}`);
  for (const [label] of category.matchAll(/\b(men|women|senior|boys|girls)\b/gi)) {
    const normalized = label.charAt(0).toUpperCase() + label.slice(1).toLowerCase();
    if (!groups.includes(normalized)) groups.push(normalized);
  }
  return [...new Set(groups)];
}
