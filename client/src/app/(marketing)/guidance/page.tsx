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
  AlertTriangle,
  Brain,
  Layers,
  MapPin,
  Eye,
  MessageCircle,
  CheckCheck,
  Info,
  Trash2,
  Pencil,
  Flag,
  Route,
  Rocket,
} from "lucide-react";
import { useState, useEffect, useRef, Fragment } from "react";
import {
  motion,
  AnimatePresence,
  type Variants,
} from "framer-motion";

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
  location: string;
  current_pathway_level?: number;
};

type BurnoutRisk = {
  level: "low" | "medium" | "high";
  message: string;
  recommendations: string[];
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
  recommendedSports?: string[];
  mentalSkillsRoadmap?: {
    currentFocus: string;
    skills: Array<{ skill: string; howToDevelop: string }>;
  };
  talentIdentifiers?: string[];
  multiSportAdvisory?: string;
  journeyPhases?: JourneyPhase[];
  goalAssessment?: GoalAssessment;
  costBreakdown?: CostBreakdown;
  burnoutRisk?: BurnoutRisk;
};

type JourneyPhase = {
  title: string;
  timeframe: string;
  focus: string;
  milestones: string[];
  outcome: string;
  estimatedCost?: string;
};

type GoalAssessment = {
  statedGoal: string;
  verdict: "On Track" | "Achievable" | "Ambitious" | "Long-Term";
  rationale: string;
  benchmark: string;
};

type CostBreakdown = {
  monthlyCoaching: string;
  equipment: string;
  tournaments: string;
  summary: string;
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
  location: "",
};

const INDIAN_STATES = [
  "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chhattisgarh",
  "Goa", "Gujarat", "Haryana", "Himachal Pradesh", "Jharkhand", "Karnataka",
  "Kerala", "Madhya Pradesh", "Maharashtra", "Manipur", "Meghalaya", "Mizoram",
  "Nagaland", "Odisha", "Punjab", "Rajasthan", "Sikkim", "Tamil Nadu",
  "Telangana", "Tripura", "Uttar Pradesh", "Uttarakhand", "West Bengal",
  "Delhi", "Jammu & Kashmir", "Chandigarh", "Puducherry",
].sort((a, b) => a.localeCompare(b));

// Required fields that must be filled before generating
const REQUIRED_FIELDS: Array<{ key: keyof GuidanceFormState; label: string }> = [
  { key: "child_age", label: "Child's age" },
  { key: "child_gender", label: "Gender" },
  { key: "primary_objective", label: "Primary goal" },
  { key: "location", label: "State / Location" },
];

function isFormValid(form: GuidanceFormState): boolean {
  return (
    form.child_age >= 3 &&
    form.child_age <= 21 &&
    !!form.child_gender &&
    !!form.primary_objective &&
    !!form.location
  );
}

function getMissingFields(form: GuidanceFormState): string[] {
  const missing: string[] = [];
  if (!form.child_age || form.child_age < 3 || form.child_age > 21) missing.push("Child's age (3–21)");
  if (!form.child_gender) missing.push("Gender");
  if (!form.primary_objective) missing.push("Primary goal");
  if (!form.location) missing.push("State / Location");
  return missing;
}

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

// ─── Autofill badge ───────────────────────────────────────────────────────────

function AutofillBadge() {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 border border-emerald-200 px-2 py-0.5 text-[9px] font-bold text-emerald-700 ml-2">
      <CheckCheck className="h-2.5 w-2.5" /> From profile
    </span>
  );
}

// ─── New result cards ─────────────────────────────────────────────────────────

function BurnoutRiskCard({ risk }: { risk: BurnoutRisk }) {
  if (risk.level === "low") return null;
  const cfg = {
    medium: {
      bg: "from-amber-50 to-orange-50",
      border: "border-amber-200",
      icon: "text-amber-600",
      title: "text-amber-900",
      badge: "bg-amber-100 text-amber-700 border-amber-200",
    },
    high: {
      bg: "from-rose-50 to-red-50",
      border: "border-rose-300",
      icon: "text-rose-600",
      title: "text-rose-900",
      badge: "bg-rose-100 text-rose-700 border-rose-200",
    },
  }[risk.level];

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className={`rounded-2xl border ${cfg.border} bg-gradient-to-br ${cfg.bg} p-5`}
    >
      <div className="flex items-center gap-2.5 mb-3">
        <div className={`flex h-9 w-9 items-center justify-center rounded-xl bg-white/80 border ${cfg.border}`}>
          <AlertTriangle className={`h-5 w-5 ${cfg.icon}`} />
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h3 className={`font-bold text-sm ${cfg.title}`}>Burnout Risk Alert</h3>
            <span className={`rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase ${cfg.badge}`}>
              {risk.level === "high" ? "High Risk" : "Monitor"}
            </span>
          </div>
          <p className={`text-xs mt-0.5 ${cfg.title} opacity-80`}>{risk.message}</p>
        </div>
      </div>
      {risk.recommendations.length > 0 && (
        <ul className="space-y-1.5">
          {risk.recommendations.map((r, i) => (
            <li key={i} className="flex items-start gap-2 text-xs text-slate-700">
              <div className={`mt-0.5 h-4 w-4 shrink-0 flex items-center justify-center rounded-full bg-white/70 border ${cfg.border}`}>
                <span className={`text-[9px] font-black ${cfg.icon}`}>{i + 1}</span>
              </div>
              {r}
            </li>
          ))}
        </ul>
      )}
    </motion.div>
  );
}

function MultiSportAdvisoryCard({ advisory }: { advisory: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl border border-sky-200 bg-gradient-to-br from-sky-50 to-indigo-50 p-5"
    >
      <div className="flex items-center gap-2.5 mb-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/80 border border-sky-200">
          <Layers className="h-5 w-5 text-sky-600" />
        </div>
        <div>
          <h3 className="font-bold text-sm text-sky-900">Multi-Sport Advisory</h3>
          <p className="text-[10px] text-sky-600 font-semibold">Recommended for under-12</p>
        </div>
      </div>
      <p className="text-sm text-slate-700 leading-relaxed">{advisory}</p>
    </motion.div>
  );
}

function MentalSkillsCard({ roadmap }: { roadmap: NonNullable<GuidanceResponse["mentalSkillsRoadmap"]> }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl border border-violet-200 bg-white p-5"
    >
      <div className="flex items-center gap-2.5 mb-4">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-50 border border-violet-200">
          <Brain className="h-5 w-5 text-violet-600" />
        </div>
        <div>
          <h3 className="font-title font-bold text-slate-900">Mental Skills Roadmap</h3>
          <p className="text-xs text-violet-600 font-semibold">Right now: {roadmap.currentFocus}</p>
        </div>
      </div>
      <div className="space-y-2.5">
        {roadmap.skills.map((s, i) => (
          <div key={i} className="rounded-xl bg-violet-50/60 border border-violet-100 p-3">
            <p className="text-xs font-bold text-violet-800 mb-1">{s.skill}</p>
            <p className="text-xs text-slate-600 leading-relaxed">{s.howToDevelop}</p>
          </div>
        ))}
      </div>
    </motion.div>
  );
}

