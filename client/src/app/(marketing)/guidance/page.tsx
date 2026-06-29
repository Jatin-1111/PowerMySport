"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  BrainCircuit,
  Star,
  Trophy,
  Loader2,
  Medal,
  ChevronLeft,
  ChevronRight,
  Info,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

import { useGuidanceForm } from "@/modules/guidance/hooks/useGuidanceForm";
import { useGuidanceHistory } from "@/modules/guidance/hooks/useGuidanceHistory";
import { STEPS, isFormValid, getMissingFields } from "@/modules/guidance/constants";
import { AutofillBadge } from "@/modules/guidance/components/shared/AutofillBadge";
import { AchievementToast } from "@/modules/guidance/components/shared/AchievementToast";
import { PastRoadmapsDropdown } from "@/modules/guidance/components/shared/PastRoadmapsDropdown";
import { StepIndicator } from "@/modules/guidance/components/shared/StepIndicator";
import { ResultSkeleton } from "@/modules/guidance/components/shared/Skeletons";
import { InputsSummaryBar } from "@/modules/guidance/components/shared/InputsSummaryBar";
import { Step1Profile } from "@/modules/guidance/components/wizard/Step1Profile";
import { Step2Goals } from "@/modules/guidance/components/wizard/Step2Goals";
import { Step3Lifestyle } from "@/modules/guidance/components/wizard/Step3Lifestyle";
import { Step4Details } from "@/modules/guidance/components/wizard/Step4Details";
import { ResultsView } from "@/modules/guidance/components/results/ResultsView";

// ─── Inner component (needs useSearchParams) ──────────────────────────────────

function GuidancePageInner() {
  const searchParams = useSearchParams();
  const initialSport = searchParams.get("sport") ?? undefined;
  const initialLevelRaw = searchParams.get("level");
  const initialLevel = initialLevelRaw ? Number(initialLevelRaw) : undefined;

  const {
    form,
    setForm,
    step,
    loading,
    submission,
    setSubmission,
    players,
    selectedProfileId,
    achievement,
    showResults,
    setShowResults,
    autofillFields,
    resultsRef,
    update,
    handleProfileSelect,
    nextStep,
    prevStep,
    handleSubmit,
    resetForm,
    editInputs,
  } = useGuidanceForm({ initialSport, initialLevel });

  const [error, setError] = useState<string | null>(null);

  const { history, setHistory, deletingId, handleDeleteRoadmap, loadPastSubmission } =
    useGuidanceHistory({
      setSubmission,
      setShowResults,
      resultsRef,
      currentSubmissionId: submission?.id,
      onLoadPast: (past) => setForm(past.query),
    });

  const onSubmit = async () => {
    setError(null);
    try {
      await handleSubmit((newSub) => {
        setHistory((prev) => [newSub, ...prev]);
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unable to generate guidance.";
      setError(msg);
    }
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
            {/* STEP 5e — show AutofillBadge when initialSport is set */}
            {initialSport && (
              <div className="mt-2 flex items-center gap-2">
                <span className="text-sm text-slate-600">Pre-filled with sport:</span>
                <span className="font-semibold text-slate-800">{initialSport}</span>
                <AutofillBadge />
              </div>
            )}
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
                      onClick={onSubmit}
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

// ─── Default export (wraps inner in Suspense for useSearchParams) ─────────────

export default function GuidancePage() {
  return (
    <Suspense fallback={null}>
      <GuidancePageInner />
    </Suspense>
  );
}
