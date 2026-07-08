"use client";

import {
    AthleteStory,
} from "@/modules/sports/services/pathwayProfileApi";
import { motion } from "framer-motion";
import {
    BadgeCheck,
    HeartHandshake,
    MessageSquareQuote,
    Sparkles,
    Trophy,
} from "lucide-react";
import { useState } from "react";

import { levelColorMap } from './SubComponents';

// ─── P8: Stories Tab ──────────────────────────────────────────────────────────

export function StoriesTab({
  sportName,
  levels,
  stories,
}: {
  sportName: string;
  levels: any[];
  stories: AthleteStory[];
}) {
  const [filterLevel, setFilterLevel] = useState<number | null>(null);

  const displayStories = filterLevel
    ? stories.filter((s) => s.level === filterLevel)
    : stories;

  return (
    <motion.div
      key="stories"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.2 }}
      className="space-y-6"
    >
      {/* Header */}
      <div>
        <div className="flex flex-wrap items-center gap-2 mb-2">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 border border-emerald-200 px-3 py-1 text-xs font-bold text-emerald-700">
            <BadgeCheck className="h-3.5 w-3.5" /> Verified Stories
          </span>
          <span className="text-xs text-slate-400">
            Illustrative family accounts based on real journeys
          </span>
        </div>
        <div className="flex flex-wrap gap-2 mt-3">
          <button
            onClick={() => setFilterLevel(null)}
            className={`rounded-xl border px-3 py-1.5 text-xs font-semibold transition ${!filterLevel ? "bg-slate-900 text-white border-transparent" : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50"}`}
          >
            All Levels
          </button>
          {levels.map((lv) => {
            const c = levelColorMap[lv.level];
            const active = filterLevel === lv.level;
            return (
              <button
                key={lv.level}
                onClick={() => setFilterLevel(active ? null : lv.level)}
                className={`rounded-xl border px-3 py-1.5 text-xs font-semibold transition-all ${active ? `bg-gradient-to-r ${c.gradient} text-white border-transparent shadow` : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50"}`}
              >
                {lv.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Story cards */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {displayStories.length === 0 ? (
          <div className="col-span-full rounded-2xl border border-slate-200 bg-white p-10 text-center">
            <MessageSquareQuote className="mx-auto mb-3 h-8 w-8 text-slate-200" />
            <p className="text-sm font-medium text-slate-500">
              Finding athlete stories…
            </p>
            <p className="text-xs text-slate-400 mt-1">
              We're compiling real journeys from Indian athletes in this sport.
              Check back in a moment.
            </p>
          </div>
        ) : (
          displayStories.map((story) => {
            const c = levelColorMap[story.level];
            return (
              <div
                key={story._id || story.name}
                className="relative flex flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-sm overflow-hidden"
              >
                {/* Colored left accent */}
                <div
                  className={`absolute inset-y-0 left-0 w-1 bg-gradient-to-b ${c.gradient} rounded-l-2xl`}
                />
                <div className="pl-3 flex flex-col flex-1">
                  {/* Header row: level badge + verified */}
                  <div className="flex items-center justify-between gap-2 mb-4">
                    <span
                      className={`inline-flex items-center rounded-lg border px-2.5 py-1 text-[10px] font-bold ${c.badge}`}
                    >
                      {levels.find((l) => l.level === story.level)?.label ??
                        `Level ${story.level}`}
                    </span>
                    <div className="flex items-center gap-1">
                      {story.isAiGenerated ? (
                        <>
                          <Sparkles className="h-3.5 w-3.5 text-slate-400" />
                          <span className="text-[10px] font-bold text-slate-400">
                            AI-compiled
                          </span>
                        </>
                      ) : (
                        <>
                          <BadgeCheck className="h-3.5 w-3.5 text-emerald-600" />
                          <span className="text-[10px] font-bold text-emerald-600">
                            Verified
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                  {/* Quote */}
                  <p className="text-sm leading-relaxed text-slate-700 italic flex-1 mb-4">
                    "{story.quote}"
                  </p>
                  {/* Footer */}
                  <div className="border-t border-slate-100 pt-4 space-y-3">
                    <div>
                      <p className="font-bold text-slate-900 text-sm">
                        {story.name}
                      </p>
                      <p className="text-xs text-slate-400 mt-0.5">
                        {sportName} · {story.location}
                      </p>
                    </div>
                    <div
                      className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 ${c.badge}`}
                    >
                      <Trophy className={`h-3 w-3 shrink-0 ${c.text}`} />
                      <span className={`text-[10px] font-bold ${c.text}`}>
                        {story.achievement}
                      </span>
                    </div>
                    {story.parentNote && (
                      <div className="rounded-xl bg-slate-50 border border-slate-100 px-3 py-2.5">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1 flex items-center gap-1">
                          <HeartHandshake className="h-3 w-3" /> Parent's Note
                        </p>
                        <p className="text-xs text-slate-500 leading-relaxed italic">
                          "{story.parentNote}"
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </motion.div>
  );
}

