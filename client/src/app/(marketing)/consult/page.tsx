"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowLeft,
  BrainCircuit,
  ChevronRight,
  Loader2,
  MessageCircle,
  RotateCcw,
  Sparkles,
  TrendingUp,
  Trophy,
  Wrench,
} from "lucide-react";
import { Suspense, useState } from "react";

import api from "@/lib/api/axios";
import { toast } from "@/lib/toast";
import { useAuthStore } from "@/modules/auth/store/authStore";
import { GuidanceChatDrawer } from "@/modules/guidance/components/chat/GuidanceChatDrawer";
import { LoginRequiredModal } from "@/modules/guidance/components/chat/LoginRequiredModal";
import { ResultsView } from "@/modules/guidance/components/results/ResultsView";
import { downloadGuidanceReportPdf } from "@/modules/guidance/services/guidance";
import type { GuidanceFormState, GuidanceSubmission } from "@/modules/guidance/types";
import { BinaryCards } from "@/modules/pathway/components/inputs/BinaryCards";
import { FourContextCards } from "@/modules/pathway/components/inputs/FourContextCards";
import { SpectrumSlider } from "@/modules/pathway/components/inputs/SpectrumSlider";
import { StateSelector } from "@/modules/pathway/components/inputs/StateSelector";
import { ThreeOptionCards } from "@/modules/pathway/components/inputs/ThreeOptionCards";

// ─── Problem type config (picker only) ───────────────────────────────────────

const PROBLEM_TYPES = [
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

type ProblemId = (typeof PROBLEM_TYPES)[number]["id"];

// ─── Wizard form (unified for all problem types) ──────────────────────────────

interface ConsultForm {
  sport: string;
  age: string;
  gender: string | null;
  state: string | null;
  experienceLevel: string | null;
  weeklyHours: string | null;
  budgetRange: string | null;
  // Weakness
  weaknessArea: string | null;
  weaknessDuration: string | null;
  // Tournament
  timeline: string | null;
  tournamentGap: string | null;
  // Level up
  currentLevel: string | null;
  targetLevel: string | null;
  levelBlocker: string | null;
  // Custom
  challenge: string;
}

const EMPTY_FORM: ConsultForm = {
  sport: "",
  age: "",
  gender: null,
  state: null,
  experienceLevel: null,
  weeklyHours: null,
  budgetRange: null,
  weaknessArea: null,
  weaknessDuration: null,
  timeline: null,
  tournamentGap: null,
  currentLevel: null,
  targetLevel: null,
  levelBlocker: null,
  challenge: "",
};

// ─── Step definitions ─────────────────────────────────────────────────────────

type ConsultField = keyof ConsultForm;

interface QuestionStep {
  kind: "question";
  id: ConsultField;
  required: boolean;
  heading: (form: ConsultForm) => string;
  sub: string;
}

interface TransitionStep {
  kind: "transition";
  text: string;
  sub: string;
}

type WizardStep = QuestionStep | TransitionStep;

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
    required: false,
    heading: () => "Any other basics?",
    sub: "Optional — some pathways and competition formats are gender-specific.",
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
  budgetRange: (): QuestionStep => ({
    kind: "question",
    id: "budgetRange",
    required: false,
    heading: () => "What's your monthly budget for this?",
    sub: "Optional — helps us recommend resources within your range.",
  }),
};

