import { STALE_AFTER_DAYS } from "../../shared/validation/opportunityFormat";
import { mapWithConcurrency, resolveSafeHttpUrl } from "./dataSourceExtraction/http";
import { daysBetween } from "./opportunityDeadlines";
import { domainOf, isAggregator, normaliseUrl } from "./opportunityDiscovery";
import { checkUrl, createRobotsLookup, type FetchLike } from "./opportunityWatch";

// ─── A second pair of eyes before an entry goes in front of parents ─────────
//
// Publishing already runs the whole record through the schema (opportunityFormat),
// which settles the things a schema can: required fields, valid dates, a window
// that does not close before it opens, an age range the right way round. This
// asks what a schema cannot: does the record read as plausible, and do its links
// still go anywhere?
//
// Everything here is advice except one thing. A finding is a "problem" only when
// the record cannot be right: a verification date in the future, or a cited link
// that no longer exists. Of those, only the first can stop a publish, because the
// offline half is what runs at publish and links are opened on request. A
// "warning" is worth a person's look and never blocks. A "note" is for
// information. Nothing is changed, and nothing is decided.
//
// Two halves with different costs:
//   offline   instant and deterministic. Runs on every publish.
//   links     opens each cited page, so it takes seconds. Runs when asked.
//
// ── What this does not do ──
// It cannot check that a quote really appears in its source. An entry does not
// keep its quotes (they live on the review submission that proposed the change),
// so there is nothing at publish time to compare against the page.

export type Severity = "problem" | "warning" | "note";

export interface Finding {
  severity: Severity;
  /** Where in the entry to look: "verified", "window", "sources", "apply", "text", "duplicates" or "links". */
  area: string;
  message: string;
}

export interface CheckableEntry {
  _id?: unknown;
  title?: string;
  summary?: string;
  selection?: string | null;
  applyUrl?: string | null;
  lastVerifiedOn?: string | null;
  steps?: string[] | null;
  keyFacts?: string[] | null;
  benefit?: { summary?: string | null } | null;
  eligibility?: {
    ageNote?: string | null;
    level?: string | null;
    academic?: string | null;
    income?: string | null;
  } | null;
  verificationNote?: string | null;
  cycle?: { label?: string | null; opensOn?: string | null; closesOn?: string | null } | null;
  sources?: Array<{ label?: string; url?: string; publishedOn?: string | null }> | null;
}

/** A source older than this before the window it supports is probably last cycle's document. */
export const SOURCE_OLDER_THAN_DAYS = 15 * 30;

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const validDate = (value: string | null | undefined): value is string =>
  typeof value === "string" && ISO_DATE.test(value) && !Number.isNaN(Date.parse(value));

const PLACEHOLDER = /\b(todo|tbd|fixme|lorem ipsum|xxx+|placeholder)\b/i;

const normaliseTitle = (title: string): string =>
  title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

/** Pure: a saved entry, today's date, and the other entries' titles in; findings out. */
export function checkOpportunityOffline(
  entry: CheckableEntry,
  today: string,
  others: Array<{ slug: string; title: string }> = []
): Finding[] {
  const findings: Finding[] = [];
  const add = (severity: Severity, area: string, message: string) =>
    findings.push({ severity, area, message });

  const verified = entry.lastVerifiedOn;
  const sources = entry.sources ?? [];
  const opensOn = entry.cycle?.opensOn;
  const closesOn = entry.cycle?.closesOn;

  // ── Verification ──
  if (validDate(verified)) {
    if (verified > today) {
      add(
        "problem",
        "verified",
        `Marked verified on ${verified}, which is in the future. Verify it again today.`
      );
    } else if (daysBetween(verified, today) > STALE_AFTER_DAYS) {
      add(
        "warning",
        "verified",
        `Last verified ${verified}, over a year ago. Parents are shown this date. Check the sources and verify it again.`
      );
    }
  }
  const publishedDates = sources.map((s) => s.publishedOn).filter(validDate);
  const newest = publishedDates.sort().at(-1);
  if (validDate(verified) && newest && verified < newest) {
    add(
      "warning",
      "verified",
      `Verified on ${verified}, before the newest source was published (${newest}). It cannot have been checked against that document.`
    );
  }

  // ── The window ──
  if (validDate(closesOn) && closesOn < today) {
    add(
      "warning",
      "window",
      `The window closed on ${closesOn}. Parents will see a closed entry; add the next cycle's dates, or leave it unpublished.`
    );
  }
  const label = entry.cycle?.label?.match(/\d{4}/)?.[0];
  if (label) {
    const start = Number(label);
    for (const [name, date] of [
      ["opens", opensOn],
      ["closes", closesOn],
    ] as const) {
      if (validDate(date)) {
        const year = Number(date.slice(0, 4));
        if (year < start || year > start + 1) {
          add(
            "warning",
            "window",
            `The cycle is labelled "${entry.cycle?.label}" but the window ${name} on ${date}.`
          );
        }
      }
    }
  }

  // ── Sources ──
  const reference = validDate(closesOn) ? closesOn : validDate(opensOn) ? opensOn : null;
  if (reference && newest && daysBetween(newest, reference) > SOURCE_OLDER_THAN_DAYS) {
    add(
      "warning",
      "sources",
      `The newest source was published ${newest}, well before this window (${reference}). It may be last cycle's document.`
    );
  }
  if (sources.length > 0 && publishedDates.length === 0) {
    add(
      "note",
      "sources",
      "No source says when it was published, so there is no way to tell how recent the rules are."
    );
  }
  const seen = new Set<string>();
  for (const source of sources) {
    if (!source.url) continue;
    const key = normaliseUrl(source.url) ?? source.url;
    if (seen.has(key)) {
      add("warning", "sources", `The same source is listed twice: ${source.url}`);
    }
    seen.add(key);
    if (isAggregator(domainOf(source.url))) {
      add(
        "warning",
        "sources",
        `"${source.label ?? source.url}" is a listing site, not the source of the rules. Cite the official page.`
      );
    }
    if (/^http:\/\//i.test(source.url)) {
      add("note", "sources", `"${source.label ?? source.url}" uses http, not https.`);
    }
  }

  // ── How to get it ──
  if ((entry.selection === "scouted" || entry.selection === "nominated") && entry.applyUrl) {
    add(
      "warning",
      "apply",
      `Selection is "${entry.selection}", which has no application, but an apply link is set. A parent would look for a form that does not exist.`
    );
  }
  if (entry.selection === "apply" && !entry.applyUrl) {
    add("warning", "apply", 'Selection is "apply" but there is no apply link.');
  }
  if ((entry.steps ?? []).length === 0) {
    add("note", "text", "No steps. Parents are not told what to do first.");
  }

  // ── Text ──
  const text: Array<[string, string | null | undefined]> = [
    ["the title", entry.title],
    ["the summary", entry.summary],
    ["the benefit", entry.benefit?.summary],
    ["the age note", entry.eligibility?.ageNote],
    ["the level", entry.eligibility?.level],
    ["the academic bar", entry.eligibility?.academic],
    ["the income rule", entry.eligibility?.income],
    ["the verification note", entry.verificationNote],
    ...(entry.steps ?? []).map((s, i): [string, string] => [`step ${i + 1}`, s]),
    ...(entry.keyFacts ?? []).map((s, i): [string, string] => [`key fact ${i + 1}`, s]),
  ];
  for (const [where, value] of text) {
    const hit = value?.match(PLACEHOLDER)?.[0];
    if (hit) add("warning", "text", `Looks like placeholder text ("${hit}") in ${where}.`);
  }

  // ── Other entries ──
  if (entry.title) {
    const mine = normaliseTitle(entry.title);
    const twin = others.find((o) => normaliseTitle(o.title) === mine);
    if (twin) {
      add("warning", "duplicates", `Another entry has the same title (${twin.slug}).`);
    }
  }

  return findings;
}

