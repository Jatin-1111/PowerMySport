"use client";

import api from "@/lib/api/axios";
import { toast } from "@/lib/toast";
import {
  BrainCircuit,
  Star,
  Trophy,
  Users,
  UserCircle2,
  Loader2,
  History,
  ChevronDown,
  Calendar,
  Target,
  Zap,
  Dumbbell,
  Timer,
  ShieldCheck,
  Compass,
  Activity,
  Crosshair,
  ChevronRight,
  ChevronLeft,
  Flame,
  Award,
  Sparkles,
  BarChart3,
  CheckCircle2,
  Medal,
  TrendingUp,
  Smile,
  Sprout,
  Wallet,
  CreditCard,
  Diamond,
  Shield,
  Network,
} from "lucide-react";
import { useState, useEffect, useRef, Fragment, type FormEvent } from "react";
import { motion, AnimatePresence, type Variants } from "framer-motion";

// ─── Types ──────────────────────────────────────────────────────────────────

type GuidanceFormState = {
  child_age: number;
  child_gender: "male" | "female";
  current_fitness_level: "Low" | "Moderate" | "High";
  personality_tags: string[];
  primary_objective: "Recreational" | "Health" | "Social" | "Competitive";
  weekly_time_commitment: number;
  budget_tier: "Budget" | "Moderate" | "Premium";
  parent_specific_question: string;
  sport: string;
};

type GuidanceResponse = {
  profileAnalysis: string;
  idealCoachingStyle: string;
  weeklyBlueprint: {
    trainingHours: string;
    freePlayHours: string;
    restDays: string;
  };
  recommendedPlatformActions: string;
};

type GuidanceSubmission = {
  id: string;
  query: GuidanceFormState;
  response: GuidanceResponse;
  createdAt: string;
  updatedAt: string;
};

type PlayerProfile = {
  _id: string;
  type: "SELF" | "DEPENDENT";
  name: string;
  age?: number;
  dob?: string;
  sportsFocus: string[];
  skillLevel?: string;
  personalityTags?: string[];
  primaryObjective?: "Recreational" | "Health" | "Social" | "Competitive";
  weeklyTimeCommitment?: number;
  budgetTier?: "Budget" | "Moderate" | "Premium";
};

// ─── Constants ───────────────────────────────────────────────────────────────

const PERSONALITY_OPTIONS = [
  { label: "Shy", icon: Shield },
  { label: "Energetic", icon: Zap },
  { label: "Competitive", icon: Trophy },
  { label: "Social", icon: Users },
  { label: "Focused", icon: Crosshair },
  { label: "Curious", icon: Compass },
  { label: "Patient", icon: Timer },
  { label: "Team-oriented", icon: Network },
] as const;

const OBJECTIVES = [
  {
    value: "Recreational",
    label: "Just for Fun",
    icon: Smile,
    desc: "Play and enjoy sport casually",
  },
  {
    value: "Health",
    label: "Get Fit",
    icon: Activity,
    desc: "Build strength and stamina",
  },
  {
    value: "Social",
    label: "Make Friends",
    icon: Users,
    desc: "Connect through sport",
  },
  { value: "Competitive", label: "Compete", icon: Trophy, desc: "Train to win" },
] as const;

const FITNESS_LEVELS = [
  {
    value: "Low",
    label: "Beginner",
    icon: Sprout,
    color: "text-emerald-600",
    bar: "w-1/3",
    barColor: "bg-emerald-400",
    desc: "Just starting out",
  },
  {
    value: "Moderate",
    label: "Developing",
    icon: Flame,
    color: "text-amber-600",
    bar: "w-2/3",
    barColor: "bg-amber-400",
    desc: "Some experience",
  },
  {
    value: "High",
    label: "Advanced",
    icon: Zap,
    color: "text-violet-600",
    bar: "w-full",
    barColor: "bg-violet-500",
    desc: "Skilled & active",
  },
] as const;

const BUDGET_OPTIONS = [
  {
    value: "Budget",
    label: "Budget",
    icon: Wallet,
    desc: "Cost-effective choices",
  },
  {
    value: "Moderate",
    label: "Moderate",
    icon: CreditCard,
    desc: "Quality balanced",
  },
  {
    value: "Premium",
    label: "Premium",
    icon: Diamond,
    desc: "Best of everything",
  },
] as const;

const STEPS = [
  { id: 1, label: "Profile", icon: UserCircle2 },
  { id: 2, label: "Goals", icon: Target },
  { id: 3, label: "Lifestyle", icon: Activity },
  { id: 4, label: "Details", icon: Sparkles },
] as const;

