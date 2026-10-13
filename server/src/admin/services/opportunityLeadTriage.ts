import { Opportunity } from "../../shared/models/Opportunity";
import { OpportunityLead, LEAD_FITS, type LeadFit } from "../../shared/models/OpportunityLead";
import {
  domainOf,
  geminiFormat,
  geminiSearch,
  isAggregator,
  nameKey,
  normaliseUrl,
  resolveGroundingRedirect,
} from "./opportunityDiscovery";
import { log as __rootLog } from "../../utils/logger";

const log = __rootLog.child("opportunity-discovery");

// ─── Sorting the month's leads so a person reads the good ones first ────────
//
// The monthly search returns a couple of dozen leads and most are not worth a
// person's time: a Facebook post, a news piece, a scheme we already cover under
// another name. Triage reads each one and writes down what it makes of it. It
// advises; it does not decide.
//
// Three layers, cheapest and most certain first:
//   1. Rules, no AI. A social media post is never an official source.
//   2. One batched AI judgment of how well each remaining lead fits.
//   3. For an aggregator lead (a listing site, never the source to cite), a
//      search for the official page behind it.
//
// ── What it may do on its own ──
// Dismiss a lead that is clearly not a scheme, and only that. A dismissal made
// here is marked `autoDismissed`, carries its reason, and sits in its own list
// with a Restore button; restoring locks the lead so it is never dismissed
// again. Everything else (a fit label, a possible duplicate, an official page)
// is shown beside the lead and left for a person.
//
// ── Why the AI half is fenced in ──
// The model sees only the lead's own text, is told to answer "low" when unsure,
// and cannot dismiss more than half of a batch: a response that calls most of
// the month "none" is far likelier to be a bad response than a bad month, so it
// is kept as labels and nothing is dismissed. Any link comes from real search
// results and never from the model's own text, as in discovery.

const SOCIAL_DOMAINS = [
  "facebook.com",
  "fb.com",
  "instagram.com",
  "youtube.com",
  "youtu.be",
  "x.com",
  "twitter.com",
  "linkedin.com",
  "reddit.com",
  "quora.com",
  "t.me",
  "telegram.me",
  "whatsapp.com",
  "pinterest.com",
  "tiktok.com",
];

const BATCH_SIZE = 25;
export const MAX_OFFICIAL_LOOKUPS_PER_RUN = 8;
/** Above this share of "none" in a batch the answer is not trusted for dismissing. */
const MAX_DISMISS_SHARE = 0.5;
const MIN_BATCH_FOR_SHARE_GUARD = 4;

/**
 * On in production, off elsewhere unless asked for, for the same reason as the
 * auto-diff: a local boot runs against the live database. A person pressing
 * "Triage" in admin is an explicit request and is not gated by this.
 */
export const leadTriageEnabled = (env: NodeJS.ProcessEnv = process.env): boolean => {
  const flag = env.OPPORTUNITY_LEAD_TRIAGE;
  if (flag === "true") return true;
  if (flag === "false") return false;
  return env.NODE_ENV === "production";
};

// ─── Pure helpers ────────────────────────────────────────────────────────────

export const isSocialDomain = (domain: string): boolean =>
  SOCIAL_DOMAINS.some((d) => domain === d || domain.endsWith(`.${d}`));

// A trailing "s" is dropped so "athletes" and "athlete" are one word.
const stem = (word: string): string => (word.length > 3 ? word.replace(/s$/, "") : word);

const tokens = (name: string): Set<string> =>
  new Set(
    nameKey(name)
      .split(" ")
      .filter((t) => t.length > 2)
      .map(stem)
  );

/**
 * An entry that is probably the same scheme under a different name. Discovery
 * already drops an exact name match; this catches "Khelo India Athlete
 * Scholarship" against "Khelo India accredited academies". Word overlap only,
 * so it errs towards suggesting too little, and it only ever suggests.
 */
export function possibleDuplicate(
  leadName: string,
  entries: Array<{ slug: string; title: string }>
): { slug: string; title: string } | null {
  const mine = tokens(leadName);
  if (mine.size < 2) return null;
  let best: { slug: string; title: string; score: number } | null = null;
  for (const entry of entries) {
    const theirs = tokens(entry.title);
    if (theirs.size < 2) continue;
    let shared = 0;
    for (const t of mine) if (theirs.has(t)) shared += 1;
    const score = shared / (mine.size + theirs.size - shared);
    if (shared >= 2 && score >= 0.6 && (!best || score > best.score)) {
      best = { slug: entry.slug, title: entry.title, score };
    }
  }
  return best ? { slug: best.slug, title: best.title } : null;
}

export interface Judgement {
  fit: LeadFit;
  reason: string;
}

