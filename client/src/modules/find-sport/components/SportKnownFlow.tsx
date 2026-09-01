"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowLeft,
  CheckCircle2,
  ChevronRight,
  Map,
  MessageCircle,
  Sparkles,
  Users,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import api from "@/lib/api/axios";
import { buildStepGateFlow } from "@/flow/defineFlow";
import { useFlow } from "@/flow/useFlow";
import { useAuthStore } from "@/modules/auth/store/authStore";
import { getCommunityAppUrl } from "@/lib/community/url";
import { roadmapHref } from "../../pathway/data/sports";
import { getAmbitionOptions, getCurrentStandingLadder, getGoverningBodyName, deriveExperienceLevel } from "../data/sportArchetypes";
import { BinaryCards } from "./inputs/BinaryCards";
import { FourContextCards } from "./inputs/FourContextCards";
import { SportSearchInput } from "./inputs/SportSearchInput";
import { StateSelector } from "./inputs/StateSelector";
import { EMPTY_FORM, isAnswered } from "../utils/sportKnownFlowUtils";
import type { KnownSportForm } from "../utils/sportKnownFlowUtils";

// ─── Wizard step definitions ─────────────────────────────────────────────────

type QuestionId = keyof KnownSportForm;

interface QuestionStep {
  kind: "question";
  id: QuestionId;
  required: boolean;
  heading: (form: KnownSportForm) => string;
  sub: string | ((form: KnownSportForm) => string);
  /** When true for the current form, this step is skipped entirely during navigation. */
  skip?: (form: KnownSportForm) => boolean;
}

interface TransitionStep {
  kind: "transition";
  text: string;
  sub: string;
}

interface ResultsStep {
  kind: "results";
}

type WizardStep = QuestionStep | TransitionStep | ResultsStep;

/** How long the final save may delay the handoff to the next step before we go anyway. */
const SAVE_HANDOFF_TIMEOUT_MS = 2500;

// The 7 things a parent who already knows the sport typically needs help
// with. Purely a routing signal — it doesn't change which questions follow,
// it travels forward as context for whichever CTA (expert, in particular)
// the parent ends up choosing on the results screen.
const ISSUE_OPTIONS = [
  { value: "coach-academy", label: "Finding the right coach / academy", context: "" },
  { value: "progress", label: "Understanding my child's progress", context: "" },
  { value: "competition", label: "Starting or progressing in competition", context: "" },
  { value: "seriousness", label: "Deciding how seriously to pursue the sport", context: "" },
  { value: "wellbeing", label: "Managing training, fitness & wellbeing", context: "" },
  { value: "opportunities", label: "Exploring international / college opportunities", context: "" },
  { value: "other", label: "Something else — ask a question", context: "" },
];

const STEPS: WizardStep[] = [
  // ─── Where do you need help ──────────────────────────────────────────────
  {
    kind: "question",
    id: "issue",
    required: true,
    heading: () => "Where do you need help?",
    sub: "We'll use this to point you to the right next step.",
  },
  {
    kind: "transition",
    text: "Good. Now let's build a quick profile.",
    sub: "A handful of questions — that's all it takes.",
  },
  // ─── Identity ───────────────────────────────────────────────────────────
  {
    kind: "question",
    id: "sport",
    required: true,
    heading: () => "Which sport does your child play?",
    sub: "We'll personalise everything downstream around this sport.",
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
    sub: "Helps us show relevant academies, federations, and experts near you.",
  },
  // ─── Current standing ───────────────────────────────────────────────────
  {
    kind: "question",
    id: "currentStandingTier",
    required: true,
    heading: (f) => `What's ${f.childName || "your child"}'s current level in ${f.sport || "the sport"}?`,
    sub: (f) => {
      const body = getGoverningBodyName(f.sport);
      return body
        ? `These are the real rungs of the ${body} junior pathway — pick the closest match.`
        : "This sets the starting point for the roadmap — pick the closest match.";
    },
  },
  {
    kind: "question",
    id: "yearsPlaying",
    required: false,
    heading: (f) => `How many years has ${f.childName || "your child"} been playing ${f.sport || "this sport"}?`,
    sub: "Optional — helps us gauge their trajectory so far.",
  },
  // ─── Goals ──────────────────────────────────────────────────────────────
  {
    kind: "question",
    id: "ambition",
    required: true,
    heading: () => "What's the goal right now?",
    sub: "Sets the tone for milestones, pace, and the investment needed.",
  },
  { kind: "results" },
];

