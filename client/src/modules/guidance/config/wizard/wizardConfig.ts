import { buildStepGateFlow } from "@/flow/defineFlow";
import { MessageCircle, TrendingUp, Trophy, Wrench } from "lucide-react";
import type { ConsultForm, ProblemId } from "@/modules/guidance/config/wizard/guidanceUtils";

/**
 * The wizard's per-problem step sequences and picker config — extracted from
 * `app/(marketing)/guidance/page.tsx`, which had grown to 1,655 lines. Pure
 * data/logic, no JSX. Nothing here changed behavior, only location.
 */

// ─── Problem type config (picker only) ───────────────────────────────────────

export const PROBLEM_TYPES = [
  {
    id: "weakness" as const,
    Icon: Wrench,
    color: "bg-rose-100 text-rose-600",
    hoverBorder: "hover:border-rose-300",
    accentText: "text-rose-600",
    tagline: "Something holding them back?",
    label: "Fix a weakness",
    description:
      "Your child struggles with a specific aspect — agility, technique, focus, or mindset. Get a targeted plan to address it.",
  },
  {
    id: "tournament" as const,
    Icon: Trophy,
    color: "bg-amber-100 text-amber-600",
    hoverBorder: "hover:border-amber-300",
    accentText: "text-amber-600",
    tagline: "Competition coming up?",
    label: "Tournament prep",
    description:
      "Tell us the sport, timeline, and your child's current level. We'll build a specific preparation plan for the event.",
  },
  {
    id: "levelup" as const,
    Icon: TrendingUp,
    color: "bg-indigo-100 text-indigo-600",
    hoverBorder: "hover:border-indigo-300",
    accentText: "text-indigo-600",
    tagline: "Stuck at one level?",
    label: "Level up",
    description:
      "Can't break through to the next milestone? Get a clear path — what the breakthrough looks like and exactly how to get there.",
  },
  {
    id: "custom" as const,
    Icon: MessageCircle,
    color: "bg-slate-100 text-slate-600",
    hoverBorder: "hover:border-slate-300",
    accentText: "text-slate-600",
    tagline: "Something else entirely?",
    label: "Ask anything",
    description:
      "Describe any sports challenge — routine, coach selection, burnout, diet, mental blocks — and get targeted expert-backed advice.",
  },
] as const;

// ─── Step definitions ─────────────────────────────────────────────────────────

export type ConsultField = keyof ConsultForm;

export interface QuestionStep {
  kind: "question";
  id: ConsultField;
  required: boolean;
  heading: (form: ConsultForm) => string;
  sub: string;
}

export interface TransitionStep {
  kind: "transition";
  text: string;
  sub: string;
}

export type WizardStep = QuestionStep | TransitionStep;

// Shared question builders
const sharedSteps = {
  sport: (tagSub: string): QuestionStep => ({
    kind: "question",
    id: "sport",
    required: true,
    heading: () => "Which sport is this for?",
    sub: tagSub,
  }),
  age: (): QuestionStep => ({
    kind: "question",
    id: "age",
    required: false,
    heading: (f) => `How old is ${f.sport ? `your ${f.sport} player` : "your child"}?`,
    sub: "Optional — helps calibrate the intensity and timeline of the plan.",
  }),
  gender: (): QuestionStep => ({
    kind: "question",
    id: "gender",
    required: true,
    heading: () => "Any other basics?",
    sub: "Some pathways and competition formats are gender-specific.",
  }),
  state: (): QuestionStep => ({
    kind: "question",
    id: "state",
    required: true,
    heading: () => "Where are you based?",
    sub: "Helps us add region-specific resources to the plan.",
  }),
  weeklyHours: (sub: string): QuestionStep => ({
    kind: "question",
    id: "weeklyHours",
    required: true,
    heading: () => "How much time can they dedicate each week?",
    sub,
  }),
  executor: (): QuestionStep => ({
    kind: "question",
    id: "executor",
    required: true,
    heading: () => "Who will actually run these sessions?",
    sub: "The plan changes completely depending on who's guiding the drills — we'll only suggest what they can realistically deliver.",
  }),
  budgetRange: (): QuestionStep => ({
    kind: "question",
    id: "budgetRange",
    required: false,
    heading: () => "What's your monthly budget for this?",
    sub: "Optional — helps us recommend resources within your range.",
  }),
};