const ORDER: Record<Severity, number> = { problem: 0, warning: 1, note: 2 };
export const sortFindings = (findings: Finding[]): Finding[] =>
  [...findings].sort((a, b) => ORDER[a.severity] - ORDER[b.severity]);

// ─── Links ───────────────────────────────────────────────────────────────────

export interface LinkResult {
  url: string;
  /** What the link is: "Apply link", or a source's label. */
  label: string;
  status: "ok" | "gone" | "moved" | "unchecked";
  note?: string;
}

const LINK_TIMEOUT_MS = 8_000;
const LINK_CONCURRENCY = 3;

/**
 * Open each cited page and the apply link once. A site that turns our server away
 * (a 403, a bot check, robots.txt) is "unchecked", never "broken": half the
 * government sites do this, and it says nothing about whether a parent's browser
 * can open them. Only a page that is gone, or a file that became a page, is
 * flagged as wrong.
 */
export async function checkOpportunityLinks(
  entry: CheckableEntry,
  deps: { fetchImpl?: FetchLike; resolveUrl?: (raw: string) => Promise<string | null> } = {}
): Promise<{ findings: Finding[]; links: LinkResult[] }> {
  const fetchImpl = deps.fetchImpl ?? ((url, init) => fetch(url, init));
  const resolveUrl = deps.resolveUrl ?? resolveSafeHttpUrl;
  const robotsFor = createRobotsLookup(fetchImpl);

  const wanted: Array<{ url: string; label: string; isApply: boolean }> = [];
  const seen = new Set<string>();
  const want = (url: string | null | undefined, label: string, isApply: boolean) => {
    if (!url || !/^https?:\/\//i.test(url)) return;
    const key = normaliseUrl(url) ?? url;
    if (seen.has(key)) return;
    seen.add(key);
    wanted.push({ url, label, isApply });
  };
  want(entry.applyUrl, "Apply link", true);
  for (const source of entry.sources ?? []) {
    want(source.url, source.label ?? source.url ?? "Source", false);
  }

  const links = await mapWithConcurrency(wanted, LINK_CONCURRENCY, async (item) => {
    const result = await checkUrl(item.url, {
      fetchImpl,
      resolveUrl,
      robotsFor,
      timeoutMs: LINK_TIMEOUT_MS,
    });
    const link: LinkResult = {
      url: item.url,
      label: item.label,
      status:
        result.status === "ok"
          ? "ok"
          : result.status === "gone"
            ? "gone"
            : result.status === "moved"
              ? "moved"
              : "unchecked",
      ...(result.note ? { note: result.note } : {}),
    };
    return { item, link };
  });

  const findings: Finding[] = [];
  for (const { item, link } of links) {
    if (link.status === "gone") {
      findings.push({
        severity: "problem",
        area: "links",
        message: `${item.label} no longer exists (${item.url}). ${
          item.isApply ? "Parents would be sent nowhere." : "Find where it moved."
        }`,
      });
    } else if (link.status === "moved") {
      findings.push({
        severity: "warning",
        area: "links",
        message: `${item.label} used to be a file and now leads to a page (${item.url}). Find the document's new address.`,
      });
    } else if (link.status === "unchecked") {
      findings.push({
        severity: "note",
        area: "links",
        message: `Could not check ${item.label} from our server (${link.note ?? "no answer"}). Open it yourself before publishing.`,
      });
    }
  }
  return { findings, links: links.map((l) => l.link) };
}
