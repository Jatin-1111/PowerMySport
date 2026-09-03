// ─── Dependent wire format ⇄ client shape ────────────────────────────────────
//
// The server stores (and the REST API sends/receives) a dependent as one flat
// document — that hasn't changed, and doesn't need to: the server already
// whitelists every field it writes, so the flat storage was never the unsafe
// part. What was unsafe was three client write-flows each building their own
// version of that flat payload by hand, and the client's own type lying about
// which fields existed.
//
// `Dependent` (in `@/types`) is the grouped, "what does this data mean" shape
// every client read site uses. `DependentWire` here is the flat "what does
// the server actually store" shape. These two functions are the ONLY place
// that should convert between them:
//
//   - `normalizeDependent` — called once, in `useProfile.ts`'s `fetchProfile`,
//     for every dependent that comes back from `/auth/profile`.
//   - `denormalizeDependent` — called once, inside `authApi.addDependent` /
//     `updateDependent`, for every write.
//
// A flow that needs a flat, wizard-prefill-shaped view of a dependent (e.g.
// `WizardShell` calling `prefillFromPlayer`) should flatten with
// `denormalizeDependent`, not read `Dependent` fields directly off a path that
// assumes the old flat shape.

import type { Dependent } from "@/types";

export interface DependentWire {
  _id?: string;
  name: string;
  dob: string | Date;
  age?: number;
  gender?: "MALE" | "FEMALE" | "OTHER";
  relation?: string;
  location?: string;
  medicalConditions?: string[];

  sportsFocus?: string[];
  consideringSports?: string[];
  sportMatches?: Array<{ sport: string; fitLabel: string; score: number }>;
  wizardCompletedAt?: string;
  chosenSport?: string;
  chosenSportAt?: string;

  heightCm?: number;
  weightKg?: number;
  build?: "lean" | "average" | "stocky";
  heightCategory?: "short" | "average" | "tall";
  energyType?: "explosive" | "endurance";
  motorType?: "gross" | "fine";
  visualTracking?: "strong" | "moderate" | "weak";
  eyesight?: "sharp" | "corrected" | "limited";
  agility?: "high" | "moderate" | "low";

  personalityTags?: string[];
  teamIndividual?: number;
  competitiveResponse?: "fired-up" | "calm" | "discouraged";
  focusStyle?: "bursts" | "sustained";
  decisionStyle?: "react" | "strategic";
  pressureResponse?: "thrives" | "manages" | "avoids";
  repetitionTolerance?: "high" | "low";

  contactComfort?: "loves" | "neutral" | "avoids";
  environment?: "outdoor" | "indoor" | "no-preference";
  waterComfort?: "comfortable" | "neutral" | "uncomfortable";

  primaryObjective?: "Recreational" | "Fitness" | "Compete";
  weeklyTimeCommitment?: number;
  budgetTier?: "Budget" | "Moderate" | "Premium";
  budgetRange?: "under-3k" | "3k-7k" | "7k-15k" | "15k-plus";
  ambition?: "fun" | "competitive" | "national" | "career" | "professional";
  weeklyHoursCategory?: "1-3" | "4-7" | "8-12" | "13-plus";
  trainingType?: "self" | "club" | "academy" | "private";

  skillLevel?: string;
  yearsPlaying?: number;
  experienceLevel?: "beginner" | "intermediate" | "competitive";
  currentStandingTier?: number;
  bestResultTier?: number;
  achievementsNote?: string;

  academyName?: string;
  sessionsPerWeek?: number;
  trainingMonths?: number;
  wizardCity?: string;

  satisfiedPrerequisites?: string[];
  currentGpa?: number;
  targetDivision?: string;
  graduationYear?: number;

  paymentHistory?: Array<{ bookingId: string; amount: number; date: string }>;
}

/** Flat API response → grouped client shape. Tolerant of a partial object
 * (e.g. a freshly-created dependent that only has `name`/`dob` yet). */