/** The model's list, keyed by lead number. Anything malformed is left out. */
export function parseJudgements(raw: unknown, count: number): Map<number, Judgement> {
  const out = new Map<number, Judgement>();
  if (!Array.isArray(raw)) return out;
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const r = item as Record<string, unknown>;
    const id = typeof r.id === "number" ? r.id : Number(r.id);
    const fit = r.fit;
    if (!Number.isInteger(id) || id < 1 || id > count) continue;
    if (typeof fit !== "string" || !(LEAD_FITS as readonly string[]).includes(fit)) continue;
    const reason = typeof r.reason === "string" ? r.reason.trim().slice(0, 200) : "";
    if (!reason) continue; // A verdict with no reason cannot be shown, and cannot dismiss.
    out.set(id, { fit: fit as LeadFit, reason });
  }
  return out;
}

/** Keep the labels, but refuse to dismiss when the batch calls most leads "none". */
export function guardDismissals(judgements: Map<number, Judgement>, batchSize: number): boolean {
  if (batchSize < MIN_BATCH_FOR_SHARE_GUARD) return true;
  const none = [...judgements.values()].filter((j) => j.fit === "none").length;
  return none / batchSize <= MAX_DISMISS_SHARE;
}

export interface LeadForPrompt {
  name: string;
  owner?: string | undefined;
  track: string;
  why?: string | undefined;
  domain: string;
  isAggregator: boolean;
}

export function judgementPrompt(leads: LeadForPrompt[]): string {
  const list = leads
    .map(
      (l, i) =>
        `${i + 1}. ${l.name}${l.owner ? ` (run by ${l.owner})` : ""}; ${l.track}; ${l.domain}${
          l.isAggregator ? " (a listing site, not the source)" : ""
        }${l.why ? `; ${l.why}` : ""}`
    )
    .join("\n");
  return `PowerMySport guides parents of junior athletes in India (tennis first) to admissions, scholarships and selection trials. Below are leads found by a web search. For each, judge how well it fits: a real scheme, admission route, scholarship or selection programme that a parent of a child athlete in India could act on.

Fit:
- "high": an official scheme or route clearly open to young athletes from India.
- "medium": relevant but indirect or partial, or a foreign programme Indians can apply to.
- "low": loosely related, a general information page, or you cannot tell. Use "low" whenever you are unsure.
- "none": clearly not one: a news item about something else, a job posting, a programme only for adults or professionals, a country with no route for Indian juniors, or a sport that is not relevant.

Judge only from the text below. Return a JSON array with one object per lead: {"id": <its number>, "fit": "...", "reason": "<at most 15 words>"}. Return ONLY the JSON array.

Leads:
${list}`;
}

// ─── The run ─────────────────────────────────────────────────────────────────

export interface TriageDeps {
  /** Judges a batch; returns the model's raw JSON. Replaced in tests. */
  classify?: (prompt: string) => Promise<unknown>;
  /** Finds the official page behind an aggregator lead. Replaced in tests. */
  findOfficial?: (lead: { name: string; owner?: string | undefined }) => Promise<string | null>;
  now?: Date;
}

export interface TriageSummary {
  considered: number;
  dismissedByRules: number;
  dismissedByAi: number;
  labelled: number;
  possibleDuplicates: number;
  officialPagesFound: number;
}

let running = false;
export const isTriageRunning = () => running;

/** Default official-page lookup: search, then let the model pick a numbered result. */
async function findOfficialPage(lead: {
  name: string;
  owner?: string | undefined;
}): Promise<string | null> {
  const outcome = await geminiSearch(
    `Official page of "${lead.name}"${lead.owner ? `, run by ${lead.owner}` : ""}, in India: ` +
      "the government body, university, federation or organisation that publishes it"
  );
  if (!outcome) return null;

  const resolved: Array<{ url: string; title?: string }> = [];
  for (const result of outcome.results) {
    const real = await resolveGroundingRedirect(result.uri);
    const url = real ? normaliseUrl(real) : null;
    resolved.push({ url: url ?? "", ...(result.title ? { title: result.title } : {}) });
  }
  // Numbering is kept intact so the model's pick still points at the right one.
  const usable = resolved.map((r) => {
    const domain = domainOf(r.url);
    return r.url && !isAggregator(domain) && !isSocialDomain(domain);
  });
  if (!usable.some(Boolean)) return null;

  const numbered = resolved
    .map((r, i) =>
      usable[i] ? `[${i + 1}] ${r.title ?? "(untitled)"} - ${domainOf(r.url)}` : null
    )
    .filter(Boolean)
    .join("\n");
  const answer = await geminiFormat(
    `Which of these results is the official page that publishes "${lead.name}"${
      lead.owner ? ` (run by ${lead.owner})` : ""
    }: its own organisation, a government body, a university or a federation, not a news or listing site? ` +
      `Return JSON {"sourceIndex": <number>} or {"sourceIndex": null} if none is.\n\n${numbered}`
  );
  const index =
    answer && typeof answer === "object" ? (answer as { sourceIndex?: unknown }).sourceIndex : null;
  if (typeof index !== "number" || !Number.isInteger(index)) return null;
  return usable[index - 1] ? resolved[index - 1]!.url : null;
}