function TalentIdentifiersCard({ identifiers }: { identifiers: string[] }) {
  if (!identifiers.length) return null;
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl border border-amber-200 bg-gradient-to-br from-amber-50 to-yellow-50 p-5"
    >
      <div className="flex items-center gap-2.5 mb-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/80 border border-amber-200">
          <Eye className="h-5 w-5 text-amber-600" />
        </div>
        <div>
          <h3 className="font-bold text-sm text-amber-900">Talent Indicators to Watch</h3>
          <p className="text-[10px] text-amber-700 font-semibold">Observable signs of genuine aptitude</p>
        </div>
      </div>
      <ul className="space-y-2">
        {identifiers.map((id, i) => (
          <li key={i} className="flex items-start gap-2.5 text-sm text-slate-700">
            <Star className="h-3.5 w-3.5 mt-0.5 shrink-0 text-amber-500" />
            {id}
          </li>
        ))}
      </ul>
    </motion.div>
  );
}

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
      className={`w-full text-left rounded-2xl border-2 p-4 transition-all duration-200 active:scale-[0.99] ${
        selected
          ? accent
            ? "border-power-orange bg-power-orange/5 shadow-power-orange/10 shadow-lg"
            : "border-power-orange bg-power-orange/5"
          : "border-slate-200 bg-white hover:-translate-y-0.5 hover:border-slate-300 hover:bg-slate-50 hover:shadow-sm"
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
  onDelete,
  deletingId,
}: {
  history: GuidanceSubmission[];
  onSelect: (h: GuidanceSubmission) => void;
  onDelete: (id: string) => void;
  deletingId: string | null;
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
              <div
                key={h.id}
                className="group flex items-center gap-2 rounded-xl px-2 py-1 transition hover:bg-slate-50"
              >
                <button
                  onClick={() => {
                    onSelect(h);
                    setOpen(false);
                  }}
                  className="flex flex-1 min-w-0 items-start gap-3 rounded-lg px-1 py-1.5 text-left"
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
                <button
                  type="button"
                  aria-label="Delete roadmap"
                  disabled={deletingId === h.id}
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete(h.id);
                  }}
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-300 transition hover:bg-rose-50 hover:text-rose-500 disabled:opacity-50 sm:opacity-0 sm:group-hover:opacity-100"
                >
                  {deletingId === h.id ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Trash2 className="h-3.5 w-3.5" />
                  )}
                </button>
              </div>
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
              value={form.child_age || ""}
              onChange={(e) => update("child_age", e.target.value ? Number(e.target.value) : ("" as any))}
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
  autofillFields,
}: {
  form: GuidanceFormState;
  update: <K extends keyof GuidanceFormState>(k: K, v: GuidanceFormState[K]) => void;
  autofillFields: Set<string>;
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
          Time, budget & location
        </h2>
        <p className="text-sm text-slate-500">
          Help us build a realistic, region-specific plan.
        </p>
      </div>

      {/* State / Location — required for govt scheme recommendations */}
      <div className="space-y-2">
        <label className="flex items-center text-xs font-bold uppercase tracking-wider text-slate-500">
          State / Union Territory
          <span className="ml-1.5 rounded-full bg-rose-100 px-1.5 py-0.5 text-[9px] font-black text-rose-600">Required</span>
          <span className="ml-1.5 rounded-full bg-slate-100 px-1.5 py-0.5 text-[9px] font-medium text-slate-500">For local schemes & resources</span>
        </label>
        <div className="relative">
          <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
          <select
            value={form.location}
            onChange={(e) => update("location", e.target.value)}
            className={`h-12 w-full rounded-xl border pl-9 pr-4 text-sm font-medium text-slate-900 outline-none transition appearance-none ${
              form.location
                ? "border-emerald-300 bg-emerald-50/40 focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100"
                : "border-slate-200 bg-white focus:border-power-orange focus:ring-4 focus:ring-power-orange/10"
            }`}
          >
            <option value="">— Select your state —</option>
            {INDIAN_STATES.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
        {form.location && (
          <p className="text-[11px] text-emerald-700 font-medium flex items-center gap-1">
            <CheckCircle2 className="h-3.5 w-3.5" /> We'll include schemes and resources available in {form.location}
          </p>
        )}
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
  update: <K extends keyof GuidanceFormState>(k: K, v: GuidanceFormState[K]) => void;
}) {
  const toggleTag = (tag: string) => {
    const has = form.personality_tags.includes(tag);
    update(
      "personality_tags",
      has ? form.personality_tags.filter((t) => t !== tag) : [...form.personality_tags, tag],
    );
  };

  // Smart question chips based on context
  const smartChips: string[] = [
    ...(form.child_age <= 11 ? ["Should my child play multiple sports at this age, or specialise?"] : []),
    ...(form.primary_objective === "Competitive" ? ["What talent indicators should I watch for in my child?"] : []),
    "How do I find and evaluate the right coach for my child's age?",
    "What documents should I start collecting from Day 1 for future trials?",
    "How do I balance school academics with serious sport training?",
  ];

  const appendChip = (chip: string) => {
    const existing = form.parent_specific_question.trim();
    update("parent_specific_question", existing ? `${existing} ${chip}` : chip);
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
          Personality & your questions
        </h2>
        <p className="text-sm text-slate-500">
          Pick traits and tap quick questions or write your own.
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

      <div className="space-y-2">
        <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
          Your biggest concern or question{" "}
          <span className="text-slate-400 normal-case font-normal">(optional)</span>
        </span>
        {/* Smart question chips */}
        <div>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1">
            <MessageCircle className="h-3 w-3" /> Quick questions — tap to add
          </p>
          <div className="flex flex-wrap gap-2">
            {smartChips.map((chip) => {
              const alreadyAdded = form.parent_specific_question.includes(chip);
              return (
                <button
                  key={chip}
                  type="button"
                  onClick={() => !alreadyAdded && appendChip(chip)}
                  disabled={alreadyAdded}
                  className={`flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-medium transition-all text-left ${
                    alreadyAdded
                      ? "border-emerald-200 bg-emerald-50 text-emerald-700 cursor-default"
                      : "border-slate-200 bg-white text-slate-600 hover:border-power-orange hover:text-power-orange hover:bg-power-orange/5"
                  }`}
                >
                  {alreadyAdded ? <CheckCircle2 className="h-3 w-3 shrink-0" /> : <span className="text-[10px] shrink-0">+</span>}
                  {chip}
                </button>
              );
            })}
          </div>
        </div>
        <textarea
          rows={4}
          value={form.parent_specific_question}
          onChange={(e) => update("parent_specific_question", e.target.value)}
          placeholder="Or write your own concern — e.g. 'My child is shy about joining teams. How can I ease them in?'"
          className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-900 outline-none transition focus:border-power-orange focus:ring-4 focus:ring-power-orange/10 resize-none"
        />
      </div>
    </motion.div>
  );
}

// ─── Inputs summary (results mode) ─────────────────────────────────────────────

function InputsSummaryBar({
  query,
  onEdit,
}: {
  query: GuidanceFormState;
  onEdit: () => void;
}) {
  const chips: Array<{ icon: typeof Compass; label: string }> = [
    { icon: UserCircle2, label: `Age ${query.child_age}` },
    { icon: Target, label: query.primary_objective },
    ...(query.sport?.trim() ? [{ icon: Activity, label: query.sport.trim() }] : []),
    { icon: Timer, label: `${query.weekly_time_commitment}h / week` },
    { icon: Wallet, label: query.budget_tier },
    ...(query.location ? [{ icon: MapPin, label: query.location }] : []),
  ];

  return (
    <div className="mb-5 flex flex-wrap items-center gap-2 rounded-2xl border border-slate-200/80 bg-white/80 p-3 shadow-sm backdrop-blur-sm">
      <span className="px-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
        Built for
      </span>
      {chips.map((c) => (
        <span
          key={c.label}
          className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700"
        >
          <c.icon className="h-3.5 w-3.5 text-slate-400" />
          {c.label}
        </span>
      ))}
      <button
        type="button"
        onClick={onEdit}
        className="ml-auto inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 shadow-sm transition hover:border-power-orange/40 hover:text-power-orange"
      >
        <Pencil className="h-3.5 w-3.5" />
        Edit inputs
      </button>
    </div>
  );
}

// ─── Goal & cost relevance cards ───────────────────────────────────────────────

const VERDICT_STYLE: Record<
  GoalAssessment["verdict"],
  { badge: string; ring: string; icon: string; bg: string }
> = {
  "On Track": {
    badge: "bg-emerald-100 text-emerald-700 border-emerald-200",
    ring: "border-emerald-200",
    icon: "text-emerald-600",
    bg: "bg-emerald-50/60",
  },
  Achievable: {
    badge: "bg-sky-100 text-sky-700 border-sky-200",
    ring: "border-sky-200",
    icon: "text-sky-600",
    bg: "bg-sky-50/60",
  },
  Ambitious: {
    badge: "bg-amber-100 text-amber-700 border-amber-200",
    ring: "border-amber-200",
    icon: "text-amber-600",
    bg: "bg-amber-50/60",
  },
  "Long-Term": {
    badge: "bg-violet-100 text-violet-700 border-violet-200",
    ring: "border-violet-200",
    icon: "text-violet-600",
    bg: "bg-violet-50/60",
  },
};

function GoalAssessmentCard({ a }: { a: GoalAssessment }) {
  const cfg = VERDICT_STYLE[a.verdict] ?? VERDICT_STYLE.Achievable;
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className={`rounded-2xl border ${cfg.ring} ${cfg.bg} p-4`}
    >
      <div className="mb-2 flex items-center gap-2.5">
        <div className={`flex h-9 w-9 items-center justify-center rounded-xl border bg-white/80 ${cfg.ring}`}>
          <Crosshair className={`h-5 w-5 ${cfg.icon}`} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
            Goal check
          </p>
          <h4 className="truncate text-sm font-bold text-slate-900">
            {a.statedGoal}
          </h4>
        </div>
        <span
          className={`shrink-0 rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase ${cfg.badge}`}
        >
          {a.verdict}
        </span>
      </div>
      <p className="text-xs leading-relaxed text-slate-700">{a.rationale}</p>
      <div className="mt-2.5 flex items-start gap-2 rounded-xl border border-white bg-white/70 px-3 py-2">
        <BarChart3 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" />
        <p className="text-[11px] text-slate-600">
          <span className="font-bold text-slate-700">Benchmark:</span> {a.benchmark}
        </p>
      </div>
    </motion.div>
  );
}

function CostBreakdownCard({ c }: { c: CostBreakdown }) {
  const items = [
    { icon: UserCircle2, label: "Coaching", value: c.monthlyCoaching },
    { icon: Dumbbell, label: "Equipment", value: c.equipment },
    { icon: Trophy, label: "Tournaments", value: c.tournaments },
  ];
  return (
    <div>
      <div className="mb-3 flex items-center gap-2">
        <Wallet className="h-4 w-4 text-emerald-600" />
        <h3 className="font-title text-sm font-semibold uppercase tracking-wide text-slate-900">
          Investment
        </h3>
        <span className="ml-auto rounded-full bg-slate-100 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-slate-400">
          Indicative
        </span>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {items.map(({ icon: Icon, label, value }) => (
          <div
            key={label}
            className="rounded-2xl border border-slate-100 bg-slate-50/70 p-3"
          >
            <Icon className="h-4 w-4 text-slate-400" />
            <p className="mt-2 text-[10px] font-bold uppercase tracking-wide text-slate-400">
              {label}
            </p>
            <p className="text-sm font-bold text-slate-800">{value}</p>
          </div>
        ))}
      </div>
      <p className="mt-3 flex items-start gap-1.5 text-[11px] text-slate-500">
        <Info className="mt-0.5 h-3 w-3 shrink-0" />
        {c.summary}
      </p>
    </div>
  );
}

// ─── Journey roadmap (interactive, gamified) ───────────────────────────────────

// Luxury easing — slow-out cubic used by premium editorial sites
const LUXE_EASE = [0.22, 1, 0.36, 1] as const;

function Phase3D({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      {children}
    </div>
  );
}

// Clip-mask line reveal — text emerges from behind an invisible mask.
function LineReveal({
  text,
  className,
  delay = 0,
}: {
  text: string;
  className?: string;
  delay?: number;
}) {
  return (
    <span className="block overflow-hidden">
      <motion.span
        initial={{ y: "115%" }}
        whileInView={{ y: 0 }}
        viewport={{ once: true, margin: "-70px" }}
        transition={{ duration: 0.65, ease: LUXE_EASE, delay }}
        className={`block ${className ?? ""}`}
      >
        {text}
      </motion.span>
    </span>
  );
}

function ProgressRing({ percent, dark }: { percent: number; dark?: boolean }) {
  const r = 30;
  const circ = 2 * Math.PI * r;
  return (
    <div className="relative h-[72px] w-[72px] shrink-0">
      <svg viewBox="0 0 72 72" className="h-[72px] w-[72px] -rotate-90">
        <circle
          cx="36"
          cy="36"
          r={r}
          fill="none"
          stroke={dark ? "rgba(255,255,255,0.14)" : "rgb(241 245 249)"}
          strokeWidth="7"
        />
        <motion.circle
          cx="36"
          cy="36"
          r={r}
          fill="none"
          stroke="url(#journeyGrad)"
          strokeWidth="7"
          strokeLinecap="round"
          strokeDasharray={circ}
          initial={{ strokeDashoffset: circ }}
          animate={{ strokeDashoffset: circ - (circ * percent) / 100 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          style={{ filter: "drop-shadow(0 0 4px rgba(233,115,22,0.5))" }}
        />
        <defs>
          <linearGradient id="journeyGrad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#e97316" />
            <stop offset="100%" stopColor="#34d399" />
          </linearGradient>
        </defs>
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={`text-base font-black ${dark ? "text-white" : "text-slate-800"}`}>
          {percent}%
        </span>
      </div>
    </div>
  );
}

function AmbientStars() {
  const stars = [
    { top: "14%", left: "8%", d: 0, s: 2 },
    { top: "30%", left: "22%", d: 0.6, s: 1.5 },
    { top: "62%", left: "12%", d: 1.1, s: 2 },
    { top: "20%", left: "46%", d: 0.3, s: 1.5 },
    { top: "74%", left: "38%", d: 0.9, s: 1.5 },
    { top: "40%", left: "66%", d: 0.5, s: 2 },
    { top: "16%", left: "82%", d: 1.3, s: 1.5 },
    { top: "66%", left: "76%", d: 0.2, s: 2 },
    { top: "82%", left: "60%", d: 0.8, s: 1.5 },
  ];
  return (
    <div className="pointer-events-none absolute inset-0">
      {stars.map((st, i) => (
        <motion.span
          key={i}
          className="absolute rounded-full bg-white"
          style={{ top: st.top, left: st.left, width: st.s, height: st.s }}
          animate={{ opacity: [0.15, 0.9, 0.15], scale: [1, 1.4, 1] }}
          transition={{ repeat: Infinity, duration: 2.4, delay: st.d, ease: "easeInOut" }}
        />
      ))}
    </div>
  );
}

function CelebrationBurst() {
  const bits = Array.from({ length: 30 });
  const colors = [
    "bg-power-orange",
    "bg-emerald-400",
    "bg-amber-400",
    "bg-sky-400",
    "bg-violet-400",
    "bg-rose-400",
  ];
  return (
    <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center overflow-hidden">
      {bits.map((_, i) => {
        const angle = (i / bits.length) * Math.PI * 2 + (i % 3) * 0.4;
        const dist = 90 + (i % 6) * 30;
        return (
          <motion.span
            key={i}
            initial={{ opacity: 1, x: 0, y: 0, scale: 1 }}
            animate={{
              opacity: 0,
              x: Math.cos(angle) * dist,
              y: Math.sin(angle) * dist - 20,
              scale: 0.2,
              rotate: i % 2 ? 220 : -220,
            }}
            transition={{ duration: 1.4, ease: "easeOut" }}
            className={`absolute ${i % 2 ? "h-3 w-1.5" : "h-2.5 w-2.5"} rounded-sm ${colors[i % colors.length]}`}
          />
        );
      })}
    </div>
  );
}

function buildFallbackJourney(r: GuidanceResponse): JourneyPhase[] {
  const splitActions = (s?: string) =>
    (s || "")
      .split(/(?<=\.)\s+|;\s*/)
      .map((t) => t.trim())
      .filter(Boolean);

  const phases: JourneyPhase[] = [];
  const actions = splitActions(r.recommendedPlatformActions);
  phases.push({
    title: "Get Set Up",
    timeframe: "Weeks 1–2",
    focus: "Lay the groundwork and start with a clear structure.",
    milestones: actions.length
      ? actions.slice(0, 4)
      : ["Choose a coach or academy", "Set a weekly schedule"],
    outcome: "Training has a clear structure and you're enrolled.",
  });
  phases.push({
    title: "Build the Weekly Rhythm",
    timeframe: "Weeks 3–8",
    focus: "Turn the plan into a sustainable weekly habit.",
    milestones: [
      `Training: ${r.weeklyBlueprint.trainingHours}`,
      `Free play: ${r.weeklyBlueprint.freePlayHours}`,
      `Rest: ${r.weeklyBlueprint.restDays}`,
    ],
    outcome: "A balanced, repeatable weekly routine the child enjoys.",
  });
  if (r.mentalSkillsRoadmap) {
    phases.push({
      title: "Strengthen the Mind",
      timeframe: "Month 2–3",
      focus: r.mentalSkillsRoadmap.currentFocus,
      milestones: r.mentalSkillsRoadmap.skills
        .map((s) => `${s.skill}: ${s.howToDevelop}`)
        .slice(0, 4),
      outcome: "Noticeably more composed and focused under pressure.",
    });
  }
  if (r.talentIdentifiers?.length) {
    phases.push({
      title: "Track Real Progress",
      timeframe: "Ongoing",
      focus: "Watch for genuine signs of aptitude and growth.",
      milestones: r.talentIdentifiers.slice(0, 4),
      outcome: "Clear, observable evidence the child is developing.",
    });
  }
  return phases;
}

function JourneyMap({
  phases,
  submissionId,
  goal,
  goalDetail,
  assessment,
}: {
  phases: JourneyPhase[];
  submissionId: string;
  goal: string;
  goalDetail?: string;
  assessment?: GoalAssessment;
}) {
  const storageKey = `pms-journey-${submissionId}`;
  const [done, setDone] = useState<Set<string>>(new Set());
  const [celebrate, setCelebrate] = useState(false);
  const [xpPops, setXpPops] = useState<number[]>([]);

  const NODE_ICONS = [Sprout, Dumbbell, Brain, Crosshair, TrendingUp, Award];

  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) setDone(new Set<string>(JSON.parse(raw)));
      else setDone(new Set());
    } catch {
      setDone(new Set());
    }
  }, [storageKey]);

  const allKeys: string[] = [];
  phases.forEach((p, pi) =>
    p.milestones.forEach((_, mi) => allKeys.push(`${pi}:${mi}`)),
  );
  const total = allKeys.length;
  const completed = allKeys.filter((k) => done.has(k)).length;
  const percent = total ? Math.round((completed / total) * 100) : 0;

  const phaseDone = (pi: number) =>
    phases[pi].milestones.length > 0 &&
    phases[pi].milestones.every((_, mi) => done.has(`${pi}:${mi}`));
  const currentPhase = phases.findIndex((_, pi) => !phaseDone(pi));

  const toggle = (key: string) => {
    const next = new Set(done);
    const adding = !next.has(key);
    if (adding) next.add(key);
    else next.delete(key);
    setDone(next);
    try {
      localStorage.setItem(storageKey, JSON.stringify([...next]));
    } catch {
      /* ignore */
    }
    if (adding) {
      const id = Date.now() + Math.floor(Math.random() * 1000);
      setXpPops((p) => [...p, id]);
      setTimeout(() => setXpPops((p) => p.filter((x) => x !== id)), 900);
    }
    if (adding && total > 0 && allKeys.filter((k) => next.has(k)).length === total) {
      setCelebrate(true);
      setTimeout(() => setCelebrate(false), 1600);
    }
  };

  const completedPhases = phases.filter((_, pi) => phaseDone(pi)).length;
  const currentDisplay = currentPhase === -1 ? phases.length : currentPhase + 1;
  const headline =
    percent === 100
      ? "Mission complete — incredible work! 🎉"
      : percent === 0
        ? "Your mission starts now"
        : `Phase ${currentDisplay} of ${phases.length} — keep climbing`;

  return (
    <div className="space-y-5">
      {/* ── Cinematic mission banner ── */}
      <motion.div
        initial={{ opacity: 0, rotateX: 26, y: 50, z: -200, filter: "blur(12px)" }}
        animate={{ opacity: 1, rotateX: 0, y: 0, z: 0, filter: "blur(0px)" }}
        transition={{ duration: 1.15, ease: LUXE_EASE }}
        style={{
          transformPerspective: 1300,
          transformOrigin: "center top",
          willChange: "transform, filter, opacity",
        }}
        className="relative overflow-hidden rounded-3xl p-px shadow-[0_24px_60px_-24px_rgba(233,115,22,0.5)]"
      >
        {/* slowly rotating gradient-light rim */}
        <motion.div
          aria-hidden
          className="pointer-events-none absolute -inset-[120%] bg-[conic-gradient(from_0deg,transparent_0deg,rgba(233,115,22,0.85)_40deg,transparent_130deg,transparent_220deg,rgba(52,211,153,0.7)_260deg,transparent_340deg)]"
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 9, ease: "linear" }}
        />
        <div className="relative overflow-hidden rounded-[23px] bg-gradient-to-br from-slate-900 via-slate-900 to-[#3a1d05] p-5 text-white sm:p-6">
        <AmbientStars />
        <div className="pointer-events-none absolute -right-12 -top-12 h-44 w-44 rounded-full bg-power-orange/30 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-16 left-1/4 h-40 w-40 rounded-full bg-emerald-500/20 blur-3xl" />
        {celebrate && <CelebrationBurst />}

        <div className="relative z-10 flex items-center gap-5">
          <div className="relative">
            <ProgressRing percent={percent} dark />
            <AnimatePresence>
              {xpPops.map((id) => (
                <motion.span
                  key={id}
                  initial={{ opacity: 0, y: 0, scale: 0.6 }}
                  animate={{ opacity: 1, y: -30, scale: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.9, ease: "easeOut" }}
                  className="pointer-events-none absolute left-1/2 top-0 -translate-x-1/2 text-xs font-black text-emerald-300"
                >
                  +10 XP
                </motion.span>
              ))}
            </AnimatePresence>
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-power-orange">
                Mission Roadmap
              </p>
              <span className="flex items-center gap-1 rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-bold text-amber-300">
                <Zap className="h-3 w-3" /> {completed * 10} XP
              </span>
            </div>
            <h3 className="font-title text-xl font-bold leading-tight">{headline}</h3>
            <p className="mt-0.5 text-xs text-white/60">
              <Flag className="mr-1 inline h-3 w-3 text-emerald-400" />
              Destination: <span className="font-semibold text-white/90">{goal}</span>
            </p>
            {/* phase pips */}
            <div className="mt-3 flex gap-1.5">
              {phases.map((_, i) => (
                <motion.span
                  key={i}
                  initial={{ scaleX: 0 }}
                  animate={{ scaleX: 1 }}
                  transition={{ delay: 0.1 + i * 0.05 }}
                  className={`h-1.5 flex-1 origin-left rounded-full ${
                    i < completedPhases
                      ? "bg-emerald-400"
                      : i === currentPhase
                        ? "bg-power-orange"
                        : "bg-white/15"
                  }`}
                />
              ))}
            </div>
          </div>
        </div>
        {/* premium sheen sweep */}
        <motion.div
          aria-hidden
          className="pointer-events-none absolute inset-0 -skew-x-12 bg-gradient-to-r from-transparent via-white/10 to-transparent"
          initial={{ x: "-160%" }}
          animate={{ x: "160%" }}
          transition={{ repeat: Infinity, duration: 3.6, repeatDelay: 4, ease: "easeInOut" }}
        />
        </div>
      </motion.div>

      {/* ── Honest goal verdict + benchmark ── */}
      {assessment && <GoalAssessmentCard a={assessment} />}

      {/* ── Timeline ── */}
      <div className="relative">
        {/* spine track */}
        <div className="absolute left-[22px] top-6 bottom-6 w-1 rounded-full bg-slate-100" />
        {/* spine fill + traveling shimmer */}
        <motion.div
          className="absolute left-[22px] top-6 w-1 overflow-hidden rounded-full bg-gradient-to-b from-power-orange to-emerald-400"
          initial={{ height: 0 }}
          animate={{ height: `${percent}%` }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          style={{ maxHeight: "calc(100% - 48px)" }}
        >
          <motion.div
            className="absolute inset-x-0 h-10 bg-gradient-to-b from-transparent via-white/80 to-transparent"
            animate={{ y: ["-40px", "260px"] }}
            transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
          />
        </motion.div>

        {/* Start node */}
        <div className="relative flex items-center gap-4 pb-6">
          <div className="relative z-10 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-power-orange to-orange-500 text-white shadow-[0_8px_20px_-6px_rgba(233,115,22,0.6)]">
            <Rocket className="h-5 w-5" />
            <motion.span
              className="absolute inset-0 rounded-2xl ring-2 ring-power-orange/40"
              animate={{ scale: [1, 1.25, 1], opacity: [0.6, 0, 0.6] }}
              transition={{ repeat: Infinity, duration: 2.2, ease: "easeInOut" }}
            />
          </div>
          <div>
            <p className="font-bold text-slate-800">Today — the starting line</p>
            <p className="text-xs text-slate-500">
              Tap milestones as you complete them to earn XP
            </p>
          </div>
        </div>

        {/* Phases */}
        {phases.map((p, pi) => {
          const complete = phaseDone(pi);
          const isCurrent = pi === currentPhase;
          const NodeIcon = NODE_ICONS[pi % NODE_ICONS.length]!;
          return (
            <Phase3D key={pi} className="relative pb-6 pl-16">
              {/* node */}
              <div
                className={`absolute left-0 top-0 z-10 flex h-12 w-12 items-center justify-center rounded-2xl border-2 shadow-md ${
                  complete
                    ? "border-emerald-500 bg-gradient-to-br from-emerald-400 to-emerald-600 text-white"
                    : isCurrent
                      ? "border-power-orange bg-gradient-to-br from-power-orange to-orange-500 text-white"
                      : "border-slate-200 bg-white text-slate-400"
                }`}
              >
                {complete ? (
                  <CheckCircle2 className="h-5 w-5" />
                ) : (
                  <NodeIcon className="h-5 w-5" />
                )}
                {isCurrent && (
                  <>
                    <span className="absolute inset-0 rounded-2xl ring-4 ring-power-orange/25 animate-pulse" />
                    <motion.div
                      className="absolute -top-7 left-0 flex w-12 justify-center"
                      animate={{ y: [0, -3, 0] }}
                      transition={{ repeat: Infinity, duration: 1.4, ease: "easeInOut" }}
                    >
                      <span className="rounded-full bg-power-orange px-2 py-0.5 text-[8px] font-black uppercase tracking-wide text-white shadow-md">
                        You
                      </span>
                    </motion.div>
                  </>
                )}
              </div>

              <div
                className={`rounded-2xl border bg-white p-4 transition-shadow duration-300 hover:shadow-[0_26px_55px_-20px_rgba(15,23,42,0.32)] ${
                  isCurrent
                    ? "border-power-orange/40 shadow-md"
                    : complete
                      ? "border-emerald-200"
                      : "border-slate-200"
                }`}
              >
                <div className="flex flex-wrap items-center gap-2 mb-1">
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-slate-500">
                    {p.timeframe}
                  </span>
                  {p.estimatedCost && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
                      <Wallet className="h-3 w-3" />
                      {p.estimatedCost}
                    </span>
                  )}
                  {isCurrent && (
                    <span className="rounded-full bg-power-orange/10 px-2 py-0.5 text-[10px] font-bold text-power-orange">
                      In progress
                    </span>
                  )}
                  {complete && (
                    <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-600">
                      Cleared
                    </span>
                  )}
                </div>
                <LineReveal
                  text={p.title}
                  delay={0.12}
                  className="font-title font-bold text-slate-900"
                />
                <p className="mt-0.5 mb-3 text-xs text-slate-500">{p.focus}</p>

                <ul className="space-y-1.5">
                  {p.milestones.map((m, mi) => {
                    const key = `${pi}:${mi}`;
                    const checked = done.has(key);
                    return (
                      <li key={mi}>
                        <button
                          type="button"
                          onClick={() => toggle(key)}
                          className="group flex w-full items-start gap-2.5 text-left"
                        >
                          <motion.span
                            whileTap={{ scale: 0.8 }}
                            animate={checked ? { scale: [1, 1.25, 1] } : {}}
                            transition={{ duration: 0.3 }}
                            className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2 transition ${
                              checked
                                ? "border-emerald-500 bg-emerald-500 text-white"
                                : "border-slate-300 group-hover:border-power-orange"
                            }`}
                          >
                            {checked && <CheckCircle2 className="h-3.5 w-3.5" />}
                          </motion.span>
                          <span
                            className={`text-xs leading-relaxed ${
                              checked
                                ? "text-slate-400 line-through"
                                : "text-slate-700"
                            }`}
                          >
                            {m}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>

                <div className="mt-3 flex items-start gap-2 rounded-xl border border-emerald-100 bg-emerald-50/60 px-3 py-2">
                  <Trophy className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" />
                  <p className="text-[11px] text-emerald-800">
                    <span className="font-bold">Reward:</span> {p.outcome}
                  </p>
                </div>
              </div>
            </Phase3D>
          );
        })}

        {/* Goal node */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: LUXE_EASE, delay: 0.2 }}
          className="relative flex items-center gap-4"
        >
          <div
            className={`relative z-10 flex h-12 w-12 items-center justify-center rounded-2xl text-white shadow-md ${
              percent === 100
                ? "bg-gradient-to-br from-emerald-400 to-emerald-600"
                : "bg-slate-800"
            }`}
          >
            <Flag className="h-5 w-5" />
            {percent === 100 && (
              <span className="absolute inset-0 rounded-2xl ring-4 ring-emerald-400/30 animate-pulse" />
            )}
          </div>
          <div className="min-w-0">
            <p className="font-bold text-slate-800">
              {percent === 100 ? "🏆 Goal reached: " : "Goal: "}
              {goal}
            </p>
            {goalDetail && (
              <p className="line-clamp-2 max-w-md text-xs text-slate-500">
                {goalDetail}
              </p>
            )}
          </div>
        </motion.div>
      </div>
    </div>
  );
}

