"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, Search, X } from "lucide-react";
import { blogService, type SubjectSearchResult } from "@/modules/community/services/blog";
import {
  getSubjectKindMeta,
  MODERATED_SUBJECT_KINDS,
  type ExperienceSubjectKind,
} from "@/modules/community/constants/experienceSubjects";

export interface SelectedSubject {
  kind: ExperienceSubjectKind;
  refId: string;
  nameSnapshot: string;
  slugSnapshot: string | null;
}

interface SubjectPickerProps {
  value: SelectedSubject | null;
  onChange: (subject: SelectedSubject | null) => void;
}

const SEARCH_DEBOUNCE_MS = 300;

/**
 * "Was this about a tournament, venue, academy or coach?" — optional, and
 * skippable with one tap. Selecting a coach or expert surfaces a note that the
 * post goes to review first (server-enforced in requiresPreModeration); every
 * other subject publishes immediately, same as an unanchored experience.
 */
export default function SubjectPicker({ value, onChange }: SubjectPickerProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SubjectSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const requestIdRef = useRef(0);

  useEffect(() => {
    const term = query.trim();
    if (term.length < 2) {
      setResults([]);
      setIsSearching(false);
      return;
    }

    // Debounced search: `isSearching` and `results` synchronize with a
    // network fetch, which is exactly what an effect is for — the linter's
    // "avoid setState in an effect" guidance is aimed at deriving UI state
    // from other UI state, not this.
    setIsSearching(true);
    const requestId = ++requestIdRef.current;
    const timer = setTimeout(async () => {
      try {
        const items = await blogService.searchSubjects(term);
        if (requestIdRef.current === requestId) {
          setResults(items);
        }
      } catch {
        if (requestIdRef.current === requestId) {
          setResults([]);
        }
      } finally {
        if (requestIdRef.current === requestId) {
          setIsSearching(false);
        }
      }
    }, SEARCH_DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [query]);

  const select = (result: SubjectSearchResult) => {
    onChange({
      kind: result.kind,
      refId: result.refId,
      nameSnapshot: result.name,
      slugSnapshot: result.slug,
    });
    setOpen(false);
    setQuery("");
    setResults([]);
  };

  if (value) {
    const meta = getSubjectKindMeta(value.kind);
    const isModerated = MODERATED_SUBJECT_KINDS.includes(value.kind);
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
              <meta.Icon size={16} />
            </span>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                {meta.label}
              </p>
              <p className="text-sm font-semibold text-slate-800">{value.nameSnapshot}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => onChange(null)}
            className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-50 hover:text-slate-600"
            aria-label="Remove subject"
          >
            <X size={16} />
          </button>
        </div>
        {isModerated && (
          <p className="mt-2.5 rounded-lg bg-amber-50 px-2.5 py-2 text-xs text-amber-800">
            Because this names {meta.label.toLowerCase()}, it goes to a quick review before
            it&apos;s visible to other parents. Describe what happened rather than a verdict.
          </p>
        )}
      </div>
    );
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="focus:border-power-orange flex w-full items-center gap-2 rounded-xl border border-dashed border-slate-300 bg-white px-3 py-2.5 text-left text-sm text-slate-500 outline-none transition hover:border-slate-400"
      >
        <Search size={15} />
        Was this about a tournament, venue, academy or coach? (optional)
      </button>
    );
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3">
      <div className="flex items-center gap-2">
        <Search size={15} className="shrink-0 text-slate-400" />
        <input
          autoFocus
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search tournaments, venues, academies, coaches…"
          className="w-full bg-transparent text-sm text-slate-800 outline-none placeholder:text-slate-400"
        />
        {isSearching && <Loader2 size={14} className="shrink-0 animate-spin text-slate-400" />}
        <button
          type="button"
          onClick={() => {
            setOpen(false);
            setQuery("");
          }}
          className="shrink-0 rounded-lg p-1 text-slate-400 transition hover:text-slate-600"
          aria-label="Cancel"
        >
          <X size={15} />
        </button>
      </div>

      {results.length > 0 && (
        <ul className="mt-2 max-h-64 overflow-y-auto border-t border-slate-100 pt-2">
          {results.map((result) => {
            const meta = getSubjectKindMeta(result.kind);
            return (
              <li key={`${result.kind}-${result.refId}`}>
                <button
                  type="button"
                  onClick={() => select(result)}
                  className="flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-left transition hover:bg-slate-50"
                >
                  <meta.Icon size={15} className="shrink-0 text-slate-400" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-slate-800">
                      {result.name}
                    </span>
                    <span className="block text-xs text-slate-400">
                      {meta.label}
                      {result.meta ? ` · ${result.meta}` : ""}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {query.trim().length >= 2 && !isSearching && results.length === 0 && (
        <p className="mt-2 border-t border-slate-100 pt-2 text-xs text-slate-400">
          Nothing found for &ldquo;{query.trim()}&rdquo;.
        </p>
      )}

      <p className="mt-2 text-[11px] text-slate-400">
        Tournaments, venues, academies, coaches and experts are searchable — skip this if it&apos;s
        not about a specific one.
      </p>
    </div>
  );
}
