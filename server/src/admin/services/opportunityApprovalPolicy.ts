import { domainOf, isAggregator } from "./opportunityDiscovery";
import { staleCycleReason } from "./dataSourceExtraction/opportunityChecks";

// ─── The rules an AI approver must satisfy before anything reaches parents ───
//
// This file is the policy and nothing else: no database, no model, no action. It
// is given what a reading found (and the checks already run on it) and answers
// one question: does every rule hold? One broken rule is enough to hold the item
// for a person, and the verdict says which, so an editor reading it knows why.
//
// The rules fall into four groups. They are deliberately conservative: a rule that
// cannot be sure fails, because a held item costs an editor a minute and a wrong
// figure on a parent's screen costs much more.
//
//   SOURCE     is this a page we can trust, and is it current?
//   EVIDENCE   does the source actually say what was extracted?
//   RECORD     would the entry be complete, plausible and not a duplicate?
//   CHANGE     (for a live entry) is this the kind of change that is safe to
//              apply unseen: small, and not about what the entry IS?
//
// Thresholds are constants so they can be read, argued with and changed in one
// place, and each has a test.

export interface PolicyRule {
  id: string;
  group: "source" | "evidence" | "record" | "change";
  /** Said to an editor, in the terms of what must be true. */
  label: string;
}

export const APPROVAL_RULES: readonly PolicyRule[] = [
  {
    id: "official-source",
    group: "source",
    label:
      "Every cited source is an official page: a government or university site, the organiser's own site, or a site this entry already cites.",
  },
  {
    id: "current",
    group: "source",
    label: "The rules are for the current cycle, and the document is not years old.",
  },
  {
    id: "every-field-quoted",
    group: "evidence",
    label: "Every field has a quote from the source behind it.",
  },
  {
    id: "quotes-verified",
    group: "evidence",
    label:
      "Every quote was found, as written, in the source's text. A partial, scattered or unmatched quote does not count.",
  },
  {
    id: "figures-match",
    group: "evidence",
    label: "Every number and date is in its own quote.",
  },
  {
    id: "quotes-not-shared",
    group: "evidence",
    label: "No single quote is stretched across several fields.",
  },
  {
    id: "no-conflicts",
    group: "evidence",
    label: "Documents that were read together do not disagree.",
  },
  {
    id: "complete",
    group: "record",
    label: "The entry would be complete enough to publish.",
  },
  {
    id: "plausible",
    group: "record",
    label: "The pre-publish check finds nothing to warn about.",
  },
  {
    id: "right-scheme",
    group: "record",
    label: "A new entry is the scheme the lead was about, and not one we already have.",
  },
  {
    id: "identity-stable",
    group: "change",
    label:
      "A change to a live entry does not touch what it is: title, section, organiser, place, sports or how you get it.",
  },
  {
    id: "no-big-swing",
    group: "change",
    label: "No figure or date moves further than is plausible in one update.",
  },
  {
    id: "small-update",
    group: "change",
    label: "A live entry changes in only a few places at once.",
  },
];

// ── Thresholds ──────────────────────────────────────────────────────────────

/** A live entry changing in more places than this is a rewrite, not an update. */
export const MAX_ROWS_PER_UPDATE = 8;
/** An amount or fee may move by at most this factor, up or down, in one update. */
export const MAX_AMOUNT_FACTOR = 2;
/** An age bound may move by at most this many years. */
export const MAX_AGE_SHIFT_YEARS = 3;
/** A window date may move by at most this many days. */
export const MAX_DATE_SHIFT_DAYS = 120;

/** What defines an entry. Changing any of these on a live entry is a person's call. */
const IDENTITY_PATHS = [
  "title",
  "category",
  "owner",
  "allSports",
  "sports",
  "selection",
  "eligibility.gender",
] as const;
const IDENTITY_PREFIXES = ["owner.", "geography."];

// ── What a reading is judged on ─────────────────────────────────────────────

export interface PolicyChange {
  path: string;
  current?: unknown;
  proposed: unknown;
}