export function normalizeDependent(wire: Partial<DependentWire>): Dependent {
  return {
    _id: wire._id,
    name: wire.name ?? "",
    dob: typeof wire.dob === "string" ? wire.dob : (wire.dob?.toISOString() ?? ""),
    age: wire.age,
    gender: wire.gender,
    relation: wire.relation,
    location: wire.location,
    medicalConditions: wire.medicalConditions,

    sport: {
      sportsFocus: wire.sportsFocus,
      consideringSports: wire.consideringSports,
      sportMatches: wire.sportMatches,
      wizardCompletedAt: wire.wizardCompletedAt,
      chosenSport: wire.chosenSport,
      chosenSportAt: wire.chosenSportAt,
    },

    physical: {
      heightCm: wire.heightCm,
      weightKg: wire.weightKg,
      build: wire.build,
      heightCategory: wire.heightCategory,
      energyType: wire.energyType,
      motorType: wire.motorType,
      visualTracking: wire.visualTracking,
      eyesight: wire.eyesight,
      agility: wire.agility,
    },

    personality: {
      personalityTags: wire.personalityTags,
      teamIndividual: wire.teamIndividual,
      competitiveResponse: wire.competitiveResponse,
      focusStyle: wire.focusStyle,
      decisionStyle: wire.decisionStyle,
      pressureResponse: wire.pressureResponse,
      repetitionTolerance: wire.repetitionTolerance,
    },

    comfort: {
      contactComfort: wire.contactComfort,
      environment: wire.environment,
      waterComfort: wire.waterComfort,
    },

    practical: {
      primaryObjective: wire.primaryObjective,
      weeklyTimeCommitment: wire.weeklyTimeCommitment,
      budgetTier: wire.budgetTier,
      budgetRange: wire.budgetRange,
      ambition: wire.ambition,
      weeklyHoursCategory: wire.weeklyHoursCategory,
      trainingType: wire.trainingType,
    },

    standing: {
      skillLevel: wire.skillLevel,
      yearsPlaying: wire.yearsPlaying,
      experienceLevel: wire.experienceLevel,
      currentStandingTier: wire.currentStandingTier,
      bestResultTier: wire.bestResultTier,
      achievementsNote: wire.achievementsNote,
    },

    training: {
      academyName: wire.academyName,
      sessionsPerWeek: wire.sessionsPerWeek,
      trainingMonths: wire.trainingMonths,
      wizardCity: wire.wizardCity,
    },

    pathwayState: {
      satisfiedPrerequisites: wire.satisfiedPrerequisites,
      currentGpa: wire.currentGpa,
      targetDivision: wire.targetDivision,
      graduationYear: wire.graduationYear,
    },

    paymentHistory: wire.paymentHistory,
  };
}

/** Grouped client shape → flat wire payload, for the API. Only present groups
 * (and only present fields within them) are flattened — a `Partial<Dependent>`
 * that only touches `sport.chosenSport` produces a payload with just that one
 * field, so a save from one flow never clobbers fields another flow owns. */
