"use client";

import { motion } from "framer-motion";
import {
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  Clock3,
  Target,
} from "lucide-react";
import { useState } from "react";
import type { PlanSession, ShortTermPlan } from "../../types";

/**
 * Week-by-week rendering for short-horizon plans (weakness fixes, tournament
 * prep). Progressive disclosure keeps it glanceable: only the current week is
 * open by default, and each drill shows just its name + duration until tapped
 * — the full instructions and "done right" cue live behind the tap, so the
 * parent scans the plan in seconds and drills into one session at a time.
 */

// Older submissions stored each session as one pre-formatted string.
function isStructured(s: PlanSession | string): s is PlanSession {
  return typeof s !== "string";
}

function weekMinutes(sessions: Array<PlanSession | string>): number | null {
  const structured = sessions.filter(isStructured);
  if (structured.length === 0 || structured.some((s) => !s.minutes)) return null;
  return structured.reduce((sum, s) => sum + (s.minutes ?? 0), 0);
}

function SessionRow({ session }: { session: PlanSession | string }) {
  const [open, setOpen] = useState(false);

  if (!isStructured(session)) {
    return (
      <li className="flex items-start gap-2 px-3.5 py-2.5">
        <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-300" />
        <span className="text-[13px] leading-relaxed text-slate-600">
          {session}
        </span>
      </li>
    );
  }

  return (
    <li className="rounded-xl border border-slate-100 bg-white">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-3 px-3.5 py-2.5 text-left"
      >
        <span className="flex items-center gap-2 min-w-0">
          <CheckCircle2
            className={`h-3.5 w-3.5 shrink-0 ${open ? "text-power-orange" : "text-slate-300"}`}
          />
          <span className="truncate text-[13px] font-semibold text-slate-800">
            {session.name}
          </span>
        </span>
        <span className="flex shrink-0 items-center gap-2">
          {session.minutes ? (
            <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-1.5 py-0.5 text-[11px] font-semibold text-slate-500">
              <Clock3 className="h-3 w-3" />
              {session.minutes} min
            </span>
          ) : null}
          <ChevronDown
            className={`h-3.5 w-3.5 text-slate-400 transition-transform ${open ? "rotate-180" : ""}`}
          />
        </span>
      </button>

      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.15 }}
        >
          <div className="border-t border-slate-100 px-3.5 py-3 space-y-2">
            <p className="text-[13px] leading-relaxed text-slate-600">
              {session.how}
            </p>
            {session.doneRight && (
              <p className="text-xs leading-relaxed text-emerald-700">
                <span className="font-bold uppercase tracking-wide">
                  Done right:{" "}
                </span>
                {session.doneRight}
              </p>
            )}
          </div>
        </motion.div>
      )}
    </li>
  );
}

export function ShortTermPlanCard({ plan }: { plan: ShortTermPlan }) {
  // The week the family should be working on right now stays open.
  const [openWeek, setOpenWeek] = useState(0);

  return (
    <div className="rounded-3xl border border-slate-200/60 bg-white p-5 sm:p-6 shadow-sm">
      <div className="flex items-center gap-3 mb-5">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-orange-50">
          <CalendarDays className="h-5 w-5 text-power-orange" />
        </div>
        <div>
          <h3 className="font-title text-lg font-bold text-slate-900 leading-tight">
            Your {plan.durationWeeks}-Week Plan
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            One focus per week — tap a drill to see how to run it
          </p>
        </div>
      </div>

      <div className="space-y-3">
        {plan.weeks.map((week, i) => {
          const isOpen = openWeek === i;
          const minutes = weekMinutes(week.sessions);
          return (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.06 }}
              className={`rounded-2xl border ${isOpen ? "border-power-orange/30 bg-orange-50/40" : "border-slate-100 bg-slate-50/60"}`}
            >
              <button
                type="button"
                onClick={() => setOpenWeek(isOpen ? -1 : i)}
                aria-expanded={isOpen}
                className="flex w-full items-start justify-between gap-3 p-4 text-left"
              >
                <span className="flex items-baseline gap-2.5 min-w-0">
                  <span className="shrink-0 rounded-lg bg-power-orange/10 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-power-orange">
                    {week.label}
                  </span>
                  <span className="text-sm font-semibold text-slate-800 leading-snug">
                    {week.focus}
                  </span>
                </span>
                <span className="mt-0.5 flex shrink-0 items-center gap-2">
                  <span className="text-[11px] font-medium text-slate-400">
                    {week.sessions.length} drill{week.sessions.length === 1 ? "" : "s"}
                    {minutes ? ` · ~${minutes} min` : ""}
                  </span>
                  <ChevronDown
                    className={`h-4 w-4 text-slate-400 transition-transform ${isOpen ? "rotate-180" : ""}`}
                  />
                </span>
              </button>

              {isOpen && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.15 }}
                >
                  <ul className="px-4 pb-4 space-y-2">
                    {week.sessions.map((session, j) => (
                      <SessionRow key={j} session={session} />
                    ))}
                  </ul>
                </motion.div>
              )}
            </motion.div>
          );
        })}
      </div>

      {plan.successCheck && (
        <div className="mt-4 flex items-start gap-3 rounded-2xl border border-emerald-100 bg-emerald-50 p-4">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-100">
            <Target className="h-4 w-4 text-emerald-600" />
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-emerald-700 mb-0.5">
              How you&apos;ll know it worked
            </p>
            <p className="text-sm leading-relaxed text-emerald-900/90">
              {plan.successCheck}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
