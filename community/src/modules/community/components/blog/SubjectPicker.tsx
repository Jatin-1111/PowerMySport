"use client";

import { useEffect, useRef, useState } from "react";
import { Search, X } from "lucide-react";
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
      <div className="bg-paper-deep rounded-2xl p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <meta.Icon
              size={20}
              strokeWidth={1.5}
              className="text-ink shrink-0"
              aria-hidden="true"
            />
            <div>
              <p className="text-ink-muted text-sm">About this {meta.label.toLowerCase()}</p>
              <p className="font-editorial text-ink text-2xl font-normal">{value.nameSnapshot}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => onChange(null)}
            className="text-ink-body hover:bg-paper hover:text-ink -mr-2 -mt-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-md transition-colors duration-200"
            aria-label="Remove subject"
          >
            <X size={18} strokeWidth={1.5} aria-hidden="true" />
          </button>
        </div>
        {isModerated && (
          <p className="text-ink border-ink/30 mt-4 border-l-2 pl-4 text-base leading-relaxed">
            Because this names {meta.label.toLowerCase()}, it goes to a quick review before other
            parents can see it. Describe what happened rather than giving a verdict.
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
        className="text-ink-body hover:border-ink/45 hover:text-ink flex min-h-12 w-full items-center gap-3 rounded-md border border-dashed border-[#bfb8ab] bg-white px-4 text-left text-base transition-colors duration-200"
      >
        <Search size={18} strokeWidth={1.5} aria-hidden="true" />
        Was this about a tournament, venue, academy or coach? Optional.
      </button>
    );
  }

  return (
    <div className="border-ink rounded-md border bg-white p-2">
      <div className="flex items-center gap-2">
        <Search
          size={18}
          strokeWidth={1.5}
          className="text-ink-muted ml-2 shrink-0"
          aria-hidden="true"
        />
        <input
          autoFocus
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          aria-label="Search tournaments, venues, academies and coaches"
          placeholder="Search tournaments, venues, academies, coaches"
          className="text-ink placeholder:text-ink-muted h-11 w-full bg-transparent text-base outline-none"
        />
        {isSearching && <span className="text-ink-muted shrink-0 pr-1 text-sm">Searching</span>}
        <button
          type="button"
          onClick={() => {
            setOpen(false);
            setQuery("");
          }}
          className="text-ink-body hover:bg-paper-deep flex h-11 w-11 shrink-0 items-center justify-center rounded-md transition-colors duration-200"
          aria-label="Cancel"
        >
          <X size={16} aria-hidden="true" />
        </button>
      </div>

      {results.length > 0 && (
        <ul className="border-hairline mt-2 max-h-64 overflow-y-auto border-t pt-2">
          {results.map((result) => {
            const meta = getSubjectKindMeta(result.kind);
            return (
              <li key={`${result.kind}-${result.refId}`}>
                <button
                  type="button"
                  onClick={() => select(result)}
                  className="hover:bg-paper-deep flex min-h-12 w-full items-center gap-3 rounded-md px-3 py-2 text-left transition-colors duration-200"
                >
                  <meta.Icon
                    size={16}
                    strokeWidth={1.5}
                    className="text-ink-muted shrink-0"
                    aria-hidden="true"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="text-ink block truncate text-base font-medium">
                      {result.name}
                    </span>
                    <span className="text-ink-muted block text-sm">
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
        <p className="border-hairline text-ink-muted mt-2 border-t px-3 pt-3 text-sm">
          Nothing found for &ldquo;{query.trim()}&rdquo;.
        </p>
      )}

      <p className="text-ink-muted px-3 pb-2 pt-3 text-sm">
        Tournaments, venues, academies, coaches and experts are searchable. Skip this if it is not
        about a specific one.
      </p>
    </div>
  );
}
