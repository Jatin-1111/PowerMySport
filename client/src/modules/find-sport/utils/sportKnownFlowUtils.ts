import { getAmbitionOptions, getBestResultLadder, getCurrentStandingLadder } from "../data/sportArchetypes";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface KnownSportForm {
  issue: string | null;
  sport: string;
  childName: string;
  dateOfBirth: string; // ISO "YYYY-MM-DD" or ""
  gender: string | null;
  state: string | null;
  trainingType: string | null; // "self" | "club" | "academy" | "private"
  heightCm: number | null;
  weightKg: number | null;
  ambition: string | null;
  weeklyHours: string | null;
  budgetRange: string | null;
  // Current standing / track record
  yearsPlaying: number | null;
  currentStandingTier: number | null; // 1–5, archetype-aware ladder
  bestResultTier: number | null; // 1–5, archetype-aware ladder
  achievementsNote: string;
  // Training setup (academyName/sessionsPerWeek/trainingMonths only asked when trainingType !== "self")
  academyName: string;
  sessionsPerWeek: number | null;
  trainingMonths: number | null;
  // Physical
  injuryNotes: string;
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
  bestResultTier: null,
  achievementsNote: "",
  academyName: "",
  sessionsPerWeek: null,
  trainingMonths: null,
  injuryNotes: "",
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

// ─── Display label maps ───────────────────────────────────────────────────────

export const TRAINING_TYPE_DISPLAY: Record<string, string> = {
  self: "Self-practice",
  club: "Club / School",
  academy: "Academy",
  private: "Private coaching",
};

export const HOURS_DISPLAY: Record<string, string> = {
  "1-3": "1–3 hrs/week",
  "4-7": "4–7 hrs/week",
  "8-12": "8–12 hrs/week",
  "13-plus": "13+ hrs/week",
};

export const BUDGET_DISPLAY: Record<string, string> = {
  "under-3k": "Under ₹3k/mo",
  "3k-7k": "₹3k–7k/mo",
  "7k-15k": "₹7k–15k/mo",
  "15k-plus": "₹15k+/mo",
};

// ─── isAnswered ───────────────────────────────────────────────────────────────

export function isAnswered(id: keyof KnownSportForm, form: KnownSportForm): boolean {
  const v = form[id];
  if (typeof v === "string") return v.length > 0;
  if (typeof v === "number") return true;
  return v !== null;
}

// ─── Profile chip builders ────────────────────────────────────────────────────

// ─── Profile readout builders ────────────────────────────────────────────────
//
// NOT CURRENTLY RENDERED ANYWHERE. These powered the wizard's end-of-flow
// summary screen, which was deleted: it only read the parent's own answers back
// to them, so it cost a click and taught them nothing. The wizard now hands off
// straight to the roadmap.
//
// They are kept — pure, tested, and free at runtime since no component imports
// them — because the profile readout is wanted on the EXPERT-facing surface,
// where the reader is someone other than the parent who typed it. If that
// doesn't land, delete this block and its tests rather than leaving it to rot.

export function buildProfileChips(form: KnownSportForm): string[] {
  const age = getAgeFromDob(form.dateOfBirth);
  const standingLadder = form.sport ? getCurrentStandingLadder(form.sport) : [];
  const standingLabel =
    form.currentStandingTier != null
      ? standingLadder.find((t) => t.value === form.currentStandingTier)?.label ?? null
      : null;

  return [
    form.gender === "MALE" ? "Boy" : form.gender === "FEMALE" ? "Girl" : null,
    age !== null ? `Age ${age}` : null,
    form.state ?? null,
    standingLabel,
    form.yearsPlaying !== null ? `${form.yearsPlaying} yr${form.yearsPlaying === 1 ? "" : "s"} playing` : null,
    TRAINING_TYPE_DISPLAY[form.trainingType ?? ""] ?? null,
    form.academyName.trim() || null,
    form.sessionsPerWeek !== null ? `${form.sessionsPerWeek}x/week` : null,
  ].filter((v): v is string => v !== null && v.length > 0);
}

export function buildAchievementChips(form: KnownSportForm): string[] {
  const ladder = form.sport ? getBestResultLadder(form.sport) : [];
  const bestResultLabel =
    form.bestResultTier != null
      ? ladder.find((t) => t.value === form.bestResultTier)?.label ?? null
      : null;

  return [bestResultLabel, form.achievementsNote.trim() || null].filter(
    (v): v is string => v !== null && v.length > 0,
  );
}

export function buildGoalChips(form: KnownSportForm): string[] {
  const ambitionOptions = form.sport ? getAmbitionOptions(form.sport) : [];
  const ambitionLabel = form.ambition
    ? ambitionOptions.find((o) => o.value === form.ambition)?.label ?? null
    : null;

  return [
    ambitionLabel,
    HOURS_DISPLAY[form.weeklyHours ?? ""] ?? null,
    BUDGET_DISPLAY[form.budgetRange ?? ""] ?? null,
  ].filter((v): v is string => v !== null);
}

