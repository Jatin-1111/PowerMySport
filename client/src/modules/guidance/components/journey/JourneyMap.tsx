"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronDown, Wallet, Clock, MapPin, Target } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import type { JourneyPhase } from "../../types";

export function JourneyMap({
  phases,
  goal,
  sport,
}: {
  phases: JourneyPhase[];
  goal: string;
  sport?: string;
}) {
  const [open, setOpen] = useState<Set<number>>(new Set([0]));

  const toggle = (i: number) => {
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  };

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
      {/* Overview strip */}
      <div className="flex items-center gap-3 border-b border-slate-100 bg-slate-50/70 px-4 py-3">
        <Target className="h-4 w-4 shrink-0 text-power-orange" />
        <p className="text-sm text-slate-700">
          <span className="font-bold text-slate-900">{phases.length}-phase plan</span> to reach{" "}
          <span className="font-semibold">{goal}</span>
        </p>
      </div>

      {/* Phase list */}
      <div className="divide-y divide-slate-100">
        {phases.map((p, pi) => {
          const isOpen = open.has(pi);
          return (
            <div key={pi}>
              <button
                type="button"
                onClick={() => toggle(pi)}
                aria-expanded={isOpen}
                className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition hover:bg-slate-50"
              >
                <span
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-black transition-colors ${
                    isOpen ? "bg-power-orange text-white" : "bg-slate-100 text-slate-500"
                  }`}
                >
                  {pi + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold text-slate-900">{p.title}</p>
                  <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-slate-400">
                    <span className="inline-flex items-center gap-1">
                      <Clock className="h-3 w-3" /> {p.timeframe}
                    </span>
                    {p.estimatedCost && (
                      <span className="inline-flex items-center gap-1">
                        <Wallet className="h-3 w-3" /> {p.estimatedCost}
                      </span>
                    )}
                  </div>
                </div>
                <ChevronDown
                  className={`h-4 w-4 shrink-0 text-slate-400 transition-transform duration-200 ${
                    isOpen ? "rotate-180" : ""
                  }`}
                />
              </button>

              <AnimatePresence initial={false}>
                {isOpen && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.22, ease: "easeInOut" }}
                    className="overflow-hidden"
                  >
                    <div className="border-t border-slate-100 bg-slate-50/40 px-4 py-4 pl-[52px]">
                      <p className="text-xs leading-relaxed text-slate-600">{p.focus}</p>

                      <ul className="mt-3 space-y-1.5">
                        {p.milestones.map((m, mi) => (
                          <li key={mi} className="flex items-start gap-2">
                            <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-slate-400" />
                            <span className="text-xs leading-relaxed text-slate-700">{m}</span>
                          </li>
                        ))}
                      </ul>

                      <div className="mt-3 rounded-lg border border-emerald-100 bg-emerald-50/60 px-3 py-2">
                        <p className="text-[11px] leading-relaxed text-emerald-800">
                          <span className="font-bold">By the end of this phase: </span>
                          {p.outcome}
                        </p>
                      </div>

                      {p.pathwayLevel && sport && (
                        <Link
                          href={`/roadmap?sport=${encodeURIComponent(sport)}&level=${p.pathwayLevel}`}
                          className="mt-2 inline-flex items-center gap-1 text-[10px] font-bold text-power-orange hover:underline"
                        >
                          <MapPin className="h-3 w-3" />
                          View Level {p.pathwayLevel} details
                        </Link>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>

      {/* Goal footer */}
      <div className="border-t border-slate-100 bg-slate-50/70 px-4 py-3">
        <p className="text-xs text-slate-500">
          <span className="font-bold text-slate-700">Goal:</span> {goal}
        </p>
      </div>
    </div>
  );
}