// Per-problem step sequences
const WIZARD_STEPS: Record<ProblemId, WizardStep[]> = {
  weakness: [
    sharedSteps.sport("We'll tailor the weakness fix plan specifically to this sport."),
    sharedSteps.state(),
    {
      kind: "question",
      id: "experienceLevel",
      required: true,
      heading: (f) => `What's their current level in ${f.sport || "the sport"}?`,
      sub: "Sets the baseline — the fix plan will match where they actually are.",
    },
    {
      kind: "question",
      id: "weaknessArea",
      required: true,
      heading: () => "What's the main weakness?",
      sub: "We'll build the entire plan around fixing this specific area.",
    },
    {
      kind: "question",
      id: "weaknessDuration",
      required: true,
      heading: () => "How long has this been a problem?",
      sub: "Helps us understand how deep-rooted it is and how to approach it.",
    },
    {
      kind: "transition",
      text: "We know what to fix. Let's look at the logistics.",
      sub: "2 final questions to calibrate the plan's intensity.",
    },
    sharedSteps.weeklyHours("The plan will match how much time you can realistically commit."),
    sharedSteps.budgetRange(),
  ],
  tournament: [
    sharedSteps.sport("We'll build a preparation plan specific to this sport's demands."),
    {
      kind: "question",
      id: "timeline",
      required: true,
      heading: () => "How soon is the tournament?",
      sub: "This defines the length and structure of the preparation plan.",
    },
    sharedSteps.state(),
    {
      kind: "question",
      id: "experienceLevel",
      required: true,
      heading: (f) => `What's their current level in ${f.sport || "the sport"}?`,
      sub: "Helps us calibrate the training intensity and goals for the event.",
    },
    {
      kind: "question",
      id: "tournamentGap",
      required: true,
      heading: () => "What's the biggest gap to close before the tournament?",
      sub: "This becomes the core focus of the preparation plan.",
    },
    {
      kind: "transition",
      text: "Got it. Now the logistics.",
      sub: "Almost done — 2 more questions.",
    },
    sharedSteps.weeklyHours("We'll build a weekly prep schedule around this availability."),
    sharedSteps.budgetRange(),
  ],
  levelup: [
    sharedSteps.sport("We'll map out exactly what the next level looks like in this sport."),
    {
      kind: "question",
      id: "currentLevel",
      required: true,
      heading: (f) => `Where is your child now in ${f.sport || "the sport"}?`,
      sub: "This is the starting point for the level-up roadmap.",
    },
    {
      kind: "question",
      id: "targetLevel",
      required: true,
      heading: () => "What level are you aiming for?",
      sub: "Sets the destination — we'll map out every step between here and there.",
    },
    sharedSteps.state(),
    {
      kind: "question",
      id: "levelBlocker",
      required: true,
      heading: () => "What's the main thing blocking progress?",
      sub: "This is what the plan will address head-on.",
    },
    {
      kind: "transition",
      text: "Clear picture. Let's get the plan right.",
      sub: "2 quick questions to size the commitment.",
    },
    sharedSteps.weeklyHours("The level-up timeline will be built around this training commitment."),
    sharedSteps.budgetRange(),
  ],
  custom: [
    sharedSteps.sport("Optional — skip if this isn't sport-specific."),
    sharedSteps.age(),
    sharedSteps.state(),
    {
      kind: "question",
      id: "challenge",
      required: true,
      heading: () => "Tell us what you're facing.",
      sub: "Describe the challenge in your own words — the more detail, the better the plan.",
    },
    {
      kind: "question",
      id: "experienceLevel",
      required: false,
      heading: () => "What's their current level?",
      sub: "Optional — gives us context for the advice.",
    },
    sharedSteps.weeklyHours("Optional — gives us context for the commitment level."),
  ],
};

// Precompute question numbers per step per problem
function getStepQNums(steps: WizardStep[]): (number | null)[] {
  return steps.map((s, i) =>
    s.kind !== "question"
      ? null
      : steps.slice(0, i + 1).filter((x) => x.kind === "question").length,
  );
}

function getTotalQuestions(steps: WizardStep[]): number {
  return steps.filter((s) => s.kind === "question").length;
}

// ─── API helpers ──────────────────────────────────────────────────────────────

const FITNESS_MAP: Record<string, GuidanceFormState["current_fitness_level"]> = {
  beginner: "Low",
  recreational: "Moderate",
  competitive: "High",
};
const HOURS_MAP: Record<string, number> = {
  "1-3": 2,
  "4-7": 6,
  "8-12": 10,
  "13-plus": 15,
};
const BUDGET_MAP: Record<string, GuidanceFormState["budget_tier"]> = {
  "under-3k": "Budget",
  "3k-7k": "Moderate",
  "7k-15k": "Moderate",
  "15k-plus": "Premium",
};
const OBJECTIVE_MAP: Record<ProblemId, GuidanceFormState["primary_objective"]> = {
  weakness: "Compete",
  tournament: "Compete",
  levelup: "Elite",
  custom: "Recreational",
};

const WEAKNESS_LABELS: Record<string, string> = {
  technique: "technical execution (incorrect form, poor timing, faulty mechanics)",
  fitness: "physical fitness (strength, speed, stamina, or agility)",
  mental: "mental focus (concentration, pressure management, nerves)",
  tactical: "tactical reading (game sense, decision-making, pattern recognition)",
};
const DURATION_LABELS: Record<string, string> = {
  weeks: "a few weeks",
  months: "several months",
  "year-plus": "over a year",
};
const TOURNAMENT_GAP_LABELS: Record<string, string> = {
  technique: "technical consistency under match pressure",
  stamina: "physical stamina for full-match performance",
  consistency: "reducing unforced errors and building consistency",
  nerves: "mental composure and nerves during competition",
};
const CURRENT_LEVEL_LABELS: Record<string, string> = {
  school: "school level",
  club: "club / academy level",
  district: "district or state competition level",
};
const TARGET_LEVEL_LABELS: Record<string, string> = {
  club: "club / academy level",
  district: "district or state competition level",
  national: "national championship level",
};
const BLOCKER_LABELS: Record<string, string> = {
  technique: "technical gaps in the fundamentals",
  fitness: "physical conditioning not matching the next level",
  coaching: "lack of the right coaching or structured guidance",
  competition: "insufficient competitive exposure and match practice",
};

