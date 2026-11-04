"use client";

import { Sport, sportsApi } from "@/modules/sports/services/sports";
import Fuse from "fuse.js";
import { FIELD_INPUT } from "@/modules/shared/components/settings/ProfileSection";
import { Check, ChevronDown, Loader2, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

interface SportsMultiSelectProps {
  value: string[];
  onChange: (sports: string[]) => void;
  disabled?: boolean;
  required?: boolean;
  /** When provided, only these sport names (case-insensitive) are selectable. */
  allowedSports?: string[];
}

export default function SportsMultiSelect({
  value,
  onChange,
  disabled = false,
  required = false,
  allowedSports,
}: SportsMultiSelectProps) {
  const [allSports, setAllSports] = useState<Sport[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [filteredSports, setFilteredSports] = useState<Sport[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [fuse, setFuse] = useState<Fuse<Sport> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const optionRefs = useRef<(HTMLButtonElement | null)[]>([]);

  // Handle click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    // Handle Escape key
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("keydown", handleEscape);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [isOpen]);

  // Fetch all sports on mount
  useEffect(() => {
    const fetchSports = async () => {
      try {
        setIsLoading(true);
        const fetched = await sportsApi.getAllSports();
        const sports = allowedSports
          ? fetched.filter((s) =>
              allowedSports.some((allowed) => allowed.toLowerCase() === s.name.toLowerCase())
            )
          : fetched;
        setAllSports(sports);
        setFilteredSports(sports);

        // Initialize fuse for fuzzy search
        const fuseInstance = new Fuse(sports, {
          keys: ["name"],
          threshold: 0.3,
        });
        setFuse(fuseInstance);
      } catch (error) {
        console.error("Failed to fetch sports:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchSports();
    // allowedSports is expected to be a stable reference (module-level constant)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Handle search with fuzzy matching
  const handleSearch = useCallback(
    (query: string) => {
      setSearchQuery(query);

      if (!query.trim()) {
        setFilteredSports(allSports);
        return;
      }

      if (fuse) {
        const results = fuse.search(query);
        setFilteredSports(results.map((result) => result.item));
      }
    },
    [fuse, allSports]
  );

  // Stored sport names are not always cased like the catalogue ("tennis" vs
  // "Tennis"), so every comparison ignores case.
  const isChosen = (name: string) => value.some((v) => v.toLowerCase() === name.toLowerCase());

  // Handle sport selection
  const handleSelectSport = (sport: string) => {
    if (!isChosen(sport)) {
      onChange([...value, sport]);
    }
    setSearchQuery("");
    setIsOpen(true); // Keep dropdown open for multiple selections
    // The picked option becomes disabled, which would silently drop focus —
    // hand it back to the search box so keyboard flow continues.
    inputRef.current?.focus();
  };

  // Move focus between the search input and the (non-disabled) options
  const focusOption = (from: number, dir: 1 | -1) => {
    const opts = optionRefs.current;
    for (let i = from + dir; i >= 0 && i < opts.length; i += dir) {
      // isConnected guards against stale refs left over after the filtered
      // list shrank
      if (opts[i] && opts[i]!.isConnected && !opts[i]!.disabled) {
        opts[i]!.focus();
        return;
      }
    }
    if (dir === -1) inputRef.current?.focus();
  };

  // Handle sport removal
  const handleRemoveSport = (sport: string) => {
    onChange(value.filter((s) => s.toLowerCase() !== sport.toLowerCase()));
  };

  // One chip per stored value, named as the catalogue names it when it is known.
  const chips = value.map((stored) => ({
    stored,
    label:
      allSports.find((sport) => sport.name.toLowerCase() === stored.toLowerCase())?.name ?? stored,
  }));

  return (
    <div className="w-full" ref={containerRef}>
      {/* Selected sports */}
      {chips.length > 0 && (
        <ul className="mb-3 flex flex-wrap gap-2" aria-label="Selected sports">
          {chips.map((chip) => (
            <li
              key={chip.stored}
              className="border-hairline bg-paper-deep text-ink flex min-h-11 items-center gap-1 rounded-md border pl-3 text-sm font-medium"
            >
              {chip.label}
              <button
                type="button"
                onClick={() => handleRemoveSport(chip.stored)}
                disabled={disabled}
                aria-label={`Remove ${chip.label}`}
                className="text-ink-body hover:text-ink focus-visible:ring-ink inline-flex h-11 w-11 items-center justify-center rounded-md focus-visible:outline-none focus-visible:ring-2 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <X size={16} strokeWidth={1.5} aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      )}

      {/* Search input */}
      <div className="relative">
        <div className="relative">
          <input
            ref={inputRef}
            type="text"
            role="combobox"
            aria-expanded={isOpen && !disabled}
            aria-controls="sports-multiselect-listbox"
            aria-autocomplete="list"
            aria-label="Search or add sports"
            placeholder="Search for a sport"
            value={searchQuery}
            onChange={(e) => handleSearch(e.target.value)}
            onFocus={() => setIsOpen(true)}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                setIsOpen(false);
              } else if (e.key === "ArrowDown") {
                e.preventDefault();
                if (!isOpen) setIsOpen(true);
                focusOption(-1, 1);
              } else if (e.key === "Enter") {
                // Don't submit the surrounding form from the search box
                e.preventDefault();
              }
            }}
            disabled={disabled || isLoading}
            className={`${FIELD_INPUT} pr-12 disabled:cursor-not-allowed disabled:opacity-60`}
          />
          <button
            type="button"
            tabIndex={-1}
            disabled={disabled || isLoading}
            onClick={() => setIsOpen((prev) => !prev)}
            className="text-ink-body hover:text-ink absolute right-0 top-0 inline-flex h-11 w-11 items-center justify-center rounded-md disabled:cursor-not-allowed"
            aria-label={isOpen ? "Close sports list" : "Open sports list"}
          >
            <ChevronDown
              size={18}
              strokeWidth={1.5}
              aria-hidden="true"
              className={`transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
            />
          </button>
        </div>

        {/* Dropdown */}
        {isOpen && !disabled && (
          <div
            id="sports-multiselect-listbox"
            className="border-ink/25 bg-paper absolute left-0 right-0 top-full z-50 mt-1 max-h-64 overflow-y-auto rounded-md border"
          >
            {isLoading ? (
              <div className="flex items-center justify-center px-4 py-6" role="status">
                <Loader2 size={20} strokeWidth={1.5} className="text-ink-body animate-spin" />
                <span className="sr-only">Loading sports</span>
              </div>
            ) : filteredSports.length > 0 ? (
              filteredSports.map((sport, i) => {
                const isSelected = isChosen(sport.name);
                return (
                  <button
                    key={sport.name}
                    type="button"
                    ref={(el) => {
                      optionRefs.current[i] = el;
                    }}
                    onClick={() => handleSelectSport(sport.name)}
                    onKeyDown={(e) => {
                      if (e.key === "ArrowDown") {
                        e.preventDefault();
                        focusOption(i, 1);
                      } else if (e.key === "ArrowUp") {
                        e.preventDefault();
                        focusOption(i, -1);
                      } else if (e.key === "Escape") {
                        e.preventDefault();
                        setIsOpen(false);
                        inputRef.current?.focus();
                      }
                    }}
                    disabled={isSelected}
                    className="text-ink hover:bg-paper-deep focus-visible:bg-paper-deep focus-visible:ring-ink disabled:text-ink-body flex min-h-11 w-full items-center justify-between gap-3 px-4 py-2 text-left text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-inset disabled:cursor-default disabled:bg-transparent"
                  >
                    <span className={isSelected ? "font-medium" : ""}>{sport.name}</span>
                    {isSelected && (
                      <>
                        <Check size={16} strokeWidth={1.5} aria-hidden="true" />
                        <span className="sr-only">Selected</span>
                      </>
                    )}
                  </button>
                );
              })
            ) : (
              <p className="text-ink-body px-4 py-3 text-sm">No sports found</p>
            )}
          </div>
        )}
      </div>

      {/* Error message for no sports selected if required */}
      {required && value.length === 0 && (
        <p role="alert" className="mt-1.5 text-sm text-red-800">
          Choose at least one sport
        </p>
      )}
    </div>
  );
}
