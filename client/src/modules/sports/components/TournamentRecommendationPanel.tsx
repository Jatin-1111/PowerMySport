"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Sparkles,
  Trophy,
  Target,
  ChevronRight,
  ChevronDown,
  Star,
  Award,
  ArrowRight,
  Zap,
  MapPin,
  Users,
  CalendarPlus,
} from "lucide-react";

interface TournamentRecommendationPanelProps {
  tournaments: any[];
  currentLevel: number; // 1-5, 0 = not set
  sportName: string;
  onViewTournament: (tournament: any) => void;
}

const GOALS = [
  { level: 2, label: "District Champion", short: "District", color: "from-blue-500 to-indigo-500", bg: "bg-blue-50 border-blue-200 text-blue-700" },
  { level: 3, label: "State Representative", short: "State", color: "from-violet-500 to-purple-600", bg: "bg-violet-50 border-violet-200 text-violet-700" },
  { level: 4, label: "National Athlete", short: "National", color: "from-orange-500 to-amber-500", bg: "bg-orange-50 border-orange-200 text-orange-700" },
  { level: 5, label: "International / Olympic", short: "Olympic", color: "from-rose-500 to-pink-600", bg: "bg-rose-50 border-rose-200 text-rose-700" },
];

const ASPIRATION_EXAMPLES: Record<string, string[]> = {
  "Badminton": ["Saina Nehwal", "PV Sindhu", "Lakshya Sen"],
  "Cricket": ["Virat Kohli", "Smriti Mandhana", "Yashasvi Jaiswal"],
  "Tennis": ["Sania Mirza", "Leander Paes", "Sumit Nagal"],
  "Hockey": ["PR Sreejesh", "Rani Rampal"],
  "Wrestling": ["Vinesh Phogat", "Bajrang Punia"],
  "Boxing": ["MC Mary Kom", "Neeraj Chopra"],
  "Athletics": ["Neeraj Chopra", "Hima Das"],
};

function normalizeTournamentLevel(levelStr: string): number {
  const l = (levelStr || "").toLowerCase();
  if (l.includes("international") || l.includes("world") || l.includes("asian") || l.includes("olympic")) return 5;
  if (l.includes("national") || l.includes("senior")) return 4;
  if (l.includes("state")) return 3;
  if (l.includes("district") || l.includes("zonal") || l.includes("sub-junior") || l.includes("junior")) return 2;
  return 1;
}

type Priority = "immediate" | "next" | "goal" | "aspire";

function getPriority(tLevel: number, currentLevel: number, goalLevel: number): Priority | null {
  if (currentLevel === 0) {
    // No progress set — prioritise everything relative to the chosen goal.
    // Without a goal, only surface beginner-friendly tournaments.
    if (goalLevel === 0) return tLevel <= 2 ? "immediate" : null;
    if (tLevel <= 2) return "immediate";
    if (tLevel < goalLevel) return "next";
    if (tLevel === goalLevel) return "goal";
    return "aspire";
  }
  if (tLevel === currentLevel) return "immediate";
  if (tLevel === currentLevel + 1) return "next";
  if (tLevel === goalLevel) return "goal";
  if (tLevel > goalLevel) return "aspire";
  if (tLevel < currentLevel) return null; // too easy — don't recommend
  return null;
}

const PRIORITY_META: Record<Priority, { label: string; icon: React.ReactNode; style: string; order: number }> = {
  immediate: { label: "Play Now", icon: <Zap className="h-3 w-3" />, style: "bg-emerald-100 text-emerald-700 border-emerald-200", order: 1 },
  next: { label: "Next Step", icon: <ChevronRight className="h-3 w-3" />, style: "bg-blue-100 text-blue-700 border-blue-200", order: 2 },
  goal: { label: "Target Goal", icon: <Target className="h-3 w-3" />, style: "bg-violet-100 text-violet-700 border-violet-200", order: 3 },
  aspire: { label: "Aspirational", icon: <Award className="h-3 w-3" />, style: "bg-amber-100 text-amber-700 border-amber-200", order: 4 },
};