// ─── Skip-aware step navigation ──────────────────────────────────────────────

function shouldSkipStep(step: WizardStep, form: KnownSportForm): boolean {
  return step.kind === "question" && step.skip?.(form) === true;
}

function countEffectiveQuestions(steps: WizardStep[], form: KnownSportForm): number {
  return steps.filter((s) => s.kind === "question" && !s.skip?.(form)).length;
}

// The wizard steps, wired to the URL. A step is enterable only when every
// required question before it is answered (so ?step=8 in a fresh tab lands on
// the first unanswered question), and skipped steps — the conditional branches
// like the "who trains them" follow-up — are transparent to both the gate and
// navigation.
const KNOWN_SPORT_FLOW = buildStepGateFlow<KnownSportForm>(
  "known-sport",
  STEPS.length,
  (i, form) => {
    const step = STEPS[i];
    return step.kind !== "question" || !step.required || isAnswered(step.id, form);
  },
  { isStepSkipped: (i, form) => shouldSkipStep(STEPS[i], form) },
);

function questionNumberAt(steps: WizardStep[], index: number, form: KnownSportForm): number | null {
  const step = steps[index];
  if (step.kind !== "question" || step.skip?.(form)) return null;
  return steps.slice(0, index + 1).filter((s) => s.kind === "question" && !s.skip?.(form)).length;
}

// ─── Slide variants ───────────────────────────────────────────────────────────

const slide = {
  enter: (dir: number) => ({ opacity: 0, x: dir * 28 }),
  center: { opacity: 1, x: 0 },
  exit: (dir: number) => ({ opacity: 0, x: dir * -28 }),
};

// ─── Question input ───────────────────────────────────────────────────────────

const textInputClass =
  "w-full rounded-xl border border-slate-200 bg-white px-4 py-3.5 text-base text-slate-900 placeholder:text-slate-400 focus:border-power-orange focus:outline-none focus:ring-2 focus:ring-power-orange/20";

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
          className={textInputClass}
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
          className={textInputClass}
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

    case "currentStandingTier": {
      const ladder = getCurrentStandingLadder(form.sport || "");
      return (
        <FourContextCards
          options={ladder.map((t) => ({ value: String(t.value), label: t.label, context: t.context ?? "" }))}
          value={form.currentStandingTier !== null ? String(form.currentStandingTier) : null}
          onChange={(v) => set("currentStandingTier", Number(v))}
        />
      );
    }

    case "yearsPlaying":
      return (
        <input
          type="number"
          min="0"
          max="20"
          autoFocus // eslint-disable-line jsx-a11y/no-autofocus
          placeholder="e.g., 3"
          value={form.yearsPlaying ?? ""}
          onChange={(e) => set("yearsPlaying", e.target.value === "" ? null : parseFloat(e.target.value))}
          className={textInputClass}
        />
      );

    case "ambition":
      return (
        <FourContextCards
          options={getAmbitionOptions(form.sport || "")}
          value={form.ambition}
          onChange={(v) => set("ambition", v)}
        />
      );

    case "issue":
      return (
        <FourContextCards
          options={ISSUE_OPTIONS}
          value={form.issue}
          onChange={(v) => set("issue", v)}
        />
      );

    default:
      return null;
  }
}

// ─── Main export ──────────────────────────────────────────────────────────────

