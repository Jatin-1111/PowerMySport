import React from "react";
import { Search, SlidersHorizontal, X } from "lucide-react";
import { Modal } from "@/modules/shared/ui/Modal";

export interface ActiveFilter {
  id: string;
  label: React.ReactNode;
  onRemove: () => void;
  badgeClassName?: string;
  iconClassName?: string;
}

interface FilterBarProps {
  searchValue: string;
  onSearchChange: (val: string) => void;
  searchPlaceholder: string;
  onSearchClear: () => void;
  onSubmit: (e: React.FormEvent) => void;
  isModalOpen: boolean;
  onModalOpenChange: (isOpen: boolean) => void;
  activeFilters: ActiveFilter[];
  onClearAll: () => void;
  children: React.ReactNode;
}

export function FilterBar({
  searchValue,
  onSearchChange,
  searchPlaceholder,
  onSearchClear,
  onSubmit,
  isModalOpen,
  onModalOpenChange,
  activeFilters,
  onClearAll,
  children,
}: FilterBarProps) {
  const hasFilters = activeFilters.length > 0;

  return (
    <>
      {/* ── Premium Compact Filter Bar ────────────────────────── */}
      <div className="border-b border-slate-100 bg-white">
        <div className="max-w-8xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
          <form onSubmit={onSubmit} className="flex flex-col gap-3">
            <div className="flex items-center gap-3">
              {/* Search input - takes most space */}
              <div className="relative min-w-0 flex-1">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={16} />
                <input
                  type="text"
                  value={searchValue}
                  onChange={(e) => onSearchChange(e.target.value)}
                  placeholder={searchPlaceholder}
                  className="w-full rounded-full border border-slate-200 bg-slate-50 py-2.5 pl-10 pr-10 text-sm text-slate-900 shadow-sm placeholder:text-slate-400 focus:border-power-orange focus:bg-white focus:outline-none focus:ring-2 focus:ring-power-orange/20 transition-all"
                />
                {searchValue && (
                  <button
                    type="button"
                    onClick={onSearchClear}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 transition-colors"
                  >
                    <X size={15} />
                  </button>
                )}
              </div>

              {/* Filters toggle button */}
              <button
                type="button"
                onClick={() => onModalOpenChange(true)}
                className="relative flex shrink-0 items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition-all hover:bg-slate-50 hover:border-slate-300"
              >
                <SlidersHorizontal size={16} />
                <span className="hidden sm:inline">Filters</span>
                {hasFilters && (
                  <span className="absolute right-2 top-2 h-2.5 w-2.5 rounded-full bg-power-orange ring-2 ring-white" />
                )}
              </button>
            </div>

            {/* Active Filter Badges */}
            {hasFilters && (
              <div className="flex items-center gap-2 overflow-x-auto no-scrollbar whitespace-nowrap pb-1">
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider mr-1">Active:</span>

                {activeFilters.map((filter) => (
                  <span
                    key={filter.id}
                    className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-semibold ${filter.badgeClassName || 'bg-orange-50 border-orange-100 text-power-orange'}`}
                  >
                    {filter.label}
                    <button type="button" onClick={filter.onRemove} className={`ml-1 ${filter.iconClassName || 'hover:text-orange-700'}`}>
                      <X size={12} />
                    </button>
                  </span>
                ))}

                <button
                  type="button"
                  onClick={onClearAll}
                  className="text-xs font-bold text-slate-400 hover:text-slate-700 transition ml-2 underline underline-offset-2"
                >
                  Clear All
                </button>
              </div>
            )}
          </form>
        </div>
      </div>

      {/* ── Filter Modal ────────────────────────────────────────── */}
      <Modal isOpen={isModalOpen} onClose={() => onModalOpenChange(false)} title="Filters" size="md">
        <div className="p-1">
          <div className="space-y-6">
            {children}
          </div>

          <div className="mt-8 flex items-center gap-3 pt-5 border-t border-slate-100">
            <button
              type="button"
              onClick={onClearAll}
              className="flex-1 rounded-xl px-4 py-3.5 text-sm font-bold text-slate-600 underline underline-offset-2 hover:text-slate-900 transition-colors"
            >
              Clear all
            </button>
            <button
              type="button"
              onClick={() => onModalOpenChange(false)}
              className="flex-1 rounded-xl bg-power-orange px-4 py-3.5 text-sm font-bold text-white shadow-sm transition hover:bg-orange-600"
            >
              Show Results
            </button>
          </div>
        </div>
      </Modal>
    </>
  );
}
