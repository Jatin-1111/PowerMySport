import api from "@/lib/api/axios";
import { toast } from "@/lib/toast";
import { useAuthStore } from "@/modules/auth/store/authStore";
import { getAgeFromDob } from "@/modules/find-sport/utils/sportKnownFlowUtils";
import { useFlow } from "@/flow/useFlow";
import type { GuidanceSubmission } from "@/modules/guidance/types";
import {
  buildPayload,
  EMPTY_FORM,
  type ConsultForm,
  type ProblemId,
} from "@/modules/guidance/config/wizard/guidanceUtils";
import { QuestionInput } from "@/modules/guidance/components/wizard/QuestionInput";
import { LoadingView, ResultsScreen } from "@/modules/guidance/components/wizard/ResultsScreen";
import {
  buildGuidanceFlow,
  getStepQNums,
  getTotalQuestions,
  isAnswered,
  PROBLEM_TYPES,
  WIZARD_STEPS,
  ConsultField,
} from "@/modules/guidance/config/wizard/wizardConfig";
import { ArrowLeft, ChevronRight, Loader2, Sparkles } from "lucide-react";
import { motion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";

type PreFillPhase = "loading" | "select" | "ready";

/**
 * The active problem's question wizard — extracted from
 * `app/(marketing)/guidance/page.tsx`. No behavior changed, only location.
 */
export function ProblemWizardInner({
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
  const [loading, setLoading] = useState(false);
  const [submission, setSubmission] = useState<GuidanceSubmission | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dependents, setDependents] = useState<any[]>([]);
  const [selectedDependentId, setSelectedDependentId] = useState<string | null>(null);
  const [preFillPhase, setPreFillPhase] = useState<PreFillPhase>(token ? "loading" : "ready");

  useEffect(() => {
    if (!token) return;
    const timeout = setTimeout(() => setPreFillPhase("ready"), 1500);
    api
      .get<{ success: boolean; data: any[] }>("/auth/players")
      .then((res) => {
        clearTimeout(timeout);
        const deps = (res.data.data || []).filter((p: any) => p.type === "DEPENDENT");
        setDependents(deps);
        // Always show the picker when there's at least one dependent — even
        // with exactly one, the parent needs the "Continue without selecting"
        // option (e.g. this query is about a different child).
        setPreFillPhase(deps.length > 0 ? "select" : "ready");
      })
      .catch(() => {
        clearTimeout(timeout);
        setPreFillPhase("ready");
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  function applyDependent(dep: any) {
    setForm((prev) => {
      const age = dep.dob ? getAgeFromDob(new Date(dep.dob).toISOString().slice(0, 10)) : null;
      return {
        ...prev,
        sport: prev.sport || dep.sportsFocus?.[0] || prev.sport,
        age: prev.age || (age ? String(age) : prev.age),
        // Only carry over MALE/FEMALE — the gender question offers just those
        // two options, so an "OTHER" profile value must stay unset and force
        // an explicit answer rather than silently failing to pre-fill.
        gender:
          prev.gender ?? (dep.gender === "MALE" || dep.gender === "FEMALE" ? dep.gender : null),
        state: prev.state ?? dep.location ?? null,
        experienceLevel: prev.experienceLevel ?? dep.experienceLevel ?? null,
        weeklyHours: prev.weeklyHours ?? dep.weeklyHoursCategory ?? null,
        budgetRange: prev.budgetRange ?? dep.budgetRange ?? null,
      };
    });
  }

  const set = <K extends ConsultField>(k: K, v: ConsultForm[K]) =>
    setForm((p) => ({ ...p, [k]: v }));

  // The active step lives in the URL (?step=), so the browser Back button walks
  // the questionnaire instead of leaving it, each step is linkable for
  // analytics, and a mid-flow entry is gated to the first unanswered question.
  const flow = useMemo(() => buildGuidanceFlow(problemId), [problemId]);
  const {
    index: idx,
    isLast: isLastStep,
    direction: dir,
    next: goToNextStep,
    back: goToPrevStep,
    goToStep,
  } = useFlow(flow, form);

  const current = steps[idx];
  const qNum = qNums[idx];

  const canAdvance =
    current.kind === "transition" || !current.required || isAnswered(current.id, form);

  const goNext = () => {
    setError(null);
    if (!isLastStep) {
      goToNextStep();
    } else {
      handleSubmit();
    }
  };

  const goPrev = () => {
    // At the first step, "back" leaves the wizard to the picker rather than
    // clamping in place.
    if (idx > 0) goToPrevStep();
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
        toast.error(`${sportName} pathway isn't available yet. Try Cricket, Tennis, or Football.`, {
          duration: 6000,
        } as Parameters<typeof toast.error>[1]);
        setLoading(false);
        return;
      }

      // Sync shared profile fields back to the matched dependent
      if (selectedDependentId) {
        api
          .put(`/auth/dependents/${selectedDependentId}`, {
            ...(form.sport ? { sportsFocus: [form.sport] } : {}),
            ...(form.gender ? { gender: form.gender } : {}),
            ...(form.state ? { location: form.state } : {}),
            ...(form.experienceLevel ? { experienceLevel: form.experienceLevel } : {}),
            ...(form.weeklyHours ? { weeklyHoursCategory: form.weeklyHours } : {}),
            ...(form.budgetRange ? { budgetRange: form.budgetRange } : {}),
          })
          .catch(() => {});
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
    goToStep(1);
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
      <div className="relative flex min-h-screen items-center justify-center">
        <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-b from-orange-50/50 via-white to-slate-50" />
        </div>
        <Loader2 className="text-power-orange h-6 w-6 animate-spin" />
      </div>
    );
  }

  // Dependent selector for users with multiple children
  if (preFillPhase === "select") {
    return (
      <div className="relative flex min-h-screen items-center justify-center px-4">
        <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-b from-orange-50/50 via-white to-slate-50" />
          <div className="bg-power-orange/8 absolute -left-32 top-10 h-96 w-96 rounded-full blur-3xl" />
        </div>
        <div className="w-full max-w-sm">
          <button
            type="button"
            onClick={onBack}
            className="mb-8 inline-flex items-center gap-1.5 text-sm font-medium text-slate-400 transition-colors hover:text-slate-700"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back
          </button>
          <h2 className="font-title mb-2 text-2xl font-bold text-slate-900">Who is this for?</h2>
          <p className="mb-6 text-sm text-slate-500">
            Select a child to pre-fill their details, or continue manually.
          </p>
          <div className="space-y-3">
            {dependents.map((dep) => {
              const age = dep.dob
                ? getAgeFromDob(new Date(dep.dob).toISOString().slice(0, 10))
                : null;
              return (
                <button
                  key={dep._id}
                  type="button"
                  onClick={() => {
                    applyDependent(dep);
                    setSelectedDependentId(dep._id);
                    setPreFillPhase("ready");
                  }}
                  className="hover:border-power-orange flex w-full items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-3.5 text-left text-sm font-medium text-slate-900 shadow-sm transition hover:bg-orange-50"
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
        <div className="bg-power-orange/8 absolute -left-32 -top-10 h-[28rem] w-[28rem] rounded-full blur-3xl" />
        <div className="absolute right-[-6rem] top-40 h-80 w-80 rounded-full bg-amber-200/20 blur-3xl" />
      </div>

      {/* Transition card */}
      {current.kind === "transition" && (
        <motion.div
          key={idx}
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.25 }}
          className="flex min-h-screen items-center justify-center px-4"
        >
          <div className="max-w-xs text-center">
            <button
              type="button"
              onClick={goPrev}
              className="mb-8 inline-flex items-center gap-1.5 text-sm font-medium text-slate-400 transition-colors hover:text-slate-700"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Back
            </button>
            <div className="bg-power-orange/10 mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl">
              <Sparkles className="text-power-orange h-7 w-7" />
            </div>
            <h2 className="font-title mb-2 text-2xl font-bold text-slate-900">{current.text}</h2>
            <p className="mb-8 text-sm text-slate-500">{current.sub}</p>
            <button
              type="button"
              onClick={goNext}
              className="bg-power-orange inline-flex items-center gap-2 rounded-xl px-6 py-3 text-sm font-bold text-white shadow-[0_4px_14px_-4px_rgba(233,115,22,0.45)] transition hover:bg-orange-600 active:scale-[0.98]"
            >
              Continue
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </motion.div>
      )}

      {/* Question card */}
      {current.kind === "question" && (
        <div className="px-4 pb-10 pt-6 sm:px-6">
          <div className="mx-auto w-full max-w-2xl">
            {levelPlanLabel && (
              <div className="mb-4 flex items-center gap-2 rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-2.5">
                <Sparkles className="h-3.5 w-3.5 shrink-0 text-indigo-500" />
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
                className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 transition-colors hover:text-slate-800"
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
            <div className="mb-6 h-1 overflow-hidden rounded-full bg-slate-100">
              <div
                className="bg-power-orange h-full rounded-full transition-all duration-500"
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
                <h2 className="font-title mb-1.5 text-xl font-bold text-slate-900">
                  {current.heading(form)}
                </h2>
                <p className="text-sm text-slate-500">{current.sub}</p>
              </div>

              <QuestionInput id={current.id} form={form} set={set} problemId={problemId} />

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
                    className="text-sm font-medium text-slate-400 transition-colors hover:text-slate-600"
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
                  className="bg-power-orange inline-flex items-center gap-2 rounded-xl px-6 py-3 text-sm font-bold text-white shadow-[0_4px_14px_-4px_rgba(233,115,22,0.45)] transition hover:bg-orange-600 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none"
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
