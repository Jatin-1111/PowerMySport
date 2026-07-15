"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowLeft,
  CheckCircle2,
  ChevronRight,
  Map,
  MessageCircle,
  RotateCcw,
  Sparkles,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { BinaryCards } from "./inputs/BinaryCards";
import { FourContextCards } from "./inputs/FourContextCards";
import { SpectrumSlider } from "./inputs/SpectrumSlider";
import { StateSelector } from "./inputs/StateSelector";
import { ThreeOptionCards } from "./inputs/ThreeOptionCards";

// ─── Sports ──────────────────────────────────────────────────────────────────

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

// ─── Form ─────────────────────────────────────────────────────────────────────

interface KnownSportForm {
  sport: string;
  childName: string;
  age: string;
  gender: string | null;
  state: string | null;
  experienceLevel: string | null;
  energyType: string | null;
  teamIndividual: number | null;
  ambition: string | null;
  weeklyHours: string | null;
  budgetRange: string | null;
}

const EMPTY_FORM: KnownSportForm = {
  sport: "",
  childName: "",
  age: "",
  gender: null,
  state: null,
  experienceLevel: null,
  energyType: null,
  teamIndividual: null,
  ambition: null,
  weeklyHours: null,
  budgetRange: null,
};

// ─── Step definitions ─────────────────────────────────────────────────────────

type QuestionId = keyof KnownSportForm;

interface QuestionStep {
  kind: "question";
  id: QuestionId;
  required: boolean;
  heading: (form: KnownSportForm) => string;
  sub: string;
}

interface TransitionStep {
  kind: "transition";
  text: string;
  sub: string;
}

type WizardStep = QuestionStep | TransitionStep;

const STEPS: WizardStep[] = [
  {
    kind: "question",
    id: "sport",
    required: true,
    heading: () => "Which sport does your child play?",
    sub: "We'll build the entire roadmap and guidance around this sport.",
  },
  {
    kind: "question",
    id: "childName",
    required: false,
    heading: () => "What's your child's name?",
    sub: "Optional — makes the profile feel personal.",
  },
  {
    kind: "question",
    id: "age",
    required: false,
    heading: (f) => `How old is ${f.childName || "your child"}?`,
    sub: "Optional — calibrates milestones to their development stage.",
  },
  {
    kind: "question",
    id: "gender",
    required: false,
    heading: (f) => `Tell us about ${f.childName || "your child"}`,
    sub: "Optional — some pathways and competitions are gender-specific.",
  },
  {
    kind: "question",
    id: "state",
    required: true,
    heading: () => "Where are you based?",
    sub: "Helps us show relevant academies, federations, and tournaments near you.",
  },
  {
    kind: "transition",
    text: "Good. Now let's understand how they play.",
    sub: "3 quick questions about their experience and style.",
  },
  {
    kind: "question",
    id: "experienceLevel",
    required: true,
    heading: (f) => `What's their current level in ${f.sport || "the sport"}?`,
    sub: "Sets the starting point and pace for the personalised roadmap.",
  },
  {
    kind: "question",
    id: "energyType",
    required: false,
    heading: (f) => `How would you describe ${f.childName || "their"} energy?`,
    sub: "Optional — helps us match training intensity and coaching style.",
  },
  {
    kind: "question",
    id: "teamIndividual",
    required: false,
    heading: (f) => `Is ${f.childName || "your child"} more of a team or solo player?`,
    sub: "Optional — useful for sport fit and academy recommendations.",
  },
  {
    kind: "transition",
    text: "Almost done. Let's set the right goals.",
    sub: "2 more questions — then the profile is ready.",
  },
  {
    kind: "question",
    id: "ambition",
    required: true,
    heading: () => "What's the ambition?",
    sub: "Sets the tone for milestones, pace, and the investment needed.",
  },
  {
    kind: "question",
    id: "weeklyHours",
    required: true,
    heading: () => "How much time can they commit each week?",
    sub: "We'll build a realistic training plan around this availability.",
  },
  {
    kind: "question",
    id: "budgetRange",
    required: false,
    heading: () => "What's your monthly budget for sport?",
    sub: "Optional — helps us filter coaching and facility recommendations.",
  },
];

// Precompute question number (1-based) at each step index
const STEP_Q_NUMS: (number | null)[] = STEPS.map((s, i) =>
  s.kind !== "question"
    ? null
    : STEPS.slice(0, i + 1).filter((x) => x.kind === "question").length,
);
const TOTAL_QUESTIONS = STEPS.filter((s) => s.kind === "question").length;

function isAnswered(id: QuestionId, form: KnownSportForm): boolean {
  const v = form[id];
  if (typeof v === "string") return v.length > 0;
  if (typeof v === "number") return true;
  return v !== null;
}

// ─── Slide variants ───────────────────────────────────────────────────────────

