"use client";

import { Search } from "lucide-react";
import { useState } from "react";
import { INDIAN_STATES_AND_UTS } from "@/lib/indianStates";

export function StateSelector({
  value,
  onChange,
}: {
  value: string | null;
  onChange: (state: string) => void;
}) {
  const [query, setQuery] = useState("");

  const filtered = query.trim()
    ? INDIAN_STATES_AND_UTS.filter((s) => s.toLowerCase().includes(query.toLowerCase()))
    : INDIAN_STATES_AND_UTS;

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          placeholder="Search your state..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="focus:border-power-orange focus:ring-power-orange/20 w-full rounded-xl border border-slate-200 bg-white py-3 pl-9 pr-4 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-1"
        />
      </div>

      <div className="flex max-h-[calc(100vh-360px)] flex-wrap gap-2 overflow-y-auto pr-1">
        {filtered.map((s) => {
          const selected = value === s;
          return (
            <button
              key={s}
              type="button"
              onClick={() => onChange(s)}
              className={`rounded-full border-2 px-4 py-2 text-sm font-medium transition-all duration-150 ${
                selected
                  ? "border-power-orange bg-power-orange/5 text-power-orange"
                  : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
              }`}
            >
              {s}
            </button>
          );
        })}
      </div>
    </div>
  );
}