export function SportKnownFlow({ onBack }: { onBack: () => void }) {
  const { token } = useAuthStore();
  const [form, setForm] = useState<KnownSportForm>(EMPTY_FORM);
  // Active step lives in the URL (?step=): Back walks the questionnaire, each
  // step is linkable, and a mid-flow deep link is gated to the first unanswered
  // question and hops any skipped branch.
  const flow = useMemo(() => KNOWN_SPORT_FLOW, []);
  const {
    index: idx,
    direction: dir,
    next: goToNext,
    back: goToPrev,
  } = useFlow(flow, form);
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
      ambition: prev.ambition ?? matchedDep.ambition ?? null,
      yearsPlaying: prev.yearsPlaying ?? matchedDep.yearsPlaying ?? null,
      currentStandingTier: prev.currentStandingTier ?? matchedDep.currentStandingTier ?? null,
    }));
  }, [matchedDep]);

  const set = <K extends keyof KnownSportForm>(k: K, v: KnownSportForm[K]) =>
    setForm((p) => ({ ...p, [k]: v }));

  const current = STEPS[idx];
  const qNum = questionNumberAt(STEPS, idx, form);
  const totalQuestions = countEffectiveQuestions(STEPS, form);

  const canAdvance =
    current.kind === "transition" ||
    current.kind === "results" ||
    !current.required ||
    isAnswered(current.id, form);

  const goNext = () => {
    goToNext();
  };

  // The wizard ends on a results screen offering three ways forward (explore
  // the roadmap, ask the community, or book an expert) rather than picking one
  // for the parent. Saving still has to happen before any of those CTAs can
  // carry a real dependent brief, so it runs once, up front, on arrival —
  // raced against a short timeout so a slow or dead API delays the results
  // screen by at most a beat rather than blocking it outright.
  const saveProfile = async (): Promise<string | null> => {
    // Persist locally so /roadmap (and a guest's later login) can personalise
    // — the only durable record for guests, and for logged-in users it covers
    // the window before the dependent refetch.
    try {
      localStorage.setItem(
        "pms_sport_profile",
        JSON.stringify({ form, savedAt: new Date().toISOString() }),
      );
    } catch {}

    if (!token) return null;

    const wizardFields = {
      ...(form.sport ? { sportsFocus: [form.sport] } : {}),
      ...(form.gender ? { gender: form.gender } : {}),
      ...(form.state ? { location: form.state } : {}),
      ...(form.ambition ? { ambition: form.ambition } : {}),
      ...(form.dateOfBirth ? { dob: form.dateOfBirth } : {}),
      ...(form.yearsPlaying !== null ? { yearsPlaying: form.yearsPlaying } : {}),
      ...(form.currentStandingTier !== null
        ? {
            currentStandingTier: form.currentStandingTier,
            experienceLevel: deriveExperienceLevel(form.currentStandingTier),
          }
        : {}),
    };

    // The dependent-sharing mechanism the expert-booking CTA relies on needs a
    // named record to attach to — fall back to a generic name rather than
    // silently skipping the save when the (optional) name question was left blank.
    const name = form.childName.trim() || "My child";

    const save = matchedDep?._id
      ? api.put(`/auth/dependents/${matchedDep._id}`, wizardFields)
      : api.post("/auth/dependents", { name, ...wizardFields });

    try {
      const res = await Promise.race([
        save,
        new Promise<null>((resolve) => setTimeout(() => resolve(null), SAVE_HANDOFF_TIMEOUT_MS)),
      ]);
      const dependentId =
        (res as { data?: { data?: { _id?: string } } } | null)?.data?.data?._id ?? matchedDep?._id ?? null;
      return dependentId ?? null;
    } catch {
      return matchedDep?._id ?? null;
    }
  };

  const goPrev = () => {
    if (idx > 0) goToPrev();
    else onBack();
  };

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
                {qNum} / {totalQuestions}
              </span>
            </div>

            {/* Progress bar */}
            <div className="mb-6 h-1 rounded-full bg-slate-100 overflow-hidden">
              <div
                className="h-full rounded-full bg-power-orange transition-all duration-500"
                style={{ width: `${((qNum ?? 0) / totalQuestions) * 100}%` }}
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
                  <p className="text-sm text-slate-500">
                    {typeof current.sub === "function" ? current.sub(form) : current.sub}
                  </p>
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
                    {qNum === totalQuestions ? "Build my profile" : "Continue"}
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
            </motion.div>
          </div>
        </div>
      )}

      {/* Results — three ways forward, no single "right" answer picked for the parent */}
      {current.kind === "results" && (
        <NavigateResultsScreen form={form} saveProfile={saveProfile} onBack={goPrev} />
      )}
    </div>
  );
}

