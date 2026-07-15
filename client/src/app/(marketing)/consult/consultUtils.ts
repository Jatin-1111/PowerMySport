import type { GuidanceFormState } from "@/modules/guidance/types";

// ─── Types ────────────────────────────────────────────────────────────────────

export type ProblemId = "weakness" | "tournament" | "levelup" | "custom";

export interface ConsultForm {
  sport: string;
  age: string;
  gender: string | null;
  state: string | null;
  experienceLevel: string | null;
  weeklyHours: string | null;
  budgetRange: string | null;
  // Weakness
  weaknessArea: string | null;
  weaknessContext: string | null;
  weaknessAttempts: string | null;
  weaknessDuration: string | null;
  // Tournament
  timeline: string | null;
  tournamentLevel: string | null;
  physicalReadiness: string | null;
  tournamentGap: string | null;
  // Level up
  currentLevel: string | null;
  targetLevel: string | null;
  timeAtCurrentLevel: string | null;
  trainingType: string | null;
  levelBlocker: string | null;
  topStrength: string | null;
  // Custom / Ask anything
  challengeCategory: string | null;
  challenge: string;
  desiredOutcome: string | null;
}

export const EMPTY_FORM: ConsultForm = {
  sport: "",
  age: "",
  gender: null,
  state: null,
  experienceLevel: null,
  weeklyHours: null,
  budgetRange: null,
  weaknessArea: null,
  weaknessContext: null,
  weaknessAttempts: null,
  weaknessDuration: null,
  timeline: null,
  tournamentLevel: null,
  physicalReadiness: null,
  tournamentGap: null,
  currentLevel: null,
  targetLevel: null,
  timeAtCurrentLevel: null,
  trainingType: null,
  levelBlocker: null,
  topStrength: null,
  challengeCategory: null,
  challenge: "",
  desiredOutcome: null,
};

// ─── Label maps ───────────────────────────────────────────────────────────────

export const FITNESS_MAP: Record<string, GuidanceFormState["current_fitness_level"]> = {
  beginner: "Low",
  intermediate: "Moderate",
  competitive: "High",
};

export const HOURS_MAP: Record<string, number> = {
  "1-3": 2,
  "4-7": 6,
  "8-12": 10,
  "13-plus": 15,
};

export const BUDGET_MAP: Record<string, GuidanceFormState["budget_tier"]> = {
  "under-3k": "Budget",
  "3k-7k": "Moderate",
  "7k-15k": "Moderate",
  "15k-plus": "Premium",
};

export const OBJECTIVE_MAP: Record<ProblemId, GuidanceFormState["primary_objective"]> = {
  weakness: "Compete",
  tournament: "Compete",
  levelup: "Elite",
  custom: "Recreational",
};

export const WEAKNESS_AREA_LABELS: Record<string, string> = {
  technique: "technical execution (incorrect form, poor timing, faulty mechanics)",
  fitness: "physical fitness (strength, speed, stamina, or agility)",
  mental: "mental focus and pressure management (nerves, concentration, composure)",
  tactical: "tactical reading and game intelligence (decision-making, positioning, pattern recognition)",
};

export const WEAKNESS_CONTEXT_LABELS: Record<string, string> = {
  training: "in training — it's visible during practice but they're aware of it",
  matches: "specifically in matches — technique or composure breaks down under game pressure",
  pressure: "when being watched or evaluated — performance drops under scrutiny",
  always: "consistently, in all situations — it's a deep-rooted habit",
};

export const WEAKNESS_ATTEMPTS_LABELS: Record<string, string> = {
  nothing: "nothing yet — we've just identified the problem",
  practice: "extra self-practice on their own",
  video: "video analysis — watching footage to self-correct",
  coaching: "tried addressing it with a coach, but it hasn't stuck",
};

export const WEAKNESS_DURATION_LABELS: Record<string, string> = {
  weeks: "a few weeks — it's relatively recent",
  months: "several months — it's been a consistent issue",
  "year-plus": "over a year — it's a deeply ingrained habit",
};

