import { asString } from "./valueParsing";

// ─── Calendar validation (moved verbatim from the retired tournamentCalendarService.ts) ──

export interface ExtractedEdition {
  name: string;
  startDate: string;
  endDate?: string | null;
  registrationDeadlineDate?: string | null;
  venue?: string | null;
  city?: string | null;
  level?: string | null;
  ageGroups?: string[] | null;
  detailUrl?: string | null;
  sourceQuote?: string | null;
  // Added by the detail-page pass, and present when validateEditions re-runs
  // over an already-enriched draft (it does, at approval time).
  officialName?: string | null;
  organiser?: string | null;
  state?: string | null;
  category?: string | null;
  documents?: unknown;
}

/** A document published alongside an edition — fact sheet, acceptance list, draw, results. */
export interface EditionDocument {
  label: string;
  url: string;
  kind: EditionDocumentKind;
}

export type EditionDocumentKind =
  "factSheet" | "acceptanceList" | "entryForm" | "draw" | "results" | "other";

export interface ValidEdition {
  name: string;
  startDate: string;
  endDate?: string | undefined;
  registrationDeadlineDate?: string | undefined;
  venue?: string | undefined;
  city?: string | undefined;
  level?: string | undefined;
  ageGroups: string[];
  sourceQuote?: string | undefined;
  /** The event's own page on the federation site — the durable link, and where the fields below come from. */
  detailUrl?: string | undefined;
  /** Full official title as published on the detail page, e.g. "AITA CHAMPIONSHIP SERIES TOURNAMENT (DELHI)". */
  officialName?: string | undefined;
  /** Host club/academy running the event. */
  organiser?: string | undefined;
  state?: string | undefined;
  /** Category wording exactly as the source prints it, e.g. "Under 12 Under 16". */
  category?: string | undefined;
  documents?: EditionDocument[] | undefined;
}

/**
 * Keeps a value only if it is a syntactically valid http(s) URL.
 *
 * The model copies these out of page text, so the failure mode is a truncated
 * or hallucinated string rather than a hostile one — but these end up rendered
 * as links for parents, and `javascript:` must never reach an href. Anything
 * that isn't cleanly http(s) is dropped rather than repaired.
 */
function sanitizeHttpUrl(value: unknown): string | undefined {
  if (typeof value !== "string" || !value.trim()) return undefined;
  try {
    const url = new URL(value.trim());
    return url.protocol === "http:" || url.protocol === "https:" ? url.toString() : undefined;
  } catch {
    return undefined;
  }
}

const DOCUMENT_KINDS: EditionDocumentKind[] = [
  "factSheet",
  "acceptanceList",
  "entryForm",
  "draw",
  "results",
  "other",
];

/**
 * Re-validates a stored/hand-edited document list. These become links rendered
 * for parents, so a non-http url is dropped rather than trusted — an admin can
 * edit the draft freely before approving.
 */
function sanitizeEditionDocuments(value: unknown): EditionDocument[] | undefined {
  if (!Array.isArray(value)) return undefined;
  // Same url twice is a real duplicate and is dropped. Same LABEL twice is not:
  // AITA publishes two distinct acceptance lists both called "Girls Under 18",
  // and collapsing on label would silently lose one of the two draws.
  const seenUrls = new Set<string>();
  const documents = value
    .filter((d): d is Record<string, unknown> => !!d && typeof d === "object")
    .map((d) => {
      const url = sanitizeHttpUrl(d.url);
      const label = asString(d.label);
      if (!url || !label || seenUrls.has(url)) return null;
      seenUrls.add(url);
      const kind = asString(d.kind);
      return {
        label,
        url,
        kind: (DOCUMENT_KINDS.includes(kind as EditionDocumentKind)
          ? kind
          : "other") as EditionDocumentKind,
      };
    })
    .filter((d): d is EditionDocument => d !== null);
  return documents.length ? documents : undefined;
}

function parseDateStrict(value: unknown): Date | undefined {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined;
  const d = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(d.getTime()) ? undefined : d;
}