// ─── Results screen ─────────────────────────────────────────────────────────
//
// Saves the profile once on arrival (so "Connect with Expert" always has a
// real dependent to attach), then offers three equally-weighted next steps.
// The chosen issue travels along only as brief context for the expert CTA —
// it never gates which of the three options are shown.

function NavigateResultsScreen({
  form,
  saveProfile,
  onBack,
}: {
  form: KnownSportForm;
  saveProfile: () => Promise<string | null>;
  onBack: () => void;
}) {
  const router = useRouter();
  const [saving, setSaving] = useState(true);
  const [dependentId, setDependentId] = useState<string | null>(null);
  const savedOnce = useRef(false);

  useEffect(() => {
    if (savedOnce.current) return;
    savedOnce.current = true;
    saveProfile()
      .then(setDependentId)
      .finally(() => setSaving(false));
  }, [saveProfile]);

  const issueLabel = ISSUE_OPTIONS.find((o) => o.value === form.issue)?.label ?? null;

  const goToExpert = () => {
    try {
      if (dependentId) {
        localStorage.setItem(
          "pms_expert_brief",
          JSON.stringify({ dependentId, issueLabel, sport: form.sport, savedAt: new Date().toISOString() }),
        );
      }
    } catch {}
    router.push(`/booking?tab=experts${form.sport ? `&sport=${encodeURIComponent(form.sport)}` : ""}`);
  };

  const cards = [
    {
      icon: Map,
      title: "Explore Pathways",
      description: `See the full ${form.sport || "sport"} journey — stages, milestones, and what comes next.`,
      onClick: () => router.push(roadmapHref(form.sport)),
    },
    {
      icon: Users,
      title: "Ask in the Parent Community",
      description: "Post your question and hear from parents who've been through this.",
      onClick: () => router.push(getCommunityAppUrl({ path: "questions" })),
    },
    {
      icon: MessageCircle,
      title: "Connect with an Expert",
      description: issueLabel
        ? `Talk it through 1:1 — starting from "${issueLabel}".`
        : "Talk it through 1:1 with a real sports expert.",
      onClick: goToExpert,
    },
  ];

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-16">
      <div className="w-full max-w-2xl">
        <button
          type="button"
          onClick={onBack}
          className="mb-6 inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-800 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </button>
        <div className="text-center mb-8">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-power-orange/10">
            <CheckCircle2 className="h-7 w-7 text-power-orange" />
          </div>
          <h1 className="font-title text-2xl font-bold text-slate-900 mb-2">
            {form.childName ? `${form.childName}'s profile is ready` : "Profile ready"}
          </h1>
          <p className="text-sm text-slate-500">
            {saving ? "Saving…" : "Pick where you'd like to go next."}
          </p>
        </div>

        <div className="space-y-3">
          {cards.map((card) => (
            <button
              key={card.title}
              type="button"
              onClick={card.onClick}
              className="w-full text-left flex items-start gap-4 rounded-2xl border-2 border-slate-200 bg-white p-5 transition-all duration-150 hover:border-power-orange hover:shadow-sm active:scale-[0.99]"
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-power-orange/10 text-power-orange">
                <card.icon className="h-5 w-5" />
              </div>
              <div className="flex-1">
                <p className="font-semibold text-[15px] text-slate-900">{card.title}</p>
                <p className="text-xs text-slate-500 mt-0.5">{card.description}</p>
              </div>
              <ChevronRight className="h-4 w-4 text-slate-300 mt-2.5 shrink-0" />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
