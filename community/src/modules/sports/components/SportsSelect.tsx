"use client";

import { sportsApi, Sport } from "@/modules/sports/services/sports";
import { useState, useEffect, useCallback, useRef } from "react";
import { ChevronDown, Loader } from "lucide-react";
import Fuse from "fuse.js";

interface SportsSelectProps {
  value: string;
  onChange: (sport: string) => void;
  disabled?: boolean;
  required?: boolean;
  placeholder?: string;
  placement?: "top" | "bottom";
}

export default function SportsSelect({
  value,
  onChange,
  disabled = false,
  required = false,
  placeholder = "Select a sport...",
  placement = "bottom",
}: SportsSelectProps) {
  const [allSports, setAllSports] = useState<Sport[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [filteredSports, setFilteredSports] = useState<Sport[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [fuse, setFuse] = useState<Fuse<Sport> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

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
        const sports = await sportsApi.getAllSports();
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
    onChange(sport);
    setSearchQuery("");
    setIsOpen(false);
  };

  return (
    <div className="relative w-full" ref={containerRef}>
      {/* Trigger Button / Input */}
      <div
        className={`focus-within:border-power-orange/50 focus-within:ring-power-orange/10 flex w-full items-center justify-between rounded-2xl border border-slate-200 bg-white/80 px-4 py-3.5 text-sm font-medium text-slate-900 shadow-sm backdrop-blur transition-all focus-within:bg-white focus-within:ring-4 ${disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer"}`}
        onClick={() => !disabled && setIsOpen(true)}
      >
        <span className={value ? "text-slate-900" : "text-slate-400"}>{value || placeholder}</span>
        <ChevronDown size={18} className="text-slate-400" />
      </div>

      {/* Dropdown */}
      {isOpen && !disabled && (
        <div
          className={`absolute left-0 z-[100] max-h-80 w-full min-w-[300px] overflow-x-hidden overflow-y-auto rounded-2xl border border-slate-200 bg-white p-2 shadow-xl ${
            placement === "top" ? "bottom-full mb-2" : "top-full mt-2"
          }`}
        >
          {/* Search Input Inside Dropdown */}
          <div className="mb-2 px-2 pt-2">
            <input
              type="text"
              placeholder="Search sports..."
              value={searchQuery}
              onChange={(e) => handleSearch(e.target.value)}
              className="focus:border-power-orange/50 focus:ring-power-orange/10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm focus:bg-white focus:ring-4 focus:outline-none"
              autoFocus
            />
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader size={20} className="text-power-orange animate-spin" />
            </div>
          ) : (
            <>
              {/* Sports List */}
              {filteredSports.length > 0 && (
                <div className="flex flex-col gap-1">
                  {filteredSports.map((sport) => {
                    const isSelected = value === sport.name;
                    return (
                      <button
                        key={sport.name}
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSelectSport(sport.name);
                        }}
                        className={`w-full rounded-xl px-3 py-2.5 text-left text-sm transition-colors ${
                          isSelected
                            ? "bg-power-orange/10 text-power-orange font-semibold"
                            : "text-slate-700 hover:bg-slate-50"
                        }`}
                      >
                        {sport.name}
                      </button>
                    );
                  })}
                </div>
              )}

              {filteredSports.length === 0 && (
                <div className="px-4 py-6 text-center text-sm text-slate-500">
                  No sports match "{searchQuery}"
                </div>
              )}
            </>
          )}
        </div>
      )}

      {required && !value && (
        <p className="mt-1.5 px-1 text-xs font-medium text-red-500">Please select a sport</p>
      )}
    </div>
  );
}