// Per-problem step sequences
export const WIZARD_STEPS: Record<ProblemId, WizardStep[]> = {
  // ── Fix a weakness ─────────────────────────────────────────────────────────
  weakness: [
    sharedSteps.sport("We'll tailor the entire fix plan to this sport's specific demands."),
    sharedSteps.age(),
    sharedSteps.gender(),
    {
      kind: "question",
      id: "experienceLevel",
      required: true,
      heading: (f) => `What's their current level in ${f.sport || "the sport"}?`,
      sub: "Sets the baseline — the fix plan will match exactly where they are right now.",
    },
    {
      kind: "question",
      id: "weaknessArea",
      required: true,
      heading: (f) =>
        `What's the main weakness holding ${f.sport ? `their ${f.sport}` : "them"} back?`,
      sub: "We'll build the entire plan around addressing this specific gap.",
    },
    {
      kind: "question",
      id: "weaknessDetail",
      required: true,
      heading: () => "What exactly does this look like?",
      sub: "Tap anything that matches, or describe it yourself — the more specific, the better the plan.",
    },
    {
      kind: "question",
      id: "weaknessContext",
      required: true,
      heading: () => "When does this weakness show up most?",
      sub: "Knowing the context helps us design drills that fix it in the right situations.",
    },
    {
      kind: "question",
      id: "weaknessAttempts",
      required: false,
      heading: () => "What have you already tried to fix it?",
      sub: "Optional — so we don't repeat what hasn't worked.",
    },
    {
      kind: "question",
      id: "weaknessDuration",
      required: true,
      heading: () => "How long has this been a problem?",
      sub: "Tells us how deep-rooted it is — a recent flaw needs a different approach than a long-standing habit.",
    },
    {
      kind: "transition",
      text: "Good — we know exactly what to target.",
      sub: "A few quick logistics questions and your plan is ready.",
    },
    sharedSteps.executor(),
    sharedSteps.weeklyHours(
      "The drill schedule will fit around the time you can realistically commit."
    ),
    sharedSteps.budgetRange(),
    sharedSteps.state(),
  ],

  // ── Tournament prep ────────────────────────────────────────────────────────
  tournament: [
    sharedSteps.sport("We'll build a prep plan specific to this sport's match demands."),
    {
      kind: "question",
      id: "timeline",
      required: true,
      heading: () => "How soon is the tournament?",
      sub: "Defines the phases and length of the preparation plan.",
    },
    {
      kind: "question",
      id: "tournamentLevel",
      required: true,
      heading: () => "What level is the tournament?",
      sub: "The level sets the competition standard the plan needs to prepare them for.",
    },
    {
      kind: "question",
      id: "experienceLevel",
      required: true,
      heading: (f) => `What's their current level in ${f.sport || "the sport"}?`,
      sub: "Calibrates training intensity and realistic goals for the event.",
    },
    {
      kind: "question",
      id: "physicalReadiness",
      required: true,
      heading: () => "How is their match fitness right now?",
      sub: "Match fitness determines how much of the plan focuses on conditioning vs. skills.",
    },
    {
      kind: "question",
      id: "tournamentGap",
      required: true,
      heading: () => "What's the most important gap to close before the tournament?",
      sub: "This becomes the core priority of the preparation plan.",
    },
    sharedSteps.age(),
    sharedSteps.gender(),
    {
      kind: "transition",
      text: "Clear picture — now let's plan the prep.",
      sub: "A few final questions to size the training commitment.",
    },
    sharedSteps.executor(),
    sharedSteps.weeklyHours("We'll build a week-by-week schedule around this availability."),
    sharedSteps.budgetRange(),
    sharedSteps.state(),
  ],

  // ── Level up ───────────────────────────────────────────────────────────────
  levelup: [
    sharedSteps.sport("We'll map out exactly what the next level requires in this sport."),
    {
      kind: "question",
      id: "currentLevel",
      required: true,
      heading: (f) => `Where is your child now in ${f.sport || "the sport"}?`,
      sub: "This is the starting point — the roadmap builds from here.",
    },
    {
      kind: "question",
      id: "targetLevel",
      required: true,
      heading: () => "What level are they aiming for?",
      sub: "Sets the destination — we'll map every step between here and there.",
    },
    {
      kind: "question",
      id: "timeAtCurrentLevel",
      required: true,
      heading: () => "How long have they been at their current level?",
      sub: "Tells us whether this is a natural plateau or something more specific holding them back.",
    },
    {
      kind: "question",
      id: "trainingType",
      required: true,
      heading: () => "How do they currently train?",
      sub: "Shapes the kind of advice — what to add, upgrade, or change in their setup.",
    },
    {
      kind: "question",
      id: "levelBlocker",
      required: true,
      heading: () => "What's the main thing blocking progress?",
      sub: "This is what the plan will address head-on.",
    },
    {
      kind: "question",
      id: "topStrength",
      required: false,
      heading: (f) =>
        `What does ${f.sport ? `your ${f.sport} player` : "your child"} actually do well?`,
      sub: "Optional — helps us build the breakthrough plan around their strengths, not just their gaps.",
    },
    sharedSteps.age(),
    sharedSteps.gender(),
    {
      kind: "transition",
      text: "Got it — full picture of where they are.",
      sub: "A few final questions to calibrate the timeline.",
    },
    sharedSteps.executor(),
    sharedSteps.weeklyHours("The level-up roadmap will be built around this training commitment."),
    sharedSteps.budgetRange(),
  ],

  // ── Ask anything ──────────────────────────────────────────────────────────
  custom: [
    sharedSteps.sport("Optional — skip if this isn't sport-specific."),
    sharedSteps.age(),
    sharedSteps.gender(),
    sharedSteps.state(),
    {
      kind: "question",
      id: "challengeCategory",
      required: true,
      heading: () => "What type of challenge is this?",
      sub: "Helps us frame the advice correctly from the start.",
    },
    {
      kind: "question",
      id: "challenge",
      required: true,
      heading: () => "Tell us what you're facing.",
      sub: "The more detail you give, the more specific and useful the advice will be.",
    },
    {
      kind: "question",
      id: "desiredOutcome",
      required: true,
      heading: () => "What kind of help are you looking for?",
      sub: "So the response is the right shape for what you actually need.",
    },
    {
      kind: "question",
      id: "experienceLevel",
      required: false,
      heading: () => "What's their current level overall?",
      sub: "Optional — gives the AI useful context to calibrate the advice.",
    },
  ],
};