const slide = {
  enter: (dir: number) => ({ opacity: 0, x: dir * 28 }),
  center: { opacity: 1, x: 0 },
  exit: (dir: number) => ({ opacity: 0, x: dir * -28 }),
};

// ─── Question input ───────────────────────────────────────────────────────────

function QuestionInput({
  id,
  form,
  set,
}: {
  id: QuestionId;
  form: KnownSportForm;
  set: <K extends keyof KnownSportForm>(k: K, v: KnownSportForm[K]) => void;
}) {
  switch (id) {
    case "sport":
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

    case "childName":
      return (
        <input
          type="text"
          autoFocus // eslint-disable-line jsx-a11y/no-autofocus
          value={form.childName}
          onChange={(e) => set("childName", e.target.value)}
          placeholder="e.g. Arjun"
          className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3.5 text-base text-slate-900 placeholder:text-slate-400 focus:border-power-orange focus:outline-none focus:ring-2 focus:ring-power-orange/20"
        />
      );

    case "age":
      return (
        <input
          type="number"
          autoFocus // eslint-disable-line jsx-a11y/no-autofocus
          value={form.age}
          onChange={(e) => set("age", e.target.value)}
          placeholder="e.g. 10"
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

    case "energyType":
      return (
        <BinaryCards
          options={[
            {
              value: "explosive",
              title: "High energy",
              sub: "Always on the move — loves fast-paced, short-burst action",
            },
            {
              value: "endurance",
              title: "Calm & focused",
              sub: "Prefers steady, sustained effort — methodical over explosive",
            },
          ]}
          value={form.energyType}
          onChange={(v) => set("energyType", v)}
        />
      );

    case "teamIndividual":
      return (
        <SpectrumSlider
          value={form.teamIndividual}
          onChange={(v) => set("teamIndividual", v)}
          leftLabel="Individual"
          rightLabel="Team"
          leftExamples="Chess, Athletics, Swimming"
          rightExamples="Cricket, Football, Kabaddi"
        />
      );

    case "ambition":
      return (
        <FourContextCards
          options={[
            { value: "fun", label: "Just for fun", context: "Staying active and enjoying the sport" },
            { value: "competitive", label: "Local competitions", context: "School or club-level tournaments" },
            { value: "national", label: "State / national level", context: "Serious training for high-level competition" },
            { value: "professional", label: "Professional pathway", context: "Full-time sport career as the end goal" },
          ]}
          value={form.ambition}
          onChange={(v) => set("ambition", v)}
        />
      );

    case "weeklyHours":
      return (
        <FourContextCards
          options={[
            { value: "1-3", label: "1–3 hrs/week", context: "Casual — once or twice a week" },
            { value: "4-7", label: "4–7 hrs/week", context: "Regular — most days, short sessions" },
            { value: "8-12", label: "8–12 hrs/week", context: "Dedicated — structured training schedule" },
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

    default:
      return null;
  }
}

// ─── Chip ─────────────────────────────────────────────────────────────────────

function Chip({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">
      {label}
    </span>
  );
}

// ─── Results ──────────────────────────────────────────────────────────────────

function ResultsView({ form, onReset }: { form: KnownSportForm; onReset: () => void }) {
  const sport = SPORTS.find((s) => s.name === form.sport);
  const sportEmoji = sport?.emoji ?? "🏆";

  const profileChips = [
    form.gender === "MALE" ? "Boy" : form.gender === "FEMALE" ? "Girl" : null,
    form.age ? `Age ${form.age}` : null,
    form.state,
    form.experienceLevel === "beginner"
      ? "Just starting out"
      : form.experienceLevel === "recreational"
      ? "Plays for fun"
      : form.experienceLevel === "competitive"
      ? "Actively competing"
      : null,
    form.energyType === "explosive"
      ? "High energy"
      : form.energyType === "endurance"
      ? "Calm & focused"
      : null,
  ].filter(Boolean) as string[];

  const goalChips = [
    form.ambition === "fun"
      ? "Just for fun"
      : form.ambition === "competitive"
      ? "Local competitions"
      : form.ambition === "national"
      ? "State / national level"
      : form.ambition === "professional"
      ? "Professional pathway"
      : null,
    form.weeklyHours
      ? ({
          "1-3": "1–3 hrs/week",
          "4-7": "4–7 hrs/week",
          "8-12": "8–12 hrs/week",
          "13-plus": "13+ hrs/week",
        } as Record<string, string>)[form.weeklyHours] ?? null
      : null,
    form.budgetRange
      ? ({
          "under-3k": "Under ₹3k/mo",
          "3k-7k": "₹3k–7k/mo",
          "7k-15k": "₹7k–15k/mo",
          "15k-plus": "₹15k+/mo",
        } as Record<string, string>)[form.budgetRange] ?? null
      : null,
  ].filter(Boolean) as string[];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="relative min-h-screen flex items-center justify-center px-4 py-16"
    >
      <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-emerald-50/40 via-white to-slate-50" />
        <div className="absolute -left-32 top-10 h-96 w-96 rounded-full bg-emerald-300/10 blur-3xl" />
        <div className="absolute right-0 top-40 h-72 w-72 rounded-full bg-orange-200/15 blur-3xl" />
      </div>

      <div className="w-full max-w-md">
        <div className="flex justify-center mb-5">
          <div className="inline-flex items-center gap-2 rounded-full border border-emerald-100 bg-emerald-50 px-4 py-1.5 text-[11px] font-bold uppercase tracking-widest text-emerald-600">
            <CheckCircle2 className="h-3.5 w-3.5" />
            Profile ready
          </div>
        </div>

        <div className="text-center mb-7">
          <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-3xl bg-orange-50 text-5xl">
            {sportEmoji}
          </div>
          <h2 className="font-title text-2xl font-bold text-slate-900">
            {form.childName ? `${form.childName}'s ` : "Your child's "}
            <span className="text-power-orange">{form.sport}</span> profile
          </h2>
          <p className="text-sm text-slate-500 mt-1 leading-relaxed">
            Based on your answers — here&apos;s what we&apos;ve built.
          </p>
        </div>

        <div className="rounded-3xl border border-slate-200/80 bg-white/95 p-5 shadow-[0_10px_40px_-18px_rgba(15,23,42,0.18)] ring-1 ring-slate-900/[0.03] mb-4">
          {profileChips.length > 0 && (
            <div className="mb-4">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">
                Child profile
              </p>
              <div className="flex flex-wrap gap-1.5">
                {profileChips.map((c) => (
                  <Chip key={c} label={c} />
                ))}
              </div>
            </div>
          )}
          {goalChips.length > 0 && (
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">
                Goals & availability
              </p>
              <div className="flex flex-wrap gap-1.5">
                {goalChips.map((c) => (
                  <Chip key={c} label={c} />
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="space-y-3">
          <Link
            href={`/roadmap?sport=${encodeURIComponent(form.sport)}`}
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-power-orange px-5 py-3.5 text-sm font-bold text-white shadow-[0_4px_14px_-4px_rgba(233,115,22,0.45)] transition hover:bg-orange-600 active:scale-[0.98]"
          >
            <Map className="h-4 w-4" />
            View {form.sport} Roadmap
          </Link>
          <Link
            href={`/consult?sport=${encodeURIComponent(form.sport)}`}
            className="flex w-full items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-5 py-3.5 text-sm font-bold text-slate-700 transition hover:bg-slate-50 active:scale-[0.98]"
          >
            <MessageCircle className="h-4 w-4" />
            Get Expert Help
          </Link>
        </div>

        <button
          type="button"
          onClick={onReset}
          className="mt-4 flex w-full items-center justify-center gap-1.5 text-xs text-slate-400 hover:text-slate-600 transition-colors"
        >
          <RotateCcw className="h-3 w-3" />
          Start over
        </button>
      </div>
    </motion.div>
  );
}

// ─── Main export ──────────────────────────────────────────────────────────────

export function SportKnownFlow({ onBack }: { onBack: () => void }) {
  const [idx, setIdx] = useState(0);
  const [done, setDone] = useState(false);
  const [form, setForm] = useState<KnownSportForm>(EMPTY_FORM);
  const [dir, setDir] = useState<1 | -1>(1);

  const set = <K extends keyof KnownSportForm>(k: K, v: KnownSportForm[K]) =>
    setForm((p) => ({ ...p, [k]: v }));

  const current = STEPS[idx];
  const qNum = STEP_Q_NUMS[idx];

  const canAdvance =
    current.kind === "transition" ||
    !current.required ||
    isAnswered(current.id, form);

  const goNext = () => {
    setDir(1);
    if (idx < STEPS.length - 1) setIdx((i) => i + 1);
    else setDone(true);
  };

  const goPrev = () => {
    setDir(-1);
    if (idx > 0) setIdx((i) => i - 1);
    else onBack();
  };

  const reset = () => {
    setForm(EMPTY_FORM);
    setIdx(0);
    setDone(false);
    setDir(1);
  };

  if (done) return <ResultsView form={form} onReset={reset} />;

  return (
    <div className="relative min-h-screen">
      {/* Ambient background */}
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
              <span className="text-xs font-medium text-slate-400">
                {qNum} / {TOTAL_QUESTIONS}
              </span>
            </div>

            {/* Progress bar */}
            <div className="mb-6 h-1 rounded-full bg-slate-100 overflow-hidden">
              <div
                className="h-full rounded-full bg-power-orange transition-all duration-500"
                style={{ width: `${((qNum ?? 0) / TOTAL_QUESTIONS) * 100}%` }}
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

                <QuestionInput id={current.id} form={form} set={set} />

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
                    {idx === STEPS.length - 1 ? "See profile" : "Continue"}
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
