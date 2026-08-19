// ─── Reading an authored age range ───────────────────────────────────────────
//
// `ageRange` is free text by design — the CMS lets an author write "~5–7", "18+"
// or "10 to 14", because a pathway's ages are genuinely fuzzy and forcing them
// into two number fields would make the content lie about how sharp it is.
//
// That freedom is only affordable if reading it back is forgiving. This parser
// answers one question — "could a child of age N be at this stage?" — and
// answers `null` whenever it is not sure, so an unparseable range simply opts
// out of age matching instead of silently claiming a wrong stage.

/**
 * Where the child's age is remembered, shared by the `/roadmap` picker and the
 * per-sport reader.
 *
 * One key on purpose: a parent who types "9" on the index should land on the
 * right stage and never be asked again, on this sport or the next one. It lived
 * privately in the reader until the index needed to agree with it.
 */
export const AGE_STORAGE_KEY = "pms_pathway_child_age";

export interface ParsedAgeRange {
  min: number;
  /** Absent means open-ended ("18+"). */
  max?: number;
}

/**
 * Pull an age range out of authored text.
 *
 * Handles the shapes the blueprint actually uses — "~5–7" (en dash), "~7-11"
 * (hyphen), "18+" — plus "10 to 14" and a bare "12". Anything else returns null.
 */
export function parseAgeRange(raw: string): ParsedAgeRange | null {
  const numbers = raw.match(/\d+/g);
  if (!numbers || numbers.length === 0) return null;

  const first = Number(numbers[0]);
  if (!Number.isFinite(first)) return null;

  if (numbers.length >= 2) {
    const second = Number(numbers[1]);
    if (!Number.isFinite(second)) return null;
    // Tolerate a reversed range rather than rejecting it: "7–5" is a typo, not
    // a reason to drop age matching for the whole stage.
    return { min: Math.min(first, second), max: Math.max(first, second) };
  }

  // A single number is open-ended only when the text says so ("18+", "18 and
  // over"). A bare "12" means twelve.
  const openEnded = /\+|\band (?:over|above|up)\b|\bonwards?\b/i.test(raw);
  return openEnded ? { min: first } : { min: first, max: first };
}

/** Whether a child of `age` could be at a stage whose range reads `raw`. */
export function ageFitsRange(raw: string, age: number): boolean {
  const parsed = parseAgeRange(raw);
  if (!parsed) return false;
  if (age < parsed.min) return false;
  return parsed.max === undefined || age <= parsed.max;
}

/**
 * The best stage for a child of `age`, as an index, or -1.
 *
 * Stages overlap on purpose — tennis runs 10–14 and 13–16 — so a 13-year-old
 * matches two. The EARLIEST match wins: a parent arriving at a stage they have
 * already passed loses a scroll, while one dropped past the stage they are
 * living in loses the advice they came for.
 */
export function findStageForAge(
  stages: Array<{ ageRange: string }>,
  age: number,
): number {
  return stages.findIndex((stage) => ageFitsRange(stage.ageRange, age));
}
