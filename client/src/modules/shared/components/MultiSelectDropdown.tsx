"use client";

import { clsx } from "clsx";
import { Check, ChevronDown, X } from "lucide-react";
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
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
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
    onChange(value.includes(opt) ? value.filter((v) => v !== opt) : [...value, opt]);
  };

  const handleTriggerKeyDown = (e: React.KeyboardEvent) => {
    if (disabled) return;
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      if (isOpen) {
        optionRefs.current[e.key === "ArrowDown" ? 0 : options.length - 1]?.focus();
      } else {
        open(e.key === "ArrowDown" ? 0 : options.length - 1);
      }
    } else if (e.key === "Escape" && isOpen) {
      e.preventDefault();
      close(true);
    }
  };

  const handleListKeyDown = (e: React.KeyboardEvent) => {
    const focused = optionRefs.current.findIndex((el) => el === document.activeElement);
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        optionRefs.current[(focused + 1) % options.length]?.focus();
        break;
      case "ArrowUp":
        e.preventDefault();
        optionRefs.current[(focused - 1 + options.length) % options.length]?.focus();
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
    <div className="relative w-full" ref={containerRef} onBlur={handleBlur}>
      {value.length > 0 && (
        <ul className="mb-3 flex flex-wrap gap-2" aria-label={`Selected ${label.toLowerCase()}`}>
          {value.map((opt) => (
            <li
              key={opt}
              className="border-hairline bg-paper-deep text-ink flex min-h-11 items-center gap-1 rounded-md border pl-3 text-sm font-medium"
            >
              {opt}
              <button
                type="button"
                aria-label={`Remove ${opt}`}
                onClick={(e) => {
                  e.stopPropagation();
                  onChange(value.filter((v) => v !== opt));
                }}
                disabled={disabled}
                className="text-ink-body hover:text-ink focus-visible:ring-ink inline-flex h-11 w-11 items-center justify-center rounded-md focus-visible:outline-none focus-visible:ring-2 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <X size={16} strokeWidth={1.5} aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
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
          aria-label={`${label}, ${value.length} selected`}
          className={cn(
            "border-ink/25 focus-visible:ring-ink flex min-h-11 w-full items-center justify-between rounded-md border bg-white px-3 py-2 text-left text-sm focus:outline-none focus-visible:ring-2",
            isOpen && "border-ink",
            disabled && "cursor-not-allowed opacity-50"
          )}
        >
          <span className="text-ink-ash">{value.length === 0 ? placeholder : addMoreText}</span>
          <ChevronDown
            aria-hidden="true"
            size={18}
            strokeWidth={1.5}
            className={cn(
              "text-ink-body transition-transform duration-200",
              isOpen && "rotate-180"
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
              "border-ink/25 bg-paper absolute z-20 max-h-60 w-full overflow-y-auto rounded-md border",
              openUp ? "bottom-full mb-1" : "top-full mt-1"
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
                    "text-ink hover:bg-paper-deep focus-visible:bg-paper-deep focus-visible:ring-ink flex min-h-11 w-full items-center justify-between gap-3 px-4 py-2 text-left text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-inset",
                    isSelected && "font-medium"
                  )}
                >
                  {opt}
                  {isSelected && <Check size={16} strokeWidth={1.5} aria-hidden="true" />}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
