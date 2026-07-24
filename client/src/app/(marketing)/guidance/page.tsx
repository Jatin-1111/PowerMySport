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
import { Suspense, useEffect, useState } from "react";

import api from "@/lib/api/axios";
import { toast } from "@/lib/toast";
import { useAuthStore } from "@/modules/auth/store/authStore";
import { GuidanceChatDrawer } from "@/modules/guidance/components/chat/GuidanceChatDrawer";
import { LoginRequiredModal } from "@/modules/guidance/components/chat/LoginRequiredModal";
import { ResultsView } from "@/modules/guidance/components/results/ResultsView";
import { TagAssistedTextarea } from "@/modules/guidance/components/shared/TagAssistedTextarea";
import { downloadGuidanceReportPdf, getGuidanceWhatsAppUrl } from "@/modules/guidance/services/guidance";
import type { GuidanceSubmission } from "@/modules/guidance/types";
import { CompleteProfileNudge, shouldShowTraitsNudge } from "@/modules/player/components/CompleteProfileNudge";
import { BinaryCards } from "@/modules/find-sport/components/inputs/BinaryCards";
import { FourContextCards } from "@/modules/find-sport/components/inputs/FourContextCards";
import { SportSearchInput } from "@/modules/find-sport/components/inputs/SportSearchInput";
import { StateSelector } from "@/modules/find-sport/components/inputs/StateSelector";
import { ThreeOptionCards } from "@/modules/find-sport/components/inputs/ThreeOptionCards";
import { getAgeFromDob } from "@/modules/find-sport/utils/sportKnownFlowUtils";
import { EMPTY_FORM, buildPayload, buildQuestion, COMMON_WEAKNESS_ISSUES } from "./guidanceUtils";
import type { ConsultForm, ProblemId } from "./guidanceUtils";

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
const WIZARD_STEPS: Record<ProblemId, WizardStep[]> = {
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
      heading: (f) => `What's the main weakness holding ${f.sport ? `their ${f.sport}` : "them"} back?`,
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
    sharedSteps.weeklyHours("The drill schedule will fit around the time you can realistically commit."),
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
      heading: (f) => `What does ${f.sport ? `your ${f.sport} player` : "your child"} actually do well?`,
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

// Rough estimate so the picker's time label tracks each flow's actual step
// count instead of a single hardcoded guess that drifts as steps are edited.
function estimateMinutes(steps: WizardStep[]): string {
  const minutes = Math.max(2, Math.round(getTotalQuestions(steps) / 2.5));
  return `~${minutes} min`;
}

// ─── Slide animation ──────────────────────────────────────────────────────────

const slide = {
  enter: (dir: number) => ({ opacity: 0, x: dir * 28 }),
  center: { opacity: 1, x: 0 },
  exit: (dir: number) => ({ opacity: 0, x: dir * -28 }),
};

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
      return (
        <SportSearchInput
          value={form.sport}
          onChange={(v) => set("sport", v)}
          required={problemId !== "custom"}
        />
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
            { value: "beginner", label: "Beginner — city / neighbourhood level, just getting started" },
            { value: "intermediate", label: "Intermediate — school, club or district level, training regularly" },
            { value: "competitive", label: "Competitive — state or national level, serious competition" },
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

    case "executor":
      return (
        <ThreeOptionCards
          options={[
            { value: "child", label: "The child on their own — self-practice, no adult guiding sessions" },
            { value: "parent", label: "Me (the parent) — I'll supervise, but I'm not a coach" },
            { value: "coach", label: "A coach or trainer — professional guidance is available" },
          ]}
          value={form.executor}
          onChange={(v) => set("executor", v)}
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

    case "weaknessDetail":
      return (
        <TagAssistedTextarea
          value={form.weaknessDetail}
          onChange={(v) => set("weaknessDetail", v)}
          options={COMMON_WEAKNESS_ISSUES[form.weaknessArea ?? ""] ?? []}
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
            { value: "stamina", label: "Physical stamina", context: "Doesn't have the fitness for a full-day competition" },
            { value: "nerves", label: "Mental composure", context: "Nerves and pressure significantly affect performance" },
            { value: "matchplay", label: "Match experience", context: "Not enough competitive matches — struggles to read opponents and adapt" },
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
            { value: "technique", label: "Technique gaps", context: "Fundamental skills not at the standard required for the next level" },
            { value: "fitness", label: "Physical conditioning", context: "Not fit or strong enough to compete at the next level" },
            { value: "mental", label: "Mental game", context: "Confidence, composure, or belief is holding them back" },
            { value: "competition", label: "Lack of exposure", context: "Not getting enough competitive match practice at the right level" },
          ]}
          value={form.levelBlocker}
          onChange={(v) => set("levelBlocker", v)}
        />
      );

    case "weaknessContext":
      return (
        <FourContextCards
          options={[
            { value: "training", label: "In training", context: "They know it's there — visible during practice" },
            { value: "matches", label: "In matches", context: "Game pressure causes the breakdown" },
            { value: "pressure", label: "Under scrutiny", context: "Performance drops when being watched or evaluated" },
            { value: "always", label: "Everywhere", context: "Consistent in all situations — deeply ingrained" },
          ]}
          value={form.weaknessContext}
          onChange={(v) => set("weaknessContext", v)}
        />
      );

    case "weaknessAttempts":
      return (
        <FourContextCards
          options={[
            { value: "nothing", label: "Nothing yet", context: "We've just identified the problem" },
            { value: "practice", label: "Extra practice", context: "Self-practice on their own" },
            { value: "video", label: "Video analysis", context: "Watching footage to self-correct" },
            { value: "coaching", label: "Tried coaching", context: "Worked with a coach but it hasn't stuck" },
          ]}
          value={form.weaknessAttempts}
          onChange={(v) => set("weaknessAttempts", v)}
        />
      );

    case "tournamentLevel":
      return (
        <FourContextCards
          options={[
            { value: "school", label: "School level", context: "Inter-school or intra-school competition" },
            { value: "district", label: "District level", context: "Competing against players across the district" },
            { value: "state", label: "State championship", context: "State-level tournament or selection trial" },
            { value: "national", label: "National level", context: "National championship or national selection" },
          ]}
          value={form.tournamentLevel}
          onChange={(v) => set("tournamentLevel", v)}
        />
      );

    case "physicalReadiness":
      return (
        <ThreeOptionCards
          options={[
            { value: "low", label: "Not match-ready — fitness is a concern, gets tired quickly" },
            { value: "moderate", label: "Reasonably fit — can compete but fades in the second half" },
            { value: "high", label: "Match-fit — conditioning is not an issue, ready to perform" },
          ]}
          value={form.physicalReadiness}
          onChange={(v) => set("physicalReadiness", v)}
        />
      );

    case "timeAtCurrentLevel":
      return (
        <ThreeOptionCards
          options={[
            { value: "new", label: "Under 6 months — still settling in at this level" },
            { value: "6-12m", label: "6–12 months — settled in but not progressing" },
            { value: "1y-plus", label: "Over a year — definitely plateaued, feels stuck" },
          ]}
          value={form.timeAtCurrentLevel}
          onChange={(v) => set("timeAtCurrentLevel", v)}
        />
      );

    case "trainingType":
      return (
        <FourContextCards
          options={[
            { value: "self", label: "Self-practice", context: "On their own at home or with friends — no coaching" },
            { value: "club", label: "Club or school", context: "Group sessions at a local club or school programme" },
            { value: "academy", label: "Formal academy", context: "Enrolled at an academy with structured training" },
            { value: "private", label: "Private coaching", context: "One-on-one or semi-private coaching sessions" },
          ]}
          value={form.trainingType}
          onChange={(v) => set("trainingType", v)}
        />
      );

    case "topStrength":
      return (
        <FourContextCards
          options={[
            { value: "technique", label: "Technical skills", context: "Clean execution, good form, strong fundamentals" },
            { value: "tactical", label: "Game intelligence", context: "Reads play well, makes smart decisions" },
            { value: "physical", label: "Physical athleticism", context: "Speed, strength, or stamina stands out" },
            { value: "mental", label: "Mental strength", context: "Composure, focus, and resilience under pressure" },
          ]}
          value={form.topStrength}
          onChange={(v) => set("topStrength", v)}
        />
      );

    case "challengeCategory":
      return (
        <FourContextCards
          options={[
            { value: "motivation", label: "Motivation / confidence", context: "Mental blocks, fear of failure, loss of drive" },
            { value: "injury", label: "Injury or recovery", context: "Physical health concern, rehab, return to sport" },
            { value: "coaching", label: "Coaching or setup", context: "Coach selection, training programme, or structure" },
            { value: "nutrition", label: "Nutrition or burnout", context: "Diet, body development, overtraining, balance" },
          ]}
          value={form.challengeCategory}
          onChange={(v) => set("challengeCategory", v)}
        />
      );

    case "desiredOutcome":
      return (
        <FourContextCards
          options={[
            { value: "plan", label: "Step-by-step plan", context: "A concrete action plan to follow immediately" },
            { value: "advice", label: "Expert perspective", context: "Guidance and insight from a sports expert viewpoint" },
            { value: "resources", label: "Resources to find", context: "Specific programmes, coaches, or tools to seek out" },
            { value: "opinion", label: "Second opinion", context: "A fresh look at what we're currently doing" },
          ]}
          value={form.desiredOutcome}
          onChange={(v) => set("desiredOutcome", v)}
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
  dependent,
}: {
  submission: GuidanceSubmission;
  problemId: ProblemId;
  onReset: () => void;
  dependent?: any | null;
}) {
  const { user } = useAuthStore();
  const [chatOpen, setChatOpen] = useState(false);
  const [loginModalOpen, setLoginModalOpen] = useState(false);
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [traitsNudgeOpen, setTraitsNudgeOpen] = useState(false);

  const pt = PROBLEM_TYPES.find((p) => p.id === problemId) ?? PROBLEM_TYPES[3];

  const handleChatClick = () => {
    if (!user) { setLoginModalOpen(true); return; }
    if (shouldShowTraitsNudge(dependent)) { setTraitsNudgeOpen(true); return; }
    setChatOpen(true);
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
                waUrl: getGuidanceWhatsAppUrl(submission.id),
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
        redirectPath={`/guidance?submissionId=${submission.id}&openChat=1`}
      />

      {dependent && (
        <CompleteProfileNudge
          isOpen={traitsNudgeOpen}
          dependentId={dependent._id}
          dependentName={dependent.name ?? "Your child"}
          onProceed={() => {
            setTraitsNudgeOpen(false);
            setChatOpen(true);
          }}
        />
      )}
    </div>
  );
}