// Precompute question numbers per step per problem
export function getStepQNums(steps: WizardStep[]): (number | null)[] {
  return steps.map((s, i) =>
    s.kind !== "question" ? null : steps.slice(0, i + 1).filter((x) => x.kind === "question").length
  );
}

export function getTotalQuestions(steps: WizardStep[]): number {
  return steps.filter((s) => s.kind === "question").length;
}

// Rough estimate so the picker's time label tracks each flow's actual step
// count instead of a single hardcoded guess that drifts as steps are edited.
export function estimateMinutes(steps: WizardStep[]): string {
  const minutes = Math.max(2, Math.round(getTotalQuestions(steps) / 2.5));
  return `~${minutes} min`;
}

export function isAnswered(id: ConsultField, form: ConsultForm): boolean {
  const v = form[id];
  if (typeof v === "string") return v.length > 0;
  if (typeof v === "number") return true;
  return v !== null;
}

// ─── Flow wiring ──────────────────────────────────────────────────────────────

export const PROBLEM_IDS: readonly ProblemId[] = ["weakness", "tournament", "levelup", "custom"];
export const isProblemId = (value: string | null): value is ProblemId =>
  value !== null && (PROBLEM_IDS as readonly string[]).includes(value);

/**
 * The per-problem question sequence, wired to the URL.
 *
 * A step is enterable only when every required question before it is answered,
 * so opening `?step=6` in a fresh tab lands on the first unanswered question
 * rather than deep inside a form that was never filled in. Built per problem
 * because each problem has its own step list; memoised by the caller on
 * problemId so the object identity is stable across answers.
 */
export function buildGuidanceFlow(problemId: ProblemId) {
  const steps = WIZARD_STEPS[problemId];
  return buildStepGateFlow<ConsultForm>(`guidance-${problemId}`, steps.length, (i, form) => {
    const step = steps[i];
    return step.kind !== "question" || !step.required || isAnswered(step.id, form);
  });
}
