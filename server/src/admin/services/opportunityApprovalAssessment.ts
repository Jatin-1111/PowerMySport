import { DataSourceSubmission } from "../../shared/models/DataSourceSubmission";
import { Opportunity } from "../../shared/models/Opportunity";
import {
  parseOpportunity,
  parseOpportunityDraft,
  todayInIndia,
} from "../../shared/validation/opportunityFormat";
import { sourcesToCite, type DocumentRecord } from "./dataSourceExtraction/multiDocument";
import { titleMatchesLead } from "./dataSourceExtraction/opportunityChecks";
import type { CitationChecks } from "./dataSourceExtraction/quoteCheck";
import { domainOf } from "./opportunityDiscovery";
import {
  APPROVAL_RULES,
  evaluateApproval,
  type ApprovalVerdict,
  type PolicyChecks,
} from "./opportunityApprovalPolicy";
import { checkOpportunityOffline, type CheckableEntry } from "./opportunityPublishCheck";
import { applyChanges, proposedChanges, withSource } from "./opportunitySourceMerge";
import { slugify } from "./opportunitySlug";

// ─── Putting a reading in front of the approval rules ────────────────────────
//
// opportunityApprovalPolicy.ts decides; this gathers what it decides on. It reads
// the database (the live entry, the other entries, the hosts we already trust) and
// writes nothing, so it is safe to run for any reading, on demand, to show an
// editor what the rules make of it.

type Submission = InstanceType<typeof DataSourceSubmission>;

export interface AssessedRule {
  id: string;
  group: string;
  label: string;
  ok: boolean;
  detail?: string | undefined;
}

export interface Assessment extends Omit<ApprovalVerdict, "rules"> {
  rules: AssessedRule[];
  /** "update" changes a live entry; "new" makes or verifies one made from a source. */
  kind: "update" | "new";
  /** An update where the source says nothing different: approving it only re-verifies. */
  unchanged: boolean;
  /** How many fields would change. */
  rows: number;
  evaluatedAt: string;
}

const plain = (value: unknown): Record<string, unknown> =>
  JSON.parse(JSON.stringify(value ?? {})) as Record<string, unknown>;

const norm = (title: string): string =>
  title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

/** Hosts we already cite on any entry, plus a configured allow-list. */
async function vettedDomains(): Promise<string[]> {
  const entries = await Opportunity.find({}).select("sources.url").lean();
  const hosts = new Set<string>();
  for (const entry of entries) {
    for (const source of entry.sources ?? []) {
      const host = source.url ? domainOf(source.url) : "";
      if (host) hosts.add(host);
    }
  }
  for (const host of (process.env.OPPORTUNITY_TRUSTED_DOMAINS ?? "").split(",")) {
    const trimmed = host.trim().toLowerCase();
    if (trimmed) hosts.add(trimmed);
  }
  return [...hosts];
}

/** Every leaf of a reading with a figure in it, as the paths the figure check uses. */
const FIGURE_LEAVES = [
  "eligibility.ageMin",
  "eligibility.ageMax",
  "benefit.amount",
  "cost",
  "cycle.opensOn",
  "cycle.closesOn",
  "cycle.keyDates",
];

/**
 * What the rules make of this reading, or null when it is not in a state to judge
 * (still being read, failed, rejected, or already decided by a person).
 */