// ─── Results ──────────────────────────────────────────────────────────────────

function ResultsView({ submission }: { submission: GuidanceSubmission }) {
  const r = submission.response;

  const fitnessInfo = (() => {
    const lvl = submission.query.current_fitness_level;
    if (lvl === "Low")
      return { pct: "33%", color: "bg-emerald-400", label: "Beginner" };
    if (lvl === "Moderate")
      return { pct: "66%", color: "bg-amber-400", label: "Developing" };
    return { pct: "100%", color: "bg-violet-500", label: "Advanced" };
  })();

  // Build tabs dynamically — only show sections that have content
  const hasSports = !!r.recommendedSports && r.recommendedSports.length > 0;
  const hasMind =
    !!r.mentalSkillsRoadmap ||
    (!!r.talentIdentifiers && r.talentIdentifiers.length > 0);
  const hasWellbeing =
    (!!r.burnoutRisk && r.burnoutRisk.level !== "low") ||
    !!r.multiSportAdvisory;

  // Time-phased roadmap from the AI, or synthesised from existing fields
  const journeyPhases =
    r.journeyPhases && r.journeyPhases.length > 0
      ? r.journeyPhases
      : buildFallbackJourney(r);

  type TabId = "journey" | "plan" | "coaching" | "mind" | "wellbeing";
  const tabs: Array<{ id: TabId; label: string; icon: typeof Compass }> = [
    { id: "journey", label: "Journey", icon: Route },
    { id: "plan", label: "Plan", icon: BarChart3 },
    { id: "coaching", label: "Coaching", icon: UserCircle2 },
    ...(hasMind
      ? [{ id: "mind" as TabId, label: "Mind", icon: Brain }]
      : []),
    ...(hasWellbeing
      ? [{ id: "wellbeing" as TabId, label: "Wellbeing", icon: ShieldCheck }]
      : []),
  ];

  const [tab, setTab] = useState<TabId>("journey");

  return (
    <div className="space-y-5">
      {/* Hero card — always visible */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 300, damping: 26 }}
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
            {r.profileAnalysis}
          </p>
        </div>
      </motion.div>

      {/* Tab navigation */}
      <div className="flex items-center gap-1.5 rounded-2xl border border-slate-200 bg-slate-50 p-1.5">
        {tabs.map((t) => {
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`relative flex flex-1 items-center justify-center gap-1.5 rounded-xl px-2 py-2 text-xs font-bold transition-colors ${
                active ? "text-power-orange" : "text-slate-500 hover:text-slate-700"
              }`}
            >
              {active && (
                <motion.div
                  layoutId="guidance-tab-pill"
                  className="absolute inset-0 rounded-xl bg-white shadow-sm"
                  transition={{ type: "spring", stiffness: 400, damping: 32 }}
                />
              )}
              <t.icon className="relative z-10 h-3.5 w-3.5 shrink-0" />
              <span className="relative z-10 truncate">{t.label}</span>
            </button>
          );
        })}
      </div>

      {/* Tab content */}
      <div className="min-h-[280px]">
        <AnimatePresence mode="wait">
          <motion.div
            key={tab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.18 }}
            className="space-y-5"
          >
            {tab === "journey" && (
              <JourneyMap
                phases={journeyPhases}
                submissionId={submission.id}
                goal={submission.query.primary_objective}
                goalDetail={submission.query.parent_specific_question}
                assessment={r.goalAssessment}
              />
            )}

            {tab === "plan" && (
              <>
                {/* Profile snapshot — at a glance */}
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {[
                    {
                      icon: Activity,
                      label: "Sport",
                      value: submission.query.sport?.trim() || "Flexible",
                    },
                    {
                      icon: Timer,
                      label: "Per week",
                      value: `${submission.query.weekly_time_commitment}h`,
                    },
                    {
                      icon: Wallet,
                      label: "Budget",
                      value: submission.query.budget_tier,
                    },
                    {
                      icon: MapPin,
                      label: "Location",
                      value: submission.query.location || "—",
                    },
                  ].map(({ icon: Icon, label, value }, i) => (
                    <motion.div
                      key={label}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.05 }}
                      className="rounded-2xl border border-slate-100 bg-slate-50/70 p-3"
                    >
                      <Icon className="h-4 w-4 text-slate-400" />
                      <p className="mt-2 text-[10px] font-bold uppercase tracking-wide text-slate-400">
                        {label}
                      </p>
                      <p className="text-sm font-bold text-slate-800 truncate" title={value}>
                        {value}
                      </p>
                    </motion.div>
                  ))}
                </div>

                {/* Investment / cost breakdown */}
                {r.costBreakdown && <CostBreakdownCard c={r.costBreakdown} />}

                {/* Weekly blueprint */}
                <div>
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
                        value: r.weeklyBlueprint.trainingHours,
                        color: "text-emerald-600",
                        bg: "bg-emerald-50",
                        border: "border-emerald-100",
                      },
                      {
                        icon: Zap,
                        label: "Free Play",
                        value: r.weeklyBlueprint.freePlayHours,
                        color: "text-sky-600",
                        bg: "bg-sky-50",
                        border: "border-sky-100",
                      },
                      {
                        icon: Timer,
                        label: "Rest",
                        value: r.weeklyBlueprint.restDays,
                        color: "text-violet-600",
                        bg: "bg-violet-50",
                        border: "border-violet-100",
                      },
                    ].map(({ icon: Icon, label, value, color, bg, border }, i) => (
                      <motion.div
                        key={label}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.07 }}
                        whileHover={{ y: -3 }}
                        className={`rounded-2xl border ${border} ${bg} p-4 transition-shadow hover:shadow-md`}
                      >
                        <span className={`mb-2 flex h-8 w-8 items-center justify-center rounded-xl bg-white/70 ${color}`}>
                          <Icon className="h-4 w-4" />
                        </span>
                        <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
                          {label}
                        </p>
                        <p className="mt-1 text-sm font-semibold text-slate-800 leading-snug">
                          {value}
                        </p>
                      </motion.div>
                    ))}
                  </div>
                </div>

                {/* Recommended Sports */}
                {hasSports && (
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <Trophy className="h-4 w-4 text-power-orange" />
                      <h3 className="font-title font-semibold text-slate-900 text-sm uppercase tracking-wide">
                        Top Recommended Sports
                      </h3>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      {r.recommendedSports!.map((sport, idx) => (
                        <motion.div
                          key={idx}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: idx * 0.07 }}
                          whileHover={{ y: -3 }}
                          className="flex items-center gap-3 rounded-2xl border border-power-orange/20 bg-gradient-to-br from-power-orange/[0.07] to-amber-50/60 p-3 transition-shadow hover:shadow-md"
                        >
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white text-power-orange font-bold shadow-sm">
                            #{idx + 1}
                          </div>
                          <p className="font-semibold text-slate-800 leading-tight">
                            {sport}
                          </p>
                        </motion.div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Personality traits */}
                {submission.query.personality_tags.length > 0 && (
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <Sparkles className="h-4 w-4 text-violet-500" />
                      <h3 className="font-title font-semibold text-slate-900 text-sm uppercase tracking-wide">
                        Personality Profile
                      </h3>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {submission.query.personality_tags.map((tag) => (
                        <span
                          key={tag}
                          className="rounded-full border border-violet-100 bg-violet-50 px-3 py-1.5 text-xs font-semibold text-violet-700"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}

            {tab === "coaching" && (
              <>
                {/* Coaching style */}
                <div className="rounded-2xl border border-slate-200 bg-white p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-purple-50">
                      <UserCircle2 className="h-4 w-4 text-purple-600" />
                    </div>
                    <h3 className="font-title font-semibold text-slate-900">
                      Ideal Coaching Style
                    </h3>
                  </div>
                  <p className="text-sm leading-7 text-slate-600">
                    {r.idealCoachingStyle}
                  </p>
                </div>

                {/* Next objectives */}
                <div className="rounded-2xl border-2 border-emerald-400 bg-emerald-50/50 p-5 relative overflow-hidden">
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
                      {r.recommendedPlatformActions}
                    </p>
                  </div>
                </div>
              </>
            )}

            {tab === "mind" && (
              <>
                {r.mentalSkillsRoadmap && (
                  <MentalSkillsCard roadmap={r.mentalSkillsRoadmap} />
                )}
                {r.talentIdentifiers && r.talentIdentifiers.length > 0 && (
                  <TalentIdentifiersCard identifiers={r.talentIdentifiers} />
                )}
              </>
            )}

            {tab === "wellbeing" && (
              <>
                {r.burnoutRisk && <BurnoutRiskCard risk={r.burnoutRisk} />}
                {r.multiSportAdvisory && (
                  <MultiSportAdvisoryCard advisory={r.multiSportAdvisory} />
                )}
              </>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* ── CTA Buttons — always visible ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
        <a
          href={process.env.NEXT_PUBLIC_MAIN_APP_URL || "http://localhost:3000"}
          className="flex items-center justify-center gap-2 rounded-xl bg-power-orange px-5 py-3.5 text-sm font-bold text-white shadow-[0_4px_14px_-4px_rgba(233,115,22,0.5)] transition-all hover:bg-orange-600 active:scale-[0.98]"
        >
          <Compass className="h-4 w-4" />
          Explore Programs
        </a>
        <a
          href="/roadmap"
          className="flex items-center justify-center gap-2 rounded-xl border-2 border-slate-200 bg-white px-5 py-3.5 text-sm font-bold text-slate-700 transition-all hover:border-slate-300 hover:bg-slate-50 active:scale-[0.98]"
        >
          <Users className="h-4 w-4" />
          View Roadmap
        </a>
      </div>
    </div>
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
  const [autofillFields, setAutofillFields] = useState<Set<string>>(new Set());
  const [deletingId, setDeletingId] = useState<string | null>(null);
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

    const filled = new Set<string>();
    setForm((f) => {
      const next = { ...f };
      if (age) { next.child_age = age; filled.add("child_age"); }
      if (player.skillLevel) { next.current_fitness_level = fitness; filled.add("current_fitness_level"); }
      if (player.personalityTags?.length) { next.personality_tags = player.personalityTags; filled.add("personality_tags"); }
      if (player.primaryObjective) { next.primary_objective = player.primaryObjective; filled.add("primary_objective"); }
      if (player.weeklyTimeCommitment) { next.weekly_time_commitment = player.weeklyTimeCommitment; filled.add("weekly_time_commitment"); }
      if (player.budgetTier) { next.budget_tier = player.budgetTier; filled.add("budget_tier"); }
      if (player.sportsFocus?.length) { next.sport = player.sportsFocus.join(", "); filled.add("sport"); }
      return next;
    });
    setAutofillFields(filled);
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

  const handleDeleteRoadmap = async (id: string) => {
    setDeletingId(id);
    try {
      await api.delete(`/guidance/${id}`);
      setHistory((prev) => prev.filter((h) => h.id !== id));
      if (submission?.id === id) {
        setSubmission(null);
        setShowResults(false);
      }
      toast.success("Roadmap deleted");
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : "Unable to delete roadmap.";
      toast.error(msg);
    } finally {
      setDeletingId(null);
    }
  };

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
      350,
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
    setAutofillFields(new Set());
    setSelectedProfileId("");
  };

  const editInputs = () => {
    setShowResults(false);
    if (typeof window !== "undefined")
      window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const mode: "results" | "input" =
    showResults && submission && !loading ? "results" : "input";

  return (
    <div className="relative min-h-screen px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
      {/* Ambient background — fixed so it never clips the sticky wizard */}
      <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-orange-50/50 via-white to-slate-50" />
        <div className="absolute -left-32 -top-10 h-[28rem] w-[28rem] rounded-full bg-power-orange/10 blur-3xl" />
        <div className="absolute right-[-6rem] top-40 h-80 w-80 rounded-full bg-amber-200/30 blur-3xl" />
        <div className="absolute bottom-0 left-1/3 h-72 w-72 rounded-full bg-indigo-200/20 blur-3xl" />
      </div>

      <div className="mx-auto w-full max-w-6xl">
        {/* ── Header ── */}
        <section className="pb-8 lg:pb-10">
          <div className="mb-6">
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
                    onDelete={handleDeleteRoadmap}
                    deletingId={deletingId}
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
            <h1 className="font-title text-2xl font-bold leading-[1.1] tracking-tight sm:text-3xl lg:text-[2.6rem] max-w-3xl">
              Get a structured sports roadmap for your{" "}
              <span className="text-power-orange">young athlete.</span>
            </h1>
            <p className="mt-2.5 max-w-2xl text-sm leading-relaxed text-slate-600">
              {mode === "results"
                ? "Here's the personalised roadmap — switch tabs to explore the plan, coaching, mindset and wellbeing."
                : "Answer four quick steps — we'll return personalised guidance on sport, coaching style, weekly schedule, and next actions."}
            </p>
          </div>

          {/* ── Layout ── */}
          <AnimatePresence mode="wait">
          {mode === "results" && submission ? (
            <motion.div
              key="results"
              ref={resultsRef}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.25 }}
              className="mx-auto max-w-4xl"
            >
              <InputsSummaryBar query={submission.query} onEdit={editInputs} />
              <div className="rounded-3xl border border-slate-200/80 bg-white/95 p-6 shadow-[0_10px_40px_-18px_rgba(15,23,42,0.25)] ring-1 ring-slate-900/[0.03] backdrop-blur-sm sm:p-8">
                <div className="mb-5 flex items-center gap-2">
                  <Medal className="h-5 w-5 text-amber-500" />
                  <span className="font-title font-bold text-slate-900">
                    Your Roadmap
                  </span>
                </div>
                <ResultsView key={submission.id} submission={submission} />
              </div>
            </motion.div>
          ) : loading ? (
            <motion.div
              key="loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="mx-auto max-w-4xl"
            >
              <div className="rounded-3xl border border-slate-200/80 bg-white/95 p-6 shadow-[0_10px_40px_-18px_rgba(15,23,42,0.25)] ring-1 ring-slate-900/[0.03] backdrop-blur-sm sm:p-8">
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
            </motion.div>
          ) : (
            <motion.div
              key="input"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.2 }}
              className="mx-auto max-w-4xl"
            >
            {/* ── Wizard Card ── */}
            <div className="rounded-3xl border border-slate-200/80 bg-white/95 p-6 shadow-[0_10px_40px_-18px_rgba(15,23,42,0.25)] ring-1 ring-slate-900/[0.03] backdrop-blur-sm sm:p-8 z-10">
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
                  <Step3Lifestyle key="step3" form={form} update={update} autofillFields={autofillFields} />
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
                  <div className="flex-1 space-y-2">
                    {/* Validation checklist */}
                    {!isFormValid(form) && (
                      <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-amber-700 mb-1.5 flex items-center gap-1">
                          <Info className="h-3 w-3" /> Required before generating
                        </p>
                        <ul className="space-y-1">
                          {getMissingFields(form).map((f) => (
                            <li key={f} className="flex items-center gap-1.5 text-xs text-amber-800">
                              <div className="h-1.5 w-1.5 rounded-full bg-amber-500 shrink-0" />
                              {f}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={handleSubmit}
                      disabled={loading || !isFormValid(form)}
                      className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-power-orange px-5 py-3 text-sm font-bold text-white shadow-[0_4px_14px_-4px_rgba(233,115,22,0.5)] transition hover:bg-orange-600 active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none"
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
                  </div>
                )}
              </div>

              {/* Step hint */}
              <p className="mt-3 text-center text-xs text-slate-400">
                Step {step} of {STEPS.length}
                {step < 4 ? " · " : " · Ready to generate "}
                {step < 4 && `${STEPS.length - step} more to go`}
              </p>
            </div>
            </motion.div>
          )}
          </AnimatePresence>
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
