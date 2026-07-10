"use client";

import { AIDisclaimer } from "@/components/shared/AIDisclaimer";
import { WhatsAppIcon } from "@/components/layout/WhatsAppButton";
import { useAuthStore } from "@/modules/auth/store/authStore";
import { motion } from "framer-motion";
import {
    ArrowRight,
    Download,
    Loader2,
    MessageCircle,
    Route,
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
      <div className="rounded-3xl border border-emerald-200 bg-emerald-50/50 p-5 sm:p-6 shadow-sm">
        <div className="flex items-center gap-3 mb-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-100/80">
            <TrendingUp className="h-5 w-5 text-emerald-600" />
          </div>
          <div>
            <h3 className="font-title text-lg font-bold text-emerald-900 leading-tight">
              Do This Next
            </h3>
            <p className="text-xs text-emerald-700/70 mt-0.5">
              Immediate actions on PowerMySport
            </p>
          </div>
        </div>
        <ul className="space-y-3">
          {actions ? (
            <>
              <li className="flex items-center gap-2.5">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-[10px] font-bold text-white">1</span>
                <div className="flex flex-1 items-center justify-between gap-3 min-w-0">
                  <span className="text-sm leading-relaxed text-emerald-900/90 font-medium">
                    Book a 1-on-1 session with a certified coach for personalised guidance.
                  </span>
                  <Link
                    href="/experts"
                    className="shrink-0 flex items-center gap-1 rounded-lg border border-emerald-300 bg-white px-2.5 py-1 text-[11px] font-semibold text-emerald-700 hover:bg-emerald-50 transition whitespace-nowrap"
                  >
                    Go <ArrowRight className="h-3 w-3" />
                  </Link>
                </div>
              </li>
              <li className="flex items-center gap-2.5">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-[10px] font-bold text-white">2</span>
                <div className="flex flex-1 items-center justify-between gap-3 min-w-0">
                  <span className="text-sm leading-relaxed text-emerald-900/90 font-medium">
                    Ask PowerMySport AI follow-up questions about any part of this plan.
                  </span>
                  <button
                    id="chat-with-coach-btn"
                    type="button"
                    onClick={actions.onChatClick}
                    className="shrink-0 flex items-center gap-1 rounded-lg border border-emerald-300 bg-white px-2.5 py-1 text-[11px] font-semibold text-emerald-700 hover:bg-emerald-50 transition whitespace-nowrap"
                  >
                    Go <ArrowRight className="h-3 w-3" />
                  </button>
                </div>
              </li>
              <li className="flex items-center gap-2.5">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-[10px] font-bold text-white">3</span>
                <div className="flex flex-1 items-center justify-between gap-3 min-w-0">
                  <span className="text-sm leading-relaxed text-emerald-900/90 font-medium">
                    Message our team on WhatsApp — a specialist will reply personally.
                  </span>
                  <a
                    href={actions.waUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="shrink-0 flex items-center gap-1 rounded-lg border border-emerald-300 bg-white px-2.5 py-1 text-[11px] font-semibold text-emerald-700 hover:bg-emerald-50 transition whitespace-nowrap"
                  >
                    Go <ArrowRight className="h-3 w-3" />
                  </a>
                </div>
              </li>
              <li className="flex items-center gap-2.5">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-[10px] font-bold text-white">4</span>
                <div className="flex flex-1 items-center justify-between gap-3 min-w-0">
                  <span className="text-sm leading-relaxed text-emerald-900/90 font-medium">
                    Download this roadmap as a PDF to save or share offline.
                  </span>
                  <button
                    type="button"
                    onClick={actions.onDownloadPdf}
                    disabled={actions.downloadingPdf}
                    className="shrink-0 flex items-center gap-1 rounded-lg border border-emerald-300 bg-white px-2.5 py-1 text-[11px] font-semibold text-emerald-700 hover:bg-emerald-50 transition whitespace-nowrap disabled:opacity-50"
                  >
                    {actions.downloadingPdf ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <>Go <ArrowRight className="h-3 w-3" /></>
                    )}
                  </button>
                </div>
              </li>
            </>
          ) : (
            nextSteps.map((step, i) => {
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
            })
          )}
        </ul>
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
