"use client";

import { clsx } from "clsx";
import { ChevronDown, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { twMerge } from "tailwind-merge";

function cn(...inputs: (string | undefined | null | false)[]) {
  return twMerge(clsx(inputs));
}

interface MultiSelectDropdownProps {
  /** Accessible name for the control, e.g. "Languages" */
  label: string;
  /** id applied to the trigger button so a <label htmlFor> can target it */
  id?: string;
  options: string[];
  value: string[];
  onChange: (next: string[]) => void;
  placeholder: string;
  addMoreText: string;
  disabled?: boolean;
}

/**
 * Fully keyboard-accessible multi-select (ARIA listbox pattern):
 * - Enter/Space/ArrowDown on the trigger opens the list and focuses an option
 * - ArrowUp/ArrowDown/Home/End move between options (with wrap-around)
 * - Enter/Space toggles an option; the list stays open for multi-selection
 * - Escape closes and returns focus to the trigger; Tab/blur also closes
 * - Flips upward when there isn't enough room below the trigger
 */
export default function MultiSelectDropdown({
  label,
  id,
  options,
  value,
  onChange,
  placeholder,
  addMoreText,
  disabled = false,
}: MultiSelectDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [openUp, setOpenUp] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const optionRefs = useRef<(HTMLButtonElement | null)[]>([]);
  // Which option to focus once the list renders (-1 = leave focus alone)
  const pendingFocus = useRef(-1);

  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  // Focus the requested option after the list mounts
  useEffect(() => {
    if (isOpen && pendingFocus.current >= 0) {
      optionRefs.current[pendingFocus.current]?.focus();
      pendingFocus.current = -1;
    }
  }, [isOpen]);

  const open = useCallback((focusIndex: number) => {
    if (containerRef.current) {
      // Flip upward when the list (max-h-60 = 240px + margin) wouldn't fit
      const rect = containerRef.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      setOpenUp(spaceBelow < 260 && rect.top > spaceBelow);
    }
    pendingFocus.current = focusIndex;
    setIsOpen(true);
  }, []);

  const close = useCallback((refocusTrigger: boolean) => {
    setIsOpen(false);
    if (refocusTrigger) triggerRef.current?.focus();
  }, []);

  const toggleOption = (opt: string) => {
    onChange(
      value.includes(opt) ? value.filter((v) => v !== opt) : [...value, opt],
    );
  };

  const handleTriggerKeyDown = (e: React.KeyboardEvent) => {
    if (disabled) return;
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      if (isOpen) {
        optionRefs.current[
          e.key === "ArrowDown" ? 0 : options.length - 1
        ]?.focus();
      } else {
        open(e.key === "ArrowDown" ? 0 : options.length - 1);
      }
    } else if (e.key === "Escape" && isOpen) {
      e.preventDefault();
      close(true);
    }
  };

  const handleListKeyDown = (e: React.KeyboardEvent) => {
    const focused = optionRefs.current.findIndex(
      (el) => el === document.activeElement,
    );
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        optionRefs.current[(focused + 1) % options.length]?.focus();
        break;
      case "ArrowUp":
        e.preventDefault();
        optionRefs.current[
          (focused - 1 + options.length) % options.length
        ]?.focus();
        break;
      case "Home":
        e.preventDefault();
        optionRefs.current[0]?.focus();
        break;
      case "End":
        e.preventDefault();
        optionRefs.current[options.length - 1]?.focus();
        break;
      case "Escape":
        e.preventDefault();
        close(true);
        break;
      case "Tab":
        // Let focus move on naturally, just close the list
        setIsOpen(false);
        break;
    }
  };

  // Close when focus leaves the whole control (e.g. Shift+Tab out).
  // relatedTarget is null when focus moves to a non-focusable target (e.g.
  // clicking the list's scrollbar in Firefox) — the outside-mousedown
  // listener already covers real outside clicks, so don't close on null.
  const handleBlur = (e: React.FocusEvent) => {
    if (
      isOpen &&
      e.relatedTarget &&
      containerRef.current &&
      !containerRef.current.contains(e.relatedTarget as Node)
    ) {
      setIsOpen(false);
    }
  };

  return (
    <div className="w-full relative" ref={containerRef} onBlur={handleBlur}>
      {value.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-2 pb-2">
          {value.map((opt) => (
            <div
              key={opt}
              className="inline-flex items-center gap-1 bg-power-orange/10 text-power-orange px-2.5 py-1 rounded-md text-xs font-medium"
            >
              <span>{opt}</span>
              <button
                type="button"
                aria-label={`Remove ${opt}`}
                onClick={(e) => {
                  e.stopPropagation();
                  onChange(value.filter((v) => v !== opt));
                }}
                disabled={disabled}
                className="rounded-full p-0.5 transition-colors hover:bg-power-orange/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-power-orange"
              >
                <X className="h-3 w-3" aria-hidden="true" />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="relative">
        <button
          type="button"
          id={id}
          ref={triggerRef}
          onClick={() => (isOpen ? close(false) : open(0))}
          onKeyDown={handleTriggerKeyDown}
          disabled={disabled}
          aria-haspopup="listbox"
          aria-expanded={isOpen}
          aria-label={`${label} — ${value.length} selected`}
          className={cn(
            "flex w-full items-center justify-between rounded-xl border bg-slate-50 px-4 py-2.5 text-sm transition-all focus:outline-none focus-visible:border-power-orange focus-visible:ring-2 focus-visible:ring-power-orange/40 dark:bg-slate-800/50",
            isOpen
              ? "border-power-orange ring-2 ring-power-orange/20 bg-white dark:bg-slate-800"
              : "border-slate-200 hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800",
            disabled && "opacity-50 cursor-not-allowed",
          )}
        >
          <span className="text-slate-500 dark:text-slate-400">
            {value.length === 0 ? placeholder : addMoreText}
          </span>
          <ChevronDown
            aria-hidden="true"
            className={cn(
              "h-4 w-4 text-slate-400 transition-transform",
              isOpen && "rotate-180",
            )}
          />
        </button>

        {isOpen && (
          <div
            role="listbox"
            aria-label={label}
            aria-multiselectable="true"
            onKeyDown={handleListKeyDown}
            className={cn(
              "absolute z-20 max-h-60 w-full overflow-y-auto rounded-xl border border-slate-200 bg-white p-2 shadow-lg shadow-black/5 dark:border-slate-700 dark:bg-slate-900",
              openUp ? "bottom-full mb-1" : "top-full mt-1",
            )}
          >
            {options.map((opt, i) => {
              const isSelected = value.includes(opt);
              return (
                <button
                  key={opt}
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  ref={(el) => {
                    optionRefs.current[i] = el;
                  }}
                  onClick={() => toggleOption(opt)}
                  className={cn(
                    "flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm text-left transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-power-orange/60",
                    isSelected
                      ? "bg-power-orange/10 text-power-orange font-semibold"
                      : "text-slate-700 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800",
                  )}
                >
                  {opt}
                  {isSelected && (
                    <div
                      className="h-2 w-2 rounded-full bg-power-orange"
                      aria-hidden="true"
                    />
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