const initialForm: GuidanceFormState = {
  child_age: 8,
  child_gender: "male",
  current_fitness_level: "Moderate",
  personality_tags: [],
  primary_objective: "Recreational",
  weekly_time_commitment: 3,
  budget_tier: "Moderate",
  parent_specific_question: "",
  sport: "",
};

// ─── Animations ──────────────────────────────────────────────────────────────

const slideIn: Variants = {
  hidden: { opacity: 0, x: 30 },
  visible: {
    opacity: 1,
    x: 0,
    transition: { type: "spring", stiffness: 340, damping: 28 },
  },
  exit: { opacity: 0, x: -30, transition: { duration: 0.15 } },
};

const fadeUp: Variants = {
  hidden: { opacity: 0, y: 16 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: {
      delay: i * 0.08,
      type: "spring",
      stiffness: 300,
      damping: 26,
    },
  }),
};

const stagger: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.1 } },
};

// ─── Sub-components ──────────────────────────────────────────────────────────

function StepIndicator({
  current,
  steps,
}: {
  current: number;
  steps: typeof STEPS;
}) {
  return (
    <div className="mb-8">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
            Progress
          </span>
        </div>
      </div>
      <div className="flex items-start w-full">
        {steps.map((step, idx) => {
          const Icon = step.icon;
          const done = current > step.id;
          const active = current === step.id;
          return (
            <Fragment key={step.id}>
              <div className="flex flex-col items-center shrink-0 w-14 sm:w-20">
                <div
                  className={`flex h-9 w-9 sm:h-10 sm:w-10 items-center justify-center rounded-full border-2 transition-all duration-300 ${
                    done
                      ? "border-emerald-500 bg-emerald-500 text-white shadow-emerald-200 shadow-md"
                      : active
                        ? "border-power-orange bg-power-orange text-white shadow-power-orange/30 shadow-md"
                        : "border-slate-200 bg-white text-slate-400"
                  }`}
                >
                  {done ? (
                    <CheckCircle2 className="h-4 w-4" />
                  ) : (
                    <Icon className="h-4 w-4" />
                  )}
                </div>
                <span
                  className={`mt-1.5 text-[10px] font-semibold hidden sm:block text-center ${
                    active
                      ? "text-power-orange"
                      : done
                        ? "text-emerald-600"
                        : "text-slate-400"
                  }`}
                >
                  {step.label}
                </span>
              </div>
              {idx < steps.length - 1 && (
                <div className="flex-1 mt-[18px] sm:mt-[20px] mx-1 sm:mx-2">
                  <div
                    className={`h-0.5 w-full rounded transition-all duration-500 ${
                      current > step.id ? "bg-emerald-400" : "bg-slate-100"
                    }`}
                  />
                </div>
              )}
            </Fragment>
          );
        })}
      </div>
    </div>
  );
}

function SelectCard({
  selected,
  onClick,
  children,
  accent = false,
}: {
  selected: boolean;
  onClick: () => void;
  children: React.ReactNode;
  accent?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full text-left rounded-2xl border-2 p-4 transition-all duration-200 ${
        selected
          ? accent
            ? "border-power-orange bg-power-orange/5 shadow-power-orange/10 shadow-lg"
            : "border-power-orange bg-power-orange/5"
          : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
      }`}
    >
      {children}
    </button>
  );
}

function SkeletonBlock({ className }: { className: string }) {
  return (
    <div className={`animate-pulse rounded-xl bg-slate-100 ${className}`} />
  );
}

function ResultSkeleton() {
  return (
    <div className="space-y-5">
      <SkeletonBlock className="h-48 w-full" />
      <div className="grid grid-cols-3 gap-3">
        <SkeletonBlock className="h-28" />
        <SkeletonBlock className="h-28" />
        <SkeletonBlock className="h-28" />
      </div>
      <SkeletonBlock className="h-32 w-full" />
      <SkeletonBlock className="h-32 w-full" />
    </div>
  );
}

function AchievementToast({ label }: { label: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.8, y: 10 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.8, y: -10 }}
      className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2 text-sm font-semibold text-amber-800 shadow-lg"
    >
      <Award className="h-4 w-4 text-amber-600" />
      {label}
    </motion.div>
  );
}

function PastRoadmapsDropdown({
  history,
  onSelect,
}: {
  history: GuidanceSubmission[];
  onSelect: (h: GuidanceSubmission) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fn = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node))
        setOpen(false);
    };
    document.addEventListener("mousedown", fn);
    return () => document.removeEventListener("mousedown", fn);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 shadow-sm transition hover:bg-slate-50"
      >
        <History className="h-3.5 w-3.5 text-power-orange" />
        <span className="hidden sm:inline">Past Roadmaps</span>
        <span className="inline sm:hidden">History</span>
        <span className="rounded-full bg-power-orange/10 px-1.5 py-0.5 text-[10px] font-bold text-power-orange">
          {history.length}
        </span>
        <ChevronDown
          className={`h-3 w-3 text-slate-400 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 6, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 6, scale: 0.96 }}
            transition={{ duration: 0.13 }}
            className="absolute right-0 top-full mt-2 z-50 w-72 rounded-2xl border border-slate-100 bg-white shadow-xl p-2 max-h-72 overflow-y-auto"
          >
            <p className="px-3 pt-1 pb-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">
              {history.length} saved roadmaps
            </p>
            {history.map((h) => (
              <button
                key={h.id}
                onClick={() => {
                  onSelect(h);
                  setOpen(false);
                }}
                className="w-full flex items-start gap-3 rounded-xl px-3 py-2.5 text-left hover:bg-slate-50 transition"
              >
                <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-power-orange/10 text-power-orange">
                  <Trophy className="h-3.5 w-3.5" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-800 truncate">
                    {h.query.primary_objective} · Age {h.query.child_age}
                  </p>
                  <p className="text-[11px] text-slate-400 mt-0.5 flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    {new Date(h.createdAt).toLocaleDateString(undefined, {
                      month: "short",
                      day: "numeric",
                    })}
                    <span className="mx-1">·</span>
                    {h.query.current_fitness_level}
                  </p>
                </div>
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Step Forms ──────────────────────────────────────────────────────────────

