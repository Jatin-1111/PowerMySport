// ─── WizardAnswers ⇄ Dependent/Player mapping ────────────────────────────────
// Translates between the quiz's answer shape and a child as the server stores it
// (the `Dependent` type: profile fields flat, quiz answers under `quiz`). Build,
// height category, budget tier, objective and weekly hours are not stored; they are
// derived from the fields kept (see the helpers below).

import type {
  ChildAmbition,
  ChildBudgetRange,
  ChildGender,
  ChildWeeklyHours,
} from "@powermysport/shared-types";
import type { Dependent, DependentQuiz } from "@/types";
import type { SportFitResult, SportResult, WizardAnswers } from "../types";

/** Build and height category are worked out from the measurements, never stored. */
export function deriveBodyCategories(
  heightCm: number | null | undefined,
  weightKg: number | null | undefined,
  age: number | null
): {
  build?: "lean" | "average" | "stocky";
  heightCategory?: "short" | "average" | "tall";
} {
  return {
    ...(heightCm && weightKg ? { build: deriveBuild(weightKg, heightCm) } : {}),
    ...(heightCm ? { heightCategory: deriveHeightCategoryFromCm(heightCm, age) } : {}),
  };
}

export function cmToFeetInches(cm: number): string {
  const totalInches = cm / 2.54;
  const feet = Math.floor(totalInches / 12);
  const inches = Math.round(totalInches % 12);
  return `${feet}′ ${inches}″`;
}

export function deriveHeightCategoryFromCm(
  cm: number,
  age: number | null
): "short" | "average" | "tall" {
  const avg = age ? Math.min(175, 85 + age * 5.5) : 140;
  if (cm < avg * 0.93) return "short";
  if (cm > avg * 1.07) return "tall";
  return "average";
}

export function deriveBuild(weightKg: number, heightCm: number): "lean" | "average" | "stocky" {
  const bmi = weightKg / (heightCm / 100) ** 2;
  if (bmi < 17) return "lean";
  if (bmi > 22) return "stocky";
  return "average";
}

/**
 * sportMatches leads with the sports the parent shortlisted themselves, then
 * fills any remaining slots with our own recommendations. Downstream consumers
 * (expert context, roadmap personalisation) read sportMatches[0] as "the sport
 * this family is pursuing" — after the shortlist pivot that's the parent's own
 * first pick, not our top suggestion.
 */
function mergeSportMatches(
  scored: SportResult[],
  chosen: SportFitResult[]
): Array<{ sport: string; fitLabel: string; score: number }> {
  const seen = new Set<string>();
  const out: Array<{ sport: string; fitLabel: string; score: number }> = [];
  for (const r of [...chosen, ...scored]) {
    if (seen.has(r.sport.name)) continue;
    seen.add(r.sport.name);
    out.push({ sport: r.sport.name, fitLabel: r.fitLabel, score: r.score });
    if (out.length === 3) break;
  }
  return out;
}