function getReasonText(tournament: any, priority: Priority, currentLevel: number, goalLevel: number, sportName: string): string {
  const goal = GOALS.find(g => g.level === goalLevel);
  const sport = sportName || "your sport";

  switch (priority) {
    case "immediate":
      return `At your child's current stage, this tournament provides essential match experience and helps build a competitive record in ${sport}.`;
    case "next":
      return `This is the critical stepping stone toward ${goal?.label || "your goal"}. Strong results here open doors to the next level of competition.`;
    case "goal":
      return `This is the type of tournament your child needs to compete in to reach ${goal?.label || "their goal"} level. Work toward qualifying for this.`;
    case "aspire":
      return `This is elite-level competition. Qualifying for events like this is the long-term aspiration beyond your set goal.`;
  }
}

export function TournamentRecommendationPanel({
  tournaments,
  currentLevel,
  sportName,
  onViewTournament,
}: TournamentRecommendationPanelProps) {
  const [goalLevel, setGoalLevel] = useState<number>(0);
  const [isExpanded, setIsExpanded] = useState(true);
  const [showAll, setShowAll] = useState(false);

  const examples = ASPIRATION_EXAMPLES[sportName] || [];

  const recommended = tournaments
    .map((t) => {
      const tLevel = normalizeTournamentLevel(t.level || "");
      // When no goal is set and no current level, default effectiveGoal to 0 so
      // getPriority shows nothing until the user picks a goal.
      const effectiveGoal = goalLevel || (currentLevel > 0 ? currentLevel + 2 : 0);
      const priority = getPriority(tLevel, currentLevel, effectiveGoal);
      return priority ? { tournament: t, priority, tLevel } : null;
    })
    .filter(Boolean)
    .sort((a, b) => {
      const orderA = PRIORITY_META[a!.priority].order;
      const orderB = PRIORITY_META[b!.priority].order;
      if (orderA !== orderB) return orderA - orderB;
      return 0;
    }) as { tournament: any; priority: Priority; tLevel: number }[];

  const displayed = showAll ? recommended : recommended.slice(0, 3);

  const activeGoal = GOALS.find(g => g.level === goalLevel);

  if (tournaments.length === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      className="mb-6 rounded-3xl border border-slate-200 bg-gradient-to-br from-slate-50 to-white overflow-hidden shadow-sm"
    >
      {/* Panel header */}
      <button
        type="button"
        onClick={() => setIsExpanded(o => !o)}
        className="w-full flex items-center gap-3 px-5 py-4 text-left hover:bg-slate-50/80 transition"
      >
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-power-orange to-amber-400 text-white shadow">
          <Sparkles className="h-4 w-4" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-widest text-power-orange">
            Personalised Recommendations
          </p>
          <p className="text-sm font-bold text-slate-900">
            {goalLevel && activeGoal
              ? `Tournament roadmap to ${activeGoal.label}`
              : "Which tournaments should your child play?"}
          </p>
        </div>
        <motion.div animate={{ rotate: isExpanded ? 180 : 0 }} transition={{ duration: 0.2 }} className="shrink-0 text-slate-400">
          <ChevronDown className="h-4 w-4" />
        </motion.div>
      </button>

      <AnimatePresence initial={false}>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ height: { type: "spring", stiffness: 300, damping: 30 }, opacity: { duration: 0.15 } }}
            className="overflow-hidden"
          >
            <div className="px-5 pb-5 space-y-4 border-t border-slate-100 pt-4">
              {/* Aspiration examples */}
              {examples.length > 0 && (
                <p className="text-xs text-slate-500">
                  Want your child to reach the level of{" "}
                  <span className="font-semibold text-slate-700">{examples.join(", ")}</span>?
                  {" "}Set a goal below and we'll show you the exact tournaments to play.
                </p>
              )}

              {/* Goal selector */}
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">
                  Select Your Child's Aspirational Goal
                </p>
                <div className="flex flex-wrap gap-2">
                  {GOALS.map((goal) => {
                    const active = goalLevel === goal.level;
                    return (
                      <button
                        key={goal.level}
                        type="button"
                        onClick={() => setGoalLevel(active ? 0 : goal.level)}
                        className={`flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-semibold transition-all ${
                          active
                            ? `bg-gradient-to-r ${goal.color} text-white border-transparent shadow-md`
                            : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50"
                        }`}
                      >
                        {active && <Star className="h-3 w-3" />}
                        {goal.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Recommended tournaments */}
              {recommended.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-200 p-6 text-center">
                  <Trophy className="h-6 w-6 text-slate-300 mx-auto mb-2" />
                  <p className="text-sm text-slate-500">
                    {goalLevel
                      ? "No tournaments found matching this goal. Try a different level."
                      : "Set a goal above to see personalised tournament recommendations for your child."}
                  </p>
                </div>
              ) : (
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-3">
                    Recommended Tournaments
                    {goalLevel && currentLevel > 0 ? ` — Your child is at Level ${currentLevel}, aiming for ${activeGoal?.label}` : ""}
                  </p>

                  <div className="space-y-2.5">
                    <AnimatePresence>
                      {displayed.map(({ tournament: t, priority, tLevel }, i) => {
                        const meta = PRIORITY_META[priority];
                        const reason = getReasonText(t, priority, currentLevel, goalLevel || 3, sportName);
                        return (
                          <motion.button
                            key={t.name || i}
                            initial={{ opacity: 0, y: 6 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: i * 0.04 }}
                            type="button"
                            onClick={() => onViewTournament(t)}
                            className="w-full flex items-start gap-3 rounded-2xl border border-slate-200 bg-white p-3.5 text-left hover:border-power-orange hover:shadow-sm transition-all group"
                          >
                            {/* Priority badge */}
                            <div className="flex flex-col items-center gap-1 shrink-0 pt-0.5">
                              <span className={`flex items-center gap-1 rounded-full border px-2 py-0.5 text-[9px] font-bold ${meta.style}`}>
                                {meta.icon}
                                {meta.label}
                              </span>
                              <span className="text-[9px] font-bold text-slate-300">#{i + 1}</span>
                            </div>

                            {/* Content */}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-start justify-between gap-2 mb-1">
                                <h4 className="font-bold text-slate-900 text-sm break-words group-hover:text-power-orange transition-colors">
                                  {t.name}
                                </h4>
                                <ArrowRight className="h-4 w-4 text-slate-300 group-hover:text-power-orange shrink-0 mt-0.5 transition-colors" />
                              </div>
                              <div className="flex flex-wrap items-center gap-2 mb-1.5">
                                <span className="text-[10px] font-semibold text-slate-500 bg-slate-100 rounded-md px-1.5 py-0.5">{t.level}</span>
                                {t.ageGroup && (
                                  <span className="flex items-center gap-1 text-[10px] text-slate-400">
                                    <Users className="h-3 w-3" />{t.ageGroup}
                                  </span>
                                )}
                                {t.city && (
                                  <span className="flex items-center gap-1 text-[10px] text-slate-400">
                                    <MapPin className="h-3 w-3" />{t.city}
                                  </span>
                                )}
                              </div>
                              <p className="text-xs text-slate-500 leading-relaxed">{reason}</p>
                            </div>
                          </motion.button>
                        );
                      })}
                    </AnimatePresence>
                  </div>

                  {/* Show more / calendar hint */}
                  <div className="mt-3 flex items-center justify-between">
                    {recommended.length > 3 && (
                      <button
                        type="button"
                        onClick={() => setShowAll(o => !o)}
                        className="text-xs font-semibold text-slate-500 hover:text-slate-800 underline underline-offset-2 transition"
                      >
                        {showAll ? "Show top 3 only" : `Show all ${recommended.length} recommendations`}
                      </button>
                    )}
                    <span className="flex items-center gap-1.5 text-xs text-slate-400 ml-auto">
                      <CalendarPlus className="h-3.5 w-3.5" />
                      Click any tournament to view details and add to calendar
                    </span>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
