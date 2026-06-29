"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Compass,
  Activity,
  Timer,
  Wallet,
  MapPin,
  Trophy,
  BarChart3,
  UserCircle2,
  Brain,
  ShieldCheck,
  Route,
  Dumbbell,
  Zap,
  Sparkles,
  TrendingUp,
  Crosshair,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import type { GuidanceSubmission } from "../../types";
import { buildFallbackJourney } from "../../utils";
import { JourneyMap } from "../journey/JourneyMap";
import { GoalAssessmentCard } from "../shared/GoalAssessmentCard";
import { CostBreakdownCard } from "../shared/CostBreakdownCard";
import { MentalSkillsCard } from "../shared/MentalSkillsCard";
import { TalentIdentifiersCard } from "../shared/TalentIdentifiersCard";
import { BurnoutRiskCard } from "../shared/BurnoutRiskCard";
import { MultiSportAdvisoryCard } from "../shared/MultiSportAdvisoryCard";

export function ResultsView({ submission }: { submission: GuidanceSubmission }) {
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
              <>
                {/* STEP 2a — GoalAssessmentCard above JourneyMap */}
                {r.goalAssessment && (
                  <GoalAssessmentCard a={r.goalAssessment} />
                )}
                <JourneyMap
                  phases={journeyPhases}
                  submissionId={submission.id}
                  goal={submission.query.primary_objective}
                  goalDetail={submission.query.parent_specific_question}
                  assessment={undefined}
                  sport={submission.query.sport}
                />
              </>
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

                    {/* STEP 5a — Explore pathway chips */}
                    {r.recommendedSports && r.recommendedSports.length > 0 && (
                      <div className="flex flex-wrap gap-2 mt-3">
                        {r.recommendedSports.map((sportName) => (
                          <Link
                            key={sportName}
                            href={`/roadmap?sport=${encodeURIComponent(sportName)}&age=${submission.query.child_age}&budget=${encodeURIComponent(submission.query.budget_tier)}&state=${encodeURIComponent(submission.query.location)}`}
                            className="inline-flex items-center gap-1.5 rounded-xl border border-power-orange/20 bg-power-orange/5 px-3 py-2 text-xs font-semibold text-power-orange hover:bg-power-orange/10 transition"
                          >
                            <MapPin className="h-3.5 w-3.5" />
                            Explore {sportName} pathway →
                          </Link>
                        ))}
                      </div>
                    )}
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
          View Roadmap
        </a>
      </div>
    </div>
  );
}