export interface PolicyChecks {
  against?: string;
  quotes?: Record<string, string>;
  figures?: Record<string, string>;
  shared?: Record<string, number>;
}

export interface PolicyFinding {
  severity: "problem" | "warning" | "note";
  message: string;
}

export interface ApprovalInput {
  kind: "update" | "new";
  now?: Date;
  changes: PolicyChange[];
  /**
   * The fields whose evidence must hold, when that is not simply the fields that
   * change. A live entry the source merely confirms has no changes, but approving
   * it re-verifies everything the source says, so all of that needs its evidence.
   */
  evidenceFields?: string[] | undefined;
  /** Likewise for the figure check: the paths with a number or date, when not the changed ones. */
  figurePaths?: string[] | undefined;
  citations: Record<string, string>;
  checks?: PolicyChecks | null;
  conflicts?: Record<string, unknown[]> | null;
  /** The sources that will be cited if this goes ahead. */
  sourceUrls: string[];
  ownerName?: string | undefined;
  /** Hosts already trusted: those the entry cites, those of other entries, and an allow-list. */
  vettedDomains: string[];
  cycleLabel?: string | undefined;
  sourcePublishedOn?: string | undefined;
  /** For a new entry made from a lead: does the title read match the lead? Absent when not from a lead. */
  titleMatchesLead?: boolean | undefined;
  /** An existing entry with this title, if there is one (new entries). */
  duplicateOf?: string | null | undefined;
  /** Whether the merged entry passes the publish schema. */
  publishable: { ok: boolean; errors: string[] };
  /** The pre-publish plausibility findings on the merged entry. */
  findings: PolicyFinding[];
}

export interface RuleResult {
  id: string;
  ok: boolean;
  /** Why it failed, or what satisfied it. */
  detail?: string;
}

export interface ApprovalVerdict {
  pass: boolean;
  rules: RuleResult[];
  /** The ids that failed, for a one-line reason. */
  failed: string[];
}

const topOf = (path: string): string => path.split(".")[0]!;

// ── Is this host one we can call official? ──────────────────────────────────

const OFFICIAL_SUFFIX = /(^|\.)(gov|nic|ac|edu|res)\.in$|\.(gov|edu)$/;

const GENERIC_OWNER_WORDS = new Set([
  "the",
  "and",
  "of",
  "for",
  "india",
  "indian",
  "foundation",
  "trust",
  "limited",
  "ltd",
  "pvt",
  "private",
  "company",
  "corporation",
  "sports",
  "sport",
  "association",
  "federation",
  "society",
  "board",
  "council",
  "authority",
  "university",
  "college",
  "school",
  "institute",
]);

/** The part of a host that names the site: "ammfoundation" from "www.ammfoundation.org". */
const hostLabel = (host: string): string => {
  const parts = host.split(".");
  const registrable = parts.length >= 3 && parts[parts.length - 2]!.length <= 3 ? -3 : -2;
  return (parts.at(registrable) ?? host).replace(/[^a-z0-9]/g, "");
};

/** Every word of the name in order, with runs of initials joined: "A.M.M. Foundation" is ["amm", "foundation"]. */
const ownerTokens = (name: string): string[] => {
  const words: string[] = [];
  let initials = "";
  for (const word of name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(" ")) {
    if (!word) continue;
    if (word.length === 1) {
      initials += word;
      continue;
    }
    if (initials) words.push(initials);
    initials = "";
    words.push(word);
  }
  if (initials) words.push(initials);
  return words;
};

/**
 * Whether a URL is plausibly its organiser's own. A site is official when it is a
 * government or university domain, when it is one we already vetted, or when its
 * name carries the organiser's name (ammfoundation.org for the A.M.M. Foundation).
 * Absence from a deny-list proves nothing, so an unknown host is not official.
 */
