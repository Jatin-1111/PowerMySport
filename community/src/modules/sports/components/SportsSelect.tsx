"use client";

import { sportsApi, Sport } from "@/modules/sports/services/sports";
import { useState, useEffect, useCallback, useRef } from "react";
import { ChevronDown, Loader, Plus, AlertCircle } from "lucide-react";
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
  const [customSportInput, setCustomSportInput] = useState("");
  const [isVerifyingCustom, setIsVerifyingCustom] = useState(false);
  const [customSportError, setCustomSportError] = useState("");
  const [fuse, setFuse] = useState<Fuse<Sport> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Handle click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
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
      setCustomSportError("");

      if (!query.trim()) {
        setFilteredSports(allSports);
        return;
      }

      if (fuse) {
        const results = fuse.search(query);
        setFilteredSports(results.map((result) => result.item));
      }
    },
    [fuse, allSports],
  );

  // Handle sport selection
  const handleSelectSport = (sport: string) => {
    onChange(sport);
    setSearchQuery("");
    setIsOpen(false);
  };

  // Handle custom sport verification and addition
  const handleAddCustomSport = async () => {
    if (!customSportInput.trim()) {
      setCustomSportError("Please enter a sport name");
      return;
    }

    setIsVerifyingCustom(true);
    setCustomSportError("");

    try {
      // Step 1: Verify the sport using Gemini
      const verification = await sportsApi.verifySport(customSportInput.trim());

      if (!verification.isValid) {
        setCustomSportError(
          `Invalid sport: ${verification.message}. Please try another.`
        );
        setIsVerifyingCustom(false);
        return;
      }

      // Step 2: Add the custom sport
      const newSport = await sportsApi.addCustomSport(customSportInput.trim());

      if (newSport) {
        // Add to local sports list
        setAllSports((prev) => [...prev, newSport]);

        // Re-initialize fuse
        const updatedSports = [...allSports, newSport];
        const fuseInstance = new Fuse(updatedSports, {
          keys: ["name"],
          threshold: 0.3,
        });
        setFuse(fuseInstance);

        // Add to selected sports
        handleSelectSport(newSport.name);
        setCustomSportInput("");
      }
    } catch (error) {
      setCustomSportError("Failed to add sport. Please try again.");
      console.error("Error adding custom sport:", error);
    } finally {
      setIsVerifyingCustom(false);
    }
  };

  return (
    <div className="w-full relative" ref={containerRef}>
      {/* Trigger Button / Input */}
      <div 
        className={`flex items-center justify-between w-full rounded-2xl border border-slate-200 bg-white/80 px-4 py-3.5 text-sm font-medium text-slate-900 shadow-sm backdrop-blur transition-all focus-within:border-power-orange/50 focus-within:bg-white focus-within:ring-4 focus-within:ring-power-orange/10 ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
        onClick={() => !disabled && setIsOpen(true)}
      >
        <span className={value ? "text-slate-900" : "text-slate-400"}>
          {value || placeholder}
        </span>
        <ChevronDown size={18} className="text-slate-400" />
      </div>

      {/* Dropdown */}
      {isOpen && !disabled && (
        <div className={`absolute left-0 z-[100] w-full min-w-[300px] max-h-80 overflow-y-auto overflow-x-hidden rounded-2xl border border-slate-200 bg-white p-2 shadow-xl ${
          placement === 'top' ? 'bottom-full mb-2' : 'top-full mt-2'
        }`}>
          {/* Search Input Inside Dropdown */}
          <div className="mb-2 px-2 pt-2">
            <input
              type="text"
              placeholder="Search sports..."
              value={searchQuery}
              onChange={(e) => handleSearch(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm focus:border-power-orange/50 focus:bg-white focus:outline-none focus:ring-4 focus:ring-power-orange/10"
              autoFocus
            />
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader size={20} className="animate-spin text-power-orange" />
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
                            : "hover:bg-slate-50 text-slate-700"
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
                  No predefined sports match "{searchQuery}"
                </div>
              )}

              {/* Custom Sport Input */}
              <div className="mt-2 border-t border-slate-100 px-2 pt-3 pb-1">
                <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
                  <Plus size={14} />
                  Add New Sport
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="e.g., Pickleball"
                    value={customSportInput}
                    onChange={(e) => {
                      setCustomSportInput(e.target.value);
                      setCustomSportError("");
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        e.stopPropagation();
                        handleAddCustomSport();
                      }
                    }}
                    disabled={isVerifyingCustom}
                    className="flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm placeholder-slate-400 focus:border-power-orange/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-power-orange/10 disabled:opacity-50"
                  />
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleAddCustomSport();
                    }}
                    disabled={isVerifyingCustom || !customSportInput.trim()}
                    className="flex h-[38px] items-center justify-center rounded-xl bg-power-orange px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-[#d96610] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {isVerifyingCustom ? (
                      <Loader size={16} className="animate-spin" />
                    ) : (
                      "Verify"
                    )}
                  </button>
                </div>

                {/* Custom Sport Error */}
                {customSportError && (
                  <div className="mt-2 flex items-start gap-2 rounded-xl bg-red-50 p-2.5 text-xs text-red-600">
                    <AlertCircle size={14} className="mt-0.5 shrink-0" />
                    <span>{customSportError}</span>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      )}

      {required && !value && (
        <p className="mt-1.5 px-1 text-xs text-red-500 font-medium">
          Please select a sport
        </p>
      )}
    </div>
  );
}
