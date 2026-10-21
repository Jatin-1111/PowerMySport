import type { ChildFields } from "@/modules/player/hooks/useSaveChild";
import { deriveExperienceLevel } from "../data/sportArchetypes";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface KnownSportForm {
  issue: string | null;
  sport: string;
  childName: string;
  dateOfBirth: string; // ISO "YYYY-MM-DD" or ""
  gender: string | null;
  state: string | null;
  trainingType: string | null; // one of CHILD_TRAINING_TYPES
  heightCm: number | null;
  weightKg: number | null;
  ambition: string | null;
  weeklyHours: string | null;
  budgetRange: string | null;
  // Current standing / track record
  yearsPlaying: number | null;
  currentStandingTier: number | null; // 1–5, archetype-aware ladder
}

export const EMPTY_FORM: KnownSportForm = {
  issue: null,
  sport: "",
  childName: "",
  dateOfBirth: "",
  gender: null,
  state: null,
  trainingType: null,
  heightCm: null,
  weightKg: null,
  ambition: null,
  weeklyHours: null,
  budgetRange: null,
  yearsPlaying: null,
  currentStandingTier: null,
};

// ─── Date of birth helpers ────────────────────────────────────────────────────

/** Returns completed years from a "YYYY-MM-DD" string, or null if invalid / out of 1–30 range. */
export function getAgeFromDob(dob: string): number | null {
  if (!dob) return null;
  const birth = new Date(dob);
  if (isNaN(birth.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) age--;
  return age >= 1 && age <= 30 ? age : null;
}

// ─── isAnswered ───────────────────────────────────────────────────────────────

export function isAnswered(id: keyof KnownSportForm, form: KnownSportForm): boolean {
  const v = form[id];
  if (typeof v === "string") return v.length > 0;
  if (typeof v === "number") return true;
  return v !== null;
}

/**
 * What "I know my sport" saves on the child.
 *
 * The flow's premise is that the parent already knows the sport, so that is a decision, not
 * just an interest: it sets `chosenSport` as well as `sportsFocus` (it used to write only
 * `sportsFocus`, so the choice never registered anywhere else). The level is derived from the
 * 1 to 5 standing so the two cannot disagree. Only answered questions are included, so a
 * blank one never clears something already on the profile.
 */
export function buildKnownSportFields(form: KnownSportForm, now: Date = new Date()): ChildFields {
  return {
    // Loosely typed as `string` on the form, but this flow only ever writes MALE or FEMALE.
    ...(form.gender ? { gender: form.gender as ChildFields["gender"] } : {}),
    ...(form.state ? { location: form.state } : {}),
    ...(form.dateOfBirth ? { dob: form.dateOfBirth } : {}),
    ...(form.sport
      ? { sportsFocus: [form.sport], chosenSport: form.sport, chosenSportAt: now.toISOString() }
      : {}),
    // Typed as `string` because the options vary per sport archetype, but every value it can
    // hold comes from the ambition vocabulary.
    ...(form.ambition ? { ambition: form.ambition as ChildFields["ambition"] } : {}),
    ...(form.yearsPlaying !== null ? { yearsPlaying: form.yearsPlaying } : {}),
    ...(form.currentStandingTier !== null
      ? {
          currentStandingTier: form.currentStandingTier,
          experienceLevel: deriveExperienceLevel(form.currentStandingTier),
        }
      : {}),
  };
}
