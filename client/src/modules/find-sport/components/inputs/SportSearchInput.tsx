"use client";

import { Sport, sportsApi } from "@/modules/sports/services/sports";
import Fuse from "fuse.js";
import { CheckCircle2, ChevronRight, Search, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

interface Props {
  value: string;
  onChange: (sport: string) => void;
  placeholder?: string;
  required?: boolean;
}

function highlightMatch(text: string, query: string): React.ReactNode {
  if (!query.trim()) return text;
  const idx = text.toLowerCase().indexOf(query.toLowerCase().trim());
  if (idx === -1) return text;
  return (
    <>
      {text.slice(0, idx)}
      <mark className="bg-orange-100 text-power-orange rounded px-0.5 not-italic font-semibold">
        {text.slice(idx, idx + query.length)}
      </mark>
      {text.slice(idx + query.length)}
    </>
  );
}

export function SportSearchInput({ value, onChange, placeholder = "e.g. Cricket, Badminton, Tennis…", required }: Props) {
  const [query, setQuery] = useState(value || "");
  const [allSports, setAllSports] = useState<Sport[]>([]);
  const [fuse, setFuse] = useState<Fuse<Sport> | null>(null);
  const [suggestions, setSuggestions] = useState<Sport[]>([]);
  const [open, setOpen] = useState(false);
  const [activeIdx, setActiveIdx] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Fetch all sports once
  useEffect(() => {
    sportsApi.getAllSports().then((sports) => {
      setAllSports(sports);
      setFuse(new Fuse(sports, { keys: ["name"], threshold: 0.35 }));
    });
  }, []);

  // Sync query when value changes externally (e.g. cleared)
  useEffect(() => {
    if (!value) setQuery("");
  }, [value]);

  // Filter suggestions
  useEffect(() => {
    setActiveIdx(-1);
    if (!fuse || query.trim().length < 1) {
      setSuggestions([]);
      setOpen(false);
      return;
    }
    const results = fuse.search(query).map((r) => r.item);
    setSuggestions(results.slice(0, 6));
    setOpen(true);
  }, [query, fuse]);

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const select = (name: string) => {
    setQuery(name);
    onChange(name);
    setOpen(false);
    setActiveIdx(-1);
  };

  const clear = () => {
    setQuery("");
    onChange("");
    setSuggestions([]);
    setOpen(false);
    inputRef.current?.focus();
  };

  const selected = !!value && value === query;

  return (
    <div ref={containerRef} className="relative">
      {/* Input */}
      <div className={`flex items-center gap-2 rounded-2xl border-2 bg-white px-4 py-3 transition-colors ${
        selected
          ? "border-emerald-400 bg-emerald-50/40"
          : open
          ? "border-power-orange"
          : "border-slate-200 hover:border-slate-300"
      }`}>
        {selected ? (
          <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />
        ) : (
          <Search className="h-4 w-4 shrink-0 text-slate-400" />
        )}
        <input
          ref={inputRef}
          type="text"
          value={query}
          autoFocus // eslint-disable-line jsx-a11y/no-autofocus
          onChange={(e) => {
            setQuery(e.target.value);
            if (value) onChange(""); // clear confirmed selection when user edits
          }}
          onFocus={() => {
            if (query.trim().length >= 1 && suggestions.length > 0) setOpen(true);
          }}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              if (!open && suggestions.length > 0) setOpen(true);
              setActiveIdx((i) => (i + 1) % suggestions.length);
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setActiveIdx((i) => (i - 1 + suggestions.length) % suggestions.length);
            } else if (e.key === "Enter") {
              e.preventDefault();
              const picked = open && activeIdx >= 0 ? suggestions[activeIdx] : suggestions[0];
              if (picked) select(picked.name);
            } else if (e.key === "Escape") {
              setOpen(false);
            }
          }}
          placeholder={placeholder}
          className="min-w-0 flex-1 bg-transparent text-sm font-medium text-slate-900 placeholder:text-slate-400 outline-none"
          role="combobox"
          aria-expanded={open}
          aria-autocomplete="list"
        />
        {query && (
          <button
            type="button"
            onClick={clear}
            className="shrink-0 flex h-6 w-6 items-center justify-center rounded-full hover:bg-slate-100 transition-colors"
          >
            <X className="h-3.5 w-3.5 text-slate-400" />
          </button>
        )}
      </div>

      {/* Selected badge */}
      {selected && (
        <p className="mt-2 text-xs text-emerald-600 font-medium flex items-center gap-1">
          <CheckCircle2 className="h-3 w-3" />
          {value} selected
        </p>
      )}

      {/* Dropdown */}
      {open && (
        <div className="absolute left-0 right-0 top-full z-30 mt-1.5 overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-2xl">
          <div className="h-0.5 w-full bg-gradient-to-r from-power-orange/60 via-power-orange to-power-orange/60" />
          {suggestions.length > 0 ? (
            <ul role="listbox" className="py-1.5 max-h-64 overflow-y-auto">
              {suggestions.map((s, idx) => {
                const active = idx === activeIdx;
                return (
                  <li key={s.slug || s.name} role="presentation">
                    <button
                      type="button"
                      role="option"
                      aria-selected={active}
                      onMouseDown={(e) => { e.preventDefault(); select(s.name); }}
                      onMouseEnter={() => setActiveIdx(idx)}
                      className={`group relative flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                        active ? "bg-orange-50" : "hover:bg-orange-50"
                      }`}
                    >
                      {active && (
                        <span className="absolute inset-y-1 left-0 w-0.5 rounded-r-full bg-power-orange" />
                      )}
                      <Search className={`h-3.5 w-3.5 shrink-0 ${active ? "text-power-orange" : "text-slate-300"}`} />
                      <span className="min-w-0 flex-1 truncate text-sm font-medium text-slate-800">
                        {highlightMatch(s.name, query)}
                      </span>
                      {s.category && (
                        <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-500 uppercase tracking-wide">
                          {s.category}
                        </span>
                      )}
                      <ChevronRight className={`h-3.5 w-3.5 shrink-0 text-slate-300 ${active ? "text-power-orange" : ""}`} />
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : (
            <div className="px-4 py-4 text-center">
              <p className="text-sm text-slate-500">No sport found for &ldquo;{query}&rdquo;</p>
              <p className="text-xs text-slate-400 mt-0.5">Try a different spelling</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