export function officialSource(
  url: string,
  ownerName: string | undefined,
  vettedDomains: string[]
): { ok: boolean; why: string } {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return { ok: false, why: `${url} is not a valid address.` };
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    return { ok: false, why: `${url} is not a web page.` };
  }
  const host = domainOf(url);
  if (isAggregator(host)) {
    return { ok: false, why: `${host} lists schemes but is not their source.` };
  }
  if (OFFICIAL_SUFFIX.test(host))
    return { ok: true, why: `${host} is a government or university site.` };
  if (vettedDomains.some((d) => host === d || host.endsWith(`.${d}`))) {
    return { ok: true, why: `${host} is a site we already cite.` };
  }
  // The host's name must BE the organiser's name (with or without the generic words,
  // "foundation", "india"), not merely contain a piece of it: a host that happens to
  // contain "amm" is not the A.M.M. Foundation's.
  const tokens = ownerName ? ownerTokens(ownerName) : [];
  const distinctive = tokens.filter((word) => word.length >= 3 && !GENERIC_OWNER_WORDS.has(word));
  const label = hostLabel(host);
  const names = new Set([tokens.join(""), distinctive.join("")].filter((name) => name.length >= 3));
  if (names.has(label)) {
    return { ok: true, why: `${host} carries the organiser's name.` };
  }
  return { ok: false, why: `${host} is not a site we can show is the organiser's own.` };
}

// ── The change rules ────────────────────────────────────────────────────────

const isIdentityPath = (path: string): boolean =>
  (IDENTITY_PATHS as readonly string[]).includes(path) ||
  IDENTITY_PREFIXES.some((prefix) => path.startsWith(prefix));

const asNumber = (value: unknown): number | null => {
  if (typeof value === "number") return value;
  if (
    value &&
    typeof value === "object" &&
    typeof (value as { value?: unknown }).value === "number"
  ) {
    return (value as { value: number }).value;
  }
  if (
    value &&
    typeof value === "object" &&
    typeof (value as { amount?: unknown }).amount === "number"
  ) {
    return (value as { amount: number }).amount;
  }
  return null;
};

const dayDifference = (a: string, b: string): number =>
  Math.abs(Date.parse(`${a}T00:00:00Z`) - Date.parse(`${b}T00:00:00Z`)) / 86_400_000;

/** Why a change moves further than plausible, or null when it does not. */
function bigSwing(change: PolicyChange): string | null {
  const { path, current, proposed } = change;
  if (current === undefined || current === null || current === "") return null;

  if (path === "benefit.amount" || path === "cost") {
    const before = asNumber(current);
    const after = asNumber(proposed);
    if (before && after) {
      const factor = after > before ? after / before : before / after;
      if (factor > MAX_AMOUNT_FACTOR) {
        return `${path} moves from ${before} to ${after}, more than ${MAX_AMOUNT_FACTOR} times.`;
      }
    }
    return null;
  }
  if (path === "eligibility.ageMin" || path === "eligibility.ageMax") {
    if (typeof current === "number" && typeof proposed === "number") {
      if (Math.abs(current - proposed) > MAX_AGE_SHIFT_YEARS) {
        return `${path} moves from ${current} to ${proposed}, more than ${MAX_AGE_SHIFT_YEARS} years.`;
      }
    }
    return null;
  }
  if (path === "cycle.opensOn" || path === "cycle.closesOn") {
    if (typeof current === "string" && typeof proposed === "string") {
      if (dayDifference(current, proposed) > MAX_DATE_SHIFT_DAYS) {
        return `${path} moves from ${current} to ${proposed}, more than ${MAX_DATE_SHIFT_DAYS} days.`;
      }
    }
  }
  return null;
}

// ── The verdict ─────────────────────────────────────────────────────────────