export const TOURNAMENT_LEVEL_LABELS: Record<string, string> = {
  school: "school / inter-school level",
  district: "district-level competition",
  state: "state championship or selection trial",
  national: "national championship or national selection",
};

export const PHYSICAL_READINESS_LABELS: Record<string, string> = {
  low: "not match-ready — gets tired quickly, fitness is a concern",
  moderate: "reasonably fit — can compete but fades in the late stages",
  high: "match-fit — conditioning is not an issue, ready to go",
};

export const TOURNAMENT_GAP_LABELS: Record<string, string> = {
  technique: "technical consistency — technique breaks down under match pressure",
  stamina: "physical stamina — doesn't have the fitness for a full-day competition",
  nerves: "mental composure — nerves and pressure significantly affect performance",
  matchplay: "match experience — hasn't played enough competitive matches to read opponents",
};

export const CURRENT_LEVEL_LABELS: Record<string, string> = {
  school: "school level — playing casually or representing school",
  club: "club / academy level — enrolled at a local academy or club programme",
  district: "district level — competing at district tournaments",
  state: "state level — competing at state championships",
};

export const TARGET_LEVEL_LABELS: Record<string, string> = {
  club: "club / academy — getting into a proper structured programme",
  district: "district level — competing at district tournaments",
  state: "state level — representing at state championships",
  national: "national level — aiming for national championships or selection",
};

export const TIME_AT_LEVEL_LABELS: Record<string, string> = {
  new: "under 6 months — still relatively new at this level",
  "6-12m": "6–12 months — settled in but not progressing",
  "1y-plus": "over a year — definitely plateaued, something specific is holding them back",
};

export const TRAINING_TYPE_LABELS: Record<string, string> = {
  self: "self-practice at home or with friends, no structured coaching",
  club: "playing at a local club or school with group sessions",
  academy: "enrolled at a formal academy with regular structured training",
  private: "receiving private or one-on-one coaching",
};

export const BLOCKER_LABELS: Record<string, string> = {
  technique: "technical gaps — fundamentals aren't at the standard required for the next level",
  fitness: "physical conditioning — not strong or fit enough to compete at the next level",
  mental: "mental game — confidence, composure, or belief is holding them back",
  competition: "lack of competitive exposure — not getting enough match practice at the right level",
};

export const TOP_STRENGTH_LABELS: Record<string, string> = {
  technique: "technical skills and execution",
  tactical: "game intelligence — reading play and making smart decisions",
  physical: "physical athleticism — speed, strength, or stamina",
  mental: "mental strength — composure, focus, and resilience",
};

export const CHALLENGE_CATEGORY_LABELS: Record<string, string> = {
  motivation: "motivation, confidence, or mental blocks",
  injury: "injury, recovery, or physical health concerns",
  coaching: "coach selection, training setup, or programme design",
  nutrition: "nutrition, body development, weight management, or burnout/overtraining",
};

export const DESIRED_OUTCOME_LABELS: Record<string, string> = {
  plan: "a step-by-step action plan to follow",
  advice: "expert perspective and advice on the situation",
  resources: "specific resource, programme, or professional recommendations",
  opinion: "a second opinion on what we're currently doing",
};

// ─── buildQuestion ────────────────────────────────────────────────────────────

