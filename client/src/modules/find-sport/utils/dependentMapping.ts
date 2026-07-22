// ─── WizardAnswers ⇄ Dependent/Player mapping ────────────────────────────────
// Shared translation layer between the pathway wizard's answer shape and the
// Player/Dependent record persisted via /api/auth/dependents. Used by the
// wizard (WizardShell) and by the dependent profile builder so both write the
// exact same derived fields (build, heightCategory, budgetTier, etc.) from
// the same source data.

import type { Dependent } from "@/types";
import { EMPTY_ANSWERS, type SportResult, type WizardAnswers } from "../types";

export function budgetRangeToTier(
  range: WizardAnswers["budget"],
): "Budget" | "Moderate" | "Premium" {
  if (range === "under-3k" || range === "3k-7k") return "Budget";
  if (range === "7k-15k") return "Moderate";
  return "Premium";
}

export function cmToFeetInches(cm: number): string {
  const totalInches = cm / 2.54;
  const feet = Math.floor(totalInches / 12);
  const inches = Math.round(totalInches % 12);
  return `${feet}′ ${inches}″`;
}

export function weeklyHoursToNumber(
  h: WizardAnswers["weeklyHours"],
): number | undefined {
  if (!h) return undefined;
  return h === "1-3" ? 2 : h === "4-7" ? 5 : h === "8-12" ? 10 : 15;
}

export function ambitionToObjective(
  ambition: WizardAnswers["ambition"],
): "Recreational" | "Fitness" | "Compete" {
  if (ambition === "fun") return "Recreational";
  if (ambition === "competitive") return "Fitness";
  return "Compete";
}

export function deriveHeightCategoryFromCm(
  cm: number,
  age: number | null,
): "short" | "average" | "tall" {
  const avg = age ? Math.min(175, 85 + age * 5.5) : 140;
  if (cm < avg * 0.93) return "short";
  if (cm > avg * 1.07) return "tall";
  return "average";
}

export function deriveBuild(
  weightKg: number,
  heightCm: number,
): "lean" | "average" | "stocky" {
  const bmi = weightKg / ((heightCm / 100) ** 2);
  if (bmi < 17) return "lean";
  if (bmi > 22) return "stocky";
  return "average";
}

export function buildDependentPayload(
  answers: WizardAnswers,
  scored: SportResult[],
  name?: string,
): Partial<Dependent> {
  const genderMap =
    answers.gender === "boy" ? "MALE"
    : answers.gender === "girl" ? "FEMALE"
    : answers.gender === "prefer-not" ? "OTHER"
    : undefined;
  return {
    ...(name ? { name } : {}),
    age: answers.age ?? undefined,
    gender: genderMap,
    location: answers.state ?? undefined,
    sportsFocus: answers.priorSports.length ? answers.priorSports : undefined,
    sportsInFamily: answers.sportsInFamily.length ? answers.sportsInFamily : undefined,
    peerSports: answers.peerSports.length ? answers.peerSports : undefined,
    informalSports: answers.informalSports.length ? answers.informalSports : undefined,
    informalReaction: answers.informalReaction ?? undefined,
    futureFlexibility: answers.futureFlexibility ?? undefined,
    heightCm: answers.height ?? undefined,
    weightKg: answers.weight ?? undefined,
    heightCategory: answers.height ? deriveHeightCategoryFromCm(answers.height, answers.age) : undefined,
    build: answers.height && answers.weight ? deriveBuild(answers.weight, answers.height) : undefined,
    energyType: answers.energyType ?? undefined,
    motorType: answers.motorType ?? undefined,
    visualTracking: answers.visualTracking ?? undefined,
    teamIndividual: answers.teamIndividual ?? undefined,
    competitiveResponse: answers.competitiveResponse ?? undefined,
    focusStyle: answers.focusStyle ?? undefined,
    decisionStyle: answers.decisionStyle ?? undefined,
    pressureResponse: answers.pressureResponse ?? undefined,
    repetitionTolerance: answers.repetitionTolerance ?? undefined,
    contactComfort: answers.contactComfort ?? undefined,
    environment: answers.environment ?? undefined,
    waterComfort: answers.waterComfort ?? undefined,
    eyesight: answers.eyesight ?? undefined,
    agility: answers.agility ?? undefined,
    budgetRange: answers.budget ?? undefined,
    budgetTier: answers.budget ? budgetRangeToTier(answers.budget) : undefined,
    ambition: answers.ambition ?? undefined,
    primaryObjective: answers.ambition ? ambitionToObjective(answers.ambition) : undefined,
    weeklyTimeCommitment: weeklyHoursToNumber(answers.weeklyHours),
    weeklyHoursCategory: answers.weeklyHours ?? undefined,
    sportMatches: scored
      .slice(0, 3)
      .map((r) => ({ sport: r.sport.name, fitLabel: r.fitLabel, score: r.score })),
    wizardCompletedAt: new Date().toISOString(),
  };
}

