"use client";

import { Suspense, useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  BrainCircuit,
  Star,
  Trophy,
  Loader2,
  ChevronLeft,
  ChevronRight,
  Info,
  MessageCircle,
  Sparkles,
  Download,
  Users,
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
import { GuidanceChatDrawer } from "@/modules/guidance/components/chat/GuidanceChatDrawer";
import { LoginRequiredModal } from "@/modules/guidance/components/chat/LoginRequiredModal";
import { useAuthStore } from "@/modules/auth/store/authStore";
import { downloadGuidanceReportPdf } from "@/modules/guidance/services/guidance";
import { toast } from "@/lib/toast";

// ─── Inner component (needs useSearchParams) ──────────────────────────────────

function GuidancePageInner() {
  const searchParams = useSearchParams();
  const initialSport = searchParams.get("sport") ?? undefined;
  const initialLevelRaw = searchParams.get("level");
  const initialLevel = initialLevelRaw ? Number(initialLevelRaw) : undefined;
  const initialMode = searchParams.get("mode") ?? undefined;
  const initialLevelLabel = searchParams.get("levelLabel") ?? undefined;
  const isLevelPlan = initialMode === "level-plan" && !!initialSport && !!initialLevel;
  const levelContext =
    isLevelPlan && initialSport && initialLevel && initialLevelLabel
      ? { sport: initialSport, level: initialLevel, levelLabel: initialLevelLabel }
      : undefined;
  // openChat: post-login redirect param — auto-opens chat drawer
  const openChatParam = searchParams.get("openChat") === "1";
  // submissionId: if returning from login with an existing submission
  const submissionIdParam = searchParams.get("submissionId") ?? null;

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
  } = useGuidanceForm({ initialSport, initialLevel, initialLevelLabel });

  // Mirrors Step1Profile's "Already here" toggle (which sets
  // current_pathway_level = initialLevel) so the header/subtitle framing
  // matches whether this is a "should we start" or "how do we progress" plan.
  const alreadyAtLevel = isLevelPlan && form.current_pathway_level === initialLevel;

  const [error, setError] = useState<string | null>(null);
  const { user } = useAuthStore();
  const [chatOpen, setChatOpen] = useState(false);
  const [loginModalOpen, setLoginModalOpen] = useState(false);
  const [downloadingPdf, setDownloadingPdf] = useState(false);

  // If returning from login with openChat=1 and a submissionId in the URL,
  // we need to load that submission and auto-open the chat.
  // We rely on the fact that if the user just logged in, submission state may be empty.
  // In this case we fire a GET to load the submission details from the history API.
  useEffect(() => {
    if (openChatParam && submissionIdParam) {
      // If we already have the submission in state, open chat immediately
      if (submission?.id === submissionIdParam) {
        setChatOpen(true);
        return;
      }
      // Otherwise load it from history
      import("@/lib/api/axios").then(({ default: api }) => {
        api
          .get("/guidance")
          .then((res) => {
            if (res.data.success && Array.isArray(res.data.data)) {
              const found = res.data.data.find(
                (s: any) => s.id === submissionIdParam,
              );
              if (found) {
                setSubmission(found);
                setShowResults(true);
                setTimeout(() => setChatOpen(true), 400);
              }
            }
          })
          .catch(() => {});
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openChatParam, submissionIdParam]);

  const handleChatClick = () => {
    if (!user) {
      setLoginModalOpen(true);
    } else {
      setChatOpen(true);
    }
  };

  const handleDownloadPdf = async () => {
    if (!submission) return;
    setDownloadingPdf(true);
    try {
      await downloadGuidanceReportPdf(submission.id);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unable to download report";
      toast.error(msg);
    } finally {
      setDownloadingPdf(false);
    }
  };

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
    <div className="relative min-h-screen px-4 pt-4 pb-6 sm:px-6 sm:pt-5 lg:px-8">
      {/* Ambient background */}
      <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-orange-50/50 via-white to-slate-50" />
        <div className="absolute -left-32 -top-10 h-[28rem] w-[28rem] rounded-full bg-power-orange/10 blur-3xl" />
        <div className="absolute right-[-6rem] top-40 h-80 w-80 rounded-full bg-amber-200/30 blur-3xl" />
        <div className="absolute bottom-0 left-1/3 h-72 w-72 rounded-full bg-indigo-200/20 blur-3xl" />
      </div>

      <div className="mx-auto w-full max-w-4xl">

        {/* ── Compact header ── */}
        <div className="pb-3">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/70 bg-white/85 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-widest text-slate-500 shadow-sm backdrop-blur">
              <BrainCircuit className="h-3.5 w-3.5 text-power-orange" />
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

          <h1 className="font-title text-xl font-bold leading-tight tracking-tight sm:text-2xl">
            {isLevelPlan ? (
              alreadyAtLevel ? (
                <>Your {initialLevelLabel} level{" "}<span className="text-power-orange">progress plan.</span></>
              ) : (
                <>Your {initialLevelLabel} level{" "}<span className="text-power-orange">decision guide.</span></>
              )
            ) : (
              <>Get a structured sports roadmap for your{" "}<span className="text-power-orange">young athlete.</span></>
            )}
          </h1>

          {initialSport && (
            <div className="mt-1 flex items-center gap-2">
              <span className="text-xs text-slate-500">Pre-filled with sport:</span>
              <span className="text-xs font-semibold text-slate-800">{initialSport}</span>
              <AutofillBadge />
            </div>
          )}

          {/* Subtitle only in input mode — results have the summary bar instead */}
          {mode === "input" && (
            <p className="mt-1 text-xs leading-relaxed text-slate-500">
              {isLevelPlan
                ? alreadyAtLevel
                  ? `Tell us a little about your child and we'll map out what to focus on next at ${initialLevelLabel} ${initialSport} — and what progress should look like.`
                  : `Tell us a little about your child and we'll tell you if ${initialLevelLabel} ${initialSport} is right for them — and what the first 90 days look like.`
                : "Answer four quick steps — we'll return personalised guidance on sport, coaching style, weekly schedule, and next actions."}
            </p>
          )}
        </div>

        {/* ── Content ── */}
        <div>
          <AnimatePresence mode="wait">
          {mode === "results" && submission ? (
            <motion.div
              key="results"
              ref={resultsRef}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.25 }}
            >
              <div className="rounded-3xl border border-slate-200/80 bg-white/95 shadow-[0_10px_40px_-18px_rgba(15,23,42,0.25)] ring-1 ring-slate-900/[0.03] backdrop-blur-sm">
                {/* Inputs row — inside card top, replaces separate summary bar + "Your Roadmap" heading */}
                <div className="border-b border-slate-100 px-4 pt-3 sm:px-5">
                  <InputsSummaryBar query={submission.query} onEdit={editInputs} />
                </div>
                <div className="p-4 pb-24 sm:p-5 sm:pb-24">
                  <ResultsView
                    key={submission.id}
                    submission={submission}
                    levelContext={levelContext}
                  />
                </div>
              </div>
            </motion.div>
          ) : loading ? (
            <motion.div
              key="loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
            >
              <div className="rounded-3xl border border-slate-200/80 bg-white/95 p-5 shadow-[0_10px_40px_-18px_rgba(15,23,42,0.25)] ring-1 ring-slate-900/[0.03] backdrop-blur-sm sm:p-6">
                <div className="mb-5 flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-power-orange/10">
                    <Loader2 className="h-5 w-5 animate-spin text-power-orange" />
                  </div>
                  <div>
                    <p className="font-semibold text-slate-900">Building your roadmap…</p>
                    <p className="text-xs text-slate-500 mt-0.5">AI is analyzing the profile</p>
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
            >
            {levelContext && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="mb-3 flex items-center gap-4 rounded-2xl border border-orange-100 bg-orange-50/80 px-5 py-4"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-power-orange/15">
                  <Sparkles className="h-5 w-5 text-power-orange" />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-power-orange/70">
                    Planning for
                  </p>
                  <p className="font-title font-bold text-slate-900 truncate">
                    {levelContext.sport} · {levelContext.levelLabel} Level
                  </p>
                </div>
                <div className="ml-auto text-right shrink-0">
                  <p className="text-[10px] text-slate-400 font-medium">2 minutes</p>
                  <p className="text-xs font-semibold text-slate-600">then your personalised plan</p>
                </div>
              </motion.div>
            )}
              {/* ── Wizard Card ── */}
              <div className="rounded-3xl border border-slate-200/80 bg-white/95 p-5 shadow-[0_10px_40px_-18px_rgba(15,23,42,0.25)] ring-1 ring-slate-900/[0.03] backdrop-blur-sm sm:p-6 z-10">
                <StepIndicator current={step} steps={STEPS} />

                <AnimatePresence mode="wait">
                  {step === 1 && (
                    <Step1Profile
                      key="step1"
                      form={form}
                      update={update}
                      players={players}
                      selectedId={selectedProfileId}
                      onSelectPlayer={handleProfileSelect}
                      levelContext={levelContext}
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
                <div className="mt-5 flex gap-3">
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

                <p className="mt-3 text-center text-xs text-slate-400">
                  Step {step} of {STEPS.length}
                  {step < 4 ? " · " : " · Ready to generate "}
                  {step < 4 && `${STEPS.length - step} more to go`}
                </p>
              </div>
            </motion.div>
          )}
          </AnimatePresence>
        </div>

      </div>

      {/* ── Sticky action bar — always-visible retention surface while viewing results ── */}
      {mode === "results" && submission && (
        <div
          className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/90 px-4 py-3 shadow-[0_-4px_20px_-8px_rgba(15,23,42,0.15)] backdrop-blur-md sm:px-6"
          style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
        >
          <div className="mx-auto flex max-w-4xl items-center gap-2.5">
            <Link
              href="/experts"
              className="flex flex-[2] items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-3 text-sm font-bold text-white shadow-[0_4px_14px_-4px_rgba(37,99,235,0.5)] transition-all hover:shadow-[0_6px_18px_-4px_rgba(37,99,235,0.65)] active:scale-[0.98]"
            >
              <Users className="h-4 w-4" />
              <span className="hidden sm:inline">Explore Experts</span>
              <span className="sm:hidden">Experts</span>
            </Link>
            <button
              id="chat-with-coach-btn"
              type="button"
              onClick={handleChatClick}
              className="flex flex-[2] items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 px-4 py-3 text-sm font-bold text-white shadow-[0_4px_14px_-4px_rgba(233,115,22,0.5)] transition-all hover:shadow-[0_6px_18px_-4px_rgba(233,115,22,0.65)] active:scale-[0.98]"
            >
              <MessageCircle className="h-4 w-4" />
              <span className="hidden sm:inline">Chat with Coach</span>
              <span className="sm:hidden">Chat</span>
            </button>
            <button
              type="button"
              onClick={handleDownloadPdf}
              disabled={downloadingPdf}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl border-2 border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 disabled:opacity-50"
              title="Download PDF"
            >
              {downloadingPdf ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Download className="h-4 w-4" />
              )}
              <span className="hidden sm:inline">PDF</span>
            </button>
          </div>
        </div>
      )}

      {/* ── Achievement Toast ── */}
      <AnimatePresence>
        {achievement && (
          <div className="fixed bottom-6 right-6 z-50">
            <AchievementToast label={achievement} />
          </div>
        )}
      </AnimatePresence>

      {/* ── Chat Drawer (authenticated users) ── */}
      {submission && chatOpen && (
        <GuidanceChatDrawer
          isOpen={chatOpen}
          onClose={() => setChatOpen(false)}
          submission={submission}
        />
      )}

      {/* ── Login Required Modal (guest users) ── */}
      {submission && (
        <LoginRequiredModal
          isOpen={loginModalOpen}
          onClose={() => setLoginModalOpen(false)}
          sport={submission.query.sport}
          redirectPath={`/guidance?submissionId=${submission.id}&openChat=1`}
        />
      )}
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