function buildQuestion(form: ConsultForm, problemId: ProblemId): string {
  const sport = form.sport || "their chosen sport";
  const level = form.experienceLevel
    ? FITNESS_MAP[form.experienceLevel]?.toLowerCase() ?? form.experienceLevel
    : "developing";

  switch (problemId) {
    case "weakness":
      return [
        `My child plays ${sport} at the ${level} level.`,
        `They have been struggling with ${WEAKNESS_LABELS[form.weaknessArea ?? ""] ?? form.weaknessArea ?? "a specific weakness"} for ${DURATION_LABELS[form.weaknessDuration ?? ""] ?? "some time"}.`,
        `Please create a targeted, actionable plan to fix this weakness. Include: specific drills and exercises, how often to practice, how to track progress, and what milestones indicate improvement.`,
        `Make the plan realistic for their current ${level} level.`,
      ].join(" ");

    case "tournament":
      return [
        `My child plays ${sport} at the ${level} level and has a tournament coming up in ${form.timeline === "weeks" ? "2–4 weeks" : form.timeline === "months-1-3" ? "1–3 months" : "3–6 months"}.`,
        `The most important gap to close before the tournament is: ${TOURNAMENT_GAP_LABELS[form.tournamentGap ?? ""] ?? form.tournamentGap ?? "overall preparation"}.`,
        `Please build a week-by-week tournament preparation plan. Cover: phase-by-phase training focus, physical preparation, mental/match readiness, and a peak-week strategy.`,
      ].join(" ");

    case "levelup":
      return [
        `My child plays ${sport} and is currently at the ${CURRENT_LEVEL_LABELS[form.currentLevel ?? ""] ?? form.currentLevel ?? "current"} level.`,
        `We want to reach the ${TARGET_LEVEL_LABELS[form.targetLevel ?? ""] ?? form.targetLevel ?? "next"} level.`,
        `The main bottleneck is: ${BLOCKER_LABELS[form.levelBlocker ?? ""] ?? form.levelBlocker ?? "general development"}.`,
        `Please map out exactly what the breakthrough requires — specific training focus, realistic timeline, key milestones, and what to address first to unlock progress.`,
      ].join(" ");

    case "custom":
      return form.challenge ||
        "Please provide personalised sports guidance and an actionable plan for my child.";

    default:
      return "Please provide personalised sports guidance for my child.";
  }
}

