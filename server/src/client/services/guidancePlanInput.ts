import type {
  ChildAmbition,
  ChildBudgetRange,
  ChildExperienceLevel,
  ChildGender,
  ChildWeeklyHours,
} from "@powermysport/shared-types";
import {
  SUPPORTED_SPORTS,
  isSupportedSport,
  toSupportedSlug,
} from "../../shared/constants/supportedSports";
import type { GuidanceRequest } from "../../shared/services/guidanceAiService";
import { ageOf } from "../../shared/services/parentContext";

/**
 * Turning a child's profile into a plan request, and saying what is still missing.
 *
 * The website's "make me a plan" form asks a parent a short wizard and maps the answers onto the
 * request. Over WhatsApp the profile already holds most of them, so this fills the request from the
 * profile and returns only what a parent still has to be asked. The three lookup tables below are
 * the website's own, copied exactly (a test fails if they drift apart), so a plan made here and a
 * plan made there read a child the same way.
 *
 * Pure: no database, no model. The caller reads the profile and acts on the result.
 */

// ─── The website's tables (client: modules/guidance/config/wizard/guidanceUtils.ts) ─────────

/** Fitness is read from experience, as the website does. */
export const FITNESS_BY_EXPERIENCE: Record<string, GuidanceRequest["current_fitness_level"]> = {
  beginner: "Low",
  intermediate: "Moderate",
  competitive: "High",
};

export const HOURS_BY_CATEGORY: Record<string, number> = {
  "1-3": 2,
  "4-7": 6,
  "8-12": 10,
  "13-plus": 15,
};

export const BUDGET_BY_RANGE: Record<string, GuidanceRequest["budget_tier"]> = {
  "under-3k": "Budget",
  "3k-7k": "Moderate",
  "7k-15k": "Moderate",
  "15k-plus": "Premium",
};

/** What the website assumes when it has no answer (its "ask anything" path). */
export const DEFAULTS = {
  objective: "Fitness" as GuidanceRequest["primary_objective"],
  fitness: "Moderate" as GuidanceRequest["current_fitness_level"],
  hours: 6,
  budget: "Moderate" as GuidanceRequest["budget_tier"],
};

/** The family's ambition, as the plan's four objectives. */
export const OBJECTIVE_BY_AMBITION: Record<ChildAmbition, GuidanceRequest["primary_objective"]> = {
  fun: "Recreational",
  competitive: "Compete",
  national: "Elite",
  career: "Elite",
  professional: "Elite",
};

// ─── Input and output ────────────────────────────────────────────────────────────────────────

export interface PlanProfile {
  id: string;
  dob?: Date | undefined;
  age?: number | undefined;
  gender?: ChildGender | undefined;
  sportsFocus?: string[] | undefined;
  chosenSport?: string | undefined;
  yearsPlaying?: number | undefined;
  location?: string | undefined;
  ambition?: ChildAmbition | undefined;
  experienceLevel?: ChildExperienceLevel | undefined;
  weeklyHoursCategory?: ChildWeeklyHours | undefined;
  budgetRange?: ChildBudgetRange | undefined;
}

/** What the parent has said in the chat, on top of the profile. Used for this plan only. */
export interface PlanAnswers {
  sport?: string;
  gender?: "male" | "female";
  ambition?: ChildAmbition;
  experienceLevel?: ChildExperienceLevel;
  weeklyHours?: number;
  /** In their words: what they want the plan to help with. */
  question?: string;
  /** The parent chose to skip the optional questions, so the website's defaults are used. */
  useDefaults?: boolean;
}

export type MissingField = "sport" | "age" | "gender" | "ambition" | "experience" | "weeklyHours";

export interface MissingQuestion {
  field: MissingField;
  /** One plain question the assistant can put to the parent. */
  ask: string;
  /** The allowed answers, when there is a short list. */
  options?: string[];
  /** Optional questions can be skipped, which uses the website's defaults. */
  optional: boolean;
}

export type PlanInput =
  | { complete: true; request: GuidanceRequest; assumptions: string[] }
  | { complete: false; missing: MissingQuestion[] };

const MIN_AGE = 3;
const MAX_AGE = 21;

