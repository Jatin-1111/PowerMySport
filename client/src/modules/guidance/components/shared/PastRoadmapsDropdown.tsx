"use client";

import { useState, useEffect, useRef } from "react";
import {
  History,
  ChevronDown,
  Calendar,
  Trophy,
  Loader2,
  Trash2,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import type { GuidanceSubmission } from "../../types";

export function PastRoadmapsDropdown({
  history,
  onSelect,
  onDelete,
  deletingId,
}: {
  history: GuidanceSubmission[];
  onSelect: (h: GuidanceSubmission) => void;
  onDelete: (id: string) => void;
  deletingId: string | null;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fn = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node))
        setOpen(false);
    };
    document.addEventListener("mousedown", fn);
    return () => document.removeEventListener("mousedown", fn);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 shadow-sm transition hover:bg-slate-50"
      >
        <History className="h-3.5 w-3.5 text-power-orange" />
        <span className="hidden sm:inline">Past Roadmaps</span>
        <span className="inline sm:hidden">History</span>
        <span className="rounded-full bg-power-orange/10 px-1.5 py-0.5 text-[10px] font-bold text-power-orange">
          {history.length}
        </span>
        <ChevronDown
          className={`h-3 w-3 text-slate-400 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 6, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 6, scale: 0.96 }}
            transition={{ duration: 0.13 }}
            className="absolute right-0 top-full mt-2 z-50 w-72 rounded-2xl border border-slate-100 bg-white shadow-xl p-2 max-h-72 overflow-y-auto"
          >
            <p className="px-3 pt-1 pb-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">
              {history.length} saved roadmaps
            </p>
            {history.map((h) => (
              <div
                key={h.id}
                className="group flex items-center gap-2 rounded-xl px-2 py-1 transition hover:bg-slate-50"
              >
                <button
                  onClick={() => {
                    onSelect(h);
                    setOpen(false);
                  }}
                  className="flex flex-1 min-w-0 items-start gap-3 rounded-lg px-1 py-1.5 text-left"
                >
                  <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-power-orange/10 text-power-orange">
                    <Trophy className="h-3.5 w-3.5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-800 truncate">
                      {h.query.primary_objective} · Age {h.query.child_age}
                    </p>
                    <p className="text-[11px] text-slate-400 mt-0.5 flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      {new Date(h.createdAt).toLocaleDateString(undefined, {
                        month: "short",
                        day: "numeric",
                      })}
                      <span className="mx-1">·</span>
                      {h.query.current_fitness_level}
                    </p>
                  </div>
                </button>
                <button
                  type="button"
                  aria-label="Delete roadmap"
                  disabled={deletingId === h.id}
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete(h.id);
                  }}
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-300 transition hover:bg-rose-50 hover:text-rose-500 disabled:opacity-50 sm:opacity-0 sm:group-hover:opacity-100"
                >
                  {deletingId === h.id ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Trash2 className="h-3.5 w-3.5" />
                  )}
                </button>
              </div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
