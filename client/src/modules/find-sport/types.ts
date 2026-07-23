// ─── Pathway Module Types ─────────────────────────────────────────────────────

export type WizardAnswers = {
  childName: string;
  // Section A — The Child
  age: number | null;
  gender: "boy" | "girl" | "prefer-not" | null;
  state: string | null;
  priorSports: string[];
  sportsInFamily: string[];
  peerSports: string[];
  informalSports: string[];
  informalReaction: "kept-asking" | "lost-interest" | null;
  // Section B — Physical
  height: number | null; // cm
  weight: number | null; // kg
  energyType: "explosive" | "endurance" | null;
  motorType: "gross" | "fine" | null;
  visualTracking: "strong" | "moderate" | "weak" | null;
  eyesight: "sharp" | "corrected" | "limited" | null;
  agility: "high" | "moderate" | "low" | null;
  // Section C — Personality
  teamIndividual: number | null; // 1=very individual, 5=very team
  competitiveResponse: "fired-up" | "calm" | "discouraged" | null;
  focusStyle: "bursts" | "sustained" | null;
  decisionStyle: "react" | "strategic" | null;
  pressureResponse: "thrives" | "manages" | "avoids" | null;
  repetitionTolerance: "high" | "low" | null;
  // Section D — Comfort
  contactComfort: "loves" | "neutral" | "avoids" | null;
  environment: "outdoor" | "indoor" | "no-preference" | null;
  waterComfort: "comfortable" | "neutral" | "uncomfortable" | null;
  medicalConditions: string[];
  // Section E — Practical
  budget: "under-3k" | "3k-7k" | "7k-15k" | "15k-plus" | null;
  ambition: "fun" | "competitive" | "national" | "professional" | null;
  futureFlexibility: "all-in" | "maybe" | "stay-local" | null;
  weeklyHours: "1-3" | "4-7" | "8-12" | "13-plus" | null;
};

export const EMPTY_ANSWERS: WizardAnswers = {
  childName: "",
  age: null,
  gender: null,
  state: null,
  priorSports: [],
  sportsInFamily: [],
  peerSports: [],
  informalSports: [],
  informalReaction: null,
  height: null,
  weight: null,
  energyType: null,
  motorType: null,
  visualTracking: null,
  eyesight: null,
  agility: null,
  teamIndividual: null,
  competitiveResponse: null,
  focusStyle: null,
  decisionStyle: null,
  pressureResponse: null,
  repetitionTolerance: null,
  contactComfort: null,
  environment: null,
  waterComfort: null,
  medicalConditions: [],
  budget: null,
  ambition: null,
  futureFlexibility: null,
  weeklyHours: null,
};

export type SportProfile = {
  id: string;
  name: string;
  category: "racket" | "field" | "water" | "combat" | "precision" | "mind" | "gymnastics" | "athletics" | "indoor";
  // Scoring dimensions — what the sport REQUIRES (1=low, 5=high)
  individual: number;          // 1=very team, 5=very individual
  explosive: number;
  endurance: number;
  visualTracking: number;
  reactFast: number;           // 1=strategic preferred, 5=fast reaction needed
  sustainedFocus: number;
  pressureTolerance: number;
  repetitionNeed: number;
  contactRequired: number;     // 1=none, 5=full contact
  visionDemand: number;        // 1=vision irrelevant, 5=precision-critical eyesight
  agilityNeed: number;         // 1=none, 5=extreme agility & flexibility
  minWeeklyHours: number;      // minimum hours/week for meaningful training
  // Physical preferences
  buildPreference: "lean" | "stocky" | "any";
  heightAdvantage: "short" | "tall" | "any";
  environmentPreference: "indoor" | "outdoor" | "either";
  // Hard gates
  requiresWater: boolean;
  requiresContact: boolean; // contact avoidance is a deal-breaker
  // Indian context
  minBudgetTier: "under-3k" | "3k-7k" | "7k-15k" | "15k-plus";
  minCityTier: 1 | 2 | 3;   // 1=all cities, 3=only tier-1 metros
  ageStartSensitivity: "critical" | "moderate" | "flexible";
  ageWindowIdeal: [number, number];
  ageWindowCutoff: number;    // hard cutoff for professional ambition
  // How concentrated/relocation-dependent serious training is in India
  specializationIntensity: "low" | "moderate" | "high";
  // Display
  costRange: string;
  tagline: string;            // one short phrase for results page
};

export type FitLabel = "Strong fit" | "Good fit" | "Worth exploring";

export type SportResult = {
  sport: SportProfile;
  score: number;              // 0–100
  fitLabel: FitLabel;
  reasons: string[];          // 2–3 specific sentences referencing the child
  isWildcard: boolean;
};

export type WizardStep =
  | { kind: "welcome" }
  | { kind: "name" }
  | { kind: "question"; key: keyof Omit<WizardAnswers, "childName" | "priorSports"> | "priorSports" }
  | { kind: "transition"; text: string; sub: string }
  | { kind: "processing" }
  | { kind: "results" };
