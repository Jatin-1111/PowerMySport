"use client";

import { sportsApi, Sport } from "@/modules/sports/services/sports";
import { Button } from "@/modules/shared/ui/Button";
import { useState, useEffect, useCallback, useRef } from "react";
import { ChevronDown, X, Loader, Plus, AlertCircle } from "lucide-react";
import Fuse from "fuse.js";

interface SportsMultiSelectProps {
  value: string[];
  onChange: (sports: string[]) => void;
  disabled?: boolean;
  required?: boolean;
}

export default function SportsMultiSelect({
  value,
  onChange,
  disabled = false,
  required = false,
}: SportsMultiSelectProps) {
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
    if (!value.includes(sport)) {
      onChange([...value, sport]);
    }
    setSearchQuery("");
    setIsOpen(true); // Keep dropdown open for multiple selections
  };

  // Handle sport removal
  const handleRemoveSport = (sport: string) => {
    onChange(value.filter((s) => s !== sport));
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
          `Invalid sport: ${verification.message}. Please try another.`,
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

  // Get selected sport objects
  const selectedSportObjects = allSports.filter((sport) =>
    value.includes(sport.name),
  );

  return (
    <div className="w-full" ref={containerRef}>
      {/* Selected Sports Display */}
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

      {/* Search Input */}
      <div className="relative">
        <div className="relative">
          <input
            type="text"
            placeholder="Search or add sports..."
            value={searchQuery}
            onChange={(e) => handleSearch(e.target.value)}
            onFocus={() => setIsOpen(true)}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                setIsOpen(false);
              }
            }}
            disabled={disabled || isLoading}
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm placeholder-slate-500 focus:border-blue-500 focus:outline-none disabled:cursor-not-allowed disabled:bg-slate-50"
          />
          <ChevronDown
            size={18}
            className="absolute right-3 top-2.5 text-slate-400"
          />
        </div>

        {/* Dropdown */}
        {isOpen && !disabled && (
          <div className="absolute left-0 right-0 top-full z-10 mt-1 max-h-64 overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-lg">
            {isLoading ? (
              <div className="flex items-center justify-center px-4 py-6">
                <Loader size={20} className="animate-spin text-blue-500" />
              </div>
            ) : (
              <>
                {/* Sports List */}
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
                          className="w-full px-4 py-2 text-left text-sm hover:bg-blue-50 disabled:cursor-default disabled:bg-blue-50 disabled:text-slate-600 focus:outline-none"
                        >
                          <div className="flex items-center gap-2">
                            {isSelected && (
                              <div className="h-4 w-4 rounded bg-blue-500" />
                            )}
                            <span className={isSelected ? "font-semibold" : ""}>
                              {sport.name}
                            </span>
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

                {/* Custom Sport Input - Always visible */}
                <div className="border-t border-slate-200 px-4 py-3">
                  <div className="mb-2 flex items-center gap-2 text-xs font-semibold text-slate-600">
                    <Plus size={14} />
                    Add Custom Sport
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="e.g., Parkour"
                      value={customSportInput}
                      onChange={(e) => {
                        setCustomSportInput(e.target.value);
                        setCustomSportError("");
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          handleAddCustomSport();
                        }
                      }}
                      disabled={isVerifyingCustom}
                      className="flex-1 rounded border border-slate-200 bg-white px-2 py-1 text-sm placeholder-slate-400 focus:border-blue-500 focus:outline-none disabled:bg-slate-50"
                    />
                    <Button
                      type="button"
                      onClick={handleAddCustomSport}
                      disabled={isVerifyingCustom || !customSportInput.trim()}
                      size="sm"
                      variant="primary"
                      className="whitespace-nowrap"
                    >
                      {isVerifyingCustom ? (
                        <Loader size={14} className="animate-spin" />
                      ) : (
                        "Add"
                      )}
                    </Button>
                  </div>

                  {/* Custom Sport Error */}
                  {customSportError && (
                    <div className="mt-2 flex items-start gap-2 rounded bg-red-50 p-2 text-xs text-red-600">
                      <AlertCircle size={14} className="mt-0.5 flex-shrink-0" />
                      <span>{customSportError}</span>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* Error message for no sports selected if required */}
      {required && value.length === 0 && (
        <p className="mt-1 text-xs text-red-500">
          Please select at least one sport
        </p>
      )}
    </div>
  );
}
