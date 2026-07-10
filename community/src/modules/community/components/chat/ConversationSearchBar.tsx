"use client";

import { Search, X, ChevronUp, ChevronDown } from "lucide-react";
import { useRef, useEffect } from "react";
import { motion } from "framer-motion";

interface Props {
  query: string;
  matchCount: number;
  currentMatchIndex: number;
  onChange: (q: string) => void;
  onClose: () => void;
  onPrev: () => void;
  onNext: () => void;
}

export default function ConversationSearchBar({
  query,
  matchCount,
  currentMatchIndex,
  onChange,
  onClose,
  onPrev,
  onNext,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  return (
    <motion.div
      initial={{ height: 0, opacity: 0 }}
      animate={{ height: "auto", opacity: 1 }}
      exit={{ height: 0, opacity: 0 }}
      transition={{ duration: 0.15 }}
      className="z-10 shrink-0 overflow-hidden border-b border-slate-200/50 bg-white/95 backdrop-blur"
    >
      <div className="flex items-center gap-2 px-3 py-2">
        <Search size={15} className="shrink-0 text-slate-400" />
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              if (e.shiftKey) onPrev();
              else onNext();
            }
            if (e.key === "Escape") onClose();
          }}
          placeholder="Search in conversation…"
          className="flex-1 bg-transparent text-[13px] text-slate-800 placeholder-slate-400 focus:outline-none"
        />
        {query.trim() && (
          <span className="shrink-0 text-[11px] font-medium text-slate-500 tabular-nums">
            {matchCount === 0
              ? "No results"
              : `${currentMatchIndex + 1} / ${matchCount}`}
          </span>
        )}
        {matchCount > 0 && (
          <div className="flex items-center gap-0.5">
            <button
              onClick={onPrev}
              className="rounded-full p-1 text-slate-500 transition hover:bg-slate-100"
              aria-label="Previous match"
            >
              <ChevronUp size={14} />
            </button>
            <button
              onClick={onNext}
              className="rounded-full p-1 text-slate-500 transition hover:bg-slate-100"
              aria-label="Next match"
            >
              <ChevronDown size={14} />
            </button>
          </div>
        )}
        <button
          onClick={onClose}
          className="rounded-full p-1 text-slate-500 transition hover:bg-slate-100"
          aria-label="Close search"
        >
          <X size={15} />
        </button>
      </div>
    </motion.div>
  );
}
