"use client";

import { ChevronDown, X } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

function cn(...inputs: (string | undefined | null | false)[]) {
  return twMerge(clsx(inputs));
}

const EXPERTISE_OPTIONS = [
  "Technical Coaching",
  "Strength & Conditioning",
  "Sports Psychology",
  "Nutrition Planning",
  "Rehabilitation",
  "Strategy & Tactics",
  "Youth Development",
  "Professional Mentorship",
  "Fitness Training",
  "Biomechanics",
  "Other"
];

interface ExpertiseMultiSelectProps {
  value: string[];
  onChange: (expertise: string[]) => void;
  disabled?: boolean;
}

export default function ExpertiseMultiSelect({
  value,
  onChange,
  disabled = false,
}: ExpertiseMultiSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  const toggleExpertise = (exp: string) => {
    const updated = value.includes(exp)
      ? value.filter((e) => e !== exp)
      : [...value, exp];
    onChange(updated);
  };

  const removeExpertise = (exp: string) => {
    onChange(value.filter((e) => e !== exp));
  };

  return (
    <div className="w-full relative" ref={containerRef}>
      {/* Selected Tags Display */}
      {value.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-2 pb-2">
          {value.map((exp) => (
            <div
              key={exp}
              className="inline-flex items-center gap-1 bg-power-orange/10 text-power-orange px-2.5 py-1 rounded-md text-xs font-medium"
            >
              <span>{exp}</span>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  removeExpertise(exp);
                }}
                disabled={disabled}
                className="hover:bg-power-orange/20 rounded-full p-0.5 transition-colors focus:outline-none"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Dropdown Button */}
      <div className="relative">
        <button
          type="button"
          onClick={() => !disabled && setIsOpen(!isOpen)}
          disabled={disabled}
          className={cn(
            "flex w-full items-center justify-between rounded-xl border bg-slate-50 px-4 py-2.5 text-sm transition-all focus:outline-none",
            isOpen ? "border-power-orange ring-2 ring-power-orange/20 bg-white" : "border-slate-200 hover:bg-slate-100",
            disabled && "opacity-50 cursor-not-allowed"
          )}
        >
          <span className="text-slate-500">
            {value.length === 0 ? "Select expertise..." : `Add more expertise...`}
          </span>
          <ChevronDown
            className={cn("h-4 w-4 text-slate-400 transition-transform", isOpen && "rotate-180")}
          />
        </button>

        {/* Dropdown Menu */}
        {isOpen && (
          <div className="absolute z-20 mt-1 max-h-60 w-full overflow-y-auto rounded-xl border border-slate-200 bg-white p-2 shadow-lg shadow-black/5">
            {EXPERTISE_OPTIONS.map((exp) => {
              const isSelected = value.includes(exp);
              return (
                <button
                  key={exp}
                  type="button"
                  onClick={() => toggleExpertise(exp)}
                  className={cn(
                    "flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm text-left transition-colors",
                    isSelected
                      ? "bg-power-orange/10 text-power-orange font-semibold"
                      : "text-slate-700 hover:bg-slate-50"
                  )}
                >
                  {exp}
                  {isSelected && (
                    <div className="h-2 w-2 rounded-full bg-power-orange" />
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
