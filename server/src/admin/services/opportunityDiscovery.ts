import { Opportunity } from "../../shared/models/Opportunity";
import { OpportunityLead } from "../../shared/models/OpportunityLead";
import { SUPPORTED_SPORTS } from "../../shared/constants/supportedSports";
import { getClient } from "./dataSourceExtraction/gemini";
import { log as __rootLog } from "../../utils/logger";

const log = __rootLog.child("opportunity-discovery");

// ─── Finding schemes we do not cover yet ────────────────────────────────────
//
// Leads, never data. An AI web search is good at finding that something
// exists and bad at getting its figures right, which is exactly what went
// wrong with the old scholarship scraper. So nothing found here is stored as
// a fact: each result becomes a lead a person can dismiss, or read through
// the normal source review, where every field is checked against a quote.
//
// ── Where a lead's link comes from ──
// Only from the search results the grounding tool returns, never from the
// model's own text: a model asked for a URL will invent a plausible one. The
// model is shown the numbered results and may only point at one of them.
// Those results arrive as Google redirect links and are resolved to the real
// address before anything is stored.

/** Sports searched for specifically. All-sports searches run once regardless. */
export const DISCOVERY_SPORTS = ["tennis"];

/**
 * Sites that list schemes but are not their source. Kept as leads, because
 * they are how schemes get found, but flagged so nobody cites them.
 */
const AGGREGATOR_DOMAINS = [
  "buddy4study.com",
  "scholarships.net.in",
  "collegedunia.com",
  "shiksha.com",
  "careers360.com",
  "jagranjosh.com",
  "vidhyaa.in",
  "indiaeducation.net",
  "wikipedia.org",
];

/** Tried in order; each is verified to support the googleSearch tool. */
const MODEL_CANDIDATES = ["gemini-2.5-flash", "gemini-3.5-flash", "gemini-2.5-flash-lite"];

export interface DiscoveryQuery {
  track: "admission" | "scholarship";
  sportSlug?: string;
  text: string;
}

/** The searches for one run. Adding a sport to DISCOVERY_SPORTS adds its searches. */
export function discoveryQueries(year: number): DiscoveryQuery[] {
  const allSports: DiscoveryQuery[] = [
    {
      track: "scholarship",
      text: `state government sports scholarship scheme for school and junior athletes in India ${year}: official notifications`,
    },
    {
      track: "scholarship",
      text: `company or foundation sports scholarship for junior athletes in India ${year} with an application process`,
    },
    {
      track: "admission",
      text: `sports quota admission ${year} Indian universities colleges: official admission bulletins and trial notices`,
    },
    {
      track: "admission",
      text: `sports school, sports hostel or academy selection trials for children in India ${year}`,
    },
  ];
  const perSport = DISCOVERY_SPORTS.flatMap((slug): DiscoveryQuery[] => {
    const sport = SUPPORTED_SPORTS.find((s) => s.slug === slug)?.name ?? slug;
    return [
      {
        track: "scholarship",
        sportSlug: slug,
        text: `${sport} scholarship, grant or funding programme for junior players in India or Asia ${year}`,
      },
      {
        track: "admission",
        sportSlug: slug,
        text: `${sport} college scholarships and university admission for junior ${sport.toLowerCase()} players from India ${year}`,
      },
    ];
  });
  return [...allSports, ...perSport];
}

// ─── Pure helpers ────────────────────────────────────────────────────────────

const TRACKING_PARAM = /^(utm_|fbclid$|gclid$|ref$|source$)/i;

/** One spelling per page, so the same result found twice is one lead. */
export function normaliseUrl(raw: string): string | null {
  try {
    const url = new URL(raw.trim());
    if (!/^https?:$/.test(url.protocol)) return null;
    url.hash = "";
    for (const key of [...url.searchParams.keys()]) {
      if (TRACKING_PARAM.test(key)) url.searchParams.delete(key);
    }
    url.hostname = url.hostname.toLowerCase().replace(/^www\./, "");
    const text = url.toString();
    return text.endsWith("/") && url.pathname !== "/" ? text.slice(0, -1) : text;
  } catch {
    return null;
  }
}

export const domainOf = (url: string): string => {
  try {
    return new URL(url).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return "";
  }
};

