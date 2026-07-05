"use client";

import { ReactNode, useEffect, useRef, useState } from "react";
import { Check, ChevronDown } from "lucide-react";

const useOutsideClose = (onClose: () => void) => {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handlePointer = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        onClose();
      }
    };
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    document.addEventListener("mousedown", handlePointer);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handlePointer);
      document.removeEventListener("keydown", handleKey);
    };
  }, [onClose]);

  return ref;
};

interface MultiCheckboxDropdownProps {
  label: string;
  icon?: ReactNode;
  options: string[];
  selected: string[];
  onToggle: (value: string) => void;
  emptyHint?: string;
}

export function MultiCheckboxDropdown({
  label,
  icon,
  options,
  selected,
  onToggle,
  emptyHint = "No options available yet",
}: MultiCheckboxDropdownProps) {
  const [open, setOpen] = useState(false);
  const ref = useOutsideClose(() => setOpen(false));
  const count = selected.length;

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        className={`flex w-full items-center justify-between gap-2 rounded-xl border px-3 py-2 text-sm font-medium transition ${
          count > 0
            ? "border-power-orange/50 bg-power-orange/5 text-slate-800"
            : "border-slate-300 bg-slate-50 text-slate-600 hover:bg-white"
        }`}
      >
        <span className="flex items-center gap-1.5 truncate">
          {icon}
          {label}
          {count > 0 ? (
            <span className="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-power-orange px-1 text-[10px] font-bold text-white">
              {count}
            </span>
          ) : null}
        </span>
        <ChevronDown
          size={15}
          className={`shrink-0 text-slate-400 transition ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open ? (
        <div className="absolute left-0 z-40 mt-2 max-h-64 w-full min-w-[13rem] overflow-y-auto rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl">
          {options.length === 0 ? (
            <p className="px-2 py-3 text-center text-xs text-slate-400">
              {emptyHint}
            </p>
          ) : (
            options.map((option) => {
              const active = selected.includes(option);
              return (
                <button
                  key={option}
                  type="button"
                  onClick={() => onToggle(option)}
                  className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm text-slate-700 transition hover:bg-slate-50"
                >
                  <span
                    className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border transition ${
                      active
                        ? "border-power-orange bg-power-orange text-white"
                        : "border-slate-300 bg-white"
                    }`}
                  >
                    {active ? <Check size={12} strokeWidth={3} /> : null}
                  </span>
                  <span className="truncate">{option}</span>
                </button>
              );
            })
          )}
        </div>
      ) : null}
    </div>
  );
}

interface SelectOption {
  value: string;
  label: string;
}

interface SelectDropdownProps {
  label?: string;
  icon?: ReactNode;
  options: SelectOption[];
  value: string;
  onChange: (value: string) => void;
  renderSuffix?: (value: string) => ReactNode;
  className?: string;
}

export function SelectDropdown({
  label,
  icon,
  options,
  value,
  onChange,
  renderSuffix,
  className = "",
}: SelectDropdownProps) {
  const [open, setOpen] = useState(false);
  const ref = useOutsideClose(() => setOpen(false));
  const current = options.find((option) => option.value === value) ?? options[0];

  return (
    <div ref={ref} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setOpen((state) => !state)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-2 rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-white"
      >
        <span className="flex items-center gap-1.5 truncate">
          {icon}
          {label ? <span className="text-slate-400">{label}:</span> : null}
          <span className="font-semibold text-slate-800">
            {current?.label ?? "All"}
          </span>
        </span>
        <ChevronDown
          size={15}
          className={`shrink-0 text-slate-400 transition ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open ? (
        <div className="absolute left-0 z-40 mt-2 max-h-72 w-full min-w-[15rem] overflow-y-auto rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl">
          {options.map((option) => {
            const active = option.value === value;
            const suffix = renderSuffix ? renderSuffix(option.value) : null;
            return (
              <div key={option.value || "all"} className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => {
                    onChange(option.value);
                    setOpen(false);
                  }}
                  className={`flex flex-1 items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm transition ${
                    active
                      ? "bg-power-orange/10 font-semibold text-power-orange"
                      : "text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  <span
                    className={`flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full border transition ${
                      active ? "border-power-orange" : "border-slate-300"
                    }`}
                  >
                    {active ? (
                      <span className="h-1.5 w-1.5 rounded-full bg-power-orange" />
                    ) : null}
                  </span>
                  <span className="truncate">{option.label}</span>
                </button>
                {suffix ? <div className="pr-1.5">{suffix}</div> : null}
              </div>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