// Structural subset of Player/Dependent fields needed to pre-fill a
// WizardAnswers object. Both the guidance module's `PlayerProfile` and the
// app-wide `Dependent` type satisfy this shape, so either can be passed here
// without casting.
export interface WizardSourceProfile {
  age?: number;
  gender?: "MALE" | "FEMALE" | "OTHER";
  location?: string;
  sportsFocus?: string[];
  sportsInFamily?: string[];
  peerSports?: string[];
  informalSports?: string[];
  informalReaction?: "kept-asking" | "lost-interest";
  futureFlexibility?: "all-in" | "maybe" | "stay-local";
  heightCm?: number;
  weightKg?: number;
  energyType?: "explosive" | "endurance";
  motorType?: "gross" | "fine";
  visualTracking?: "strong" | "moderate" | "weak";
  teamIndividual?: number;
  competitiveResponse?: "fired-up" | "calm" | "discouraged";
  focusStyle?: "bursts" | "sustained";
  decisionStyle?: "react" | "strategic";
  pressureResponse?: "thrives" | "manages" | "avoids";
  repetitionTolerance?: "high" | "low";
  contactComfort?: "loves" | "neutral" | "avoids";
  environment?: "outdoor" | "indoor" | "no-preference";
  waterComfort?: "comfortable" | "neutral" | "uncomfortable";
  budgetRange?: "under-3k" | "3k-7k" | "7k-15k" | "15k-plus";
  budgetTier?: "Budget" | "Moderate" | "Premium";
  ambition?: "fun" | "competitive" | "national" | "professional";
  eyesight?: "sharp" | "corrected" | "limited";
  agility?: "high" | "moderate" | "low";
  weeklyHoursCategory?: "1-3" | "4-7" | "8-12" | "13-plus";
  weeklyTimeCommitment?: number;
}