export const isAggregator = (domain: string): boolean =>
  AGGREGATOR_DOMAINS.some((d) => domain === d || domain.endsWith(`.${d}`));

/** Lowercased words only, for spotting a scheme we already have under the same name. */
export const nameKey = (name: string): string =>
  name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\b(the|of|for|and|scheme|scholarship|programme|program)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();

export interface LeadCandidate {
  name: string;
  owner?: string;
  track: "admission" | "scholarship";
  why?: string;
  url: string;
}

/**
 * The model's list, mapped onto the real search results. A candidate that
 * does not point at one of the numbered results is dropped: that is the rule
 * that keeps invented links out.
 */
export function candidatesFromModel(
  raw: unknown,
  results: Array<{ url: string }>,
  fallbackTrack: "admission" | "scholarship"
): LeadCandidate[] {
  if (!Array.isArray(raw)) return [];
  const out: LeadCandidate[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const r = item as Record<string, unknown>;
    const name = typeof r.name === "string" ? r.name.trim().slice(0, 200) : "";
    const index = typeof r.sourceIndex === "number" ? r.sourceIndex : Number.NaN;
    const result = Number.isInteger(index) ? results[index - 1] : undefined;
    if (!name || !result) continue;
    const track = r.track === "admission" || r.track === "scholarship" ? r.track : fallbackTrack;
    out.push({
      name,
      track,
      url: result.url,
      ...(typeof r.owner === "string" && r.owner.trim()
        ? { owner: r.owner.trim().slice(0, 200) }
        : {}),
      ...(typeof r.why === "string" && r.why.trim() ? { why: r.why.trim().slice(0, 400) } : {}),
    });
  }
  return out;
}

// ─── Model calls (injectable for tests) ──────────────────────────────────────

export interface SearchOutcome {
  findings: string;
  /** Grounding results, in the order the tool returned them; links not yet resolved. */
  results: Array<{ uri: string; title?: string }>;
}

export interface DiscoveryDeps {
  search?: (query: string) => Promise<SearchOutcome | null>;
  format?: (prompt: string) => Promise<unknown>;
  resolveRedirect?: (uri: string) => Promise<string | null>;
}

async function geminiSearch(query: string): Promise<SearchOutcome | null> {
  const genAI = getClient();
  if (!genAI) return null;
  for (const model of MODEL_CANDIDATES) {
    try {
      const res = await genAI.models.generateContent({
        model,
        contents:
          `Search the web for: ${query}\n\n` +
          "List each distinct scheme, admission route or programme you find, with who runs it and what page describes it. " +
          "Prefer official pages (government, university, federation) over news or listing sites. Report only what the results say.",
        config: { tools: [{ googleSearch: {} }], temperature: 0.2 },
      });
      const findings = (res.text ?? "").trim();
      const chunks = res.candidates?.[0]?.groundingMetadata?.groundingChunks ?? [];
      const results = chunks
        .map((chunk) => ({
          uri: chunk.web?.uri ?? "",
          ...(chunk.web?.title ? { title: chunk.web.title } : {}),
        }))
        .filter((r) => r.uri);
      if (findings && results.length) return { findings, results };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      log.warn(`search via ${model} failed: ${msg.slice(0, 160)}`);
    }
  }
  return null;
}

async function geminiFormat(prompt: string): Promise<unknown> {
  const genAI = getClient();
  if (!genAI) return null;
  for (const model of MODEL_CANDIDATES) {
    try {
      const res = await genAI.models.generateContent({
        model,
        contents: prompt,
        config: { responseMimeType: "application/json", temperature: 0 },
      });
      const text = (res.text ?? "")
        .replace(/^```[a-z]*\n?/i, "")
        .replace(/```$/i, "")
        .trim();
      return JSON.parse(text);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      log.warn(`formatting via ${model} failed: ${msg.slice(0, 160)}`);
    }
  }
  return null;
}

/**
 * Google's grounding links are redirects through vertexaisearch.cloud.google.com.
 * The real address is in the redirect's Location header; the page itself is
 * not fetched here.
 */
async function resolveGroundingRedirect(uri: string): Promise<string | null> {
  if (!/grounding-api-redirect/.test(uri)) return uri;
  try {
    const res = await fetch(uri, { redirect: "manual", signal: AbortSignal.timeout(10_000) });
    const location = res.headers.get("location");
    return location && /^https?:\/\//i.test(location) ? location : null;
  } catch {
    return null;
  }
}

