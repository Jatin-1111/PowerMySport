// ─── Types ────────────────────────────────────────────────────────────────────

export interface KnownSportForm {
  sport: string;
  childName: string;
  dateOfBirth: string; // ISO "YYYY-MM-DD" or ""
  gender: string | null;
  state: string | null;
  experienceLevel: string | null; // "beginner" | "intermediate" | "competitive"
  trainingType: string | null; // "self" | "club" | "academy" | "private"
  energyType: string | null;
  motorType: string | null; // "gross" | "fine"
  heightCm: number | null;
  weightKg: number | null;
  ambition: string | null;
  weeklyHours: string | null;
  budgetRange: string | null;
}

export const EMPTY_FORM: KnownSportForm = {
  sport: "",
  childName: "",
  dateOfBirth: "",
  gender: null,
  state: null,
  experienceLevel: null,
  trainingType: null,
  energyType: null,
  motorType: null,
  heightCm: null,
  weightKg: null,
  ambition: null,
  weeklyHours: null,
  budgetRange: null,
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

/** Aligned with the app's 3 macro-level roadmap tiers */
export const EXPERIENCE_DISPLAY: Record<string, string> = {
  beginner: "Beginner",
  intermediate: "Intermediate",
  competitive: "Competitive",
};

export const ENERGY_DISPLAY: Record<string, string> = {
  explosive: "High energy",
  endurance: "Calm & focused",
};

export const AMBITION_DISPLAY: Record<string, string> = {
  fun: "Just for fun",
  competitive: "Local competitions",
  national: "State / national level",
  professional: "Professional pathway",
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

export function buildProfileChips(form: KnownSportForm): string[] {
  const age = getAgeFromDob(form.dateOfBirth);

  return [
    form.gender === "MALE" ? "Boy" : form.gender === "FEMALE" ? "Girl" : null,
    age !== null ? `Age ${age}` : null,
    form.state ?? null,
    EXPERIENCE_DISPLAY[form.experienceLevel ?? ""] ?? null,
    TRAINING_TYPE_DISPLAY[form.trainingType ?? ""] ?? null,
    ENERGY_DISPLAY[form.energyType ?? ""] ?? null,
  ].filter((v): v is string => v !== null && v.length > 0);
}

export function buildGoalChips(form: KnownSportForm): string[] {
  return [
    AMBITION_DISPLAY[form.ambition ?? ""] ?? null,
    HOURS_DISPLAY[form.weeklyHours ?? ""] ?? null,
    BUDGET_DISPLAY[form.budgetRange ?? ""] ?? null,
  ].filter((v): v is string => v !== null);
}
