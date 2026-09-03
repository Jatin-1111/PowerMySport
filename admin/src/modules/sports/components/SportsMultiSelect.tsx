"use client";

import { sportsApi, Sport } from "@/modules/sports/services/sports";
import { useState, useEffect, useCallback, useRef } from "react";
import { ChevronDown, X, Loader } from "lucide-react";

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
  // simple filter - avoid adding fuse dependency to admin
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsOpen(false);
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
      } catch (err) {
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchSports();
    // allowedSports is expected to be a stable reference (module-level constant)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSearch = useCallback(
    (query: string) => {
      setSearchQuery(query);
      if (!query.trim()) {
        setFilteredSports(allSports);
        return;
      }
      const q = query.trim().toLowerCase();
      setFilteredSports(allSports.filter((s) => s.name.toLowerCase().includes(q)));
    },
    [allSports]
  );

  const handleSelectSport = (sport: string) => {
    if (!value.includes(sport)) onChange([...value, sport]);
    setSearchQuery("");
    setIsOpen(true);
  };

  const handleRemoveSport = (sport: string) => onChange(value.filter((s) => s !== sport));

  const selectedSportObjects = allSports.filter((s) => value.includes(s.name));

  return (
    <div className="w-full" ref={containerRef}>
      <div className="mb-3 flex flex-wrap gap-2">
        {selectedSportObjects.map((sport) => (
          <div
            key={sport.name}
            className="flex items-center gap-2 rounded-lg bg-blue-50 px-3 py-1.5 text-sm font-medium text-blue-700"
          >
            {sport.name}
            <button
              type="button"
              onClick={() => handleRemoveSport(sport.name)}
              disabled={disabled}
              className="text-blue-500 hover:text-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <X size={16} />
            </button>
          </div>
        ))}
      </div>

      <div className="relative">
        <div className="relative">
          <input
            type="text"
            placeholder="Search or add sports..."
            value={searchQuery}
            onChange={(e) => handleSearch(e.target.value)}
            onFocus={() => setIsOpen(true)}
            disabled={disabled || isLoading}
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm placeholder-slate-500 focus:border-blue-500 focus:outline-none disabled:cursor-not-allowed disabled:bg-slate-50"
          />
          <ChevronDown size={18} className="absolute top-2.5 right-3 text-slate-400" />
        </div>

        {isOpen && !disabled && (
          <div className="absolute top-full right-0 left-0 z-10 mt-1 max-h-64 overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-lg">
            {isLoading ? (
              <div className="flex items-center justify-center px-4 py-6">
                <Loader size={20} className="animate-spin text-blue-500" />
              </div>
            ) : (
              <>
                {filteredSports.length > 0 && (
                  <div>
                    {filteredSports.map((sport) => {
                      const isSelected = value.includes(sport.name);
                      return (
                        <button
                          key={sport.name}
                          type="button"
                          onClick={() => handleSelectSport(sport.name)}
                          disabled={isSelected}
                          className="w-full px-4 py-2 text-left text-sm hover:bg-blue-50 focus:outline-none disabled:cursor-default disabled:bg-blue-50 disabled:text-slate-600"
                        >
                          <div className="flex items-center gap-2">
                            {isSelected && <div className="h-4 w-4 rounded bg-blue-500" />}
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

      {required && value.length === 0 && (
        <p className="mt-1 text-xs text-red-500">Please select at least one sport</p>
      )}
    </div>
  );
}
