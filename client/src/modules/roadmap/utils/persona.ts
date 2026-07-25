// ─── Roadmap persona ─────────────────────────────────────────────────────────
//
// Layer-1 (deterministic, no AI) personalization for the pathway explorer.
// One canonical read model over the three places we learn about a child:
//
//   1. The selected dependent (DB, logged in) — richest & durable; both the
//      /assessment/discover wizard and /sport-profile write to it.
//   2. `pms_sport_profile` (localStorage) — guest completion of /sport-profile;
//      carries the 1–5 currentStandingTier for one specific sport.
//   3. `pms_wizard_results` (localStorage) — guest completion of the discover
//      wizard; name/age/state/budget/ambition, no standing.
//
// Everything here renders client-side only — a child's name must never end up
// in URLs, analytics events, or anything shareable by link.

export interface RoadmapPersona {
  source: "dependent" | "guest";
  /** First name only. */
  name?: string;
  age?: number;
  state?: string;
  ambition?: "fun" | "competitive" | "national" | "professional";
  budgetRange?: "under-3k" | "3k-7k" | "7k-15k" | "15k-plus";
  weeklyHours?: "1-3" | "4-7" | "8-12" | "13-plus";
  /** 1–5 archetype-ladder standing — only meaningful for sports in `sports`. */
  standingTier?: number;
  experienceLevel?: "beginner" | "intermediate" | "competitive";
  /** Lowercased sports the standing/experience data was collected for. */
  sports: string[];
}

const SPORT_PROFILE_KEY = "pms_sport_profile";
const WIZARD_RESULTS_KEY = "pms_wizard_results";
const GUEST_FRESHNESS_MS = 7 * 24 * 60 * 60 * 1000;

export function firstName(full: string | undefined | null): string | undefined {
  const n = (full ?? "").trim().split(/\s+/)[0];
  return n ? n : undefined;
}

/** "Aarav" → "Aarav's" (works fine for Indian first names; no s-apostrophe fussing). */
export function possessive(name: string): string {
  return `${name}’s`;
}

export function ageFromDob(dob: string | Date | undefined | null): number | undefined {
  if (!dob) return undefined;
  const birth = new Date(dob);
  if (isNaN(birth.getTime())) return undefined;
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
  return age >= 1 && age <= 30 ? age : undefined;
}

// ─── Source → persona ────────────────────────────────────────────────────────

/** Structural subset of the Dependent/Player record the resolver reads. */
export interface DependentLike {
  name?: string;
  dob?: string | Date;
  age?: number;
  location?: string;
  ambition?: RoadmapPersona["ambition"];
  budgetRange?: RoadmapPersona["budgetRange"];
  weeklyHoursCategory?: RoadmapPersona["weeklyHours"];
  currentStandingTier?: number;
  experienceLevel?: RoadmapPersona["experienceLevel"];
  sportsFocus?: string[];
}

export function personaFromDependent(dep: DependentLike): RoadmapPersona {
  return {
    source: "dependent",
    name: firstName(dep.name),
    age: ageFromDob(dep.dob) ?? dep.age ?? undefined,
    state: dep.location || undefined,
    ambition: dep.ambition || undefined,
    budgetRange: dep.budgetRange || undefined,
    weeklyHours: dep.weeklyHoursCategory || undefined,
    standingTier: dep.currentStandingTier || undefined,
    experienceLevel: dep.experienceLevel || undefined,
    sports: (dep.sportsFocus ?? []).map((s) => s.toLowerCase()),
  };
}

function isFresh(savedAt: unknown): boolean {
  if (typeof savedAt !== "string") return false;
  const t = new Date(savedAt).getTime();
  return !isNaN(t) && Date.now() - t < GUEST_FRESHNESS_MS;
}

/**
 * Guest persona from localStorage: /sport-profile answers win per-field (they
 * carry the standing tier), the discover wizard fills the gaps.
 * Returns null when neither source is present and fresh.
 */
export function loadGuestPersona(): RoadmapPersona | null {
  if (typeof window === "undefined") return null;
  let out: RoadmapPersona | null = null;

  try {
    const raw = localStorage.getItem(WIZARD_RESULTS_KEY);
    if (raw) {
      const { answers, savedAt } = JSON.parse(raw);
      if (answers && isFresh(savedAt)) {
        out = {
          source: "guest",
          name: firstName(answers.childName),
          age: typeof answers.age === "number" ? answers.age : undefined,
          state: answers.state || undefined,
          ambition: answers.ambition || undefined,
          budgetRange: answers.budget || undefined,
          weeklyHours: answers.weeklyHours || undefined,
          sports: [],
        };
      }
    }
  } catch {}

  try {
    const raw = localStorage.getItem(SPORT_PROFILE_KEY);
    if (raw) {
      const { form, savedAt } = JSON.parse(raw);
      if (form && isFresh(savedAt)) {
        out = {
          source: "guest",
          name: firstName(form.childName) ?? out?.name,
          age: ageFromDob(form.dateOfBirth) ?? out?.age,
          state: form.state || out?.state,
          ambition: form.ambition || out?.ambition,
          budgetRange: form.budgetRange || out?.budgetRange,
          weeklyHours: form.weeklyHours || out?.weeklyHours,
          standingTier: form.currentStandingTier || undefined,
          sports: form.sport ? [String(form.sport).toLowerCase()] : [],
        };
      }
    }
  } catch {}

  return out;
}

