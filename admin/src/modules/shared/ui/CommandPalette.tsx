"use client";

import { Search, CornerDownLeft } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

export interface CommandPaletteItem {
  href: string;
  label: string;
  group: string;
  icon: React.ComponentType<{ size?: number }>;
}

interface CommandPaletteProps {
  open: boolean;
  items: CommandPaletteItem[];
  onClose: () => void;
  onNavigate: (href: string) => void;
}

const fuzzyMatch = (query: string, target: string): boolean => {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) return true;
  return target.toLowerCase().includes(normalizedQuery);
};

export function CommandPalette({
  open,
  items,
  onClose,
  onNavigate,
}: CommandPaletteProps) {
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const results = useMemo(() => {
    if (!query.trim()) return items;
    return items.filter(
      (item) => fuzzyMatch(query, item.label) || fuzzyMatch(query, item.group),
    );
  }, [items, query]);

  useEffect(() => {
    if (open) {
      setQuery("");
      setActiveIndex(0);
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  useEffect(() => {
    if (!open) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      } else if (event.key === "ArrowDown") {
        event.preventDefault();
        setActiveIndex((prev) => Math.min(prev + 1, results.length - 1));
      } else if (event.key === "ArrowUp") {
        event.preventDefault();
        setActiveIndex((prev) => Math.max(prev - 1, 0));
      } else if (event.key === "Enter") {
        event.preventDefault();
        const target = results[activeIndex];
        if (target) {
          onNavigate(target.href);
          onClose();
        }
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, results, activeIndex, onNavigate, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-start justify-center bg-slate-900/50 p-4 pt-[12vh]"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 border-b border-slate-100 px-4 py-3">
          <Search className="h-4 w-4 shrink-0 text-slate-400" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Jump to a page..."
            className="w-full text-sm outline-none placeholder:text-slate-400"
          />
          <kbd className="hidden shrink-0 rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[10px] font-semibold text-slate-400 sm:block">
            ESC
          </kbd>
        </div>

        <div className="max-h-80 overflow-y-auto py-2">
          {results.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-slate-500">
              No matching pages.
            </p>
          ) : (
            results.map((item, index) => {
              const Icon = item.icon;
              const isActive = index === activeIndex;
              return (
                <button
                  key={item.href}
                  type="button"
                  onMouseEnter={() => setActiveIndex(index)}
                  onClick={() => {
                    onNavigate(item.href);
                    onClose();
                  }}
                  className={`flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm transition-colors ${
                    isActive
                      ? "bg-power-orange/10 text-power-orange"
                      : "text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  <Icon size={16} />
                  <span className="flex-1">{item.label}</span>
                  <span className="text-xs text-slate-400">{item.group}</span>
                  {isActive && (
                    <CornerDownLeft className="h-3.5 w-3.5 text-power-orange" />
                  )}
                </button>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