function formatPrompt(query: DiscoveryQuery, outcome: SearchOutcome): string {
  const numbered = outcome.results
    .map((r, i) => `[${i + 1}] ${r.title ?? "(untitled)"}`)
    .join("\n");
  return `Below are findings from a web search for "${query.text}", and the numbered search results they came from.

Return a JSON array with one object per distinct scheme, admission route or programme for young athletes that the findings describe:
- "name": its own name.
- "owner": who runs it, or null.
- "track": "admission" for a way into a school, university or academy; "scholarship" for money, grants or funded support.
- "why": one short sentence on what it is.
- "sourceIndex": the number of the search result that describes it. Required. If no numbered result describes it, leave the item out.

Use only what the findings say. Return [] if they describe nothing relevant. Return ONLY the JSON array.

Search results:
${numbered}

Findings:
"""
${outcome.findings}
"""`;
}

// ─── The run ─────────────────────────────────────────────────────────────────

export interface DiscoverySummary {
  queries: number;
  found: number;
  newLeads: number;
  alreadyKnown: number;
}

let running = false;
export const isDiscoveryRunning = () => running;

export async function runOpportunityDiscovery(deps: DiscoveryDeps = {}): Promise<DiscoverySummary> {
  if (running) throw new Error("A search for new leads is already running.");
  running = true;
  try {
    const search = deps.search ?? geminiSearch;
    const format = deps.format ?? geminiFormat;
    const resolveRedirect = deps.resolveRedirect ?? resolveGroundingRedirect;

    // What we already cover, by link and by name, so a lead is only ever
    // something new.
    const entries = await Opportunity.find({})
      .select("title sources.url watchUrls applyUrl")
      .lean();
    const knownUrls = new Set(
      entries
        .flatMap((e) => [
          ...(e.sources ?? []).map((s) => s.url),
          ...(e.watchUrls ?? []),
          e.applyUrl,
        ])
        .filter((u): u is string => Boolean(u))
        .map((u) => normaliseUrl(u))
        .filter((u): u is string => Boolean(u))
    );
    const knownNames = new Set(entries.map((e) => nameKey(e.title)).filter(Boolean));

    const queries = discoveryQueries(new Date().getFullYear());
    const now = new Date();
    let found = 0;
    let newLeads = 0;
    let alreadyKnown = 0;

    for (const query of queries) {
      const outcome = await search(query.text);
      if (!outcome) continue;

      const resolved: Array<{ url: string }> = [];
      for (const result of outcome.results) {
        const real = await resolveRedirect(result.uri);
        const url = real ? normaliseUrl(real) : null;
        // Keep the numbering intact even for a result that did not resolve,
        // so the model's sourceIndex still points at the right one.
        resolved.push({ url: url ?? "" });
      }

      const candidates = candidatesFromModel(
        await format(formatPrompt(query, outcome)),
        resolved,
        query.track
      ).filter((c) => c.url);
      found += candidates.length;

      for (const candidate of candidates) {
        if (knownUrls.has(candidate.url) || knownNames.has(nameKey(candidate.name))) {
          alreadyKnown += 1;
          continue;
        }
        const domain = domainOf(candidate.url);
        const existing = await OpportunityLead.findOne({ url: candidate.url }).select("_id").lean();
        if (existing) {
          // Seen before: count it, but never resurrect one a person dismissed.
          await OpportunityLead.updateOne(
            { _id: existing._id },
            { $set: { lastFoundAt: now }, $inc: { timesFound: 1 } }
          );
          alreadyKnown += 1;
          continue;
        }
        await OpportunityLead.create({
          ...candidate,
          domain,
          isAggregator: isAggregator(domain),
          query: query.text,
          ...(query.sportSlug ? { sportSlug: query.sportSlug } : {}),
          status: "new",
          firstFoundAt: now,
          lastFoundAt: now,
        });
        knownUrls.add(candidate.url);
        newLeads += 1;
      }
    }

    const summary = { queries: queries.length, found, newLeads, alreadyKnown };
    log.info("Search for new leads finished", summary);
    return summary;
  } finally {
    running = false;
  }
}
