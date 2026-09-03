"use client";

import { Sport, sportsApi } from "@/modules/sports/services/sports";
import Fuse from "fuse.js";
import { ChevronDown, Loader, X } from "lucide-react";
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

  // Handle sport selection
  const handleSelectSport = (sport: string) => {
    if (!value.includes(sport)) {
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
    onChange(value.filter((s) => s !== sport));
  };

  // Get selected sport objects
  const selectedSportObjects = allSports.filter((sport) => value.includes(sport.name));

  return (
    <div className="w-full" ref={containerRef}>
      {/* Selected Sports Display */}
      <div className="mb-3 flex flex-wrap gap-2">
        {selectedSportObjects.map((sport) => (
          <div
            key={sport.name}
            className="flex items-center gap-2 rounded-lg bg-indigo-50 px-3 py-1.5 text-sm font-medium text-indigo-700"
          >
            {sport.name}
            <button
              type="button"
              onClick={() => handleRemoveSport(sport.name)}
              disabled={disabled}
              aria-label={`Remove ${sport.name}`}
              className="rounded text-indigo-500 hover:text-indigo-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <X size={16} aria-hidden="true" />
            </button>
          </div>
        ))}
      </div>

      {/* Search Input */}
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
            placeholder="Search or add sports..."
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
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm placeholder-slate-500 focus:border-blue-500 focus:outline-none disabled:cursor-not-allowed disabled:bg-slate-50"
          />
          <button
            type="button"
            tabIndex={-1}
            disabled={disabled || isLoading}
            onClick={() => setIsOpen((prev) => !prev)}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-slate-400 hover:text-slate-600 disabled:cursor-not-allowed"
            aria-label={isOpen ? "Close sports dropdown" : "Open sports dropdown"}
          >
            <ChevronDown
              size={18}
              className={`transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
            />
          </button>
        </div>

        {/* Dropdown */}
        {isOpen && !disabled && (
          <div
            id="sports-multiselect-listbox"
            className="absolute left-0 right-0 top-full z-50 mt-1 max-h-64 overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-lg"
          >
            {isLoading ? (
              <div className="flex items-center justify-center px-4 py-6">
                <Loader size={20} className="animate-spin text-indigo-500" />
              </div>
            ) : (
              <>
                {/* Sports List */}
                {filteredSports.length > 0 && (
                  <div>
                    {filteredSports.map((sport, i) => {
                      const isSelected = value.includes(sport.name);
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
                          className="w-full px-4 py-2 text-left text-sm hover:bg-indigo-50 focus:outline-none focus-visible:bg-indigo-50 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-indigo-500 disabled:cursor-default disabled:bg-indigo-50 disabled:text-slate-600"
                        >
                          <div className="flex items-center gap-2">
                            {isSelected && (
                              <div className="h-4 w-4 rounded bg-blue-500" aria-hidden="true" />
                            )}
                            <span className={isSelected ? "font-semibold" : ""}>{sport.name}</span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}

                {filteredSports.length === 0 && (
                  <div className="px-4 py-3 text-center text-sm text-slate-500">
                    No sports found
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>

      {/* Error message for no sports selected if required */}
      {required && value.length === 0 && (
        <p className="mt-1 text-xs text-red-500">Please select at least one sport</p>
      )}
    </div>
  );
}
