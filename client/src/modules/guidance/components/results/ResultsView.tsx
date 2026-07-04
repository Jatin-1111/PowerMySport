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
  Sparkles,
  TrendingUp,
  Route,
  X,
  UserPlus,
  Users,
  ArrowRight,
} from "lucide-react";
import { motion } from "framer-motion";
import type { GuidanceSubmission } from "../../types";
import { buildFallbackJourney } from "../../utils";
import { useAuthStore } from "@/modules/auth/store/authStore";
import { JourneyMap } from "../journey/JourneyMap";
import { VerdictHero } from "./VerdictHero";
import { CostBreakdownCard } from "../shared/CostBreakdownCard";
import { BurnoutRiskCard } from "../shared/BurnoutRiskCard";

interface LevelContext {
  sport: string;
  level: number;
  levelLabel: string;
}

export function ResultsView({
  submission,
  levelContext,
}: {
  submission: GuidanceSubmission;
  levelContext?: LevelContext;
}) {
  const r = submission.response;
  const { user } = useAuthStore();
  const [bannerDismissed, setBannerDismissed] = useState(false);

  const fitnessInfo = (() => {
    const lvl = submission.query.current_fitness_level;
    if (lvl === "Low")
      return { pct: "33%", color: "bg-emerald-400", label: "Beginner" };
    if (lvl === "Moderate")
      return { pct: "66%", color: "bg-amber-400", label: "Developing" };
    return { pct: "100%", color: "bg-violet-500", label: "Advanced" };
  })();

  const hasSports = !!r.recommendedSports && r.recommendedSports.length > 0;

  // Time-phased roadmap from the AI, or synthesised from existing fields
  const journeyPhases =
    r.journeyPhases && r.journeyPhases.length > 0
      ? r.journeyPhases
      : buildFallbackJourney(r);

  // recommendedPlatformActions is one flowing string of 3-4 steps — split it
  // into a scannable checklist instead of a paragraph parents have to parse.
  const nextSteps = r.recommendedPlatformActions
    .split(/\.\s+/)
    .map((s) => s.trim().replace(/\.$/, ""))
    .filter(Boolean);

  const [profileExpanded, setProfileExpanded] = useState(false);

  return (
    <div className="flex flex-col gap-3">
      {/* The verdict, up front — this is the one thing every parent came here for */}
      {r.goalAssessment && (
        <VerdictHero
          assessment={r.goalAssessment}
          levelContext={
            levelContext
              ? {
                  sport: levelContext.sport,
                  levelLabel: levelContext.levelLabel,
                  roadmapHref: `/roadmap?sport=${encodeURIComponent(levelContext.sport)}`,
                }
              : undefined
          }
        />
      )}

      {/* Player analysis — supporting context, not the headline anymore */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4">
        <div className="flex items-center gap-3 mb-2">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-power-orange/10">
            <Compass className="h-4 w-4 text-power-orange" />
          </div>
          <h3 className="font-title text-sm font-semibold text-slate-900">
            About your child
          </h3>
        </div>

        <div className="mb-3 flex items-center gap-3 rounded-lg border border-slate-100 bg-slate-50/70 px-3 py-2">
          <p className="flex shrink-0 items-center gap-1 text-[10px] font-bold uppercase text-slate-400">
            <Activity className="h-3 w-3" /> {fitnessInfo.label}
          </p>
          <div className="h-1.5 flex-1 rounded-full bg-slate-100 overflow-hidden">
            <motion.div
              className={`h-full rounded-full ${fitnessInfo.color}`}
              initial={{ width: 0 }}
              animate={{ width: fitnessInfo.pct }}
              transition={{ delay: 0.3, duration: 0.8, ease: "easeOut" }}
            />
          </div>
        </div>

        <p className={`text-sm leading-6 text-slate-700 ${profileExpanded ? "" : "line-clamp-2"}`}>
          {r.profileAnalysis}
        </p>
        {r.profileAnalysis && r.profileAnalysis.length > 140 && (
          <button
            type="button"
            onClick={() => setProfileExpanded(!profileExpanded)}
            className="mt-1 text-xs font-semibold text-power-orange transition hover:text-orange-600"
          >
            {profileExpanded ? "Show less" : "Read more →"}
          </button>
        )}

        {/* At-a-glance facts — lets a parent double-check what they entered */}
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {[
            { icon: Activity, label: "Sport", value: submission.query.sport?.trim() || "Flexible" },
            { icon: Timer, label: "Per week", value: `${submission.query.weekly_time_commitment}h` },
            { icon: Wallet, label: "Budget", value: submission.query.budget_tier },
            { icon: MapPin, label: "Location", value: submission.query.location || "—" },
          ].map(({ icon: Icon, label, value }) => (
            <div key={label} className="rounded-xl border border-slate-100 bg-slate-50/70 p-2.5">
              <Icon className="h-3.5 w-3.5 text-slate-400" />
              <p className="mt-1.5 text-[9px] font-bold uppercase tracking-wide text-slate-400">
                {label}
              </p>
              <p className="text-xs font-bold text-slate-800 truncate" title={value}>
                {value}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Guest retention nudge — only for guests who haven't saved this plan */}
      {!user && !bannerDismissed && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-3 rounded-2xl border border-power-orange/25 bg-power-orange/5 px-4 py-3"
        >
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white">
            <UserPlus className="h-4 w-4 text-power-orange" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-bold text-slate-800">Don't lose this plan</p>
            <p className="text-[11px] text-slate-500">
              Create a free account to save it and pick up right where you left off.
            </p>
          </div>
          <Link
            href={`/register?redirect=${encodeURIComponent("/guidance")}`}
            className="shrink-0 rounded-lg bg-power-orange px-3 py-2 text-[11px] font-bold text-white hover:bg-orange-600 transition"
          >
            Save free
          </Link>
          <button
            type="button"
            onClick={() => setBannerDismissed(true)}
            aria-label="Dismiss"
            className="shrink-0 text-slate-300 hover:text-slate-500 transition"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </motion.div>
      )}

      {/* Your path forward */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <Route className="h-4 w-4 text-power-orange" />
          <h3 className="font-title font-semibold text-slate-900 text-sm uppercase tracking-wide">
            Your Path Forward
          </h3>
        </div>
        <p className="text-xs text-slate-500 mb-3">
          Here's the step-by-step plan, from today to the goal.
        </p>
        <JourneyMap
          phases={journeyPhases}
          goal={r.goalAssessment?.statedGoal || submission.query.primary_objective}
          sport={submission.query.sport}
        />
      </div>

      {/* Next steps — platform actions only, as a checklist */}
      {nextSteps.length > 0 && (
        <div className="rounded-2xl border-2 border-emerald-400 bg-emerald-50/50 p-5">
          <div className="flex items-center gap-2 mb-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-100">
              <TrendingUp className="h-4 w-4 text-emerald-700" />
            </div>
            <h3 className="font-title font-semibold text-emerald-900">
              Do This Next
            </h3>
          </div>
          <ul className="space-y-2.5">
            {nextSteps.map((step, i) => (
              <li key={i} className="flex items-start gap-2.5">
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-[10px] font-bold text-white">
                  {i + 1}
                </span>
                <span className="text-sm leading-relaxed text-emerald-900/90 font-medium">
                  {step}.
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

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
              label: "Training",
              value: r.weeklyBlueprint.trainingHours,
              color: "text-emerald-600",
              bg: "bg-emerald-50",
              border: "border-emerald-100",
            },
            {
              label: "Free Play",
              value: r.weeklyBlueprint.freePlayHours,
              color: "text-sky-600",
              bg: "bg-sky-50",
              border: "border-sky-100",
            },
            {
              label: "Rest",
              value: r.weeklyBlueprint.restDays,
              color: "text-violet-600",
              bg: "bg-violet-50",
              border: "border-violet-100",
            },
          ].map(({ label, value, color, bg, border }, i) => (
            <motion.div
              key={label}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.07 }}
              whileHover={{ y: -3 }}
              className={`rounded-2xl border ${border} ${bg} p-4 transition-shadow hover:shadow-md`}
            >
              <span className={`mb-2 flex h-8 w-8 items-center justify-center rounded-xl bg-white/70 ${color}`}>
                <Timer className="h-4 w-4" />
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

      {/* Investment */}
      {r.costBreakdown && <CostBreakdownCard c={r.costBreakdown} />}

      {/* Burnout risk — self-hides when risk level is low */}
      {r.burnoutRisk && <BurnoutRiskCard risk={r.burnoutRisk} />}

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

      {/* Experts CTA — human guidance to complement the AI plan */}
      <div className="rounded-2xl border border-blue-200 bg-blue-50/50 p-5">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-100">
            <Users className="h-5 w-5 text-blue-600" />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="font-title text-sm font-bold text-slate-900">
              Want a real expert to weigh in?
            </h3>
            <p className="mt-0.5 text-xs text-slate-500">
              Our Experts platform connects you with experienced coaches for personalised, one-on-one guidance.
            </p>
          </div>
        </div>
        <Link
          href="/experts"
          className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-xs font-bold text-white transition hover:bg-blue-700 sm:w-auto"
        >
          Explore Experts
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>

      {/* Low-key footer links — primary actions live in the sticky bar */}
      <div className="flex items-center justify-center gap-4 pt-2 pb-1">
        <a
          href={process.env.NEXT_PUBLIC_MAIN_APP_URL || "http://localhost:3000"}
          className="text-xs font-semibold text-slate-400 hover:text-power-orange transition"
        >
          Explore Programs
        </a>
        <span className="text-slate-200">·</span>
        <a href="/roadmap" className="text-xs font-semibold text-slate-400 hover:text-power-orange transition">
          View Roadmap
        </a>
      </div>
    </div>
  );
}