function buildPayload(
  form: ConsultForm,
  problemId: ProblemId,
): GuidanceFormState {
  return {
    child_age: form.age ? Number(form.age) : 10,
    child_gender: form.gender === "FEMALE" ? "female" : "male",
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

function buildWaUrl(q: GuidanceFormState): string {
  const lines = [
    `Hi! I used PowerMySport's consult tool for my child. Here are their details:`,
    `• Sport: ${q.sport}`,
    `• Age: ${q.child_age} (${q.child_gender})`,
    `• Level: ${q.current_fitness_level}`,
    `• Time: ${q.weekly_time_commitment} hrs/week`,
    ``,
    `My question: ${q.parent_specific_question}`,
    ``,
    `I'd love personalised support based on the plan.`,
  ];
  return `https://wa.me/918968582443?text=${encodeURIComponent(lines.join("\n"))}`;
}

// ─── Slide animation ──────────────────────────────────────────────────────────

const slide = {
  enter: (dir: number) => ({ opacity: 0, x: dir * 28 }),
  center: { opacity: 1, x: 0 },
  exit: (dir: number) => ({ opacity: 0, x: dir * -28 }),
};

// ─── Sport grid (shared with find-sport) ─────────────────────────────────────

const SPORTS = [
  { name: "Cricket", emoji: "🏏" },
  { name: "Football", emoji: "⚽" },
  { name: "Badminton", emoji: "🏸" },
  { name: "Table Tennis", emoji: "🏓" },
  { name: "Tennis", emoji: "🎾" },
  { name: "Basketball", emoji: "🏀" },
  { name: "Volleyball", emoji: "🏐" },
  { name: "Swimming", emoji: "🏊" },
  { name: "Athletics", emoji: "🏃" },
  { name: "Gymnastics", emoji: "🤸" },
  { name: "Kabaddi", emoji: "🤼" },
  { name: "Wrestling", emoji: "🤼‍♂️" },
  { name: "Chess", emoji: "♟️" },
  { name: "Shooting", emoji: "🎯" },
] as const;

// ─── Question input renderer ──────────────────────────────────────────────────

function QuestionInput({
  id,
  form,
  set,
  problemId,
}: {
  id: ConsultField;
  form: ConsultForm;
  set: <K extends ConsultField>(k: K, v: ConsultForm[K]) => void;
  problemId: ProblemId;
}) {
  switch (id) {
    case "sport":
      if (problemId === "custom") {
        return (
          <div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
              {SPORTS.map((s) => (
                <button
                  key={s.name}
                  type="button"
                  onClick={() =>
                    set("sport", form.sport === s.name ? "" : s.name)
                  }
                  className={`flex items-center gap-2 rounded-2xl border-2 px-3 py-2.5 text-sm font-medium transition-all duration-150 active:scale-[0.97] ${
                    form.sport === s.name
                      ? "border-power-orange bg-power-orange/5 text-power-orange"
                      : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50"
                  }`}
                >
                  <span className="text-base">{s.emoji}</span>
                  <span className="truncate">{s.name}</span>
                </button>
              ))}
            </div>
            {form.sport && (
              <button
                type="button"
                onClick={() => set("sport", "")}
                className="text-xs text-slate-400 hover:text-slate-600 transition-colors"
              >
                Clear selection
              </button>
            )}
          </div>
        );
      }
      return (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {SPORTS.map((s) => (
            <button
              key={s.name}
              type="button"
              onClick={() => set("sport", s.name)}
              className={`flex items-center gap-2 rounded-2xl border-2 px-3 py-2.5 text-sm font-medium transition-all duration-150 active:scale-[0.97] ${
                form.sport === s.name
                  ? "border-power-orange bg-power-orange/5 text-power-orange"
                  : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50"
              }`}
            >
              <span className="text-base">{s.emoji}</span>
              <span className="truncate">{s.name}</span>
            </button>
          ))}
        </div>
      );

    case "age":
      return (
        <input
          type="number"
          autoFocus // eslint-disable-line jsx-a11y/no-autofocus
          value={form.age}
          onChange={(e) => set("age", e.target.value)}
          placeholder="e.g. 12"
          min={3}
          max={25}
          className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3.5 text-base text-slate-900 placeholder:text-slate-400 focus:border-power-orange focus:outline-none focus:ring-2 focus:ring-power-orange/20"
        />
      );

    case "gender":
      return (
        <BinaryCards
          options={[
            { value: "MALE", title: "Boy", sub: "" },
            { value: "FEMALE", title: "Girl", sub: "" },
          ]}
          value={form.gender}
          onChange={(v) => set("gender", v)}
        />
      );

    case "state":
      return <StateSelector value={form.state} onChange={(v) => set("state", v)} />;

    case "experienceLevel":
      return (
        <ThreeOptionCards
          options={[
            { value: "beginner", label: "Just starting out — no prior training" },
            { value: "recreational", label: "Plays for fun or at school / local club" },
            { value: "competitive", label: "Trains regularly or already competes" },
          ]}
          value={form.experienceLevel}
          onChange={(v) => set("experienceLevel", v)}
        />
      );

    case "weeklyHours":
      return (
        <FourContextCards
          options={[
            { value: "1-3", label: "1–3 hrs/week", context: "Casual — once or twice a week" },
            { value: "4-7", label: "4–7 hrs/week", context: "Regular — most days, short sessions" },
            { value: "8-12", label: "8–12 hrs/week", context: "Dedicated — structured schedule" },
            { value: "13-plus", label: "13+ hrs/week", context: "Full-time athlete commitment" },
          ]}
          value={form.weeklyHours}
          onChange={(v) => set("weeklyHours", v)}
        />
      );

    case "budgetRange":
      return (
        <FourContextCards
          options={[
            { value: "under-3k", label: "Under ₹3,000", context: "Minimal equipment, public grounds" },
            { value: "3k-7k", label: "₹3,000–7,000", context: "Academy fees, basic coaching" },
            { value: "7k-15k", label: "₹7,000–15,000", context: "Regular coaching + equipment" },
            { value: "15k-plus", label: "₹15,000+", context: "Premium coaching, tournaments, travel" },
          ]}
          value={form.budgetRange}
          onChange={(v) => set("budgetRange", v)}
        />
      );

    case "weaknessArea":
      return (
        <FourContextCards
          options={[
            { value: "technique", label: "Technique problems", context: "Incorrect form, poor timing, faulty mechanics" },
            { value: "fitness", label: "Physical fitness", context: "Lacks strength, speed, stamina, or agility" },
            { value: "mental", label: "Mental focus", context: "Loses concentration, nerves, gives up under pressure" },
            { value: "tactical", label: "Tactical reading", context: "Doesn't read the game or make smart decisions" },
          ]}
          value={form.weaknessArea}
          onChange={(v) => set("weaknessArea", v)}
        />
      );

    case "weaknessDuration":
      return (
        <ThreeOptionCards
          options={[
            { value: "weeks", label: "Just a few weeks — it's recent" },
            { value: "months", label: "A few months — it's been consistent" },
            { value: "year-plus", label: "Over a year — it's a recurring problem" },
          ]}
          value={form.weaknessDuration}
          onChange={(v) => set("weaknessDuration", v)}
        />
      );

    case "timeline":
      return (
        <ThreeOptionCards
          options={[
            { value: "weeks", label: "2–4 weeks — very soon" },
            { value: "months-1-3", label: "1–3 months — enough time to build" },
            { value: "months-3-6", label: "3–6 months — good runway to peak" },
          ]}
          value={form.timeline}
          onChange={(v) => set("timeline", v)}
        />
      );

    case "tournamentGap":
      return (
        <FourContextCards
          options={[
            { value: "technique", label: "Technical consistency", context: "Technique breaks down under match pressure" },
            { value: "stamina", label: "Physical stamina", context: "Doesn't have the fitness for full-match performance" },
            { value: "consistency", label: "Reducing errors", context: "Too many unforced errors and inconsistent play" },
            { value: "nerves", label: "Mental composure", context: "Nerves and pressure affect performance during competition" },
          ]}
          value={form.tournamentGap}
          onChange={(v) => set("tournamentGap", v)}
        />
      );

    case "currentLevel":
      return (
        <ThreeOptionCards
          options={[
            { value: "school", label: "School level — playing casually or for school" },
            { value: "club", label: "Club level — enrolled at an academy or local club" },
            { value: "district", label: "District / State — competing at district or state events" },
          ]}
          value={form.currentLevel}
          onChange={(v) => set("currentLevel", v)}
        />
      );

    case "targetLevel":
      return (
        <ThreeOptionCards
          options={[
            { value: "club", label: "Club / academy — get into a proper structured programme" },
            { value: "district", label: "District / State — compete at district or state tournaments" },
            { value: "national", label: "National — aim for national championships or selection" },
          ]}
          value={form.targetLevel}
          onChange={(v) => set("targetLevel", v)}
        />
      );

    case "levelBlocker":
      return (
        <FourContextCards
          options={[
            { value: "technique", label: "Technique gaps", context: "Fundamental skills not at the required standard" },
            { value: "fitness", label: "Physical conditioning", context: "Not fit or strong enough for the next level" },
            { value: "coaching", label: "Coaching quality", context: "Needs better guidance or a higher-level coach" },
            { value: "competition", label: "Lack of exposure", context: "Not getting enough competitive match practice" },
          ]}
          value={form.levelBlocker}
          onChange={(v) => set("levelBlocker", v)}
        />
      );

    case "challenge":
      return (
        <textarea
          autoFocus // eslint-disable-line jsx-a11y/no-autofocus
          value={form.challenge}
          onChange={(e) => set("challenge", e.target.value)}
          placeholder="e.g. My son has been struggling with motivation after a string of losses. He loves cricket but keeps saying he wants to quit. How do we help him get his confidence back?"
          rows={5}
          className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-power-orange focus:outline-none focus:ring-2 focus:ring-power-orange/20 resize-none leading-relaxed"
        />
      );

    default:
      return null;
  }
}

function isAnswered(id: ConsultField, form: ConsultForm): boolean {
  const v = form[id];
  if (typeof v === "string") return v.length > 0;
  if (typeof v === "number") return true;
  return v !== null;
}

// ─── Loading screen ───────────────────────────────────────────────────────────

function LoadingView({ problemId }: { problemId: ProblemId }) {
  const labels: Record<ProblemId, { title: string; sub: string }> = {
    weakness: { title: "Building your weakness fix plan…", sub: "Analysing the challenge and designing targeted drills" },
    tournament: { title: "Building your tournament plan…", sub: "Designing a week-by-week preparation timeline" },
    levelup: { title: "Mapping the level-up path…", sub: "Working out exactly what the breakthrough requires" },
    custom: { title: "Working on your plan…", sub: "Analysing the challenge and crafting targeted advice" },
  };
  const { title, sub } = labels[problemId];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="relative min-h-screen flex items-center justify-center px-4"
    >
      <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-orange-50/50 via-white to-slate-50" />
        <div className="absolute -left-32 top-10 h-96 w-96 rounded-full bg-power-orange/8 blur-3xl" />
      </div>
      <div className="text-center max-w-xs">
        <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-power-orange/10">
          <Loader2 className="h-8 w-8 animate-spin text-power-orange" />
        </div>
        <h2 className="font-title text-xl font-bold text-slate-900 mb-2">{title}</h2>
        <p className="text-sm text-slate-500">{sub}</p>
      </div>
    </motion.div>
  );
}

// ─── Results screen ───────────────────────────────────────────────────────────

function ResultsScreen({
  submission,
  problemId,
  onReset,
}: {
  submission: GuidanceSubmission;
  problemId: ProblemId;
  onReset: () => void;
}) {
  const { user } = useAuthStore();
  const [chatOpen, setChatOpen] = useState(false);
  const [loginModalOpen, setLoginModalOpen] = useState(false);
  const [downloadingPdf, setDownloadingPdf] = useState(false);

  const pt = PROBLEM_TYPES.find((p) => p.id === problemId) ?? PROBLEM_TYPES[3];

  const handleChatClick = () => {
    if (!user) setLoginModalOpen(true);
    else setChatOpen(true);
  };

  const handleDownloadPdf = async () => {
    setDownloadingPdf(true);
    try {
      await downloadGuidanceReportPdf(submission.id);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Unable to download report");
    } finally {
      setDownloadingPdf(false);
    }
  };

  return (
    <div className="relative min-h-screen px-4 pt-4 pb-10 sm:px-6">
      <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-orange-50/50 via-white to-slate-50" />
        <div className="absolute -left-32 -top-10 h-[28rem] w-[28rem] rounded-full bg-power-orange/10 blur-3xl" />
        <div className="absolute right-[-6rem] top-40 h-80 w-80 rounded-full bg-amber-200/30 blur-3xl" />
      </div>

      <div className="mx-auto w-full max-w-4xl">
        {/* Header */}
        <div className="pb-4">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/70 bg-white/85 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-widest text-slate-500 shadow-sm backdrop-blur">
              <BrainCircuit className="h-3.5 w-3.5 text-power-orange" />
              {pt.label}
            </div>
            <button
              type="button"
              onClick={onReset}
              className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 shadow-sm transition hover:bg-slate-50"
            >
              <RotateCcw className="h-3 w-3" />
              New query
            </button>
          </div>
          <p className="text-sm text-slate-500">
            Here&apos;s your personalised plan — based on everything you told us.
          </p>
        </div>

        {/* Results */}
        <div className="rounded-3xl border border-slate-200/80 bg-white/95 shadow-[0_10px_40px_-18px_rgba(15,23,42,0.25)] ring-1 ring-slate-900/[0.03] backdrop-blur-sm">
          <div className="p-4 sm:p-6">
            <ResultsView
              key={submission.id}
              submission={submission}
              actions={{
                onChatClick: handleChatClick,
                onDownloadPdf: handleDownloadPdf,
                downloadingPdf,
                waUrl: buildWaUrl(submission.query),
              }}
            />
          </div>
        </div>
      </div>

      {chatOpen && (
        <GuidanceChatDrawer
          isOpen={chatOpen}
          onClose={() => setChatOpen(false)}
          submission={submission}
        />
      )}

      <LoginRequiredModal
        isOpen={loginModalOpen}
        onClose={() => setLoginModalOpen(false)}
        sport={submission.query.sport}
        redirectPath={`/consult?submissionId=${submission.id}&openChat=1`}
      />
    </div>
  );
}

// ─── Problem wizard ───────────────────────────────────────────────────────────

function ProblemWizardInner({
  problemId,
  onBack,
}: {
  problemId: ProblemId;
  onBack: () => void;
}) {
  const steps = WIZARD_STEPS[problemId];
  const qNums = getStepQNums(steps);
  const totalQ = getTotalQuestions(steps);

  const [idx, setIdx] = useState(0);
  const [form, setForm] = useState<ConsultForm>(() => {
    // Pre-fill sport from URL search params if present
    if (typeof window !== "undefined") {
      const sp = new URLSearchParams(window.location.search);
      const sport = sp.get("sport") ?? "";
      return { ...EMPTY_FORM, sport };
    }
    return EMPTY_FORM;
  });
  const [dir, setDir] = useState<1 | -1>(1);
  const [loading, setLoading] = useState(false);
  const [submission, setSubmission] = useState<GuidanceSubmission | null>(null);
  const [error, setError] = useState<string | null>(null);

  const set = <K extends ConsultField>(k: K, v: ConsultForm[K]) =>
    setForm((p) => ({ ...p, [k]: v }));

  const current = steps[idx];
  const qNum = qNums[idx];

  const canAdvance =
    current.kind === "transition" ||
    !current.required ||
    isAnswered(current.id, form);

  const isLastStep = idx === steps.length - 1;

  const goNext = () => {
    setError(null);
    setDir(1);
    if (!isLastStep) {
      setIdx((i) => i + 1);
    } else {
      handleSubmit();
    }
  };

  const goPrev = () => {
    setDir(-1);
    if (idx > 0) setIdx((i) => i - 1);
    else onBack();
  };

  const handleSubmit = async () => {
    setLoading(true);
    try {
      const payload = buildPayload(form, problemId);
      const res = await api.post<{
        success: boolean;
        status?: string;
        sport?: string;
        data: GuidanceSubmission;
      }>("/guidance", payload);

      if (res.data.status === "not_supported") {
        const sportName = res.data.sport ?? form.sport ?? "that sport";
        toast.error(
          `We're building the ${sportName} pathway — try Cricket, Tennis, or Football for now.`,
          { duration: 6000 } as Parameters<typeof toast.error>[1],
        );
        setLoading(false);
        return;
      }

      setSubmission(res.data.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to generate plan. Please try again.");
      setLoading(false);
    }
  };

  const reset = () => {
    setForm(EMPTY_FORM);
    setIdx(0);
    setDir(1);
    setLoading(false);
    setSubmission(null);
    setError(null);
  };

  if (loading) return <LoadingView problemId={problemId} />;
  if (submission) return <ResultsScreen submission={submission} problemId={problemId} onReset={reset} />;

  const pt = PROBLEM_TYPES.find((p) => p.id === problemId)!;

  return (
    <div className="relative min-h-screen">
      <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-orange-50/50 via-white to-slate-50" />
        <div className="absolute -left-32 -top-10 h-[28rem] w-[28rem] rounded-full bg-power-orange/8 blur-3xl" />
        <div className="absolute right-[-6rem] top-40 h-80 w-80 rounded-full bg-amber-200/20 blur-3xl" />
      </div>

      {/* Transition card */}
      {current.kind === "transition" && (
        <motion.div
          key={idx}
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.25 }}
          className="min-h-screen flex items-center justify-center px-4"
        >
          <div className="text-center max-w-xs">
            <button
              type="button"
              onClick={goPrev}
              className="mb-8 inline-flex items-center gap-1.5 text-sm font-medium text-slate-400 hover:text-slate-700 transition-colors"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Back
            </button>
            <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-power-orange/10">
              <Sparkles className="h-7 w-7 text-power-orange" />
            </div>
            <h2 className="font-title text-2xl font-bold text-slate-900 mb-2">
              {current.text}
            </h2>
            <p className="text-slate-500 text-sm mb-8">{current.sub}</p>
            <button
              type="button"
              onClick={goNext}
              className="inline-flex items-center gap-2 rounded-xl bg-power-orange px-6 py-3 text-sm font-bold text-white shadow-[0_4px_14px_-4px_rgba(233,115,22,0.45)] transition hover:bg-orange-600 active:scale-[0.98]"
            >
              Continue
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </motion.div>
      )}

      {/* Question card */}
      {current.kind === "question" && (
        <div className="px-4 pt-6 pb-10 sm:px-6">
          <div className="mx-auto w-full max-w-2xl">
            {/* Nav row */}
            <div className="mb-5 flex items-center justify-between">
              <button
                type="button"
                onClick={goPrev}
                className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-800 transition-colors"
              >
                <ArrowLeft className="h-4 w-4" />
                {idx === 0 ? "Back to options" : "Back"}
              </button>
              <div className="flex items-center gap-3">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  {pt.label}
                </span>
                {qNum !== null && (
                  <span className="text-xs font-medium text-slate-400">
                    {qNum} / {totalQ}
                  </span>
                )}
              </div>
            </div>

            {/* Progress bar */}
            <div className="mb-6 h-1 rounded-full bg-slate-100 overflow-hidden">
              <div
                className="h-full rounded-full bg-power-orange transition-all duration-500"
                style={{ width: `${((qNum ?? 0) / totalQ) * 100}%` }}
              />
            </div>

            {/* Animated question card */}
            <motion.div
              key={idx}
              initial={{ opacity: 0, x: dir * 28 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.22, ease: "easeOut" }}
              className="rounded-3xl border border-slate-200/80 bg-white/95 p-6 shadow-[0_10px_40px_-18px_rgba(15,23,42,0.2)] ring-1 ring-slate-900/[0.03] sm:p-7"
            >
                <div className="mb-5">
                  <h2 className="font-title text-xl font-bold text-slate-900 mb-1.5">
                    {current.heading(form)}
                  </h2>
                  <p className="text-sm text-slate-500">{current.sub}</p>
                </div>

                <QuestionInput
                  id={current.id}
                  form={form}
                  set={set}
                  problemId={problemId}
                />

                {error && (
                  <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                    {error}
                  </div>
                )}

                <div className="mt-7 flex items-center justify-between gap-3">
                  {!current.required ? (
                    <button
                      type="button"
                      onClick={goNext}
                      className="text-sm font-medium text-slate-400 hover:text-slate-600 transition-colors"
                    >
                      Skip
                    </button>
                  ) : (
                    <div />
                  )}
                  <button
                    type="button"
                    onClick={goNext}
                    disabled={!canAdvance}
                    className="inline-flex items-center gap-2 rounded-xl bg-power-orange px-6 py-3 text-sm font-bold text-white shadow-[0_4px_14px_-4px_rgba(233,115,22,0.45)] transition hover:bg-orange-600 active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none"
                  >
                    {isLastStep ? "Get my plan" : "Continue"}
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
            </motion.div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Problem picker ───────────────────────────────────────────────────────────

function ProblemPicker({ onSelect }: { onSelect: (id: ProblemId) => void }) {
  return (
    <div className="relative min-h-screen flex items-center justify-center px-4 py-16">
      <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-orange-50/60 via-white to-slate-50" />
        <div className="absolute -left-32 -top-10 h-[28rem] w-[28rem] rounded-full bg-power-orange/8 blur-3xl" />
        <div className="absolute right-[-6rem] top-40 h-80 w-80 rounded-full bg-amber-200/25 blur-3xl" />
        <div className="absolute bottom-0 left-1/3 h-64 w-64 rounded-full bg-indigo-200/15 blur-3xl" />
      </div>

      <div className="w-full max-w-3xl">
        <motion.div
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: "easeOut" }}
          className="text-center mb-10"
        >
          <div className="inline-flex items-center gap-2 rounded-full border border-orange-100 bg-orange-50 px-3 py-1.5 text-[11px] font-bold uppercase tracking-widest text-power-orange mb-4">
            <BrainCircuit className="h-3 w-3" />
            Expert Help
          </div>
          <h1 className="font-title text-3xl font-bold text-slate-900 sm:text-4xl mb-3 tracking-tight">
            What do you need help with?
          </h1>
          <p className="text-slate-500 text-base max-w-md mx-auto leading-relaxed">
            Pick the challenge you&apos;re facing — we&apos;ll ask a few targeted questions and
            return an actionable plan.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {PROBLEM_TYPES.map((pt, i) => {
            const Icon = pt.Icon;
            return (
              <motion.button
                key={pt.id}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.08 * i + 0.1, duration: 0.35, ease: "easeOut" }}
                onClick={() => onSelect(pt.id)}
                className={`group text-left rounded-3xl border-2 border-slate-200 bg-white p-6 shadow-sm ${pt.hoverBorder} hover:shadow-md transition-all duration-200 active:scale-[0.99]`}
              >
                <div
                  className={`mb-4 flex h-11 w-11 items-center justify-center rounded-2xl ${pt.color} transition-transform duration-300 group-hover:scale-110`}
                >
                  <Icon className="h-5 w-5" />
                </div>
                <p className={`text-[11px] font-bold uppercase tracking-wider ${pt.accentText} mb-0.5`}>
                  {pt.tagline}
                </p>
                <h2 className="font-title text-lg font-bold text-slate-900 mb-1.5">
                  {pt.label}
                </h2>
                <p className="text-sm text-slate-500 leading-relaxed mb-4">
                  {pt.description}
                </p>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-slate-400">~3 minutes</span>
                  <span
                    className={`text-sm font-bold ${pt.accentText} group-hover:translate-x-1 transition-transform duration-200 inline-flex`}
                  >
                    Get started →
                  </span>
                </div>
              </motion.button>
            );
          })}
        </div>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5, duration: 0.4 }}
          className="text-center text-xs text-slate-400 mt-6"
        >
          Free to use · AI-powered · No commitment
        </motion.p>
      </div>
    </div>
  );
}

// ─── Default export ───────────────────────────────────────────────────────────

export default function ConsultPage() {
  const [problemType, setProblemType] = useState<ProblemId | null>(null);

  if (problemType) {
    return (
      <Suspense fallback={null}>
        <ProblemWizardInner
          problemId={problemType}
          onBack={() => setProblemType(null)}
        />
      </Suspense>
    );
  }
  return <ProblemPicker onSelect={setProblemType} />;
}