function Step1Profile({
  form,
  update,
  players,
  selectedId,
  onSelectPlayer,
}: {
  form: GuidanceFormState;
  update: <K extends keyof GuidanceFormState>(
    k: K,
    v: GuidanceFormState[K],
  ) => void;
  players: PlayerProfile[];
  selectedId: string;
  onSelectPlayer: (id: string) => void;
}) {
  return (
    <motion.div
      variants={slideIn}
      initial="hidden"
      animate="visible"
      exit="exit"
      className="space-y-6"
    >
      <div>
        <h2 className="font-title text-2xl font-bold text-slate-900 mb-1">
          Who are we building for?
        </h2>
        <p className="text-sm text-slate-500">
          Tell us about the young athlete.
        </p>
      </div>

      {players.length > 0 && (
        <div className="rounded-2xl border border-blue-100 bg-blue-50/60 p-4">
          <p className="text-xs font-bold uppercase tracking-wider text-blue-600 mb-2">
            Auto-fill from profile
          </p>
          <select
            value={selectedId}
            onChange={(e) => onSelectPlayer(e.target.value)}
            className="w-full rounded-xl border border-blue-200 bg-white px-3 py-2.5 text-sm font-medium text-slate-800 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
          >
            <option value="">— New athlete —</option>
            {players.map((p) => (
              <option key={p._id} value={p._id}>
                {p.type === "SELF"
                  ? `Myself (${p.name})`
                  : `Dependent: ${p.name}`}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <label className="space-y-2">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
            Age
          </span>
          <div className="relative">
            <input
              type="number"
              min={3}
              max={21}
              value={form.child_age}
              onChange={(e) => update("child_age", Number(e.target.value))}
              className="h-12 w-full rounded-xl border border-slate-200 bg-white px-4 pr-10 text-lg font-bold text-slate-900 outline-none transition focus:border-power-orange focus:ring-4 focus:ring-power-orange/10"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 font-medium">
              yrs
            </span>
          </div>
        </label>
        <label className="space-y-2">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
            Gender
          </span>
          <div className="flex gap-2 h-12">
            {(["male", "female"] as const).map((g) => (
              <button
                key={g}
                type="button"
                onClick={() => update("child_gender", g)}
                className={`flex-1 rounded-xl border-2 text-sm font-semibold capitalize transition-all ${
                  form.child_gender === g
                    ? "border-power-orange bg-power-orange text-white"
                    : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
                }`}
              >
                {g === "male" ? "♂ Male" : "♀ Female"}
              </button>
            ))}
          </div>
        </label>
      </div>

      <div className="space-y-2">
        <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
          Current Sport (optional)
        </span>
        <input
          type="text"
          value={form.sport}
          onChange={(e) => update("sport", e.target.value)}
          placeholder="e.g. Basketball, Swimming, Cricket…"
          className="h-12 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm font-medium text-slate-900 outline-none transition focus:border-power-orange focus:ring-4 focus:ring-power-orange/10"
        />
      </div>
    </motion.div>
  );
}

function Step2Goals({
  form,
  update,
}: {
  form: GuidanceFormState;
  update: <K extends keyof GuidanceFormState>(
    k: K,
    v: GuidanceFormState[K],
  ) => void;
}) {
  return (
    <motion.div
      variants={slideIn}
      initial="hidden"
      animate="visible"
      exit="exit"
      className="space-y-6"
    >
      <div>
        <h2 className="font-title text-2xl font-bold text-slate-900 mb-1">
          What's the main goal?
        </h2>
        <p className="text-sm text-slate-500">
          Choose the primary objective for this athlete.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {OBJECTIVES.map((obj) => (
          <SelectCard
            key={obj.value}
            selected={form.primary_objective === obj.value}
            onClick={() => update("primary_objective", obj.value)}
            accent
          >
            <div className="flex items-start gap-3">
              <div className="text-slate-700 mt-1"><obj.icon className="h-5 w-5" /></div>
              <div>
                <p className="font-bold text-slate-900">{obj.label}</p>
                <p className="text-xs text-slate-500 mt-0.5">{obj.desc}</p>
              </div>
              {form.primary_objective === obj.value && (
                <CheckCircle2 className="ml-auto h-5 w-5 shrink-0 text-power-orange" />
              )}
            </div>
          </SelectCard>
        ))}
      </div>

      <div className="space-y-2">
        <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
          Fitness Level
        </span>
        <div className="space-y-2">
          {FITNESS_LEVELS.map((lvl) => (
            <SelectCard
              key={lvl.value}
              selected={form.current_fitness_level === lvl.value}
              onClick={() => update("current_fitness_level", lvl.value)}
            >
              <div className="flex items-center gap-3">
                <div className="text-slate-700"><lvl.icon className="h-5 w-5" /></div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-semibold text-slate-800 text-sm">
                      {lvl.label}
                    </span>
                    <span className="text-xs text-slate-500">{lvl.desc}</span>
                  </div>
                  <div className="h-1.5 w-full rounded-full bg-slate-100 overflow-hidden">
                    <div
                      className={`h-full rounded-full ${lvl.barColor} ${lvl.bar}`}
                    />
                  </div>
                </div>
                {form.current_fitness_level === lvl.value && (
                  <CheckCircle2 className="h-5 w-5 shrink-0 text-power-orange" />
                )}
              </div>
            </SelectCard>
          ))}
        </div>
      </div>
    </motion.div>
  );
}

function Step3Lifestyle({
  form,
  update,
}: {
  form: GuidanceFormState;
  update: <K extends keyof GuidanceFormState>(
    k: K,
    v: GuidanceFormState[K],
  ) => void;
}) {
  return (
    <motion.div
      variants={slideIn}
      initial="hidden"
      animate="visible"
      exit="exit"
      className="space-y-6"
    >
      <div>
        <h2 className="font-title text-2xl font-bold text-slate-900 mb-1">
          Time & budget
        </h2>
        <p className="text-sm text-slate-500">
          Help us build a realistic plan.
        </p>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
            Weekly hours available
          </span>
          <span className="text-2xl font-bold text-power-orange tabular-nums">
            {form.weekly_time_commitment}h
          </span>
        </div>
        <input
          type="range"
          min={1}
          max={30}
          step={1}
          value={form.weekly_time_commitment}
          onChange={(e) =>
            update("weekly_time_commitment", Number(e.target.value))
          }
          className="w-full accent-power-orange h-2 rounded-full cursor-pointer"
        />
        <div className="flex justify-between text-[10px] text-slate-400 font-medium">
          <span>1h / week</span>
          <span>30h / week</span>
        </div>
        <div className="grid grid-cols-3 gap-2 mt-1">
          {[3, 8, 15].map((hrs) => (
            <button
              key={hrs}
              type="button"
              onClick={() => update("weekly_time_commitment", hrs)}
              className={`rounded-lg py-1.5 text-xs font-semibold transition ${
                form.weekly_time_commitment === hrs
                  ? "bg-power-orange text-white"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              {hrs}h
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
          Budget tier
        </span>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          {BUDGET_OPTIONS.map((b) => (
            <SelectCard
              key={b.value}
              selected={form.budget_tier === b.value}
              onClick={() => update("budget_tier", b.value)}
            >
              <div className="text-center py-1 flex flex-col items-center">
                <div className="mb-2 text-slate-700"><b.icon className="h-6 w-6" /></div>
                <p className="font-bold text-slate-900 text-sm">{b.label}</p>
                <p className="text-[11px] text-slate-500 mt-0.5">{b.desc}</p>
              </div>
            </SelectCard>
          ))}
        </div>
      </div>
    </motion.div>
  );
}

function Step4Details({
  form,
  update,
}: {
  form: GuidanceFormState;
  update: <K extends keyof GuidanceFormState>(
    k: K,
    v: GuidanceFormState[K],
  ) => void;
}) {
  const toggleTag = (tag: string) => {
    const has = form.personality_tags.includes(tag);
    update(
      "personality_tags",
      has
        ? form.personality_tags.filter((t) => t !== tag)
        : [...form.personality_tags, tag],
    );
  };

  return (
    <motion.div
      variants={slideIn}
      initial="hidden"
      animate="visible"
      exit="exit"
      className="space-y-6"
    >
      <div>
        <h2 className="font-title text-2xl font-bold text-slate-900 mb-1">
          Personality & specifics
        </h2>
        <p className="text-sm text-slate-500">
          Pick traits and share any specific questions.
        </p>
      </div>

      <div className="space-y-2">
        <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
          Personality traits{" "}
          <span className="text-slate-400 normal-case font-normal">
            (pick all that fit)
          </span>
        </span>
        <div className="flex flex-wrap gap-2">
          {PERSONALITY_OPTIONS.map(({ label, icon: Icon }) => {
            const selected = form.personality_tags.includes(label);
            return (
              <button
                key={label}
                type="button"
                onClick={() => toggleTag(label)}
                className={`flex items-center gap-2 rounded-xl border-2 px-3 py-2 text-sm font-medium transition-all ${
                  selected
                    ? "border-power-orange bg-power-orange/5 text-power-orange shadow-sm"
                    : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50"
                }`}
              >
                <div className="text-slate-600 flex items-center justify-center"><Icon className="h-4 w-4" /></div>
                <span className="truncate">{label}</span>
                {selected && (
                  <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      <label className="block space-y-2">
        <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
          Your biggest concern or goal{" "}
          <span className="text-slate-400 normal-case font-normal">
            (optional)
          </span>
        </span>
        <textarea
          rows={4}
          value={form.parent_specific_question}
          onChange={(e) => update("parent_specific_question", e.target.value)}
          placeholder="E.g. 'My child is shy about joining teams. How can I ease them into a sport?'"
          className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-900 outline-none transition focus:border-power-orange focus:ring-4 focus:ring-power-orange/10 resize-none"
        />
      </label>
    </motion.div>
  );
}

// ─── Results ──────────────────────────────────────────────────────────────────

function ResultsView({ submission }: { submission: GuidanceSubmission }) {
  const fitnessInfo = (() => {
    const lvl = submission.query.current_fitness_level;
    if (lvl === "Low")
      return { pct: "33%", color: "bg-emerald-400", label: "Beginner" };
    if (lvl === "Moderate")
      return { pct: "66%", color: "bg-amber-400", label: "Developing" };
    return { pct: "100%", color: "bg-violet-500", label: "Advanced" };
  })();

  return (
    <motion.div
      variants={stagger}
      initial="hidden"
      animate="visible"
      className="space-y-5"
    >
      {/* Hero card */}
      <motion.div
        custom={0}
        variants={fadeUp}
        className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-power-orange/5 via-amber-50 to-white border border-power-orange/20 p-6"
      >
        <div className="absolute -right-8 -top-8 h-36 w-36 rounded-full bg-power-orange/5" />
        <div className="absolute -right-2 -bottom-10 h-28 w-28 rounded-full bg-amber-100/60" />
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-power-orange/15">
              <Compass className="h-5 w-5 text-power-orange" />
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-power-orange/70">
                Scout Report
              </p>
              <h3 className="font-title text-lg font-bold text-slate-900">
                Player Analysis
              </h3>
            </div>
            <div className="ml-auto flex items-center gap-2">
              <span className="rounded-full bg-power-orange/10 px-3 py-1 text-xs font-bold text-power-orange">
                Age {submission.query.child_age}
              </span>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">
                {submission.query.primary_objective}
              </span>
            </div>
          </div>

          <div className="mb-4 rounded-xl border border-white bg-white/70 p-3">
            <p className="text-[10px] font-bold uppercase text-slate-400 mb-2 flex items-center gap-1">
              <Activity className="h-3 w-3" /> Fitness Rating
            </p>
            <div className="flex items-center gap-3">
              <div className="h-2 flex-1 rounded-full bg-slate-100 overflow-hidden">
                <motion.div
                  className={`h-full rounded-full ${fitnessInfo.color}`}
                  initial={{ width: 0 }}
                  animate={{ width: fitnessInfo.pct }}
                  transition={{ delay: 0.3, duration: 0.8, ease: "easeOut" }}
                />
              </div>
              <span className="text-xs font-bold text-slate-700 shrink-0">
                {fitnessInfo.label}
              </span>
            </div>
          </div>

          <p className="text-sm leading-7 text-slate-700">
            {submission.response.profileAnalysis}
          </p>
        </div>
      </motion.div>

      {/* Weekly blueprint */}
      <motion.div custom={1} variants={fadeUp}>
        <div className="flex items-center gap-2 mb-3">
          <BarChart3 className="h-4 w-4 text-slate-600" />
          <h3 className="font-title font-semibold text-slate-900 text-sm uppercase tracking-wide">
            Weekly Blueprint
          </h3>
        </div>
        <div className="grid grid-cols-3 gap-3">
          {[
            {
              icon: Dumbbell,
              label: "Training",
              value: submission.response.weeklyBlueprint.trainingHours,
              color: "text-emerald-600",
              bg: "bg-emerald-50",
              border: "border-emerald-100",
            },
            {
              icon: Zap,
              label: "Free Play",
              value: submission.response.weeklyBlueprint.freePlayHours,
              color: "text-sky-600",
              bg: "bg-sky-50",
              border: "border-sky-100",
            },
            {
              icon: Timer,
              label: "Rest",
              value: submission.response.weeklyBlueprint.restDays,
              color: "text-violet-600",
              bg: "bg-violet-50",
              border: "border-violet-100",
            },
          ].map(({ icon: Icon, label, value, color, bg, border }) => (
            <div
              key={label}
              className={`rounded-2xl border ${border} ${bg} p-4`}
            >
              <Icon className={`h-5 w-5 ${color} mb-2`} />
              <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
                {label}
              </p>
              <p className="mt-1 text-sm font-semibold text-slate-800 leading-snug">
                {value}
              </p>
            </div>
          ))}
        </div>
      </motion.div>

      {/* Coaching style */}
      <motion.div
        custom={2}
        variants={fadeUp}
        className="rounded-2xl border border-slate-200 bg-white p-5"
      >
        <div className="flex items-center gap-2 mb-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-purple-50">
            <UserCircle2 className="h-4 w-4 text-purple-600" />
          </div>
          <h3 className="font-title font-semibold text-slate-900">
            Ideal Coaching Style
          </h3>
        </div>
        <p className="text-sm leading-7 text-slate-600">
          {submission.response.idealCoachingStyle}
        </p>
      </motion.div>

      {/* Next objectives */}
      <motion.div
        custom={3}
        variants={fadeUp}
        className="rounded-2xl border-2 border-emerald-400 bg-emerald-50/50 p-5 relative overflow-hidden"
      >
        <div className="absolute -right-10 -bottom-10 opacity-[0.06] pointer-events-none">
          <ShieldCheck className="h-40 w-40 text-emerald-900" />
        </div>
        <div className="relative z-10">
          <div className="flex items-center gap-2 mb-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-100">
              <Crosshair className="h-4 w-4 text-emerald-700" />
            </div>
            <h3 className="font-title font-semibold text-emerald-900">
              Next Objectives
            </h3>
            <TrendingUp className="ml-auto h-4 w-4 text-emerald-500" />
          </div>
          <p className="text-sm leading-7 text-emerald-900/80 font-medium">
            {submission.response.recommendedPlatformActions}
          </p>
        </div>
      </motion.div>

      {/* ── CTA Buttons ── */}
      <motion.div
        custom={4}
        variants={fadeUp}
        className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2"
      >
        <a
          href={process.env.NEXT_PUBLIC_MAIN_APP_URL || "http://localhost:3000"}
          className="flex items-center justify-center gap-2 rounded-xl bg-power-orange px-5 py-3.5 text-sm font-bold text-white shadow-[0_4px_14px_-4px_rgba(233,115,22,0.5)] transition-all hover:bg-orange-600 active:scale-[0.98]"
        >
          <Compass className="h-4 w-4" />
          Explore Programs
        </a>
        <a
          href="/community/chats?sidebar=conversations&directory=contacts"
          className="flex items-center justify-center gap-2 rounded-xl border-2 border-slate-200 bg-white px-5 py-3.5 text-sm font-bold text-slate-700 transition-all hover:border-slate-300 hover:bg-slate-50 active:scale-[0.98]"
        >
          <Users className="h-4 w-4" />
          Connect with Parents
        </a>
      </motion.div>
    </motion.div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function GuidancePage() {
  const [form, setForm] = useState<GuidanceFormState>(initialForm);
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [submission, setSubmission] = useState<GuidanceSubmission | null>(null);
  const [history, setHistory] = useState<GuidanceSubmission[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [players, setPlayers] = useState<PlayerProfile[]>([]);
  const [selectedProfileId, setSelectedProfileId] = useState("");
  const [achievement, setAchievement] = useState<string | null>(null);
  const [showResults, setShowResults] = useState(false);
  const resultsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    api
      .get("/auth/players")
      .then((res) => {
        if (res.data.success && Array.isArray(res.data.data))
          setPlayers(res.data.data);
      })
      .catch(() => {});
    api
      .get<{ success: boolean; data: GuidanceSubmission[] }>("/guidance")
      .then((res) => {
        if (res.data.success && Array.isArray(res.data.data))
          setHistory(res.data.data);
      })
      .catch(() => {});
  }, []);

  const update = <K extends keyof GuidanceFormState>(
    k: K,
    v: GuidanceFormState[K],
  ) => setForm((c) => ({ ...c, [k]: v }));

  const handleProfileSelect = (id: string) => {
    setSelectedProfileId(id);
    if (!id) {
      setForm(initialForm);
      return;
    }
    const player = players.find((p) => p._id === id);
    if (!player) return;

    let age = form.child_age;
    if (player.age) age = player.age;
    else if (player.dob) {
      const bd = new Date(player.dob);
      age = Math.abs(
        new Date(Date.now() - bd.getTime()).getUTCFullYear() - 1970,
      );
    }

    let fitness: GuidanceFormState["current_fitness_level"] =
      form.current_fitness_level;
    if (player.skillLevel?.toLowerCase().includes("beginner")) fitness = "Low";
    else if (player.skillLevel?.toLowerCase().includes("intermediate"))
      fitness = "Moderate";
    else if (player.skillLevel?.toLowerCase().includes("advanced"))
      fitness = "High";

    setForm((f) => ({
      ...f,
      child_age: age || 8,
      current_fitness_level: fitness,
      personality_tags: player.personalityTags || f.personality_tags,
      primary_objective: player.primaryObjective || f.primary_objective,
      weekly_time_commitment:
        player.weeklyTimeCommitment || f.weekly_time_commitment,
      budget_tier: player.budgetTier || f.budget_tier,
      sport: player.sportsFocus?.join(", ") || f.sport,
    }));
  };

  const nextStep = () => {
    const messages = [
      "Step Complete!",
      "Keep Going! ⚡",
      "Almost There! 🔥",
      "Final Step! 🏆",
    ];
    setAchievement(messages[step - 1] || "Progress!");
    setTimeout(() => setAchievement(null), 2000);

    setStep((s) => Math.min(s + 1, 4));
  };

  const prevStep = () => setStep((s) => Math.max(s - 1, 1));

  const loadPastSubmission = (past: GuidanceSubmission) => {
    setSubmission(past);
    setForm(past.query);
    setShowResults(true);
    toast.success("Loaded past roadmap");
    setTimeout(
      () =>
        resultsRef.current?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        }),
      100,
    );
  };

  const handleSubmit = async () => {
    setLoading(true);
    setError(null);
    const payload = {
      ...form,
      child_age: Number(form.child_age),
      weekly_time_commitment: Number(form.weekly_time_commitment),
    };
    try {
      const response = await api.post<{
        success: boolean;
        message: string;
        data: GuidanceSubmission;
      }>("/guidance", payload);
      setSubmission(response.data.data);
      setHistory((prev) => [response.data.data, ...prev]);
      setShowResults(true);
      setAchievement("🏆 Roadmap unlocked!");
      setTimeout(() => {
        setAchievement(null);
        resultsRef.current?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      }, 2000);
      toast.success("Guidance generated!");
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : "Unable to generate guidance.";
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setForm(initialForm);
    setStep(1);
    setShowResults(false);
    setSubmission(null);
    setError(null);
    setSelectedProfileId("");
  };

  return (
    <div className="community-page-shell">
      <div className="mx-auto w-full max-w-6xl">
        {/* ── Header ── */}
        <section className="pb-10 lg:pb-14">
          <div className="mb-8">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/70 bg-white/85 px-4 py-2 text-xs font-semibold uppercase tracking-widest text-slate-500 shadow-sm backdrop-blur">
                <BrainCircuit className="h-4 w-4 text-power-orange" />
                AI guidance portal
              </div>
              <div className="flex items-center gap-2">
                {history.length > 0 && (
                  <PastRoadmapsDropdown
                    history={history}
                    onSelect={loadPastSubmission}
                  />
                )}
                {(showResults || step > 1) && (
                  <button
                    type="button"
                    onClick={resetForm}
                    className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 shadow-sm transition hover:bg-slate-50"
                  >
                    <Star className="h-3.5 w-3.5 text-power-orange" />
                    New Roadmap
                  </button>
                )}
              </div>
            </div>
            <h1 className="font-title text-3xl font-bold leading-tight tracking-tight sm:text-4xl lg:text-5xl max-w-3xl">
              Get a structured sports roadmap for your young athlete.
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-600 sm:text-base">
              Answer four quick steps — we'll return personalised guidance on
              sport, coaching style, weekly schedule, and next actions.
            </p>
          </div>

          {/* ── Layout ── */}
          <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
            {/* ── Wizard Card ── */}
            <div className="community-card p-6 sm:p-8 lg:sticky lg:top-6 z-10">
              <StepIndicator
                current={step}
                steps={STEPS}
              />

              <AnimatePresence mode="wait">
                {step === 1 && (
                  <Step1Profile
                    key="step1"
                    form={form}
                    update={update}
                    players={players}
                    selectedId={selectedProfileId}
                    onSelectPlayer={handleProfileSelect}
                  />
                )}
                {step === 2 && (
                  <Step2Goals key="step2" form={form} update={update} />
                )}
                {step === 3 && (
                  <Step3Lifestyle key="step3" form={form} update={update} />
                )}
                {step === 4 && (
                  <Step4Details key="step4" form={form} update={update} />
                )}
              </AnimatePresence>

              {error && (
                <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                  {error}
                </div>
              )}

              {/* ── Navigation ── */}
              <div className="mt-6 flex gap-3">
                {step > 1 && (
                  <button
                    type="button"
                    onClick={prevStep}
                    className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                  >
                    <ChevronLeft className="h-4 w-4" />
                    Back
                  </button>
                )}
                {step < 4 ? (
                  <button
                    type="button"
                    onClick={nextStep}
                    className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-power-orange px-5 py-3 text-sm font-bold text-white shadow-[0_4px_14px_-4px_rgba(233,115,22,0.5)] transition hover:bg-orange-600 active:scale-[0.98]"
                  >
                    Continue
                    <ChevronRight className="h-4 w-4" />
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleSubmit}
                    disabled={loading}
                    className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-power-orange px-5 py-3 text-sm font-bold text-white shadow-[0_4px_14px_-4px_rgba(233,115,22,0.5)] transition hover:bg-orange-600 active:scale-[0.98] disabled:opacity-50 disabled:cursor-wait"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Analyzing…
                      </>
                    ) : (
                      <>
                        <Trophy className="h-4 w-4" />
                        Generate Roadmap
                      </>
                    )}
                  </button>
                )}
              </div>

              {/* Step hint */}
              <p className="mt-3 text-center text-xs text-slate-400">
                Step {step} of {STEPS.length}
                {step < 4 ? " · " : " · Ready to generate "}
                {step < 4 && `${STEPS.length - step} more to go`}
              </p>
            </div>

            {/* ── Results Pane ── */}
            <div
              ref={resultsRef}
              className="community-card p-6 sm:p-8 min-h-[560px] flex flex-col"
            >
              {loading ? (
                <div>
                  <div className="mb-6 flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-power-orange/10">
                      <Loader2 className="h-5 w-5 animate-spin text-power-orange" />
                    </div>
                    <div>
                      <p className="font-semibold text-slate-900">
                        Building your roadmap…
                      </p>
                      <p className="text-xs text-slate-500 mt-0.5">
                        AI is analyzing the profile
                      </p>
                    </div>
                  </div>
                  <ResultSkeleton />
                </div>
              ) : showResults && submission ? (
                <div>
                  <div className="mb-5 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Medal className="h-5 w-5 text-amber-500" />
                      <span className="font-title font-bold text-slate-900">
                        Your Roadmap
                      </span>
                    </div>
                  </div>
                  <ResultsView submission={submission} />
                </div>
              ) : (
                <div className="flex flex-1 flex-col items-center justify-center py-12 text-center">
                  <motion.div
                    animate={{ y: [0, -8, 0] }}
                    transition={{
                      repeat: Infinity,
                      duration: 2.5,
                      ease: "easeInOut",
                    }}
                    className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-power-orange/10"
                  >
                    <Trophy className="h-8 w-8 text-power-orange" />
                  </motion.div>
                  <h3 className="font-title text-xl font-bold text-slate-900 mb-2">
                    Your roadmap awaits
                  </h3>
                  <p className="max-w-xs text-sm text-slate-500 leading-6">
                    Complete the 4-step wizard on the left to unlock a
                    personalised sports plan.
                  </p>
                  <div className="mt-6 grid grid-cols-2 gap-3 w-full max-w-xs">
                    {[
                      { icon: Target, label: "Sport match" },
                      { icon: Calendar, label: "Weekly plan" },
                      { icon: Dumbbell, label: "Training guide" },
                      { icon: Compass, label: "Next actions" },
                    ].map(({ icon: Icon, label }) => (
                      <div
                        key={label}
                        className="flex items-center gap-2 rounded-xl border border-dashed border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-500"
                      >
                        <div className="text-slate-500"><Icon className="h-4 w-4" /></div>
                        <span className="font-medium">{label}</span>
                      </div>
                    ))}
                  </div>
                  <div className="mt-6 flex items-center gap-2 text-xs text-slate-400">
                    <Users className="h-3.5 w-3.5 text-power-orange" />
                    Personalised plan will appear here
                  </div>
                </div>
              )}
            </div>
          </div>
        </section>
      </div>

      {/* ── Achievement Toast ── */}
      <AnimatePresence>
        {achievement && (
          <div className="fixed bottom-6 right-6 z-50">
            <AchievementToast label={achievement} />
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
