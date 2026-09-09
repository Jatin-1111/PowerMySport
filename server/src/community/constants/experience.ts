/**
 * The Experience taxonomy: what an experience is *about* (category), which
 * sport it concerns, and — when it is anchored to a real tournament, venue,
 * academy or coach — which structured signals the composer asks for.
 *
 * These slugs are stored in the database. Renaming one is a migration, not an
 * edit.
 */

// ─── Categories ───────────────────────────────────────────────────────────────
// What kind of experience this is. Required on every experience; doubles as the
// composer prompt. The client has its own display list (labels, icons) in
// community/src/modules/community/constants/experienceCategories.ts — icons
// cannot live here because they would have to cross a server→client boundary.

export const EXPERIENCE_CATEGORIES = [
  "match-day",
  "training",
  "injury-recovery",
  "choosing-sport",
  "finding-academy",
  "gear",
  "travel-stay",
  "school-balance",
  "money",
  "nutrition",
  "mindset",
  "general",
] as const;

export type ExperienceCategory = (typeof EXPERIENCE_CATEGORIES)[number];

export const DEFAULT_EXPERIENCE_CATEGORY: ExperienceCategory = "general";

const CATEGORY_SET = new Set<string>(EXPERIENCE_CATEGORIES);

export const isExperienceCategory = (value: unknown): value is ExperienceCategory =>
  typeof value === "string" && CATEGORY_SET.has(value);

export const normalizeExperienceCategory = (value?: unknown): ExperienceCategory =>
  isExperienceCategory(value) ? value : DEFAULT_EXPERIENCE_CATEGORY;

// ─── Sports ───────────────────────────────────────────────────────────────────
// Optional. Deliberately stored in the same TitleCase form the old `topic`
// field used, so migration 39 moves the value across without rewriting it.

export const EXPERIENCE_SPORTS = [
  "Cricket",
  "Football",
  "Badminton",
  "Hockey",
  "Tennis",
  "Basketball",
  "Athletics",
  "Swimming",
  "Cycling",
] as const;

export type ExperienceSport = (typeof EXPERIENCE_SPORTS)[number];

const SPORT_SET = new Set<string>(EXPERIENCE_SPORTS);

export const isExperienceSport = (value: unknown): value is ExperienceSport =>
  typeof value === "string" && SPORT_SET.has(value);

// ─── Subjects ─────────────────────────────────────────────────────────────────
// What an experience can be anchored to. An experience without a subject is
// simply a parent writing about their own child — that is the common case and
// stays first-class.
//
// COACH and EXPERT name individuals and ACADEMY/VENUE name businesses, which is
// why those carry pre-publication moderation (see `moderationStatus` on the
// model). TOURNAMENT and TOURNAMENT_EDITION describe an event and do not.

export const EXPERIENCE_SUBJECT_KINDS = [
  "TOURNAMENT",
  "TOURNAMENT_EDITION",
  "VENUE",
  "ACADEMY",
  "COACH",
  "EXPERT",
] as const;

export type ExperienceSubjectKind = (typeof EXPERIENCE_SUBJECT_KINDS)[number];

/** Subject kinds that name a person or a business, and so need review first. */
export const MODERATED_SUBJECT_KINDS: readonly ExperienceSubjectKind[] = [
  "COACH",
  "EXPERT",
] as const;

export const requiresPreModeration = (kind?: ExperienceSubjectKind | null): boolean =>
  Boolean(kind && MODERATED_SUBJECT_KINDS.includes(kind));

/** Which Mongoose model each subject kind points at, for populate/lookup. */
export const SUBJECT_KIND_REF: Record<ExperienceSubjectKind, string> = {
  TOURNAMENT: "Tournament",
  TOURNAMENT_EDITION: "TournamentEdition",
  VENUE: "Venue",
  ACADEMY: "Academy",
  COACH: "Coach",
  EXPERT: "ExpertProfile",
};

// ─── Signals ──────────────────────────────────────────────────────────────────
// Three-point answers, asked only when an experience has a subject. Three points
// rather than five stars on purpose: this is reporting, not scoring, and the
// aggregate is shown as counts ("7 of 9 said organisation was smooth") rather
// than a number out of five. The star rating on provider pages is a different
// thing entirely — see client/models/Review.ts, which stays as it is.

export const SIGNAL_VALUES = ["GOOD", "OKAY", "POOR"] as const;

export type SignalValue = (typeof SIGNAL_VALUES)[number];

/**
 * Every signal key across every subject kind. Stored as a flat subdocument
 * rather than a Map so the entity-page aggregate is a plain `$group`.
 */
export const SIGNAL_KEYS = [
  "organisation",
  "facilities",
  "officiating",
  "valueForMoney",
  "travelAndStay",
  "cleanliness",
  "staff",
  "coachingQuality",
  "communication",
  "punctuality",
] as const;

export type SignalKey = (typeof SIGNAL_KEYS)[number];

/** Which signals the composer asks for, per subject kind. */
export const SIGNAL_KEYS_BY_SUBJECT_KIND: Record<ExperienceSubjectKind, readonly SignalKey[]> = {
  TOURNAMENT: ["organisation", "facilities", "officiating", "valueForMoney", "travelAndStay"],
  TOURNAMENT_EDITION: [
    "organisation",
    "facilities",
    "officiating",
    "valueForMoney",
    "travelAndStay",
  ],
  VENUE: ["facilities", "cleanliness", "staff", "valueForMoney"],
  ACADEMY: ["coachingQuality", "facilities", "communication", "valueForMoney"],
  COACH: ["coachingQuality", "communication", "punctuality", "valueForMoney"],
  EXPERT: ["coachingQuality", "communication", "punctuality", "valueForMoney"],
};

/**
 * Drop any signal that does not belong to the given subject kind, and any value
 * outside the three-point scale. Returns undefined when nothing survives, so a
 * caller can leave the field unset rather than storing an empty object.
 */
export const pickValidSignals = (
  kind: ExperienceSubjectKind | null | undefined,
  raw: unknown
): Partial<Record<SignalKey, SignalValue>> | undefined => {
  if (!kind || !raw || typeof raw !== "object") return undefined;

  const allowed = SIGNAL_KEYS_BY_SUBJECT_KIND[kind];
  const source = raw as Record<string, unknown>;
  const picked: Partial<Record<SignalKey, SignalValue>> = {};

  for (const key of allowed) {
    const value = source[key];
    if (typeof value === "string" && (SIGNAL_VALUES as readonly string[]).includes(value)) {
      picked[key] = value as SignalValue;
    }
  }

  return Object.keys(picked).length > 0 ? picked : undefined;
};
