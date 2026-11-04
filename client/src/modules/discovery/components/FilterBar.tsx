import { Modal } from "@/modules/shared/ui/Modal";
import { Search, SlidersHorizontal, X } from "lucide-react";
import React from "react";

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
  /** A quick filter set directly under the search box, e.g. a row of sport chips. */
  quickFilters?: React.ReactNode;
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
  quickFilters,
  children,
}: FilterBarProps) {
  const hasFilters = activeFilters.length > 0;

  return (
    <>
      {/* ── Premium Compact Filter Bar ────────────────────────── */}
      <div className="border-hairline bg-paper border-b">
        <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
          <form onSubmit={onSubmit} className="flex flex-col gap-3">
            <div className="flex items-center gap-3">
              {/* Search input - takes most space */}
              <div className="relative min-w-0 flex-1">
                <Search
                  className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
                  size={16}
                />
                <input
                  type="text"
                  value={searchValue}
                  onChange={(e) => onSearchChange(e.target.value)}
                  placeholder={searchPlaceholder}
                  className="border-hairline text-ink placeholder:text-ink-muted focus-visible:ring-ink w-full rounded-lg border bg-white py-2.5 pl-10 pr-10 text-sm transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2"
                />
                {searchValue && (
                  <button
                    type="button"
                    onClick={onSearchClear}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 transition-colors hover:text-slate-700"
                  >
                    <X size={15} />
                  </button>
                )}
              </div>

              {/* Filters toggle button */}
              <button
                type="button"
                onClick={() => onModalOpenChange(true)}
                className="border-hairline text-ink hover:border-ink/40 focus-visible:ring-ink relative flex shrink-0 items-center gap-2 rounded-lg border bg-white px-4 py-2.5 text-sm font-medium transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2"
              >
                <SlidersHorizontal size={16} />
                <span className="hidden sm:inline">Filters</span>
                {hasFilters && (
                  <span className="bg-power-orange absolute right-2 top-2 h-2.5 w-2.5 rounded-full ring-2 ring-white" />
                )}
              </button>
            </div>

            {quickFilters}

            {/* Active Filter Badges */}
            {hasFilters && (
              <div className="hide-scrollbar flex items-center gap-2 overflow-x-auto whitespace-nowrap pb-1">
                <span className="text-ink-muted mr-1 text-sm">Active filters</span>

                {activeFilters.map((filter) => (
                  <span
                    key={filter.id}
                    className={`inline-flex items-center gap-1 rounded-md border px-3 py-1 text-xs font-medium ${filter.badgeClassName || "text-ink border-hairline bg-white"}`}
                  >
                    {filter.label}
                    <button
                      type="button"
                      onClick={filter.onRemove}
                      className={`ml-1 ${filter.iconClassName || "hover:text-orange-700"}`}
                    >
                      <X size={12} />
                    </button>
                  </span>
                ))}

                <button
                  type="button"
                  onClick={onClearAll}
                  className="ml-2 text-xs font-bold text-slate-400 underline underline-offset-2 transition hover:text-slate-700"
                >
                  Clear All
                </button>
              </div>
            )}
          </form>
        </div>
      </div>

      {/* ── Filter Modal ────────────────────────────────────────── */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => onModalOpenChange(false)}
        title="Filters"
        size="md"
      >
        <div className="p-1">
          <div className="space-y-6">{children}</div>

          <div className="mt-8 flex items-center gap-3 border-t border-slate-100 pt-5">
            <button
              type="button"
              onClick={onClearAll}
              className="flex-1 rounded-xl px-4 py-3.5 text-sm font-bold text-slate-600 underline underline-offset-2 transition-colors hover:text-slate-900"
            >
              Clear all
            </button>
            <button
              type="button"
              onClick={() => onModalOpenChange(false)}
              className="bg-power-orange-solid flex-1 rounded-xl px-4 py-3.5 text-sm font-bold text-white shadow-sm transition hover:bg-orange-600"
            >
              Show Results
            </button>
          </div>
        </div>
      </Modal>
    </>
  );
}
