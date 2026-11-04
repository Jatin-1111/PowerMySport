// ─── Small, mechanical checks on what a reading came back with ──────────────
//
// None of these ask a model anything. They exist because a model reading a page
// cold can be fluent and still wrong about which scheme it read, which year it
// is for, and what belongs in which field; each was seen on a real reading.

// ── Is this the scheme the lead was about? ──────────────────────────────────

/** Words that name a kind of thing rather than which thing, so they prove nothing about a match. */
const GENERIC = new Set([
  "the",
  "and",
  "for",
  "of",
  "in",
  "on",
  "to",
  "a",
  "an",
  "scholarship",
  "scholarships",
  "scheme",
  "schemes",
  "program",
  "programme",
  "programs",
  "programmes",
  "sports",
  "sport",
  "admission",
  "admissions",
  "selection",
  "quota",
  "india",
  "indian",
  "national",
  "school",
  "college",
  "university",
  "academy",
  "trials",
  "trial",
]);

const tokens = (name: string): Set<string> =>
  new Set(
    name
      .toLowerCase()
      // A parenthesised abbreviation or year ("(MRTSS)", "2026-27") is not the name.
      .replace(/\([^)]*\)/g, " ")
      .replace(/[^a-z0-9]+/g, " ")
      .split(" ")
      .filter((word) => word.length >= 3 && !/^\d+$/.test(word) && !GENERIC.has(word))
  );

/**
 * Whether the title that was read plausibly names the scheme the lead was about.
 *
 * At least half of the smaller name's distinctive words must be in the other. A
 * foundation's page that links an older, different scheme reads fluently as that
 * scheme, and without this the editor would be handed a confident draft of the
 * wrong thing. When either name has no distinctive words there is nothing to
 * compare, so it does not block.
 */
export function titleMatchesLead(leadName: string, readTitle: string): boolean {
  const lead = tokens(leadName);
  const read = tokens(readTitle);
  if (lead.size === 0 || read.size === 0) return true;
  const shared = [...lead].filter((word) => read.has(word)).length;
  return shared / Math.min(lead.size, read.size) >= 0.5;
}

// ── Is the year it is for out of date? ──────────────────────────────────────

/**
 * The last year a cycle label names: "2026-27" is 2027, "2021-22" is 2022, "2025"
 * is 2025. Null when the label has no year.
 */
function lastYearOf(label: string): number | null {
  const years: number[] = [];
  for (const match of label.matchAll(/(20\d{2})(?:\s*[-/–]\s*(\d{2,4}))?/g)) {
    const start = Number(match[1]);
    years.push(start);
    const end = match[2];
    if (end)
      years.push(end.length === 2 ? Math.floor(start / 100) * 100 + Number(end) : Number(end));
  }
  return years.length ? Math.max(...years) : null;
}

/**
 * Says so when the rules read are for a year that is over, or the document is
 * years old. Rules change every cycle, and a page that links last decade's form
 * reads as confidently as one that links this year's.
 */
export function staleCycleReason(
  cycleLabel: string | undefined,
  sourcePublishedOn: string | undefined,
  now: Date = new Date()
): string | null {
  const thisYear = now.getUTCFullYear();
  const labelYear = cycleLabel ? lastYearOf(cycleLabel) : null;
  if (labelYear !== null && labelYear < thisYear - 1) {
    return `The rules read are for ${cycleLabel}, which is out of date.`;
  }
  const publishedYear = sourcePublishedOn ? Number(sourcePublishedOn.slice(0, 4)) : null;
  if (publishedYear && publishedYear < thisYear - 2) {
    return `The document is from ${publishedYear}, which is out of date.`;
  }
  return null;
}

// ── Keep what it costs out of the one-line "who can apply" ──────────────────

const COST_WORDS = /\b(free|fees?|costs?|charges?|charged)\b/i;
const COST_TAIL = /,\s*(?:and\s+)?[^,;]*\b(?:free|fees?|costs?|charges?|charged)\b[^,;]*$/i;

/**
 * Takes cost wording out of the who-can-apply line. The cost has its own field, and
 * asking the model to keep it out did not hold: "Open to aspiring players;
 * participation is free for girls" came back after the prompt said not to. Whole
 * clauses (split at "." and ";") that talk about cost are dropped, and so is a
 * trailing ", free for ..." tail. A clause about an income limit is not a cost
 * and stays. Null when nothing is left.
 */
export function stripCostWording(line: string | undefined): string | undefined {
  if (!line) return line;
  const kept = line
    .split(/[.;]\s*/)
    // A cost tail on a clause that is otherwise about who: "...players, and free for girls".
    .map((clause) => clause.replace(COST_TAIL, "").trim())
    .filter((clause) => clause && !COST_WORDS.test(clause));
  return kept.join("; ") || undefined;
}
