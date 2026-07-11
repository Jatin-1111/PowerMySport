"use client";

import { AIDisclaimer } from "@/components/shared/AIDisclaimer";
import { WhatsAppIcon } from "@/components/layout/WhatsAppButton";
import { useAuthStore } from "@/modules/auth/store/authStore";
import { motion } from "framer-motion";
import {
    ArrowRight,
    CalendarCheck,
    Download,
    Loader2,
    MessageCircle,
    Route,
    Sparkles,
    TrendingUp,
    Trophy,
    UserPlus,
    Users,
    X,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import type { GuidanceSubmission } from "../../types";
import { buildFallbackJourney } from "../../utils";
import { JourneyMap } from "../journey/JourneyMap";
import { BurnoutRiskCard } from "../shared/BurnoutRiskCard";
import { CostBreakdownCard } from "../shared/CostBreakdownCard";
import { VerdictHero } from "./VerdictHero";

function getActionUrl(step: string, sport?: string): string | null {
  const s = step.toLowerCase();
  const sportParam = sport ? `?sport=${encodeURIComponent(sport)}` : "";
  if (s.includes("coach") || s.includes("session") || s.includes("book")) return "/book";
  if (s.includes("communit") || s.includes("parent")) return "/community";
  if (s.includes("tournament") || s.includes("compet") || s.includes("opportunit")) return `/roadmap${sportParam}`;
  if (s.includes("roadmap") || s.includes("pathway")) return `/roadmap${sportParam}`;
  if (s.includes("guidance") || s.includes("assessment") || s.includes("personalised")) return "/guidance";
  return null;
}

interface LevelContext {
  sport: string;
  level: number;
  levelLabel: string;
}

interface ResultsActions {
  onChatClick: () => void;
  onDownloadPdf: () => void;
  downloadingPdf: boolean;
  waUrl: string;
}

export function ResultsView({
  submission,
  levelContext,
  actions,
}: {
  submission: GuidanceSubmission;
  levelContext?: LevelContext;
  actions?: ResultsActions;
}) {
  const r = submission.response;
  const { user } = useAuthStore();
  const [bannerDismissed, setBannerDismissed] = useState(false);

  const hasSports = !!r.recommendedSports && r.recommendedSports.length > 0;

  // true when the parent came from a level-plan page and chose "already here"
  const alreadyAtLevel = !!(
    levelContext && submission.query.current_pathway_level === levelContext.level
  );

  // Time-phased roadmap from the AI, or synthesised from existing fields
  const journeyPhases =
    r.journeyPhases && r.journeyPhases.length > 0
      ? r.journeyPhases
      : buildFallbackJourney(r);

  // recommendedPlatformActions might come as a single paragraph, newlines, or numbered lists.
  // We split by sentence boundaries or newlines, then strip any leading bullets, numbers, or dashes.
  const nextSteps = r.recommendedPlatformActions
    .split(/(?:\.\s+|\n+)/)
    .map((s) =>
      s
        .trim()
        .replace(/^[\d\-\*\•]+[\.\)]?\s*/, "")
        .replace(/\.$/, ""),
    )
    .filter((s) => s.length > 3);

  return (
    <div className="flex flex-col gap-5 sm:gap-6">
      <AIDisclaimer variant="guidance" />
      {/* The verdict, up front — this is the one thing every parent came here for */}
      {r.goalAssessment && (
        <VerdictHero
          assessment={r.goalAssessment}
          alreadyAtLevel={alreadyAtLevel}
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
            <p className="text-xs font-bold text-slate-800">
              Don't lose this plan
            </p>
            <p className="text-[11px] text-slate-500">
              Create a free account to save it and pick up right where you left
              off.
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
      <div className="rounded-3xl border border-slate-200/60 bg-white p-5 sm:p-6 shadow-sm">
        <div className="flex items-center gap-3 mb-5">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-orange-50">
            <Route className="h-5 w-5 text-power-orange" />
          </div>
          <div>
            <h3 className="font-title text-lg font-bold text-slate-900 leading-tight">
              Your Path Forward
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Step-by-step from today to the goal
            </p>
          </div>
        </div>
        <JourneyMap
          phases={journeyPhases}
          goal={
            r.goalAssessment?.statedGoal || submission.query.primary_objective
          }
          sport={submission.query.sport}
        />
      </div>

      {/* Investment Estimate — before action list so parents know the cost context */}
      {r.costBreakdown && <CostBreakdownCard c={r.costBreakdown} />}

      {/* Do This Next */}
      <div className="rounded-3xl border border-slate-200/60 bg-white p-5 sm:p-6 shadow-sm">
        <div className="flex items-center gap-3 mb-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50">
            <TrendingUp className="h-5 w-5 text-emerald-600" />
          </div>
          <div>
            <h3 className="font-title text-lg font-bold text-slate-900 leading-tight">
              Do This Next
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Immediate actions on PowerMySport
            </p>
          </div>
        </div>
        {actions ? (
          <div className="grid grid-cols-2 gap-3">
            {/* Book an Expert */}
            <Link
              href="/experts"
              className="group flex flex-col items-start gap-3 rounded-2xl border border-orange-100 bg-orange-50 p-4 transition hover:border-orange-200 hover:bg-orange-100/60 cursor-pointer"
            >
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-orange-100 group-hover:bg-orange-200/70 transition">
                <CalendarCheck className="h-4 w-4 text-orange-600" />
              </div>
              <div>
                <p className="text-[13px] font-bold leading-tight text-slate-800">Book an Expert</p>
                <p className="text-[11px] text-slate-500 mt-0.5 leading-snug">1-on-1 with a certified expert</p>
              </div>
            </Link>

            {/* Ask AI Coach */}
            <button
              id="chat-with-coach-btn"
              type="button"
              onClick={actions.onChatClick}
              className="group flex flex-col items-start gap-3 rounded-2xl border border-violet-100 bg-violet-50 p-4 text-left transition hover:border-violet-200 hover:bg-violet-100/60 cursor-pointer"
            >
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-100 group-hover:bg-violet-200/70 transition">
                <Sparkles className="h-4 w-4 text-violet-600" />
              </div>
              <div>
                <p className="text-[13px] font-bold leading-tight text-slate-800">Ask PowerMySport AI</p>
                <p className="text-[11px] text-slate-500 mt-0.5 leading-snug">Follow-up on any part of this plan</p>
              </div>
            </button>

            {/* WhatsApp Us */}
            <a
              href={actions.waUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="group flex flex-col items-start gap-3 rounded-2xl border border-emerald-100 bg-emerald-50 p-4 transition hover:border-emerald-200 hover:bg-emerald-100/60 cursor-pointer"
            >
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-100 group-hover:bg-emerald-200/70 transition">
                <WhatsAppIcon className="h-4 w-4 text-emerald-600" />
              </div>
              <div>
                <p className="text-[13px] font-bold leading-tight text-slate-800">WhatsApp Us</p>
                <p className="text-[11px] text-slate-500 mt-0.5 leading-snug">A specialist replies personally</p>
              </div>
            </a>

            {/* Download PDF */}
            <button
              type="button"
              onClick={actions.onDownloadPdf}
              disabled={actions.downloadingPdf}
              className="group flex flex-col items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-left transition hover:border-slate-300 hover:bg-slate-100/60 disabled:opacity-50 cursor-pointer"
            >
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-200 group-hover:bg-slate-300/70 transition">
                {actions.downloadingPdf ? (
                  <Loader2 className="h-4 w-4 animate-spin text-slate-600" />
                ) : (
                  <Download className="h-4 w-4 text-slate-600" />
                )}
              </div>
              <div>
                <p className="text-[13px] font-bold leading-tight text-slate-800">Download PDF</p>
                <p className="text-[11px] text-slate-500 mt-0.5 leading-snug">Save or share offline</p>
              </div>
            </button>
          </div>
        ) : (
          <ul className="space-y-3">
            {nextSteps.map((step, i) => {
              const actionUrl = getActionUrl(step, submission.query.sport);
              return (
                <li key={i} className="flex items-start gap-2.5">
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-[10px] font-bold text-white">
                    {i + 1}
                  </span>
                  <div className="flex flex-1 items-start justify-between gap-3 min-w-0">
                    <span className="text-sm leading-relaxed text-emerald-900/90 font-medium">
                      {step}.
                    </span>
                    {actionUrl && (
                      <Link
                        href={actionUrl}
                        className="shrink-0 flex items-center gap-1 rounded-lg border border-emerald-300 bg-white px-2.5 py-1 text-[11px] font-semibold text-emerald-700 hover:bg-emerald-50 transition whitespace-nowrap"
                      >
                        Go <ArrowRight className="h-3 w-3" />
                      </Link>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Burnout risk — self-hides when risk level is low */}
      {r.burnoutRisk && <BurnoutRiskCard risk={r.burnoutRisk} />}

      {/* Recommended Sports */}
      {hasSports && (
        <div className="rounded-3xl border border-slate-200/60 bg-white p-5 sm:p-6 shadow-sm">
          <div className="flex items-center gap-3 mb-5">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-50">
              <Trophy className="h-5 w-5 text-amber-500" />
            </div>
            <div>
              <h3 className="font-title text-lg font-bold text-slate-900 leading-tight">
                Top Recommended Sports
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Based on your child's profile
              </p>
            </div>
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
    </div>
  );
}
