import type {
  Ambition,
  ClaimChild,
  Experience,
  Gender,
  HandoffChild,
} from "../services/handoffApi";

/**
 * The review page's rules, kept apart from the screen so they can be tested without one.
 */

export interface ChildDraft {
  include: boolean;
  dob: string;
  gender?: Gender;
  ambition?: Ambition;
  experience?: Experience;
}

export const AMBITION_OPTIONS: ReadonlyArray<{ value: Ambition; label: string }> = [
  { value: "fun", label: "Fun" },
  { value: "competitive", label: "Competitive" },
  { value: "national", label: "National" },
  { value: "career", label: "Career" },
];

export const EXPERIENCE_OPTIONS: ReadonlyArray<{ value: Experience; label: string }> = [
  { value: "beginner", label: "Beginner" },
  { value: "intermediate", label: "Intermediate" },
  { value: "competitive", label: "Competitive" },
];

export const GENDER_OPTIONS: ReadonlyArray<{ value: Gender; label: string }> = [
  { value: "MALE", label: "Boy" },
  { value: "FEMALE", label: "Girl" },
  { value: "OTHER", label: "Other" },
];

/** Every child starts selected, with the suggestions pre-chosen for the parent to confirm. */
export function initialDrafts(children: HandoffChild[]): Record<string, ChildDraft> {
  return Object.fromEntries(
    children.map((child) => [
      child.key,
      {
        include: true,
        dob: "",
        ...(child.suggestedAmbition ? { ambition: child.suggestedAmbition } : {}),
        ...(child.suggestedExperience ? { experience: child.suggestedExperience } : {}),
      },
    ])
  );
}

const isoDay = (date: Date): string => date.toISOString().slice(0, 10);

/** The earliest and latest date of birth the form accepts: under 18, and not in the future. */
export function dobBounds(now: Date = new Date()): { min: string; max: string } {
  const min = new Date(now);
  min.setUTCFullYear(min.getUTCFullYear() - 18);
  // A child turning 18 today is no longer a child, so the day after is the first allowed.
  min.setUTCDate(min.getUTCDate() + 1);
  return { min: isoDay(min), max: isoDay(now) };
}

/** What is wrong with a date of birth, in words for the parent, or null when it is fine. */
export function dobProblem(dob: string, now: Date = new Date()): string | null {
  if (!dob) return "Enter a date of birth.";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dob) || Number.isNaN(new Date(dob).getTime())) {
    return "Enter a valid date of birth.";
  }
  const { min, max } = dobBounds(now);
  if (dob > max) return "A date of birth cannot be in the future.";
  if (dob < min) return "A child must be under 18.";
  return null;
}

export type BuiltClaim =
  { ok: true; items: ClaimChild[] } | { ok: false; errors: Record<string, string> };

/** The request for the children the parent ticked, or what to fix first. */
export function buildClaim(
  children: HandoffChild[],
  drafts: Record<string, ChildDraft>,
  now: Date = new Date()
): BuiltClaim {
  const items: ClaimChild[] = [];
  const errors: Record<string, string> = {};

  for (const child of children) {
    const draft = drafts[child.key];
    if (!draft?.include) continue;
    const problem = dobProblem(draft.dob, now);
    if (problem) {
      errors[child.key] = problem;
      continue;
    }
    items.push({
      key: child.key,
      dob: draft.dob,
      ...(draft.gender ? { gender: draft.gender } : {}),
      ...(draft.ambition ? { ambition: draft.ambition } : {}),
      ...(draft.experience ? { experienceLevel: draft.experience } : {}),
    });
  }

  if (Object.keys(errors).length > 0) return { ok: false, errors };
  if (items.length === 0) return { ok: false, errors: { _: "Choose at least one child." } };
  return { ok: true, items };
}
