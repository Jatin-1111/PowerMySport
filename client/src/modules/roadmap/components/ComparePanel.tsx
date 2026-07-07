"use client";

import {
    pathwayApi,
    SportPathway,
} from "@/modules/sports/services/pathway";
import { Sport } from "@/modules/sports/services/sports";
import { AnimatePresence, motion } from "framer-motion";
import Fuse from "fuse.js";
import {
    Briefcase,
    Clock,
    Database,
    Loader2,
    Plus,
    ShoppingBag,
    Wallet,
    X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";

import {
    pathwayLevels
} from '../config/constants';

// ─── P3: Compare Panel ────────────────────────────────────────────────────────

export function ComparePanel({
  primaryPathway,
  allSports,
}: {
  primaryPathway: SportPathway;
  allSports: Sport[];
}) {
  const [compareList, setCompareList] = useState<SportPathway[]>([
    primaryPathway,
  ]);
  const [searchQuery, setSearchQuery] = useState("");
  const [fuse, setFuse] = useState<Fuse<Sport> | null>(null);
  const [suggestions, setSuggestions] = useState<Sport[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [loadingIdx, setLoadingIdx] = useState<number | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (allSports.length > 0)
      setFuse(new Fuse(allSports, { keys: ["name"], threshold: 0.3 }));
  }, [allSports]);

  useEffect(() => {
    if (!fuse || searchQuery.trim().length < 1) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }
    const res = fuse.search(searchQuery).map((r) => r.item);
    setSuggestions(res.slice(0, 5));
    setShowSuggestions(res.length > 0);
  }, [searchQuery, fuse]);

  const addSport = async (name: string) => {
    if (compareList.length >= 3) return;
    if (
      compareList.some(
        (p) => p.sportSlug === name.toLowerCase().replace(/\s+/g, "-"),
      )
    )
      return;
    setShowSuggestions(false);
    setSearchQuery("");
    const idx = compareList.length;
    setLoadingIdx(idx);
    try {
      const res = await pathwayApi.getPathway(
        name,
        undefined,
        primaryPathway.state,
      );
      if (res && (res.pathway as any).status !== "pending_review") {
        setCompareList((prev) => [...prev, res.pathway]);
      } else if (res && (res.pathway as any).status === "pending_review") {
        alert(
          "This pathway is being reviewed by experts and is not yet available for comparison.",
        );
      }
    } catch {}
    setLoadingIdx(null);
  };

  const removeSport = (idx: number) => {
    if (idx === 0) return; // keep primary
    setCompareList((prev) => prev.filter((_, i) => i !== idx));
  };

  // Extract cost midpoint from string like "₹2,000–₹5,000"
  const parseCost = (cost: string): number => {
    const nums = cost.replace(/[₹,]/g, "").match(/\d+/g);
    if (!nums) return 0;
    if (nums.length >= 2)
      return (Number(nums[0]) + Number(nums[nums.length - 1])) / 2;
    return Number(nums[0]);
  };

  const getEquipmentCost = (
    pathway: SportPathway,
  ): { total: number; label: string } => {
    if (!pathway.equipment?.length) return { total: 0, label: "N/A" };
    const total = pathway.equipment.reduce(
      (sum, e) => sum + parseCost(e.estimatedCost),
      0,
    );
    return {
      total,
      label:
        total > 0 ? `₹${Math.round(total).toLocaleString("en-IN")}` : "Varies",
    };
  };

  const getScholarshipCount = (pathway: SportPathway) =>
    pathway.scholarships?.length || 0;

  const getCareerCount = (pathway: SportPathway) =>
    pathway.careers?.length || 0;

  const getTimeCommitment = (): string => {
    const lvl = pathwayLevels.find((l) => l.level === 3);
    return lvl?.parentalCommitment.time || "Daily";
  };

  return (
    <motion.div
      key="compare"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.2 }}
      className="space-y-4"
    >
      {/* Search input */}
      {compareList.length < 3 && (
        <div className="relative">
          <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 shadow-sm">
            <Plus className="h-4 w-4 text-slate-400 shrink-0" />
            <input
              ref={inputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && suggestions.length > 0)
                  addSport(suggestions[0].name);
                if (e.key === "Escape") setShowSuggestions(false);
              }}
              onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
              placeholder={`Add sport ${compareList.length + 1} of 3 to compare…`}
              className="flex-1 bg-transparent text-sm font-medium text-slate-800 placeholder-slate-400 outline-none"
            />
            {loadingIdx !== null && (
              <Loader2 className="h-4 w-4 animate-spin text-power-orange shrink-0" />
            )}
          </div>
          <AnimatePresence>
            {showSuggestions && (
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                className="absolute left-0 right-0 top-full z-20 mt-1.5 rounded-2xl border border-slate-100 bg-white shadow-xl overflow-hidden"
              >
                {suggestions.map((s) => (
                  <button
                    key={s.slug || s.name}
                    onClick={() => addSport(s.name)}
                    className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm font-medium text-slate-800 hover:bg-slate-50 transition"
                  >
                    <Database className="h-4 w-4 shrink-0 text-slate-400" />
                    {s.name}
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* Comparison table */}
      <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
        {/* Column headers — fixed 150px metric label, equal-width sport columns */}
        {(() => {
          const slotCount =
            compareList.length + (compareList.length < 3 ? 1 : 0);
          const colTemplate = `150px repeat(${slotCount}, 1fr)`;
          const METRICS = [
            {
              label: "Equipment Cost",
              icon: <ShoppingBag className="h-3 w-3" />,
              getValue: (p: SportPathway) => getEquipmentCost(p).label,
              getRaw: (p: SportPathway) => getEquipmentCost(p).total,
              lowerIsBetter: true,
            },
            {
              label: "Weekly Commitment",
              icon: <Clock className="h-3 w-3" />,
              getValue: (p: SportPathway) => getTimeCommitment(),
              getRaw: (_: SportPathway) => 0,
              lowerIsBetter: false,
            },
            {
              label: "Scholarships",
              icon: <Wallet className="h-3 w-3" />,
              getValue: (p: SportPathway) =>
                `${getScholarshipCount(p)} available`,
              getRaw: (p: SportPathway) => getScholarshipCount(p),
              lowerIsBetter: false,
            },
            {
              label: "Career Paths",
              icon: <Briefcase className="h-3 w-3" />,
              getValue: (p: SportPathway) => `${getCareerCount(p)} options`,
              getRaw: (p: SportPathway) => getCareerCount(p),
              lowerIsBetter: false,
            },
          ];
          return (
            <>
              <div
                className="grid border-b border-slate-100 bg-slate-50"
                style={{ gridTemplateColumns: colTemplate }}
              >
                <div className="px-4 py-3">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                    Metric
                  </p>
                </div>
                {compareList.map((pw, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between gap-2 px-4 py-3 border-l border-slate-100 min-w-0"
                  >
                    <p className="font-title font-bold text-slate-900 text-sm truncate">
                      {pw.sportName}
                    </p>
                    {idx === 0 ? (
                      <span className="shrink-0 text-[9px] font-bold uppercase tracking-wider bg-slate-200 text-slate-500 px-1.5 py-0.5 rounded-full">
                        Primary
                      </span>
                    ) : (
                      <button
                        onClick={() => removeSport(idx)}
                        className="shrink-0 flex h-5 w-5 items-center justify-center rounded-full hover:bg-slate-200 text-slate-400 hover:text-slate-600 transition"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                ))}
                {compareList.length < 3 && (
                  <div className="border-l border-dashed border-slate-200 px-4 py-3 flex items-center">
                    <button
                      onClick={() => inputRef.current?.focus()}
                      className="flex items-center gap-1 text-xs font-medium text-slate-400 hover:text-power-orange transition"
                    >
                      <Plus className="h-3.5 w-3.5" /> Add sport
                    </button>
                  </div>
                )}
              </div>

              {METRICS.map((metric, mIdx) => {
                const raws = compareList.map((p) => metric.getRaw(p));
                const bestRaw = metric.lowerIsBetter
                  ? Math.min(...raws.filter((v) => v > 0))
                  : Math.max(...raws);
                return (
                  <div
                    key={mIdx}
                    className="grid border-t border-slate-100"
                    style={{ gridTemplateColumns: colTemplate }}
                  >
                    <div className="flex items-center gap-1.5 px-4 py-3 text-xs text-slate-500 font-medium">
                      <span className="text-slate-400 shrink-0">
                        {metric.icon}
                      </span>
                      {metric.label}
                    </div>
                    {compareList.map((pw, idx) => {
                      const raw = metric.getRaw(pw);
                      const isBest =
                        raw > 0 && raw === bestRaw && compareList.length > 1;
                      return (
                        <div
                          key={idx}
                          className={`px-4 py-3 border-l border-slate-100 ${isBest ? "bg-orange-50/40" : ""}`}
                        >
                          <p
                            className={`text-sm tabular-nums ${isBest ? "font-bold text-slate-900" : "font-semibold text-slate-700"}`}
                          >
                            {metric.getValue(pw)}
                          </p>
                          {isBest && (
                            <p className="text-[9px] font-bold uppercase tracking-wider text-power-orange mt-0.5">
                              Best
                            </p>
                          )}
                        </div>
                      );
                    })}
                    {compareList.length < 3 && (
                      <div className="border-l border-dashed border-slate-200 px-4 py-3">
                        <p className="text-sm text-slate-200">—</p>
                      </div>
                    )}
                  </div>
                );
              })}
            </>
          );
        })()}
      </div>

      {compareList.length > 1 && (
        <p className="text-xs text-slate-400 text-center">
          Data sourced from pathway analysis for{" "}
          {compareList.map((p) => p.sportName).join(", ")}.
        </p>
      )}
    </motion.div>
  );
}