export function prefillFromPlayer(player: WizardSourceProfile): Partial<WizardAnswers> {
  const out: Partial<WizardAnswers> = {};
  if (player.age) out.age = player.age;
  if (player.gender === "MALE") out.gender = "boy";
  else if (player.gender === "FEMALE") out.gender = "girl";
  else if (player.gender === "OTHER") out.gender = "prefer-not";

  if (player.location) out.state = player.location;

  if (player.sportsFocus?.length) out.priorSports = player.sportsFocus;
  if (player.sportsInFamily?.length) out.sportsInFamily = player.sportsInFamily;
  if (player.peerSports?.length) out.peerSports = player.peerSports;
  if (player.informalSports?.length) out.informalSports = player.informalSports;
  if (player.informalReaction) out.informalReaction = player.informalReaction;

  // Wizard physical — prefer exact numeric values for round-tripping
  if (player.heightCm) out.height = player.heightCm;
  if (player.weightKg) out.weight = player.weightKg;
  if (player.energyType) out.energyType = player.energyType;
  if (player.motorType) out.motorType = player.motorType;
  if (player.visualTracking) out.visualTracking = player.visualTracking;
  // Wizard personality
  if (player.teamIndividual !== undefined) out.teamIndividual = player.teamIndividual;
  if (player.competitiveResponse) out.competitiveResponse = player.competitiveResponse;
  if (player.focusStyle) out.focusStyle = player.focusStyle;
  if (player.decisionStyle) out.decisionStyle = player.decisionStyle;
  if (player.pressureResponse) out.pressureResponse = player.pressureResponse;
  if (player.repetitionTolerance) out.repetitionTolerance = player.repetitionTolerance;
  // Wizard comfort
  if (player.contactComfort) out.contactComfort = player.contactComfort;
  if (player.environment) out.environment = player.environment;
  if (player.waterComfort) out.waterComfort = player.waterComfort;
  // Wizard practical
  if (player.budgetRange) {
    out.budget = player.budgetRange;
  } else if (player.budgetTier) {
    const map: Record<string, WizardAnswers["budget"]> = {
      Budget: "3k-7k",
      Moderate: "7k-15k",
      Premium: "15k-plus",
    };
    out.budget = map[player.budgetTier] ?? null;
  }
  if (player.ambition) out.ambition = player.ambition;
  if (player.futureFlexibility) out.futureFlexibility = player.futureFlexibility;
  if (player.eyesight) out.eyesight = player.eyesight;
  if (player.agility) out.agility = player.agility;
  if (player.weeklyHoursCategory) {
    out.weeklyHours = player.weeklyHoursCategory;
  } else if (player.weeklyTimeCommitment) {
    const wh = player.weeklyTimeCommitment;
    out.weeklyHours = wh <= 3 ? "1-3" : wh <= 7 ? "4-7" : wh <= 12 ? "8-12" : "13-plus";
  }

  return out;
}

/**
 * Builds a full WizardAnswers object directly from a dependent profile-builder
 * form (rather than the wizard's own answer state), so the same scoreSports()
 * engine can be run whenever a dependent is edited outside the guided /pathway
 * flow — keeping sportMatches in sync with whatever data the parent enters,
 * wizard or not.
 */
export function dependentToWizardAnswers(
  dep: WizardSourceProfile,
  childName: string,
  age: number | null,
): WizardAnswers {
  const genderMap =
    dep.gender === "MALE" ? ("boy" as const)
    : dep.gender === "FEMALE" ? ("girl" as const)
    : dep.gender === "OTHER" ? ("prefer-not" as const)
    : null;

  return {
    ...EMPTY_ANSWERS,
    childName,
    age,
    gender: genderMap,
    state: dep.location ?? null,
    priorSports: dep.sportsFocus ?? [],
    sportsInFamily: dep.sportsInFamily ?? [],
    peerSports: dep.peerSports ?? [],
    informalSports: dep.informalSports ?? [],
    informalReaction: dep.informalReaction ?? null,
    height: dep.heightCm ?? null,
    weight: dep.weightKg ?? null,
    energyType: dep.energyType ?? null,
    motorType: dep.motorType ?? null,
    visualTracking: dep.visualTracking ?? null,
    eyesight: dep.eyesight ?? null,
    agility: dep.agility ?? null,
    teamIndividual: dep.teamIndividual ?? null,
    competitiveResponse: dep.competitiveResponse ?? null,
    focusStyle: dep.focusStyle ?? null,
    decisionStyle: dep.decisionStyle ?? null,
    pressureResponse: dep.pressureResponse ?? null,
    repetitionTolerance: dep.repetitionTolerance ?? null,
    contactComfort: dep.contactComfort ?? null,
    environment: dep.environment ?? null,
    waterComfort: dep.waterComfort ?? null,
    budget: dep.budgetRange ?? null,
    ambition: dep.ambition ?? null,
    futureFlexibility: dep.futureFlexibility ?? null,
    weeklyHours: dep.weeklyHoursCategory ?? null,
  };
}

/** True once enough signal exists to make a fresh sportMatches computation meaningful. */
export function hasWizardSignal(dep: WizardSourceProfile, age: number | null): boolean {
  if (!age) return false;
  return Boolean(
    dep.energyType || dep.ambition || dep.teamIndividual !== undefined ||
    dep.contactComfort || dep.budgetRange || dep.focusStyle || dep.decisionStyle,
  );
}