/**
 * Repairs the two name malformations the extraction reliably produces, so the
 * stored (and displayed) name is clean: a doubled organiser prefix
 * ("AITA AITA Rs 1 Lakh" -> "AITA Rs 1 Lakh") and a missing space before a
 * bracket ("AITA CS7(Sonipat)" -> "AITA CS7 (Sonipat)"). Cosmetic only —
 * applied independently of dedup, since a malformed name can exist without a
 * clean twin to be deduped against.
 *
 * The doubled token is only collapsed when it's an acronym (2-6 caps), because
 * plenty of legitimate names genuinely repeat a word — real examples from this
 * dataset: "Ten Ten Chess Academy" (the academy's name) and "V V Balaram
 * Memorial" (a person's initials). This mutates stored data, so it stays
 * deliberately conservative.
 */
export function cleanEditionName(name: string): string {
  const tokens = name.trim().replace(/\s+/g, " ").split(" ");
  while (
    tokens.length >= 2 &&
    tokens[0]!.toLowerCase() === tokens[1]!.toLowerCase() &&
    /^[A-Z]{2,6}$/.test(tokens[0]!.replace(/[^A-Za-z]/g, ""))
  ) {
    tokens.shift();
  }
  return tokens.join(" ").replace(/(\S)\(/g, "$1 (");
}

/** Case/punctuation/whitespace-insensitive form — "AITA CS7(Sonipat)" and "AITA CS7 (Sonipat)" collapse to one string. */
function normalizeEditionName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** "aita aita rs 1 lakh" -> "aita rs 1 lakh" — the extraction prompt asks for an organiser prefix and sometimes applies it twice. */
function collapseRepeatedPrefix(normalized: string): string {
  return normalized.replace(/^(\S+)(?: \1)+(?= |$)/, "$1");
}

/**
 * Dedup keys for one edition. The extraction prompt asks Gemini to prefix event
 * names with the organiser, which it applies inconsistently — producing twins
 * like "Nationals (Chennai)" / "AITA Nationals (Chennai)" and
 * "AITA Rs 1 Lakh (Gudur)" / "AITA AITA Rs 1 Lakh (Gudur)" that a plain
 * name-equality check treats as distinct events.
 *
 * So an edition is a duplicate if EITHER its normalized name OR that name minus
 * its leading organiser token has already been seen on the same start date.
 *
 * The leading token is only dropped when it's an ACRONYM in the original name
 * (AITA, ITF, BAI, BWF) and 2+ tokens remain. Both guards matter: without the
 * acronym check, ordinals collapse genuinely different events — real example
 * from this dataset, "First Chola Chennai" and "Second Chola Chennai" both
 * reduce to "chola chennai".
 */
export function editionDedupKeys(name: string, startDate: string): string[] {
  const base = collapseRepeatedPrefix(normalizeEditionName(name));
  const keys = [`${base}|${startDate}`];
  const originalFirstToken = (name.trim().split(/\s+/)[0] ?? "").replace(/[^A-Za-z]/g, "");
  const isAcronymPrefix = /^[A-Z]{2,6}$/.test(originalFirstToken);
  const tokens = base.split(" ");
  if (isAcronymPrefix && tokens.length >= 3) {
    keys.push(`${tokens.slice(1).join(" ")}|${startDate}`);
  }
  return keys;
}

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

export function validateEditions(raw: unknown): { valid: ValidEdition[]; errors: string[] } {
  const errors: string[] = [];
  if (!Array.isArray(raw)) return { valid: [], errors: ["Extraction did not return a list."] };
  // Distinct from "entries were rejected" — here the model read the page and
  // listed nothing, which points at the source (JS-rendered, or too long to
  // enumerate) rather than at our validation rules.
  if (raw.length === 0) {
    return {
      valid: [],
      errors: [
        "The AI read the source but listed no tournament entries. The page may build its calendar with JavaScript, or be too long for the model to enumerate — try uploading the official PDF instead of the link.",
      ],
    };
  }

  const now = Date.now();
  const minStart = now - 60 * 24 * 60 * 60 * 1000; // 60 days back
  const maxStart = now + 550 * 24 * 60 * 60 * 1000; // ~18 months ahead
  const seen = new Set<string>();
  const valid: ValidEdition[] = [];

  // Per-reason tallies: a bare "N entries were dropped" is undiagnosable when N
  // equals the whole batch — the admin can't tell a wrong-year extraction from
  // genuine duplicates. Note a 100% drop rate can never be duplicates alone,
  // since the first occurrence of any key is always kept.
  const drops = { badName: 0, badDate: 0, outOfWindow: 0, endBeforeStart: 0, duplicate: 0 };
  const observedDates: string[] = [];

  for (const item of raw as ExtractedEdition[]) {
    const name = typeof item?.name === "string" ? cleanEditionName(item.name) : "";
    const startDate = parseDateStrict(item?.startDate);
    if (typeof item?.startDate === "string" && ISO_DAY.test(item.startDate)) {
      observedDates.push(item.startDate);
    }
    if (!name || name.length < 3) {
      drops.badName++;
      continue;
    }
    if (!startDate) {
      drops.badDate++;
      continue;
    }
    if (startDate.getTime() < minStart || startDate.getTime() > maxStart) {
      drops.outOfWindow++;
      continue;
    }
    const endDate = parseDateStrict(item?.endDate ?? undefined);
    if (endDate && endDate.getTime() < startDate.getTime()) {
      drops.endBeforeStart++;
      continue;
    }
    const keys = editionDedupKeys(name, item.startDate);
    if (keys.some((k) => seen.has(k))) {
      drops.duplicate++;
      continue;
    }
    for (const k of keys) seen.add(k);

    valid.push({
      name,
      startDate: item.startDate,
      endDate: endDate ? (item.endDate as string) : undefined,
      registrationDeadlineDate: parseDateStrict(item?.registrationDeadlineDate ?? undefined)
        ? (item.registrationDeadlineDate as string)
        : undefined,
      venue: typeof item?.venue === "string" ? item.venue.trim() || undefined : undefined,
      city: typeof item?.city === "string" ? item.city.trim() || undefined : undefined,
      level: typeof item?.level === "string" ? item.level.trim() || undefined : undefined,
      ageGroups: Array.isArray(item?.ageGroups)
        ? item.ageGroups.filter((a): a is string => typeof a === "string" && a.trim().length > 0)
        : [],
      detailUrl: sanitizeHttpUrl(item?.detailUrl),
      sourceQuote:
        typeof item?.sourceQuote === "string" ? item.sourceQuote.trim() || undefined : undefined,
      // Detail-page fields must be carried through, not rebuilt from scratch.
      // This function is a whitelist, and it runs again on the saved draft at
      // approval time — anything it omits is silently discarded, so dropping
      // these here would publish every edition with no fact sheet at all.
      officialName: asString(item?.officialName),
      organiser: asString(item?.organiser),
      state: asString(item?.state),
      category: asString(item?.category),
      documents: sanitizeEditionDocuments(item?.documents),
    });
  }

  const totalDropped =
    drops.badName + drops.badDate + drops.outOfWindow + drops.endBeforeStart + drops.duplicate;

  if (totalDropped > 0) {
    const parts: string[] = [];
    if (drops.outOfWindow) parts.push(`${drops.outOfWindow} dated outside the accepted window`);
    if (drops.badDate) parts.push(`${drops.badDate} with an unusable start date`);
    if (drops.badName) parts.push(`${drops.badName} with a missing/too-short name`);
    if (drops.endBeforeStart)
      parts.push(`${drops.endBeforeStart} whose end date precedes its start`);
    if (drops.duplicate) parts.push(`${drops.duplicate} duplicates`);
    errors.push(`${totalDropped} of ${raw.length} entries were dropped: ${parts.join(", ")}.`);

    // The out-of-window case is nearly always a wrong-year extraction, so show
    // the range the model actually returned next to the window we accept.
    if (drops.outOfWindow > 0 && observedDates.length > 0) {
      const sorted = [...observedDates].sort();
      errors.push(
        `Extracted dates span ${sorted[0]} to ${sorted[sorted.length - 1]}; accepted window is ` +
          `${new Date(minStart).toISOString().slice(0, 10)} to ${new Date(maxStart).toISOString().slice(0, 10)}.`
      );
    }
  }
  if (valid.length === 0) errors.push("No valid calendar entries were found in the source.");
  return { valid, errors };
}