/** Plain, short text only: no links, markup, line breaks or runs of spaces. */
function plain(value: string | undefined, max: number): string | undefined {
  if (typeof value !== "string") return undefined;
  const text = value
    .replace(/https?:\/\/\S+/gi, " ")
    .replace(/[<>{}[\]\\`]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
  return text || undefined;
}

/** The sports we make plans for, as names. */
export const SPORT_NAMES = SUPPORTED_SPORTS.map((sport) => sport.name);

/** The sport this plan is for, or the question that settles it. */
function chooseSport(
  profile: PlanProfile,
  answers: PlanAnswers
): { sport: string } | { question: MissingQuestion } {
  const named = plain(answers.sport, 40);
  const candidates = [named, profile.chosenSport, ...(profile.sportsFocus ?? [])]
    .map((sport) => plain(sport, 40))
    .filter((sport): sport is string => Boolean(sport));
  const distinct = [...new Set(candidates.map((sport) => sport.toLowerCase()))];
  const first = candidates[0];

  // A sport the parent just named wins, then the one the family committed to, then the only one
  // in focus. With several in focus and no commitment, the parent chooses.
  const decided = named ?? profile.chosenSport ?? (distinct.length === 1 ? first : undefined);
  if (decided && isSupportedSport(decided)) {
    // The canonical name, whatever way it was typed ("table tennis", "TENNIS", "table-tennis").
    const slug = toSupportedSlug(decided);
    const byName = decided.trim().toLowerCase();
    const match = SUPPORTED_SPORTS.find(
      (sport) => sport.slug === slug || sport.name.toLowerCase() === byName
    );
    return { sport: match?.name ?? decided };
  }

  const options = decided ? SPORT_NAMES : distinct.length > 1 ? candidates : SPORT_NAMES;
  return {
    question: {
      field: "sport",
      ask: decided
        ? `We do not make plans for ${decided} yet. Which of these should the plan be for?`
        : "Which sport should the plan be for?",
      options: [...new Set(options)],
      optional: false,
    },
  };
}

/**
 * The request for this child, or the questions still open. Hard questions (sport, age, boy or
 * girl) must be answered; the soft ones (ambition, experience, hours) can be skipped, which uses
 * the website's own defaults and is said back to the parent as an assumption.
 */
export function buildPlanInput(
  profile: PlanProfile,
  answers: PlanAnswers = {},
  now: Date = new Date()
): PlanInput {
  const missing: MissingQuestion[] = [];

  const sport = chooseSport(profile, answers);
  if ("question" in sport) missing.push(sport.question);

  const age = ageOf({ dob: profile.dob, age: profile.age } as { dob?: Date; age?: number }, now);
  if (age === undefined || age < MIN_AGE || age > MAX_AGE) {
    missing.push({
      field: "age",
      ask: `How old is the child? Plans are made for ages ${MIN_AGE} to ${MAX_AGE}.`,
      optional: false,
    });
  }

  const gender =
    answers.gender ??
    (profile.gender === "MALE" ? "male" : profile.gender === "FEMALE" ? "female" : undefined);
  if (!gender) {
    missing.push({
      field: "gender",
      ask: "Should the plan be made for a boy or a girl?",
      options: ["boy", "girl"],
      optional: false,
    });
  }

  const skip = answers.useDefaults === true;
  const ambition = answers.ambition ?? profile.ambition;
  if (!ambition && !skip) {
    missing.push({
      field: "ambition",
      ask: "What do you want from the sport: fun, to compete, to reach national level, or a career?",
      options: ["fun", "competitive", "national", "career"],
      optional: true,
    });
  }

  const experience = answers.experienceLevel ?? profile.experienceLevel;
  if (!experience && !skip) {
    missing.push({
      field: "experience",
      ask: "How experienced is the child: a beginner, intermediate, or competitive?",
      options: ["beginner", "intermediate", "competitive"],
      optional: true,
    });
  }

  const hoursFromProfile = profile.weeklyHoursCategory
    ? HOURS_BY_CATEGORY[profile.weeklyHoursCategory]
    : undefined;
  const hours =
    answers.weeklyHours !== undefined && answers.weeklyHours >= 0 && answers.weeklyHours <= 40
      ? answers.weeklyHours
      : hoursFromProfile;
  if (hours === undefined && !skip) {
    missing.push({
      field: "weeklyHours",
      ask: "About how many hours a week do they train or play?",
      optional: true,
    });
  }

  if (missing.length > 0 || "question" in sport || age === undefined || !gender) {
    return { complete: false, missing };
  }

  const assumptions: string[] = [];
  if (!ambition) assumptions.push("a general fitness goal");
  if (!experience) assumptions.push("an intermediate level");
  if (hours === undefined) assumptions.push(`${DEFAULTS.hours} hours a week`);
  const budget = profile.budgetRange ? BUDGET_BY_RANGE[profile.budgetRange] : undefined;
  if (!budget) assumptions.push("a moderate budget");

  const question = plain(answers.question, 300);
  const location = plain(profile.location, 80);

  const request: GuidanceRequest = {
    child_age: age,
    child_gender: gender,
    current_fitness_level: experience
      ? (FITNESS_BY_EXPERIENCE[experience] ?? DEFAULTS.fitness)
      : DEFAULTS.fitness,
    personality_tags: [],
    primary_objective: ambition ? OBJECTIVE_BY_AMBITION[ambition] : DEFAULTS.objective,
    weekly_time_commitment: hours ?? DEFAULTS.hours,
    budget_tier: budget ?? DEFAULTS.budget,
    sport: sport.sport,
    // "auto" lets the model shape the plan around a question; a plain "development plan" is a journey.
    plan_horizon: question ? "auto" : "journey",
    dependent_id: profile.id,
    ...(question ? { parent_specific_question: question } : {}),
    ...(location ? { location } : {}),
    ...(profile.yearsPlaying !== undefined &&
    profile.yearsPlaying >= 0 &&
    profile.yearsPlaying <= 20
      ? { years_playing: profile.yearsPlaying }
      : {}),
  };
  return { complete: true, request, assumptions };
}
