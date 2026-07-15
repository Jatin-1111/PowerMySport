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
import { useEffect, useState } from "react";
import api from "@/lib/api/axios";
import { useAuthStore } from "@/modules/auth/store/authStore";
import { BinaryCards } from "./inputs/BinaryCards";
import { FourContextCards } from "./inputs/FourContextCards";
import { SportSearchInput } from "./inputs/SportSearchInput";
import { StateSelector } from "./inputs/StateSelector";
import { ThreeOptionCards } from "./inputs/ThreeOptionCards";
import {
  EMPTY_FORM,
  buildGoalChips,
  buildProfileChips,
  isAnswered,
} from "../utils/sportKnownFlowUtils";
import type { KnownSportForm } from "../utils/sportKnownFlowUtils";
import { JourneyPipeline } from "./JourneyPipeline";

// ─── Wizard step definitions ─────────────────────────────────────────────────

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
    id: "dateOfBirth",
    required: false,
    heading: (f) => `When was ${f.childName || "your child"} born?`,
    sub: "Optional — helps us send age-appropriate milestones and track their development over time.",
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
    sub: "3 quick questions about their experience, training and energy.",
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
    id: "trainingType",
    required: true,
    heading: (f) => `How is ${f.childName || "your child"} currently training?`,
    sub: "Helps us place them accurately on the roadmap and show the right next step.",
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
    id: "motorType",
    required: false,
    heading: (f) => `What kind of movements does ${f.childName || "your child"} excel at?`,
    sub: "Optional — helps match sports that reward their natural physical style.",
  },
  {
    kind: "question",
    id: "heightCm",
    required: false,
    heading: (f) => `What are ${f.childName || "your child"}'s physical stats?`,
    sub: "Optional — used to refine sport matches based on body type.",
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
        <SportSearchInput
          value={form.sport}
          onChange={(v) => set("sport", v)}
          required
        />
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

    case "dateOfBirth":
      return (
        <input
          type="date"
          autoFocus // eslint-disable-line jsx-a11y/no-autofocus
          value={form.dateOfBirth}
          onChange={(e) => set("dateOfBirth", e.target.value)}
          max={new Date(new Date().setFullYear(new Date().getFullYear() - 1)).toISOString().slice(0, 10)}
          min={new Date(new Date().setFullYear(new Date().getFullYear() - 30)).toISOString().slice(0, 10)}
          className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3.5 text-base text-slate-900 focus:border-power-orange focus:outline-none focus:ring-2 focus:ring-power-orange/20"
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

    case "trainingType":
      return (
        <FourContextCards
          options={[
            { value: "self", label: "Self-practice", context: "Playing at home or local grounds, no formal coaching" },
            { value: "club", label: "School / Club", context: "Group coaching at school or local club, 1–2x per week" },
            { value: "academy", label: "Academy", context: "Enrolled in a structured programme with regular sessions" },
            { value: "private", label: "Private coaching", context: "One-on-one sessions with a dedicated coach" },
          ]}
          value={form.trainingType}
          onChange={(v) => set("trainingType", v)}
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

    case "motorType":
      return (
        <BinaryCards
          options={[
            {
              value: "gross",
              title: "Gross motor",
              sub: "Big whole-body movements — running, jumping, throwing",
            },
            {
              value: "fine",
              title: "Fine motor",
              sub: "Precise, controlled movements — aim, balance, accuracy",
            },
          ]}
          value={form.motorType}
          onChange={(v) => set("motorType", v)}
        />
      );

    case "heightCm":
      return (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-slate-500">Height (cm)</label>
              <input
                type="number"
                min="50"
                max="220"
                placeholder="e.g., 135"
                value={form.heightCm ?? ""}
                onChange={(e) =>
                  set("heightCm", e.target.value === "" ? null : parseFloat(e.target.value))
                }
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-base text-slate-900 placeholder:text-slate-400 focus:border-power-orange focus:outline-none focus:ring-2 focus:ring-power-orange/20"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-slate-500">Weight (kg)</label>
              <input
                type="number"
                min="10"
                max="150"
                placeholder="e.g., 32"
                value={form.weightKg ?? ""}
                onChange={(e) =>
                  set("weightKg", e.target.value === "" ? null : parseFloat(e.target.value))
                }
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-base text-slate-900 placeholder:text-slate-400 focus:border-power-orange focus:outline-none focus:ring-2 focus:ring-power-orange/20"
              />
            </div>
          </div>
          {form.heightCm && form.weightKg && (
            <p className="text-center text-xs text-slate-400">
              {Math.floor(form.heightCm / 30.48)}′ {Math.round((form.heightCm / 2.54) % 12)}″ ·{" "}
              {(() => {
                const bmi = form.weightKg / ((form.heightCm / 100) ** 2);
                return bmi < 17 ? "Lean build" : bmi > 22 ? "Stocky build" : "Average build";
              })()}
            </p>
          )}
        </div>
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
  const sportEmoji = "🏅";
  const profileChips = buildProfileChips(form);
  const goalChips = buildGoalChips(form);

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

        <JourneyPipeline
          childName={form.childName || ""}
          topSport={form.sport || undefined}
        />

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
  const { token } = useAuthStore();
  const [idx, setIdx] = useState(0);
  const [done, setDone] = useState(false);
  const [form, setForm] = useState<KnownSportForm>(EMPTY_FORM);
  const [dir, setDir] = useState<1 | -1>(1);
  const [dependents, setDependents] = useState<any[]>([]);
  const [matchedDep, setMatchedDep] = useState<any | null>(null);

  // Fetch logged-in user's dependents once on mount
  useEffect(() => {
    if (!token) return;
    api.get<{ success: boolean; data: any[] }>("/auth/players")
      .then(res => {
        if (!res.data.success) return;
        setDependents((res.data.data || []).filter((p: any) => p.type === "DEPENDENT"));
      })
      .catch(() => {});
  }, [token]);

  // Match a dependent by name (+ dob when available)
  useEffect(() => {
    if (!form.childName.trim() || dependents.length === 0) {
      setMatchedDep(null);
      return;
    }
    const normName = form.childName.trim().toLowerCase();
    // Prefer name + dob match
    if (form.dateOfBirth) {
      const withDob = dependents.find(d => {
        const dDob = d.dob ? new Date(d.dob).toISOString().slice(0, 10) : null;
        return d.name?.toLowerCase() === normName && dDob === form.dateOfBirth;
      });
      if (withDob) { setMatchedDep(withDob); return; }
    }
    // Fall back to name-only match
    setMatchedDep(dependents.find(d => d.name?.toLowerCase() === normName) ?? null);
  }, [form.childName, form.dateOfBirth, dependents]);

  // Pre-fill unanswered form fields when a match is found
  useEffect(() => {
    if (!matchedDep) return;
    setForm(prev => ({
      ...prev,
      dateOfBirth: prev.dateOfBirth || (matchedDep.dob ? new Date(matchedDep.dob).toISOString().slice(0, 10) : ""),
      gender: prev.gender ?? matchedDep.gender ?? null,
      state: prev.state ?? matchedDep.location ?? null,
      experienceLevel: prev.experienceLevel ?? matchedDep.experienceLevel ?? null,
      trainingType: prev.trainingType ?? matchedDep.trainingType ?? null,
      energyType: prev.energyType ?? matchedDep.energyType ?? null,
      motorType: prev.motorType ?? matchedDep.motorType ?? null,
      heightCm: prev.heightCm ?? matchedDep.heightCm ?? null,
      weightKg: prev.weightKg ?? matchedDep.weightKg ?? null,
      ambition: prev.ambition ?? matchedDep.ambition ?? null,
      weeklyHours: prev.weeklyHours ?? matchedDep.weeklyHoursCategory ?? null,
      budgetRange: prev.budgetRange ?? matchedDep.budgetRange ?? null,
    }));
  }, [matchedDep]);

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
    if (idx < STEPS.length - 1) {
      setIdx((i) => i + 1);
    } else {
      if (token) {
        const wizardFields = {
          ...(form.sport ? { sportsFocus: [form.sport] } : {}),
          ...(form.gender ? { gender: form.gender } : {}),
          ...(form.state ? { location: form.state } : {}),
          ...(form.experienceLevel ? { experienceLevel: form.experienceLevel } : {}),
          ...(form.trainingType ? { trainingType: form.trainingType } : {}),
          ...(form.energyType ? { energyType: form.energyType } : {}),
          ...(form.motorType ? { motorType: form.motorType } : {}),
          ...(form.heightCm ? { heightCm: form.heightCm } : {}),
          ...(form.weightKg ? { weightKg: form.weightKg } : {}),
          ...(form.ambition ? { ambition: form.ambition } : {}),
          ...(form.weeklyHours ? { weeklyHoursCategory: form.weeklyHours } : {}),
          ...(form.budgetRange ? { budgetRange: form.budgetRange } : {}),
          ...(form.dateOfBirth ? { dob: form.dateOfBirth } : {}),
        };

        if (matchedDep?._id) {
          // Update the existing matched dependent
          api.put(`/auth/dependents/${matchedDep._id}`, wizardFields).catch(() => {});
        } else if (form.childName.trim()) {
          // Create a new dependent with all wizard fields in one call
          api.post("/auth/dependents", {
            name: form.childName.trim(),
            ...wizardFields,
          }).catch(() => {});
        }
      }
      setDone(true);
    }
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
    setMatchedDep(null);
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
                {matchedDep && (
                  <div className="flex items-center gap-2 rounded-xl border border-emerald-100 bg-emerald-50 px-3 py-2 text-xs text-emerald-700 mb-4">
                    <CheckCircle2 className="h-3.5 w-3.5 flex-shrink-0" />
                    Pre-filling from {matchedDep.name}&apos;s saved profile
                  </div>
                )}
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