// ─── Persona → pathway placement ─────────────────────────────────────────────

const EXPERIENCE_TO_RAW: Record<string, number> = {
  beginner: 1,
  intermediate: 3,
  competitive: 4,
};

/**
 * Raw pathway level (1–5) where this child stands in the given sport, or null
 * when we don't actually know this sport for them — a badminton standing must
 * never pin a level on the cricket roadmap.
 */
export function personaRawLevel(
  persona: RoadmapPersona | null,
  sportName: string,
): number | null {
  if (!persona) return null;
  const plays = persona.sports.includes(sportName.trim().toLowerCase());
  if (!plays) return null;
  if (persona.standingTier && persona.standingTier >= 1 && persona.standingTier <= 5) {
    return persona.standingTier;
  }
  if (persona.experienceLevel) {
    return EXPERIENCE_TO_RAW[persona.experienceLevel] ?? null;
  }
  return null;
}

/**
 * Raw level the family said they're aiming for. "fun" deliberately maps to
 * null — enjoyment is a complete outcome, not a rung to pin a goal flag on.
 */
export function ambitionTargetRawLevel(
  ambition: RoadmapPersona["ambition"],
): number | null {
  if (ambition === "competitive") return 3;
  if (ambition === "national") return 4;
  if (ambition === "professional") return 5;
  return null;
}

// ─── Layer-2: personal-notes request params ──────────────────────────────────

export interface PersonalNotesParams {
  age?: number;
  tier?: number;
  ambition?: string;
  budget?: string;
  hours?: string;
}

/**
 * Anonymized query params for the personal-notes endpoint. Deliberately no
 * name — the server caches by cohort signature and the client renders the
 * "For <name>" label itself. Returns null when we know nothing useful.
 */
export function personalNotesParams(
  persona: RoadmapPersona | null,
  sportName: string,
): PersonalNotesParams | null {
  if (!persona) return null;
  const tier = personaRawLevel(persona, sportName) ?? undefined;
  const params: PersonalNotesParams = {
    age: persona.age,
    tier,
    ambition: persona.ambition,
    budget: persona.budgetRange,
    hours: persona.weeklyHours,
  };
  return params.age || params.tier || params.ambition || params.budget || params.hours
    ? params
    : null;
}

// ─── Fit helpers (age & budget vs a stage) ───────────────────────────────────

export type AgeFit = { fit: "within" | "younger" | "older"; min: number; max: number };

/** Parse a merged age-range label like "8 – 14 years" against the child's age. */
export function getAgeFit(
  ageRangeLabel: string | undefined,
  age: number | undefined,
): AgeFit | null {
  if (!ageRangeLabel || !age) return null;
  const nums = (ageRangeLabel.match(/\d+/g) || []).map(Number);
  if (nums.length === 0) return null;
  const min = Math.min(...nums);
  const max = Math.max(...nums);
  return { fit: age < min ? "younger" : age > max ? "older" : "within", min, max };
}

const BUDGET_CEILING: Record<NonNullable<RoadmapPersona["budgetRange"]>, number> = {
  "under-3k": 3000,
  "3k-7k": 7000,
  "7k-15k": 15000,
  "15k-plus": Number.POSITIVE_INFINITY,
};

export const BUDGET_RANGE_DISPLAY: Record<
  NonNullable<RoadmapPersona["budgetRange"]>,
  string
> = {
  "under-3k": "under ₹3k/mo",
  "3k-7k": "₹3k–7k/mo",
  "7k-15k": "₹7k–15k/mo",
  "15k-plus": "₹15k+/mo",
};

export type BudgetFit = "within" | "stretch" | "above";

/**
 * Compare the family's stated budget with a stage's typical coaching-fee
 * bounds (from macroLevels' fee tiers). "above" = even the stage's entry cost
 * exceeds their budget; "stretch" = entry fits but the top of the range doesn't.
 */
export function getBudgetFit(
  feeBounds: { low: number; high: number } | null,
  budgetRange: RoadmapPersona["budgetRange"],
): BudgetFit | null {
  if (!feeBounds || !budgetRange) return null;
  const ceiling = BUDGET_CEILING[budgetRange];
  if (feeBounds.low > ceiling) return "above";
  if (feeBounds.high <= ceiling) return "within";
  return "stretch";
}