export function buildQuestion(form: ConsultForm, problemId: ProblemId): string {
  const sport = form.sport || "their chosen sport";
  // Fix: avoid double space when age is empty
  const agePrefix = form.age ? `${form.age}-year-old ` : "";
  const levelLabel =
    form.experienceLevel === "beginner" ? "beginner (city / neighbourhood)"
    : form.experienceLevel === "intermediate" ? "intermediate (district / state)"
    : form.experienceLevel === "competitive" ? "competitive (national / international)"
    : "developing";
  const genderLabel =
    form.gender === "MALE" ? "son"
    : form.gender === "FEMALE" ? "daughter"
    : "child";

  switch (problemId) {
    case "weakness": {
      const area = WEAKNESS_AREA_LABELS[form.weaknessArea ?? ""] ?? form.weaknessArea ?? "a specific weakness";
      const context = WEAKNESS_CONTEXT_LABELS[form.weaknessContext ?? ""] ?? "";
      const tried = WEAKNESS_ATTEMPTS_LABELS[form.weaknessAttempts ?? ""] ?? "";
      const duration = WEAKNESS_DURATION_LABELS[form.weaknessDuration ?? ""] ?? "some time";
      const hrs = HOURS_MAP[form.weeklyHours ?? ""] ?? 6;
      const budget = BUDGET_MAP[form.budgetRange ?? ""] ?? "Moderate";
      return [
        `My ${agePrefix}${genderLabel} plays ${sport} at the ${levelLabel} level.`,
        `They have been struggling with ${area} for ${duration}.`,
        context ? `This weakness shows up most ${context}.` : "",
        tried ? `What we have already tried: ${tried}.` : "We have not yet tried any specific fix.",
        `They can commit ${hrs} hours per week to fixing this, with a ${budget.toLowerCase()} budget for any specialist support.`,
        `Please create a highly targeted, practical plan to fix this specific weakness. Include:`,
        `1) Root cause analysis — why this weakness typically develops at the ${levelLabel} level in ${sport}.`,
        `2) A structured drill programme (daily/weekly schedule) with specific exercises addressing the root cause.`,
        `3) Progression checkpoints — how to know they are improving and when to move to the next phase.`,
        `4) Match application — how to translate the drill improvements into actual game performance.`,
        `5) Common mistakes to avoid when addressing this type of weakness.`,
      ].filter(Boolean).join(" ");
    }

    case "tournament": {
      const timeframe =
        form.timeline === "weeks" ? "2–4 weeks"
        : form.timeline === "months-1-3" ? "1–3 months"
        : form.timeline === "months-3-6" ? "3–6 months"
        : form.timeline ?? "a few months";
      const tournLevel = TOURNAMENT_LEVEL_LABELS[form.tournamentLevel ?? ""] ?? form.tournamentLevel ?? "competitive";
      const fitness = PHYSICAL_READINESS_LABELS[form.physicalReadiness ?? ""] ?? "";
      const gap = TOURNAMENT_GAP_LABELS[form.tournamentGap ?? ""] ?? form.tournamentGap ?? "overall preparation";
      const hrs = HOURS_MAP[form.weeklyHours ?? ""] ?? 6;
      const budget = BUDGET_MAP[form.budgetRange ?? ""] ?? "Moderate";
      return [
        `My ${agePrefix}${genderLabel} plays ${sport} at the ${levelLabel} level and has a ${tournLevel} tournament in ${timeframe}.`,
        fitness ? `Their current match fitness: ${fitness}.` : "",
        `The most critical gap to close before the tournament: ${gap}.`,
        `They can train ${hrs} hours per week in the lead-up, with a ${budget.toLowerCase()} budget for prep support.`,
        `Please build a detailed, phase-by-phase tournament preparation plan. Include:`,
        `1) Phase breakdown — specific weekly focus areas across the ${timeframe} lead-up (technical, physical, tactical, match simulation).`,
        `2) Priority drills and sessions addressing the key gap: ${gap}.`,
        `3) Physical preparation — conditioning and match-fitness programme appropriate for this timeline.`,
        `4) Mental and match readiness — pre-match routine, pressure simulation, composure strategies.`,
        `5) Peak week strategy — how to taper and prepare in the final 7 days before the tournament.`,
        `6) What to do on competition day itself.`,
      ].filter(Boolean).join(" ");
    }

    case "levelup": {
      const from = CURRENT_LEVEL_LABELS[form.currentLevel ?? ""] ?? form.currentLevel ?? "current";
      const to = TARGET_LEVEL_LABELS[form.targetLevel ?? ""] ?? form.targetLevel ?? "next";
      const timeAtLevel = TIME_AT_LEVEL_LABELS[form.timeAtCurrentLevel ?? ""] ?? "";
      const training = TRAINING_TYPE_LABELS[form.trainingType ?? ""] ?? "";
      const blocker = BLOCKER_LABELS[form.levelBlocker ?? ""] ?? form.levelBlocker ?? "general development";
      const strength = TOP_STRENGTH_LABELS[form.topStrength ?? ""] ?? "";
      const hrs = HOURS_MAP[form.weeklyHours ?? ""] ?? 6;
      const budget = BUDGET_MAP[form.budgetRange ?? ""] ?? "Moderate";
      return [
        `My ${agePrefix}${genderLabel} plays ${sport} and is currently at ${from}.`,
        `They want to reach ${to}.`,
        timeAtLevel ? `They have been at their current level for ${timeAtLevel}.` : "",
        training ? `Current training setup: ${training}.` : "",
        `Main bottleneck holding them back: ${blocker}.`,
        strength ? `Their biggest strength to build on: ${strength}.` : "",
        `They can commit ${hrs} hours per week, with a ${budget.toLowerCase()} monthly budget for development.`,
        `Please map out a comprehensive level-up roadmap. Include:`,
        `1) Honest gap analysis — exactly what the move from ${from} to ${to} requires in ${sport} (technical, physical, mental, competitive).`,
        `2) Addressing the primary blocker (${blocker}) first — specific actions, drills, or structural changes needed.`,
        `3) Training upgrades — what needs to change in their current setup (${training}) to reach the next level.`,
        `4) Milestone roadmap — what intermediate checkpoints look like and a realistic timeline.`,
        `5) Competitive exposure strategy — what tournaments, trials, or events to target at each stage.`,
        `6) What success looks like at the ${to} level — specific benchmarks to aim for.`,
      ].filter(Boolean).join(" ");
    }

    case "custom": {
      const category = CHALLENGE_CATEGORY_LABELS[form.challengeCategory ?? ""] ?? "";
      const outcome = DESIRED_OUTCOME_LABELS[form.desiredOutcome ?? ""] ?? "actionable advice";
      const challenge = form.challenge || "a general sports challenge";
      return [
        form.sport
          ? `My ${agePrefix}${genderLabel} plays ${sport} at the ${levelLabel} level.`
          : agePrefix
          ? `My ${agePrefix}${genderLabel} is involved in sport.`
          : `My ${genderLabel} is involved in sport.`,
        category ? `The type of challenge we are facing: ${category}.` : "",
        `Here is the specific situation: ${challenge}`,
        `What I am looking for: ${outcome}.`,
        `Please provide practical, expert-backed advice and guidance tailored to this exact situation.`,
        `Be specific and actionable — avoid generic advice. If relevant, include concrete next steps, professional resources to seek, and what to watch out for.`,
      ].filter(Boolean).join(" ");
    }

    default:
      return "Please provide personalised sports guidance for my child.";
  }
}

// ─── buildPayload ─────────────────────────────────────────────────────────────

export function buildPayload(form: ConsultForm, problemId: ProblemId): GuidanceFormState {
  const rawAge = Number(form.age);
  const safeAge = form.age && !Number.isNaN(rawAge)
    ? Math.max(3, Math.min(25, rawAge))
    : 10;

  return {
    child_age: safeAge,
    child_gender: form.gender === "FEMALE" ? "female" : form.gender === "MALE" ? "male" : "male",
    current_fitness_level: FITNESS_MAP[form.experienceLevel ?? ""] ?? "Moderate",
    personality_tags: [],
    primary_objective: OBJECTIVE_MAP[problemId],
    weekly_time_commitment: HOURS_MAP[form.weeklyHours ?? ""] ?? 6,
    budget_tier: BUDGET_MAP[form.budgetRange ?? ""] ?? "Moderate",
    parent_specific_question: buildQuestion(form, problemId),
    sport: form.sport || "General",
    location: form.state ?? "",
  };
}