export function buildDependentPayload(
  answers: WizardAnswers,
  scored: SportResult[],
  name?: string,
  chosen: SportFitResult[] = [],
  /**
   * Set only when a guest picked a sport before registering — the pick has
   * nowhere to live until the dependent exists, so it rides in on creation.
   * Omitted on a normal save so a later retake never wipes an earlier decision.
   */
  chosenSport?: string
): Partial<Dependent> {
  const genderMap =
    answers.gender === "boy"
      ? "MALE"
      : answers.gender === "girl"
        ? "FEMALE"
        : answers.gender === "prefer-not"
          ? "OTHER"
          : undefined;
  return {
    ...(name ? { name } : {}),
    dob: answers.dob ?? undefined,
    age: answers.age ?? undefined,
    gender: genderMap,
    location: answers.state ?? undefined,
    sportsFocus: answers.priorSports.length ? answers.priorSports : undefined,
    consideringSports: answers.consideringSports.length ? answers.consideringSports : undefined,
    sportMatches: mergeSportMatches(scored, chosen),
    wizardCompletedAt: new Date().toISOString(),
    ...(chosenSport ? { chosenSport, chosenSportAt: new Date().toISOString() } : {}),
    budgetRange: answers.budget ?? undefined,
    ambition: answers.ambition ?? undefined,
    weeklyHoursCategory: answers.weeklyHours ?? undefined,
    quiz: {
      heightCm: answers.height ?? undefined,
      weightKg: answers.weight ?? undefined,
      energyType: answers.energyType ?? undefined,
      motorType: answers.motorType ?? undefined,
      visualTracking: answers.visualTracking ?? undefined,
      eyesight: answers.eyesight ?? undefined,
      agility: answers.agility ?? undefined,
      teamIndividual: answers.teamIndividual ?? undefined,
      competitiveResponse: answers.competitiveResponse ?? undefined,
      focusStyle: answers.focusStyle ?? undefined,
      decisionStyle: answers.decisionStyle ?? undefined,
      pressureResponse: answers.pressureResponse ?? undefined,
      repetitionTolerance: answers.repetitionTolerance ?? undefined,
      contactComfort: answers.contactComfort ?? undefined,
      environment: answers.environment ?? undefined,
      waterComfort: answers.waterComfort ?? undefined,
    },
  };
}

// The part of a child the quiz pre-fill reads: the profile fields and the `quiz` record,
// as the server returns them. Both the guidance module's `PlayerProfile` and the
// app-wide `Dependent` satisfy it, so either can be passed without casting.
export interface WizardSourceProfile {
  age?: number;
  dob?: string | Date;
  gender?: ChildGender;
  location?: string;
  sportsFocus?: string[];
  consideringSports?: string[];
  budgetRange?: ChildBudgetRange;
  ambition?: ChildAmbition;
  weeklyHoursCategory?: ChildWeeklyHours;
  quiz?: DependentQuiz | null;
}

export function prefillFromPlayer(player: WizardSourceProfile): Partial<WizardAnswers> {
  const out: Partial<WizardAnswers> = {};
  if (player.dob) out.dob = new Date(player.dob).toISOString().slice(0, 10);
  if (player.age) out.age = player.age;
  if (player.gender === "MALE") out.gender = "boy";
  else if (player.gender === "FEMALE") out.gender = "girl";
  else if (player.gender === "OTHER") out.gender = "prefer-not";

  if (player.location) out.state = player.location;

  if (player.sportsFocus?.length) out.priorSports = player.sportsFocus;
  if (player.consideringSports?.length) out.consideringSports = player.consideringSports;

  // The quiz's own answers
  const q = player.quiz ?? {};
  if (q.heightCm) out.height = q.heightCm;
  if (q.weightKg) out.weight = q.weightKg;
  if (q.energyType) out.energyType = q.energyType;
  if (q.motorType) out.motorType = q.motorType;
  if (q.visualTracking) out.visualTracking = q.visualTracking;
  if (q.eyesight) out.eyesight = q.eyesight;
  if (q.agility) out.agility = q.agility;
  if (q.teamIndividual !== undefined) out.teamIndividual = q.teamIndividual;
  if (q.competitiveResponse) out.competitiveResponse = q.competitiveResponse;
  if (q.focusStyle) out.focusStyle = q.focusStyle;
  if (q.decisionStyle) out.decisionStyle = q.decisionStyle;
  if (q.pressureResponse) out.pressureResponse = q.pressureResponse;
  if (q.repetitionTolerance) out.repetitionTolerance = q.repetitionTolerance;
  if (q.contactComfort) out.contactComfort = q.contactComfort;
  if (q.environment) out.environment = q.environment;
  if (q.waterComfort) out.waterComfort = q.waterComfort;
  // What it takes to do the sport
  if (player.budgetRange) out.budget = player.budgetRange;
  if (player.ambition) out.ambition = player.ambition;
  if (player.weeklyHoursCategory) out.weeklyHours = player.weeklyHoursCategory;

  return out;
}
