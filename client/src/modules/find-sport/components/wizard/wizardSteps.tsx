import type React from "react";
import { Brain, Heart, Target, User, Zap } from "lucide-react";
import { defineFlow } from "@/flow/defineFlow";
import type { WizardAnswers } from "../../types";

// ─── Date-of-birth bounds — mirrors the wizard's supported 4–18 age range ─────

export const DOB_BOUNDS = (() => {
  const today = new Date();
  const min = new Date(today.getFullYear() - 18, today.getMonth(), today.getDate());
  const max = new Date(today.getFullYear() - 4, today.getMonth(), today.getDate());
  return { min: min.toISOString().slice(0, 10), max: max.toISOString().slice(0, 10) };
})();

// ─── Step sequence definition ─────────────────────────────────────────────────

export type StepKind = "welcome" | "name" | "question" | "transition" | "processing" | "results";

export type Step =
  | { kind: "welcome" }
  | { kind: "name" }
  | { kind: "question"; questionKey: keyof WizardAnswers | "priorSports" }
  | { kind: "transition"; text: string; sub: string }
  | { kind: "processing" }
  | { kind: "results" };

export const STEPS: Step[] = [
  { kind: "welcome" },
  { kind: "name" },
  { kind: "question", questionKey: "dob" },
  { kind: "question", questionKey: "gender" },
  { kind: "question", questionKey: "state" },
  { kind: "question", questionKey: "priorSports" },
  { kind: "question", questionKey: "consideringSports" },
  {
    kind: "transition",
    text: "Good. Let's understand {name} physically.",
    sub: "7 quick questions.",
  },
  { kind: "question", questionKey: "height" },
  { kind: "question", questionKey: "weight" },
  { kind: "question", questionKey: "energyType" },
  { kind: "question", questionKey: "motorType" },
  { kind: "question", questionKey: "visualTracking" },
  { kind: "question", questionKey: "eyesight" },
  { kind: "question", questionKey: "agility" },
  { kind: "transition", text: "Now the interesting part.", sub: "How {name} thinks and competes." },
  { kind: "question", questionKey: "teamIndividual" },
  { kind: "question", questionKey: "competitiveResponse" },
  { kind: "question", questionKey: "focusStyle" },
  { kind: "question", questionKey: "decisionStyle" },
  { kind: "question", questionKey: "pressureResponse" },
  { kind: "question", questionKey: "repetitionTolerance" },
  { kind: "transition", text: "Almost done.", sub: "A few practical questions for your family." },
  { kind: "question", questionKey: "contactComfort" },
  { kind: "question", questionKey: "environment" },
  { kind: "question", questionKey: "waterComfort" },
  { kind: "question", questionKey: "medicalConditions" },
  { kind: "question", questionKey: "budget" },
  { kind: "question", questionKey: "ambition" },
  { kind: "question", questionKey: "weeklyHours" },
  { kind: "processing" },
  { kind: "results" },
];

export const QUESTION_STEPS = STEPS.filter((s) => s.kind === "question");
export const TOTAL_QUESTIONS = QUESTION_STEPS.length;

// The step lives in the URL. `processing` — the only step with a side-effect
// (it creates or updates the child profile) — is gated on the questionnaire
// being complete, i.e. the last question is answered. A bare `?step=processing`
// or `?step=results` therefore cannot fire that side-effect or render an empty
// report: it clamps back to the final question instead. Every other step is a
// question or a screen that is safe to open directly.
export const PROCESSING_INDEX = STEPS.findIndex((s) => s.kind === "processing");
type AssessmentFlowContext = { completed: boolean };
export const ASSESSMENT_FLOW = defineFlow<string, AssessmentFlowContext>({
  id: "sport-assessment",
  steps: STEPS.map((_, i) => String(i + 1)),
  canEnter: {
    [String(PROCESSING_INDEX + 1)]: (ctx) => ctx.completed,
  },
});

// Every step is unconditional, so navigation is a straight walk in both
// directions — there is no longer any question shown only in response to a
// previous answer.