export async function assessSubmission(
  submission: Submission,
  now: Date = new Date()
): Promise<Assessment | null> {
  const drafted = Boolean(submission.autoDraft && submission.draftedSlug);
  const waiting = submission.status === "PENDING_REVIEW";
  // A draft made automatically is judged too: that is the entry that would be verified and published.
  if (!waiting && !(drafted && submission.status === "APPROVED")) return null;

  const extracted = plain(submission.extractedData);
  const citations = (submission.citations ?? {}) as Record<string, string>;
  const checks = submission.citationChecks as Partial<CitationChecks> | undefined;
  const records = (submission.documents as DocumentRecord[] | undefined) ?? [];
  const fieldSources = (submission.fieldSources as Record<string, string> | undefined) ?? {};

  const liveSlug = submission.opportunitySlug ?? (drafted ? submission.draftedSlug : undefined);
  const live = liveSlug ? await Opportunity.findOne({ slug: liveSlug }).lean() : null;
  const kind: "update" | "new" = submission.opportunitySlug ? "update" : "new";
  // For an automatic draft the entry already holds everything read, so what is judged
  // is the whole reading, not a difference from it.
  const against = kind === "update" && live ? plain(live) : null;

  const changes = proposedChanges(against, extracted, citations, checks, {
    fieldSources: submission.fieldSources as Record<string, string> | undefined,
    conflicts: submission.conflicts as Record<string, never[]> | undefined,
    documents: submission.documents as DocumentRecord[] | undefined,
  });
  const unchanged = kind === "update" && changes.length === 0;

  // What the evidence rules must hold for: what would change, or (when nothing
  // would) everything the reading says, since re-verifying asserts all of it.
  const reading = proposedChanges(null, extracted);
  const evidenceChanges = unchanged ? reading : changes;
  const keep = new Set(evidenceChanges.map((change) => change.path));

  // The sources that would be cited.
  const sourceUrl = submission.originUrl || submission.sourceUrl;
  const publishedOn =
    typeof extracted.sourcePublishedOn === "string" ? extracted.sourcePublishedOn : undefined;
  const ownRecord = records.find((record) => record.url === sourceUrl);
  const citeAs = sourceUrl
    ? sourcesToCite(records, fieldSources, keep, {
        label: submission.sourceLabel || "Official source",
        url: sourceUrl,
        publishedOn: ownRecord ? ownRecord.sourcePublishedOn : publishedOn,
      })
    : [];

  // The entry as it would be after approval, for the completeness and plausibility rules.
  const base = kind === "update" && live ? plain(live) : drafted && live ? plain(live) : null;
  const merged: Record<string, unknown> =
    drafted && live
      ? { ...plain(live) }
      : applyChanges(base, changes, new Set(changes.map((change) => change.path)));
  if (!(drafted && live)) {
    let sources = merged.sources as
      Array<{ label: string; url: string; publishedOn?: string }> | undefined;
    for (const source of [...citeAs].reverse()) sources = withSource(sources, source);
    merged.sources = sources;
  }
  merged.lastVerifiedOn = todayInIndia(now);
  if (kind === "new" && !merged.slug && typeof merged.title === "string") {
    merged.slug = slugify(merged.title);
  }
  merged.track = merged.track ?? submission.opportunityTrack ?? "scholarship";

  const {
    _id: _i,
    status: _s,
    publishedAt: _p,
    createdAt: _c,
    updatedAt: _u,
    updatedBy: _b,
    __v: _v,
    ...fields
  } = merged;
  const isDraftEntry = !live || live.status !== "published";
  // A new entry is judged as one that is about to be published; so is a live one.
  const parsed =
    kind === "new" || !isDraftEntry ? parseOpportunity(fields) : parseOpportunityDraft(fields);
  const publishable = parsed.ok ? { ok: true, errors: [] } : { ok: false, errors: parsed.errors };

  const others = (await Opportunity.find({}).select("slug title").lean()).filter(
    (entry) => entry.slug !== liveSlug
  );
  const findings = checkOpportunityOffline(merged as CheckableEntry, todayInIndia(now), others).map(
    (finding) => ({ severity: finding.severity, message: finding.message })
  );

  const title = typeof merged.title === "string" ? merged.title : "";
  const twin = others.find((entry) => norm(entry.title) === norm(title));

  const ownerName =
    (extracted.owner as { name?: string } | undefined)?.name ??
    (live?.owner as { name?: string } | undefined)?.name;
  const cycle = merged.cycle as { label?: string } | undefined;

  const verdict = evaluateApproval({
    kind,
    now,
    changes: unchanged
      ? []
      : changes.map((c) => ({ path: c.path, current: c.current, proposed: c.proposed })),
    ...(unchanged
      ? {
          evidenceFields: [...new Set(reading.map((c) => c.path.split(".")[0]!))],
          figurePaths: reading.map((c) => c.path).filter((p) => FIGURE_LEAVES.includes(p)),
        }
      : drafted
        ? {
            // The draft holds the whole reading; judge all of it.
            changes: reading.map((c) => ({ path: c.path, proposed: c.proposed })),
          }
        : {}),
    citations,
    checks: (checks ?? null) as PolicyChecks | null,
    conflicts: (submission.conflicts ?? null) as Record<string, unknown[]> | null,
    sourceUrls: citeAs.map((source) => source.url),
    ownerName,
    vettedDomains: await vettedDomains(),
    cycleLabel: cycle?.label,
    sourcePublishedOn: publishedOn,
    titleMatchesLead:
      kind === "new" && submission.autoDraft && submission.sourceLabel && title
        ? titleMatchesLead(submission.sourceLabel, title)
        : undefined,
    duplicateOf: kind === "new" ? (twin?.title ?? null) : null,
    publishable,
    findings,
  });

  return {
    ...verdict,
    rules: verdict.rules.map((rule) => {
      const policy = APPROVAL_RULES.find((candidate) => candidate.id === rule.id);
      return { ...rule, group: policy?.group ?? "", label: policy?.label ?? rule.id };
    }),
    kind,
    unchanged,
    rows: changes.length,
    evaluatedAt: now.toISOString(),
  };
}