export function evaluateApproval(input: ApprovalInput): ApprovalVerdict {
  const rules: RuleResult[] = [];
  const add = (id: string, ok: boolean, detail?: string) =>
    rules.push({ id, ok, ...(detail ? { detail } : {}) });

  const proposedTops = input.evidenceFields ?? [
    ...new Set(input.changes.map((change) => topOf(change.path))),
  ];
  const checks = input.checks ?? null;

  // SOURCE
  const unofficial = input.sourceUrls
    .map((url) => officialSource(url, input.ownerName, input.vettedDomains))
    .filter((result) => !result.ok);
  add(
    "official-source",
    input.sourceUrls.length > 0 && unofficial.length === 0,
    input.sourceUrls.length === 0 ? "There is no source to cite." : unofficial[0]?.why
  );

  const stale = staleCycleReason(input.cycleLabel, input.sourcePublishedOn, input.now);
  add("current", stale === null, stale ?? undefined);

  // EVIDENCE
  const unquoted = proposedTops.filter((field) => !input.citations[field]);
  add(
    "every-field-quoted",
    proposedTops.length > 0 && unquoted.length === 0,
    proposedTops.length === 0
      ? "Nothing was read."
      : unquoted.length
        ? `No quote for: ${unquoted.join(", ")}.`
        : undefined
  );

  const unverifiable = !checks || checks.against === "none" || checks.against === undefined;
  const notFound = proposedTops.filter((field) => checks?.quotes?.[field] !== "found");
  add(
    "quotes-verified",
    !unverifiable && notFound.length === 0,
    unverifiable
      ? "The quotes could not be compared with the source's text."
      : notFound.length
        ? `Not verified as written: ${notFound.map((f) => `${f} (${checks?.quotes?.[f] ?? "unchecked"})`).join(", ")}.`
        : undefined
  );

  const FIGURE_PATHS = [
    "eligibility.ageMin",
    "eligibility.ageMax",
    "benefit.amount",
    "cost",
    "cycle.opensOn",
    "cycle.closesOn",
    "cycle.keyDates",
  ];
  const badFigures = (input.figurePaths ?? input.changes.map((change) => change.path))
    .filter((path) => FIGURE_PATHS.includes(path))
    .filter((path) => checks?.figures?.[path] !== "ok");
  add(
    "figures-match",
    badFigures.length === 0,
    badFigures.length ? `Not confirmed in the quote: ${badFigures.join(", ")}.` : undefined
  );

  const shared = proposedTops.filter((field) => (checks?.shared?.[field] ?? 0) > 0);
  add(
    "quotes-not-shared",
    shared.length === 0,
    shared.length ? `One quote is used for several fields: ${shared.join(", ")}.` : undefined
  );

  const conflicted = proposedTops.filter((field) => (input.conflicts?.[field]?.length ?? 0) > 0);
  add(
    "no-conflicts",
    conflicted.length === 0,
    conflicted.length ? `The documents disagree about: ${conflicted.join(", ")}.` : undefined
  );

  // RECORD
  add(
    "complete",
    input.publishable.ok,
    input.publishable.ok ? undefined : input.publishable.errors.slice(0, 3).join("; ")
  );

  const warnings = input.findings.filter((f) => f.severity !== "note");
  add("plausible", warnings.length === 0, warnings.length ? warnings[0]!.message : undefined);

  if (input.kind === "new") {
    const wrong =
      input.titleMatchesLead === false
        ? "The title read does not match the lead."
        : input.duplicateOf
          ? `An entry called "${input.duplicateOf}" already exists.`
          : null;
    add("right-scheme", wrong === null, wrong ?? undefined);
  } else {
    add("right-scheme", true);
  }

  // CHANGE (a live entry only)
  if (input.kind === "update") {
    const identity = input.changes.filter((change) => isIdentityPath(change.path));
    add(
      "identity-stable",
      identity.length === 0,
      identity.length
        ? `Changes what the entry is: ${identity.map((c) => c.path).join(", ")}.`
        : undefined
    );

    const swings = input.changes
      .map(bigSwing)
      .filter((reason): reason is string => reason !== null);
    add("no-big-swing", swings.length === 0, swings[0]);

    add(
      "small-update",
      input.changes.length <= MAX_ROWS_PER_UPDATE,
      input.changes.length > MAX_ROWS_PER_UPDATE
        ? `${input.changes.length} fields change, more than ${MAX_ROWS_PER_UPDATE}.`
        : undefined
    );
  } else {
    add("identity-stable", true);
    add("no-big-swing", true);
    add("small-update", true);
  }

  const failed = rules.filter((rule) => !rule.ok).map((rule) => rule.id);
  return { pass: failed.length === 0, rules, failed };
}
