import { Medal, Star, Trophy, type LucideIcon } from "lucide-react";

// ─── Wizard-derived field labels ─────────────────────────────────────────────
// Shared display labels for the pathway-assessment fields stored on a
// Player/Dependent record. Used by the dependent profile builder and the
// my-profile dependent cards so both surfaces describe the same values the
// same way.

export const GENDER_LABELS: Record<string, string> = {
  MALE: "Male",
  FEMALE: "Female",
  OTHER: "Other",
};

export const AMBITION_LABELS: Record<string, string> = {
  fun: "Plays for fun",
  competitive: "Competitive",
  national: "National-level goal",
  professional: "Professional pathway",
};

export const ENERGY_LABELS: Record<string, string> = {
  explosive: "Explosive energy",
  endurance: "Endurance type",
};

export const MOTOR_LABELS: Record<string, string> = {
  gross: "Gross motor strength",
  fine: "Fine motor precision",
};

export const VISUAL_TRACKING_LABELS: Record<string, string> = {
  strong: "Strong visual tracking",
  moderate: "Moderate visual tracking",
  weak: "Developing visual tracking",
};

export const EYESIGHT_LABELS: Record<string, string> = {
  sharp: "Sharp eyesight",
  corrected: "Corrected vision",
  limited: "Limited vision",
};

export const AGILITY_LABELS: Record<string, string> = {
  high: "High agility",
  moderate: "Moderate agility",
  low: "Low agility",
};

export const FOCUS_LABELS: Record<string, string> = {
  bursts: "Focuses in bursts",
  sustained: "Sustained focus",
};

export const DECISION_LABELS: Record<string, string> = {
  react: "Instinctive player",
  strategic: "Strategic thinker",
};

export const PRESSURE_LABELS: Record<string, string> = {
  thrives: "Thrives under pressure",
  manages: "Manages pressure",
  avoids: "Prefers low pressure",
};

export const COMPETITIVE_RESPONSE_LABELS: Record<string, string> = {
  "fired-up": "Fires up competing",
  calm: "Stays calm competing",
  discouraged: "Discouraged by losses",
};

export const REPETITION_LABELS: Record<string, string> = {
  high: "High repetition tolerance",
  low: "Prefers variety over drilling",
};

export const CONTACT_LABELS: Record<string, string> = {
  loves: "Contact OK",
  neutral: "Neutral on contact",
  avoids: "Avoids contact",
};

export const ENV_LABELS: Record<string, string> = {
  outdoor: "Prefers outdoors",
  indoor: "Prefers indoors",
  "no-preference": "Any environment",
};

export const WATER_COMFORT_LABELS: Record<string, string> = {
  comfortable: "Comfortable in water",
  neutral: "Neutral on water",
  uncomfortable: "Uncomfortable in water",
};

export const BUILD_LABELS: Record<string, string> = {
  lean: "Lean build",
  average: "Average build",
  stocky: "Strong build",
};

export const HEIGHT_LABELS: Record<string, string> = {
  short: "Compact for age",
  average: "Average height",
  tall: "Tall for age",
};

export const BUDGET_RANGE_LABELS: Record<string, string> = {
  "under-3k": "Under ₹3,000/month",
  "3k-7k": "₹3,000 – 7,000/month",
  "7k-15k": "₹7,000 – 15,000/month",
  "15k-plus": "₹15,000+/month",
};

export const WEEKLY_HOURS_LABELS: Record<string, string> = {
  "1-3": "1–3 hrs/week",
  "4-7": "4–7 hrs/week",
  "8-12": "8–12 hrs/week",
  "13-plus": "13+ hrs/week",
};

export const TEAM_INDIVIDUAL_LABELS: Record<number, string> = {
  1: "Very individual",
  2: "Mostly individual",
  3: "Balanced",
  4: "Mostly team-oriented",
  5: "Very team-oriented",
};

/** Looks up a label for a possibly-undefined categorical value. Returns null if unset or unmapped. */
export function wizardChip(
  val: string | number | undefined | null,
  map: Record<string | number, string>,
): string | null {
  if (val === undefined || val === null) return null;
  return map[val] ?? null;
}

/** Shared rank styling for the top-3 sport match display (modal + dependent cards). */
export const MATCH_RANK_META: Array<{ icon: LucideIcon; badge: string; ring: string }> = [
  { icon: Trophy, badge: "bg-power-orange/10 text-power-orange", ring: "border-power-orange/20" },
  { icon: Medal, badge: "bg-slate-100 text-slate-600", ring: "border-slate-200" },
  { icon: Star, badge: "bg-slate-100 text-slate-500", ring: "border-slate-200" },
];