export async function runLeadTriage(deps: TriageDeps = {}): Promise<TriageSummary> {
  if (running) throw new Error("Triage is already running.");
  running = true;
  try {
    const classify = deps.classify ?? geminiFormat;
    const findOfficial = deps.findOfficial ?? findOfficialPage;
    const now = deps.now ?? new Date();

    const [leads, entries] = await Promise.all([
      OpportunityLead.find({
        status: "new",
        triageLocked: { $ne: true },
        "triage.fit": { $exists: false },
      })
        .sort({ lastFoundAt: -1 })
        .limit(200),
      Opportunity.find({}).select("slug title").lean(),
    ]);

    const summary: TriageSummary = {
      considered: leads.length,
      dismissedByRules: 0,
      dismissedByAi: 0,
      labelled: 0,
      possibleDuplicates: 0,
      officialPagesFound: 0,
    };

    // 1. Rules.
    const open: typeof leads = [];
    for (const lead of leads) {
      if (isSocialDomain(lead.domain)) {
        const reason = "A social media post, not an official page.";
        await OpportunityLead.updateOne(
          { _id: lead._id },
          {
            $set: {
              status: "dismissed",
              autoDismissed: true,
              dismissReason: reason,
              triage: { fit: "none", reason, by: "rules", at: now },
            },
          }
        );
        summary.dismissedByRules += 1;
        continue;
      }
      const duplicate = possibleDuplicate(lead.name, entries);
      if (duplicate) {
        await OpportunityLead.updateOne(
          { _id: lead._id },
          {
            $set: {
              "triage.possibleDuplicateOf": duplicate,
              "triage.by": "rules",
              "triage.at": now,
            },
          }
        );
        summary.possibleDuplicates += 1;
      }
      open.push(lead);
    }

    // 2. One judgment per batch.
    for (let start = 0; start < open.length; start += BATCH_SIZE) {
      const batch = open.slice(start, start + BATCH_SIZE);
      let raw: unknown = null;
      try {
        raw = await classify(
          judgementPrompt(
            batch.map((l) => ({
              name: l.name,
              owner: l.owner,
              track: l.track,
              why: l.why,
              domain: l.domain,
              isAggregator: l.isAggregator,
            }))
          )
        );
      } catch (error) {
        log.warn("Triage: judging a batch failed, leaving it for next time:", error);
      }
      const judgements = parseJudgements(raw, batch.length);
      if (judgements.size === 0) continue; // Nothing usable: leave them untriaged to try again.
      const mayDismiss = guardDismissals(judgements, batch.length);
      if (!mayDismiss) {
        log.warn(`Triage: a batch of ${batch.length} was mostly "none"; labelling only.`);
      }

      for (const [number, judgement] of judgements) {
        const lead = batch[number - 1]!;
        const dismiss = mayDismiss && judgement.fit === "none";
        await OpportunityLead.updateOne(
          { _id: lead._id },
          {
            $set: {
              "triage.fit": mayDismiss
                ? judgement.fit
                : judgement.fit === "none"
                  ? "low"
                  : judgement.fit,
              "triage.reason": judgement.reason,
              "triage.by": "ai",
              "triage.at": now,
              ...(dismiss
                ? { status: "dismissed", autoDismissed: true, dismissReason: judgement.reason }
                : {}),
            },
          }
        );
        if (dismiss) summary.dismissedByAi += 1;
        else summary.labelled += 1;
      }
    }

    // 3. The official page behind an aggregator, a few per run.
    let lookups = 0;
    for (const lead of open) {
      if (lookups >= MAX_OFFICIAL_LOOKUPS_PER_RUN) break;
      if (!lead.isAggregator) continue;
      const fresh = await OpportunityLead.findById(lead._id).select("status triage").lean();
      if (!fresh || fresh.status !== "new" || fresh.triage?.officialUrl) continue;
      lookups += 1;
      let url: string | null = null;
      try {
        url = await findOfficial({ name: lead.name, owner: lead.owner });
      } catch (error) {
        log.warn("Triage: official-page lookup failed:", error);
      }
      if (url) {
        await OpportunityLead.updateOne(
          { _id: lead._id },
          { $set: { "triage.officialUrl": url, "triage.by": "ai", "triage.at": now } }
        );
        summary.officialPagesFound += 1;
      }
    }

    log.info("Lead triage finished", summary);
    return summary;
  } finally {
    running = false;
  }
}