// ─── Left sidebar metadata ────────────────────────────────────────────────────

export const SECTION_META: Record<string, { icon: React.ReactNode; title: string; desc: string }> =
  {
    Child: {
      icon: <User className="h-5 w-5" />,
      title: "About your child",
      desc: "Basic details that help us calibrate recommendations to their age, location, and background.",
    },
    Physical: {
      icon: <Zap className="h-5 w-5" />,
      title: "Physical profile",
      desc: "How they move, their energy pattern, and physical traits that align with different sports.",
    },
    Personality: {
      icon: <Brain className="h-5 w-5" />,
      title: "Mindset & competition",
      desc: "Decision-making style, focus pattern, and how they respond to pressure.",
    },
    Comfort: {
      icon: <Heart className="h-5 w-5" />,
      title: "Preferences & comfort",
      desc: "The environments they thrive in and activities they'd rather avoid.",
    },
    Practical: {
      icon: <Target className="h-5 w-5" />,
      title: "Goals & commitment",
      desc: "Your honest goals for this journey and realistic time and budget you can invest.",
    },
  };

export const SECTION_ORDER = ["Child", "Physical", "Personality", "Comfort", "Practical"];

export function getProfileChips(answers: WizardAnswers): { label: string; value: string }[] {
  const chips: { label: string; value: string }[] = [];
  if (answers.age) chips.push({ label: "Age", value: `${answers.age} yrs` });
  if (answers.gender && answers.gender !== "prefer-not")
    chips.push({ label: "Gender", value: answers.gender === "boy" ? "Boy" : "Girl" });
  if (answers.state) chips.push({ label: "State", value: answers.state });
  if (answers.energyType)
    chips.push({
      label: "Energy",
      value: answers.energyType === "explosive" ? "Explosive" : "Endurance",
    });
  if (answers.eyesight)
    chips.push({
      label: "Vision",
      value: { sharp: "Sharp", corrected: "Corrected", limited: "Limited" }[answers.eyesight]!,
    });
  if (answers.agility)
    chips.push({
      label: "Agility",
      value: { high: "High", moderate: "Moderate", low: "Low" }[answers.agility]!,
    });
  if (answers.teamIndividual !== null && answers.teamIndividual !== undefined) {
    const v = answers.teamIndividual;
    chips.push({
      label: "Style",
      value: v <= 2 ? "Solo player" : v >= 4 ? "Team player" : "Balanced",
    });
  }
  if (answers.pressureResponse)
    chips.push({
      label: "Pressure",
      value: { thrives: "Thrives", manages: "Manages", avoids: "Avoids" }[
        answers.pressureResponse
      ]!,
    });
  if (answers.environment)
    chips.push({
      label: "Environment",
      value: { outdoor: "Outdoors", indoor: "Indoors", "no-preference": "Either" }[
        answers.environment
      ]!,
    });
  if (answers.ambition)
    chips.push({
      label: "Goal",
      value: {
        fun: "Health & fun",
        competitive: "Competitive",
        national: "National",
        career: "Career in sport",
        professional: "Pro career",
      }[answers.ambition]!,
    });
  if (answers.budget)
    chips.push({
      label: "Budget",
      value: {
        "under-3k": "< ₹3k/mo",
        "3k-7k": "₹3–7k/mo",
        "7k-15k": "₹7–15k/mo",
        "15k-plus": "₹15k+/mo",
      }[answers.budget]!,
    });
  if (answers.weeklyHours)
    chips.push({ label: "Training", value: `${answers.weeklyHours} hrs/wk` });
  if (answers.consideringSports.length > 0)
    chips.push({ label: "Considering", value: answers.consideringSports.join(", ") });
  return chips;
}

// ─── Progress calculation (only question steps count) ─────────────────────────

export function questionProgress(stepIndex: number): number {
  const questionsAnsweredSoFar = STEPS.slice(0, stepIndex).filter(
    (s) => s.kind === "question"
  ).length;
  return Math.round((questionsAnsweredSoFar / TOTAL_QUESTIONS) * 100);
}
