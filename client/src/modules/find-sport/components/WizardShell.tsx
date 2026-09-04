"use client";

import React from "react";
import { motion } from "framer-motion";
import { ArrowLeft, ArrowRight, CheckCircle, Clock } from "lucide-react";
import { ResultsView } from "./results/ResultsView";
import { SectionTransition } from "./SectionTransition";
import { QuestionScreen, ProcessingScreen } from "./wizard/WizardStepScreens";
import { SECTION_META, SECTION_ORDER, TOTAL_QUESTIONS } from "./wizard/wizardSteps";
import { useWizardShell } from "../hooks/useWizardShell";

// ─── Main wizard shell ────────────────────────────────────────────────────────

export function WizardShell() {
  const {
    token,
    answers,
    setAnswer,
    nameInput,
    setNameInput,
    nameRef,
    chosenSport,
    choosingSport,
    players,
    selectedDependentId,
    selectDependent,
    startNewChild,
    savedStatus,
    savedForName,
    results,
    chosenFits,
    stepIndex,
    direction,
    goNext,
    goBack,
    currentStep,
    progress,
    showProgress,
    showBack,
    isFullScreen,
    currentSection,
    sectionMeta,
    profileChips,
    transitionText,
    retake,
    chooseSport,
    selectedPlayer,
  } = useWizardShell();

  return (
    <div className="flex min-h-screen bg-white">
      {/* ── Left sidebar (desktop only, hidden on full-screen steps) ── */}
      {/* Outer wrapper carries the dark background and stretches to match the
          right panel's height (which can exceed one viewport, e.g. long
          multi-select lists); the inner aside stays pinned via sticky. */}
      {!isFullScreen && (
        <div className="hidden w-[320px] shrink-0 bg-slate-900 lg:block xl:w-[360px]">
          <aside className="sticky top-16 flex h-[calc(100vh-4rem)] flex-col overflow-hidden">
            {/* Brand */}
            <div className="border-b border-slate-800 px-8 pb-6 pt-8">
              <p className="text-power-orange mb-0.5 text-[11px] font-bold uppercase tracking-widest">
                PowerMySport
              </p>
              <p className="text-sm text-slate-400">Sport Assessment</p>
            </div>

            {/* Section context */}
            <div className="flex-1 overflow-y-auto px-8 py-7">
              {sectionMeta && (
                <div key={currentSection} className="animate-in fade-in duration-300">
                  {/* Section progress dots */}
                  <div className="mb-6 flex gap-1.5">
                    {SECTION_ORDER.map((s) => (
                      <div
                        key={s}
                        className={`h-1 rounded-full transition-all duration-300 ${
                          s === currentSection
                            ? "bg-power-orange w-6"
                            : SECTION_ORDER.indexOf(s) < SECTION_ORDER.indexOf(currentSection)
                              ? "w-3 bg-slate-600"
                              : "w-3 bg-slate-800"
                        }`}
                      />
                    ))}
                  </div>

                  {/* Icon */}
                  <div className="bg-power-orange/15 text-power-orange mb-5 flex h-11 w-11 items-center justify-center rounded-2xl">
                    {sectionMeta.icon}
                  </div>

                  <h2 className="font-title mb-2 text-xl font-bold leading-snug text-white">
                    {sectionMeta.title}
                  </h2>
                  <p className="text-sm leading-relaxed text-slate-400">{sectionMeta.desc}</p>
                </div>
              )}

              {/* Profile chips — grow as answers fill in */}
              {profileChips.length > 0 && (
                <div className="mt-8">
                  <p className="mb-3 text-[10px] font-semibold uppercase tracking-widest text-slate-500">
                    Profile so far
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {profileChips.map((chip) => (
                      <div
                        key={chip.label}
                        className="flex items-center gap-1.5 rounded-full bg-slate-800 px-3 py-1"
                      >
                        <span className="text-[10px] text-slate-500">{chip.label}</span>
                        <span className="text-[11px] font-semibold text-slate-200">
                          {chip.value}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Progress at bottom */}
            <div className="border-t border-slate-800 px-8 py-6">
              <div className="mb-2 flex justify-between text-xs text-slate-500">
                <span>Progress</span>
                <span className="font-medium text-slate-300">{progress}%</span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-slate-800">
                <motion.div
                  className="bg-power-orange h-full rounded-full"
                  animate={{ width: `${progress}%` }}
                  transition={{ ease: "easeOut", duration: 0.5 }}
                />
              </div>
            </div>
          </aside>
        </div>
      )}

      {/* ── Right panel ── */}
      <div className="flex min-h-screen flex-1 flex-col">
        {/* Mobile progress bar */}
        {showProgress && (
          <div className="h-1 w-full shrink-0 bg-slate-100 lg:hidden">
            <motion.div
              className="bg-power-orange h-full"
              animate={{ width: `${progress}%` }}
              transition={{ ease: "easeOut", duration: 0.4 }}
            />
          </div>
        )}

        {/* Desktop progress bar — only when no sidebar (full-screen steps) */}
        {showProgress && isFullScreen && (
          <div className="hidden h-1 w-full shrink-0 bg-slate-100 lg:block">
            <motion.div
              className="bg-power-orange h-full"
              animate={{ width: `${progress}%` }}
              transition={{ ease: "easeOut", duration: 0.4 }}
            />
          </div>
        )}

        {/* Back button */}
        {showBack && (
          <div className="flex shrink-0 items-center px-5 pt-4 lg:px-10">
            <button
              type="button"
              onClick={goBack}
              className="flex items-center gap-1.5 text-sm text-slate-400 transition-colors hover:text-slate-700"
            >
              <ArrowLeft className="h-4 w-4" />
              Back
            </button>
          </div>
        )}

        {/* Content */}
        {/* The results step is a report, not a single question — it needs the
            extra track width for side-by-side fit/gap columns and a 3-up card
            row. Welcome and processing stay narrower. */}
        <div
          className={`mx-auto w-full flex-1 px-5 py-8 lg:py-10 ${
            currentStep.kind === "results"
              ? "max-w-6xl lg:px-10 xl:px-12"
              : isFullScreen
                ? "max-w-5xl lg:px-10 xl:px-14"
                : "max-w-2xl lg:mx-0 lg:px-10 xl:px-16"
          }`}
        >
          <div
            key={stepIndex}
            className={`animate-in fade-in duration-200 ${direction >= 0 ? "slide-in-from-right-8" : "slide-in-from-left-8"}`}
          >
            {currentStep.kind === "welcome" && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.35 }}
                className="py-4"
              >
                <div className="relative flex flex-col overflow-hidden rounded-[28px] border border-slate-200/70 bg-white shadow-[0_28px_70px_-28px_rgba(15,23,42,0.22)] lg:flex-row">
                  {/* ── Left panel — branded showcase ── */}
                  <div className="flex flex-col gap-7 bg-slate-900 p-7 lg:w-[52%] lg:shrink-0 xl:w-[55%] xl:p-9">
                    {/* Brand eyebrow */}
                    <div className="flex items-center gap-2">
                      <span className="bg-power-orange/15 text-power-orange inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-bold uppercase tracking-widest">
                        <span className="bg-power-orange h-1.5 w-1.5 animate-pulse rounded-full" />
                        Sport Assessment
                      </span>
                    </div>

                    {/* Headline */}
                    <div>
                      <h1 className="font-title mb-3 text-2xl font-bold leading-tight text-white xl:text-3xl">
                        Find the right sport
                        <br />
                        for your child.
                      </h1>
                      <p className="max-w-sm text-sm leading-relaxed text-slate-400">
                        We analyse {TOTAL_QUESTIONS} data points — the same things a top sports
                        consultant would want to know.
                      </p>
                    </div>

                    {/* Trust stats */}
                    <div className="grid grid-cols-3 gap-3">
                      {[
                        { value: TOTAL_QUESTIONS.toString(), label: "Questions" },
                        { value: "5", label: "Categories" },
                        { value: "~10", label: "Minutes" },
                      ].map((stat) => (
                        <div
                          key={stat.label}
                          className="rounded-2xl border border-white/5 bg-white/[0.04] p-4 text-center"
                        >
                          <p className="font-title mb-0.5 text-2xl font-bold text-white">
                            {stat.value}
                          </p>
                          <p className="text-[11px] font-medium text-slate-500">{stat.label}</p>
                        </div>
                      ))}
                    </div>

                    {/* Category list */}
                    <div className="flex flex-col gap-2.5">
                      <p className="mb-1 text-[10px] font-bold uppercase tracking-widest text-slate-600">
                        What we evaluate
                      </p>
                      <motion.div
                        initial="hidden"
                        animate="show"
                        variants={{
                          hidden: { opacity: 0 },
                          show: {
                            opacity: 1,
                            transition: { staggerChildren: 0.07, delayChildren: 0.1 },
                          },
                        }}
                        className="grid grid-cols-2 gap-2"
                      >
                        {SECTION_ORDER.map((key, idx) => {
                          const sec = SECTION_META[key];
                          const gradients = [
                            "from-orange-500 to-amber-400",
                            "from-blue-500 to-cyan-400",
                            "from-violet-500 to-purple-400",
                            "from-rose-500 to-pink-400",
                            "from-emerald-500 to-teal-400",
                          ];
                          const isLast = idx === SECTION_ORDER.length - 1;
                          return (
                            <motion.div
                              key={key}
                              variants={{
                                hidden: { opacity: 0, y: 10 },
                                show: { opacity: 1, y: 0, transition: { duration: 0.3 } },
                              }}
                              className={`flex items-center gap-3 rounded-xl border border-white/5 bg-white/[0.04] p-3 transition-colors duration-200 hover:bg-white/[0.07] cursor-default${isLast ? "col-span-2" : ""}`}
                            >
                              <div
                                className={`h-8 w-8 rounded-lg bg-gradient-to-br ${gradients[idx]} flex shrink-0 items-center justify-center text-white shadow-sm`}
                              >
                                {React.cloneElement(
                                  sec.icon as React.ReactElement<{ className?: string }>,
                                  { className: "w-4 h-4" }
                                )}
                              </div>
                              <p className="truncate text-[12px] font-semibold leading-tight text-white">
                                {sec.title}
                              </p>
                            </motion.div>
                          );
                        })}
                      </motion.div>
                    </div>
                  </div>

                  {/* ── Right panel — CTA ── */}
                  <div className="relative flex flex-1 flex-col justify-center gap-7 overflow-hidden p-7 xl:p-9">
                    {/* Ambient glow — echoes the left panel's dark treatment without repeating it */}
                    <div className="bg-power-orange/[0.06] pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full blur-3xl" />
                    <div className="pointer-events-none absolute -bottom-24 -left-12 h-56 w-56 rounded-full bg-sky-400/[0.06] blur-3xl" />

                    <div className="relative">
                      <p className="mb-3 text-[11px] font-bold uppercase tracking-widest text-slate-400">
                        Personalised recommendation
                      </p>
                      <h2 className="font-title mb-3 text-2xl font-bold leading-snug text-slate-900">
                        Ready to find the perfect match?
                      </h2>
                      <p className="text-sm leading-relaxed text-slate-500">
                        Answer honestly — there are no right or wrong answers. The more accurate you
                        are, the better the match.
                      </p>
                    </div>

                    {/* How it works mini steps */}
                    <div className="relative flex flex-col gap-3">
                      {[
                        { step: "1", text: "Tell us about your child" },
                        { step: "2", text: "We score across 5 dimensions" },
                        { step: "3", text: "Get your personalised sport report" },
                      ].map((item) => (
                        <div key={item.step} className="flex items-center gap-3">
                          <span className="bg-power-orange/10 text-power-orange flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[12px] font-bold">
                            {item.step}
                          </span>
                          <p className="text-[13px] font-medium text-slate-600">{item.text}</p>
                        </div>
                      ))}
                    </div>

                    {/* Child picker */}
                    {players.length > 0 && (
                      <div className="relative">
                        <p className="mb-2.5 text-[11px] font-bold uppercase tracking-widest text-slate-400">
                          Who is this for?
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {players.map((p) => (
                            <button
                              key={p._id}
                              type="button"
                              onClick={() => selectDependent(p)}
                              className={`rounded-full border-2 px-4 py-2 text-sm font-semibold transition-all duration-200 ${
                                selectedDependentId === p._id
                                  ? "border-power-orange bg-power-orange text-white shadow-sm"
                                  : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
                              }`}
                            >
                              {p.name.split(" ")[0]}
                              {selectedDependentId === p._id && p.wizardCompletedAt && (
                                <span className="ml-1.5 text-[10px] opacity-75">· retake</span>
                              )}
                            </button>
                          ))}
                          {players.length > 0 && selectedDependentId && (
                            <button
                              type="button"
                              onClick={startNewChild}
                              className="rounded-full border-2 border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-500 transition-all duration-200 hover:border-slate-300"
                            >
                              Someone new
                            </button>
                          )}
                        </div>
                        {selectedDependentId && selectedPlayer?.wizardCompletedAt && (
                          <p className="mt-2 text-xs text-slate-400">
                            Answers pre-filled from previous assessment — update anything
                            that&apos;s changed.
                          </p>
                        )}
                      </div>
                    )}

                    {/* CTA */}
                    <div className="relative flex flex-col gap-3">
                      <button
                        type="button"
                        onClick={goNext}
                        className="bg-power-orange group relative flex w-full items-center justify-center gap-2 overflow-hidden rounded-2xl px-8 py-4 text-[15px] font-bold text-white shadow-[0_4px_24px_-4px_rgba(234,88,12,0.5)] transition-all duration-200 hover:bg-orange-600 hover:shadow-[0_8px_32px_-4px_rgba(234,88,12,0.6)] active:scale-[0.99]"
                      >
                        <span>
                          {selectedDependentId
                            ? `Start for ${selectedPlayer?.name.split(" ")[0]}`
                            : "Start the assessment"}
                        </span>
                        <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-1" />
                      </button>
                      <div className="flex items-center justify-center gap-4 text-[11px] text-slate-400">
                        <span className="flex items-center gap-1">
                          <CheckCircle className="h-3 w-3 text-emerald-500" /> Free
                        </span>
                        <span className="flex items-center gap-1">
                          <CheckCircle className="h-3 w-3 text-emerald-500" /> No account needed
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" /> ~10 min
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {currentStep.kind === "name" && (
              <div className="space-y-6 py-4">
                <div>
                  <h2 className="font-title mb-2 text-2xl font-bold text-slate-900">
                    Let&apos;s start. What&apos;s your child&apos;s name?
                  </h2>
                  <p className="text-sm text-slate-400">
                    Just so we can make this feel personal, not generic.
                  </p>
                </div>
                <input
                  ref={nameRef}
                  type="text"
                  placeholder="e.g. Aryan"
                  value={nameInput}
                  onChange={(e) => setNameInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && nameInput.trim()) {
                      setAnswer("childName", nameInput.trim());
                      goNext();
                    }
                  }}
                  className="focus:border-power-orange focus:ring-power-orange/15 w-full rounded-xl border border-slate-200 px-4 py-3 text-base text-slate-900 placeholder:text-slate-300 focus:outline-none focus:ring-2"
                />
                <button
                  type="button"
                  onClick={() => {
                    setAnswer("childName", nameInput.trim());
                    goNext();
                  }}
                  disabled={!nameInput.trim()}
                  className="bg-power-orange hover:bg-power-orange/90 w-full rounded-xl py-3 text-sm font-semibold text-white transition-colors disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {nameInput.trim()
                    ? `Continue with ${nameInput.trim()}`
                    : "Enter a name to continue"}
                </button>
              </div>
            )}

            {currentStep.kind === "transition" && (
              <SectionTransition
                text={transitionText(currentStep.text)}
                sub={transitionText(currentStep.sub)}
                onContinue={goNext}
              />
            )}

            {currentStep.kind === "question" && (
              <QuestionScreen
                questionKey={currentStep.questionKey}
                answers={answers}
                onAnswer={setAnswer}
                onNext={goNext}
              />
            )}

            {currentStep.kind === "processing" && <ProcessingScreen name={answers.childName} />}

            {currentStep.kind === "results" && (
              <ResultsView
                results={results}
                chosenFits={chosenFits}
                answers={answers}
                onRetake={retake}
                savedStatus={savedStatus}
                isLoggedIn={!!token}
                savedForName={savedForName}
                dependentId={selectedDependentId ?? undefined}
                chosenSport={chosenSport}
                choosingSport={choosingSport}
                onChooseSport={chooseSport}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