// ─── Problem wizard ───────────────────────────────────────────────────────────

type PreFillPhase = "loading" | "select" | "ready";

function ProblemWizardInner({
  problemId,
  onBack,
}: {
  problemId: ProblemId;
  onBack: () => void;
}) {
  const { token } = useAuthStore();
  const steps = WIZARD_STEPS[problemId];
  const qNums = getStepQNums(steps);
  const totalQ = getTotalQuestions(steps);

  const [idx, setIdx] = useState(0);
  const [levelPlanLabel] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    const sp = new URLSearchParams(window.location.search);
    return sp.get("mode") === "level-plan" ? sp.get("levelLabel") : null;
  });
  const [form, setForm] = useState<ConsultForm>(() => {
    // Pre-fill from URL search params if present — sport always; state and
    // roadmapLevelLabel only for a /roadmap level CTA (?mode=level-plan).
    if (typeof window !== "undefined") {
      const sp = new URLSearchParams(window.location.search);
      const sport = sp.get("sport") ?? "";
      const isLevelPlan = sp.get("mode") === "level-plan";
      return {
        ...EMPTY_FORM,
        sport,
        state: isLevelPlan ? sp.get("state") : null,
        roadmapLevelLabel: isLevelPlan ? sp.get("levelLabel") : null,
      };
    }
    return EMPTY_FORM;
  });
  const [dir, setDir] = useState<1 | -1>(1);
  const [loading, setLoading] = useState(false);
  const [submission, setSubmission] = useState<GuidanceSubmission | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dependents, setDependents] = useState<any[]>([]);
  const [selectedDependentId, setSelectedDependentId] = useState<string | null>(null);
  const [preFillPhase, setPreFillPhase] = useState<PreFillPhase>(token ? "loading" : "ready");

  useEffect(() => {
    if (!token) return;
    const timeout = setTimeout(() => setPreFillPhase("ready"), 1500);
    api.get<{ success: boolean; data: any[] }>("/auth/players")
      .then(res => {
        clearTimeout(timeout);
        const deps = (res.data.data || []).filter((p: any) => p.type === "DEPENDENT");
        setDependents(deps);
        // Always show the picker when there's at least one dependent — even
        // with exactly one, the parent needs the "Continue without selecting"
        // option (e.g. this query is about a different child).
        setPreFillPhase(deps.length > 0 ? "select" : "ready");
      })
      .catch(() => { clearTimeout(timeout); setPreFillPhase("ready"); });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  function applyDependent(dep: any) {
    setForm(prev => {
      const age = dep.dob ? getAgeFromDob(new Date(dep.dob).toISOString().slice(0, 10)) : null;
      return {
        ...prev,
        sport: prev.sport || dep.sportsFocus?.[0] || prev.sport,
        age: prev.age || (age ? String(age) : prev.age),
        // Only carry over MALE/FEMALE — the gender question offers just those
        // two options, so an "OTHER" profile value must stay unset and force
        // an explicit answer rather than silently failing to pre-fill.
        gender: prev.gender ?? (dep.gender === "MALE" || dep.gender === "FEMALE" ? dep.gender : null),
        state: prev.state ?? dep.location ?? null,
        experienceLevel: prev.experienceLevel ?? dep.experienceLevel ?? null,
        weeklyHours: prev.weeklyHours ?? dep.weeklyHoursCategory ?? null,
        budgetRange: prev.budgetRange ?? dep.budgetRange ?? null,
      };
    });
  }

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
      if (selectedDependentId) {
        payload.dependent_id = selectedDependentId;
      }
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

      // Sync shared profile fields back to the matched dependent
      if (selectedDependentId) {
        api.put(`/auth/dependents/${selectedDependentId}`, {
          ...(form.sport ? { sportsFocus: [form.sport] } : {}),
          ...(form.gender ? { gender: form.gender } : {}),
          ...(form.state ? { location: form.state } : {}),
          ...(form.experienceLevel ? { experienceLevel: form.experienceLevel } : {}),
          ...(form.weeklyHours ? { weeklyHoursCategory: form.weeklyHours } : {}),
          ...(form.budgetRange ? { budgetRange: form.budgetRange } : {}),
        }).catch(() => {});
      }

      setLoading(false);
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
    setSelectedDependentId(null);
    setPreFillPhase(dependents.length > 0 ? "select" : "ready");
  };

  if (loading) return <LoadingView problemId={problemId} />;
  if (submission)
    return (
      <ResultsScreen
        submission={submission}
        problemId={problemId}
        onReset={reset}
        dependent={dependents.find((d) => d._id === selectedDependentId) ?? null}
      />
    );

  // Brief loading state while we fetch dependents
  if (preFillPhase === "loading") {
    return (
      <div className="relative min-h-screen flex items-center justify-center">
        <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-b from-orange-50/50 via-white to-slate-50" />
        </div>
        <Loader2 className="h-6 w-6 animate-spin text-power-orange" />
      </div>
    );
  }

  // Dependent selector for users with multiple children
  if (preFillPhase === "select") {
    return (
      <div className="relative min-h-screen flex items-center justify-center px-4">
        <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-b from-orange-50/50 via-white to-slate-50" />
          <div className="absolute -left-32 top-10 h-96 w-96 rounded-full bg-power-orange/8 blur-3xl" />
        </div>
        <div className="w-full max-w-sm">
          <button
            type="button"
            onClick={onBack}
            className="mb-8 inline-flex items-center gap-1.5 text-sm font-medium text-slate-400 hover:text-slate-700 transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back
          </button>
          <h2 className="font-title text-2xl font-bold text-slate-900 mb-2">
            Who is this for?
          </h2>
          <p className="text-sm text-slate-500 mb-6">
            Select a child to pre-fill their details, or continue manually.
          </p>
          <div className="space-y-3">
            {dependents.map(dep => {
              const age = dep.dob ? getAgeFromDob(new Date(dep.dob).toISOString().slice(0, 10)) : null;
              return (
                <button
                  key={dep._id}
                  type="button"
                  onClick={() => {
                    applyDependent(dep);
                    setSelectedDependentId(dep._id);
                    setPreFillPhase("ready");
                  }}
                  className="w-full flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-3.5 text-left text-sm font-medium text-slate-900 shadow-sm transition hover:border-power-orange hover:bg-orange-50"
                >
                  <span>{dep.name}</span>
                  {age && <span className="text-xs text-slate-400">{age} yrs</span>}
                </button>
              );
            })}
            <button
              type="button"
              onClick={() => setPreFillPhase("ready")}
              className="w-full rounded-2xl border border-dashed border-slate-200 bg-transparent px-4 py-3 text-sm text-slate-400 transition hover:border-slate-300 hover:text-slate-600"
            >
              Continue without selecting
            </button>
          </div>
        </div>
      </div>
    );
  }

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
            {levelPlanLabel && (
              <div className="mb-4 flex items-center gap-2 rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-2.5">
                <Sparkles className="h-3.5 w-3.5 text-indigo-500 shrink-0" />
                <p className="text-xs font-semibold text-indigo-700">
                  Planning for {form.sport || "your sport"} · {levelPlanLabel}
                </p>
              </div>
            )}
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
                  <span className="text-xs font-medium text-slate-400">
                    {estimateMinutes(WIZARD_STEPS[pt.id])}
                  </span>
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

export default function GuidancePage() {
  // A /roadmap level CTA (?mode=level-plan) always maps to "levelup" and
  // skips the picker entirely — the parent already told us what they want by
  // clicking a specific pathway level, so don't ask them again.
  const [problemType, setProblemType] = useState<ProblemId | null>(() => {
    if (typeof window !== "undefined") {
      const sp = new URLSearchParams(window.location.search);
      if (sp.get("mode") === "level-plan") return "levelup";
    }
    return null;
  });

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
