"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Check, ChevronDown } from "lucide-react";
import React, { useEffect, useRef, useState } from "react";

/**
 * The contact form's two controls: a text field and a listbox select.
 *
 * The select is custom (not a native <select>) so each option can carry an icon, and it
 * is built to the listbox pattern: arrow keys, Home and End, type-ahead, Escape to close
 * and return focus, Tab to leave. The page's tests drive it by those keys.
 */

interface FieldProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  required?: boolean;
  /** Marks an optional field in words, which reads better than a star on the others. */
  optional?: boolean;
}

export function Field({ label, id, required, optional, ...props }: FieldProps) {
  return (
    <div>
      <label htmlFor={id} className="text-ink mb-1.5 block text-sm font-medium">
        {label} {required && <span className="text-power-orange-solid">*</span>}
        {optional && <span className="text-ink-muted ml-1 font-normal">optional</span>}
      </label>
      <input
        id={id}
        required={required}
        className="border-hairline text-ink placeholder:text-ink-muted focus:border-ink focus:ring-ink w-full rounded-lg border bg-white px-4 py-3 transition-colors duration-300 focus:outline-none focus:ring-1"
        {...props}
      />
    </div>
  );
}

export interface SelectOption {
  value: string;
  label: string;
  icon?: React.ElementType;
}

interface CustomSelectProps {
  id: string;
  label: string;
  required?: boolean;
  placeholder: string;
  value: string;
  options: SelectOption[];
  onChange: (value: string) => void;
}

export function CustomSelect({
  id,
  label,
  required,
  placeholder,
  value,
  options,
  onChange,
}: CustomSelectProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const optionRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const typeaheadRef = useRef({ buffer: "", lastTime: 0 });

  const close = (refocusTrigger: boolean) => {
    setOpen(false);
    if (refocusTrigger) triggerRef.current?.focus();
  };

  useEffect(() => {
    if (!open) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const selectedIndex = options.findIndex((opt) => opt.value === value);
    const focusIndex = selectedIndex >= 0 ? selectedIndex : 0;
    optionRefs.current[focusIndex]?.focus();
  }, [open, options, value]);

  const focusOption = (index: number) => {
    const clamped = Math.max(0, Math.min(options.length - 1, index));
    optionRefs.current[clamped]?.focus();
  };

  const selectOption = (opt: SelectOption) => {
    onChange(opt.value);
    close(true);
  };

  const handleTriggerKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
    if (["ArrowDown", "ArrowUp", "Enter", " "].includes(e.key)) {
      e.preventDefault();
      setOpen(true);
    }
  };

  const handleOptionKeyDown = (
    e: React.KeyboardEvent<HTMLButtonElement>,
    index: number,
    opt: SelectOption
  ) => {
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        focusOption(index + 1);
        break;
      case "ArrowUp":
        e.preventDefault();
        focusOption(index - 1);
        break;
      case "Home":
        e.preventDefault();
        focusOption(0);
        break;
      case "End":
        e.preventDefault();
        focusOption(options.length - 1);
        break;
      case "Enter":
      case " ":
        e.preventDefault();
        selectOption(opt);
        break;
      case "Escape":
        e.preventDefault();
        close(true);
        break;
      case "Tab":
        setOpen(false);
        break;
      default:
        if (e.key.length === 1 && /\S/.test(e.key)) {
          // The event's own clock: the same milliseconds, without reading the time ourselves.
          const now = e.timeStamp;
          const buf =
            now - typeaheadRef.current.lastTime < 600
              ? typeaheadRef.current.buffer + e.key.toLowerCase()
              : e.key.toLowerCase();
          typeaheadRef.current = { buffer: buf, lastTime: now };
          const match = options.findIndex((o) => o.label.toLowerCase().startsWith(buf));
          if (match >= 0) focusOption(match);
        }
    }
  };

  const selected = options.find((opt) => opt.value === value);
  const SelectedIcon = selected?.icon;

  return (
    <div ref={containerRef} className="relative">
      <label htmlFor={id} className="text-ink mb-1.5 block text-sm font-medium">
        {label} {required && <span className="text-power-orange-solid">*</span>}
      </label>

      <button
        ref={triggerRef}
        type="button"
        id={id}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        onKeyDown={handleTriggerKeyDown}
        className={`text-ink focus-visible:ring-ink flex w-full items-center justify-between gap-3 rounded-lg border bg-white px-4 py-3 text-left transition-colors duration-300 focus:outline-none focus-visible:ring-1 ${
          open ? "border-ink ring-ink ring-1" : "border-hairline hover:border-ink/40"
        }`}
      >
        <span className="flex items-center gap-2.5 truncate">
          {SelectedIcon && (
            <span className="bg-paper-deep text-ink flex h-7 w-7 shrink-0 items-center justify-center rounded-md">
              <SelectedIcon className="h-4 w-4" strokeWidth={2} />
            </span>
          )}
          <span className={selected ? "text-ink" : "text-ink-muted"}>
            {selected ? selected.label : placeholder}
          </span>
        </span>
        <ChevronDown
          className={`text-ink-muted h-4 w-4 shrink-0 transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] motion-reduce:transition-none ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>

      <AnimatePresence>
        {open && (
          <motion.ul
            role="listbox"
            aria-labelledby={id}
            initial={{ opacity: 0, y: -8, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.97 }}
            transition={{ type: "spring", stiffness: 420, damping: 30 }}
            style={{ originY: 0 }}
            className="border-hairline absolute z-20 mt-2 w-full overflow-hidden rounded-xl border bg-white p-1.5 shadow-[0_18px_40px_-24px_rgba(57,34,30,0.35)]"
          >
            {options.map((opt, index) => {
              const isSelected = opt.value === value;
              const OptIcon = opt.icon;
              return (
                <li key={opt.value} role="option" aria-selected={isSelected}>
                  <button
                    ref={(el) => {
                      optionRefs.current[index] = el;
                    }}
                    type="button"
                    onClick={() => selectOption(opt)}
                    onKeyDown={(e) => handleOptionKeyDown(e, index, opt)}
                    className={`focus-visible:bg-paper-deep focus-visible:ring-ink flex w-full items-center gap-2.5 rounded-md px-3 py-2.5 text-left text-sm transition-colors focus:outline-none focus-visible:ring-1 ${
                      isSelected
                        ? "bg-paper-deep text-ink font-semibold"
                        : "text-ink-body hover:bg-paper-deep/60"
                    }`}
                  >
                    {OptIcon && (
                      <span
                        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md ${
                          isSelected ? "text-ink bg-white" : "bg-paper-deep text-ink-muted"
                        }`}
                      >
                        <OptIcon className="h-4 w-4" strokeWidth={2} />
                      </span>
                    )}
                    <span className="flex-1 truncate">{opt.label}</span>
                    {isSelected && <Check className="h-4 w-4 shrink-0" />}
                  </button>
                </li>
              );
            })}
          </motion.ul>
        )}
      </AnimatePresence>
    </div>
  );
}