export function denormalizeDependent(
  dep: Omit<Partial<Dependent>, "dob"> & { dob?: string | Date }
): Partial<DependentWire> {
  const out: Partial<DependentWire> = {};

  if (dep._id !== undefined) out._id = dep._id;
  if (dep.name !== undefined) out.name = dep.name;
  if (dep.dob !== undefined) out.dob = dep.dob;
  if (dep.age !== undefined) out.age = dep.age;
  if (dep.gender !== undefined) out.gender = dep.gender;
  if (dep.relation !== undefined) out.relation = dep.relation;
  if (dep.location !== undefined) out.location = dep.location;
  if (dep.medicalConditions !== undefined) out.medicalConditions = dep.medicalConditions;

  if (dep.sport) {
    const s = dep.sport;
    if (s.sportsFocus !== undefined) out.sportsFocus = s.sportsFocus;
    if (s.consideringSports !== undefined) out.consideringSports = s.consideringSports;
    if (s.sportMatches !== undefined) out.sportMatches = s.sportMatches;
    if (s.wizardCompletedAt !== undefined) out.wizardCompletedAt = s.wizardCompletedAt;
    if (s.chosenSport !== undefined) out.chosenSport = s.chosenSport;
    if (s.chosenSportAt !== undefined) out.chosenSportAt = s.chosenSportAt;
  }

  if (dep.physical) {
    const p = dep.physical;
    if (p.heightCm !== undefined) out.heightCm = p.heightCm;
    if (p.weightKg !== undefined) out.weightKg = p.weightKg;
    if (p.build !== undefined) out.build = p.build;
    if (p.heightCategory !== undefined) out.heightCategory = p.heightCategory;
    if (p.energyType !== undefined) out.energyType = p.energyType;
    if (p.motorType !== undefined) out.motorType = p.motorType;
    if (p.visualTracking !== undefined) out.visualTracking = p.visualTracking;
    if (p.eyesight !== undefined) out.eyesight = p.eyesight;
    if (p.agility !== undefined) out.agility = p.agility;
  }

  if (dep.personality) {
    const p = dep.personality;
    if (p.personalityTags !== undefined) out.personalityTags = p.personalityTags;
    if (p.teamIndividual !== undefined) out.teamIndividual = p.teamIndividual;
    if (p.competitiveResponse !== undefined) out.competitiveResponse = p.competitiveResponse;
    if (p.focusStyle !== undefined) out.focusStyle = p.focusStyle;
    if (p.decisionStyle !== undefined) out.decisionStyle = p.decisionStyle;
    if (p.pressureResponse !== undefined) out.pressureResponse = p.pressureResponse;
    if (p.repetitionTolerance !== undefined) out.repetitionTolerance = p.repetitionTolerance;
  }

  if (dep.comfort) {
    const c = dep.comfort;
    if (c.contactComfort !== undefined) out.contactComfort = c.contactComfort;
    if (c.environment !== undefined) out.environment = c.environment;
    if (c.waterComfort !== undefined) out.waterComfort = c.waterComfort;
  }

  if (dep.practical) {
    const p = dep.practical;
    if (p.primaryObjective !== undefined) out.primaryObjective = p.primaryObjective;
    if (p.weeklyTimeCommitment !== undefined) out.weeklyTimeCommitment = p.weeklyTimeCommitment;
    if (p.budgetTier !== undefined) out.budgetTier = p.budgetTier;
    if (p.budgetRange !== undefined) out.budgetRange = p.budgetRange;
    if (p.ambition !== undefined) out.ambition = p.ambition;
    if (p.weeklyHoursCategory !== undefined) out.weeklyHoursCategory = p.weeklyHoursCategory;
    if (p.trainingType !== undefined) out.trainingType = p.trainingType;
  }

  if (dep.standing) {
    const s = dep.standing;
    if (s.skillLevel !== undefined) out.skillLevel = s.skillLevel;
    if (s.yearsPlaying !== undefined) out.yearsPlaying = s.yearsPlaying;
    if (s.experienceLevel !== undefined) out.experienceLevel = s.experienceLevel;
    if (s.currentStandingTier !== undefined) out.currentStandingTier = s.currentStandingTier;
    if (s.bestResultTier !== undefined) out.bestResultTier = s.bestResultTier;
    if (s.achievementsNote !== undefined) out.achievementsNote = s.achievementsNote;
  }

  if (dep.training) {
    const t = dep.training;
    if (t.academyName !== undefined) out.academyName = t.academyName;
    if (t.sessionsPerWeek !== undefined) out.sessionsPerWeek = t.sessionsPerWeek;
    if (t.trainingMonths !== undefined) out.trainingMonths = t.trainingMonths;
    if (t.wizardCity !== undefined) out.wizardCity = t.wizardCity;
  }

  if (dep.pathwayState) {
    const p = dep.pathwayState;
    if (p.satisfiedPrerequisites !== undefined)
      out.satisfiedPrerequisites = p.satisfiedPrerequisites;
    if (p.currentGpa !== undefined) out.currentGpa = p.currentGpa;
    if (p.targetDivision !== undefined) out.targetDivision = p.targetDivision;
    if (p.graduationYear !== undefined) out.graduationYear = p.graduationYear;
  }

  if (dep.paymentHistory !== undefined) out.paymentHistory = dep.paymentHistory;

  return out;
}
