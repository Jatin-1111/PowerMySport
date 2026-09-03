"use client";

import { formatAsOn, type RankingDate } from "@/modules/rankings/services/api";
import { Search, X } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";

/**
 * Filters for one ranking list.
 *
 * State lives in the URL rather than in component state, so a filtered view is
 * linkable and survives a refresh — "Maharashtra U-14" is a thing a parent will
 * want to send to someone. Every change resets `page`, because landing on
 * page 7 of a filter that now returns 20 rows is the classic way these tables
 * show an empty screen and look broken.
 */
export function RankingFilters({
  states,
  dates,
  /**
   * The junior lists are read by parents looking for one child; the open-age
   * lists are read by adults looking for themselves. Addressing a Men's Singles
   * reader as somebody's parent is the sort of small wrongness that makes a page
   * feel like it was not written for them.
   */
  searchLabel = "Find a player",
}: {
  states: string[];
  dates: RankingDate[];
  searchLabel?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const currentSearch = searchParams.get("search") ?? "";
  const [search, setSearch] = useState(currentSearch);

  // Keep the box in step when the URL changes underneath it — browser back, or
  // the Clear button below.
  //
  // Adjusted during render rather than in an effect. React's own guidance for
  // "reset state when a prop changes" is to compare against the last value seen
  // and set during render: an effect for this runs a second render pass after
  // painting the stale value, which is both a wasted pass and a visible flicker
  // of the old query on a slow device.
  const [lastUrlSearch, setLastUrlSearch] = useState(currentSearch);
  if (currentSearch !== lastUrlSearch) {
    setLastUrlSearch(currentSearch);
    setSearch(currentSearch);
  }

  const apply = (changes: Record<string, string | null>) => {
    const next = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(changes)) {
      if (value) next.set(key, value);
      else next.delete(key);
    }
    next.delete("page");
    const query = next.toString();
    startTransition(() => router.push(query ? `${pathname}?${query}` : pathname));
  };

  const state = searchParams.get("state") ?? "";
  const date = searchParams.get("date") ?? "";
  const hasFilters = Boolean(state || date || currentSearch);

  const selectClass =
    "h-10 rounded-lg border bg-background px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-power-orange focus-visible:ring-offset-2";

  return (
    // Search gets its own row and the whole width. It is not one filter among
    // three: on a list of 1,600 children, looking one up is what almost everybody
    // came to do, and burying it in a row of dropdowns made it look optional.
    <div className="space-y-3" data-pending={isPending ? "" : undefined}>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          apply({ search: search.trim() || null });
        }}
      >
        <label htmlFor="ranking-search" className="mb-1.5 block text-sm font-medium">
          {searchLabel}
        </label>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search
              className="text-muted-foreground pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2"
              aria-hidden
            />
            <input
              id="ranking-search"
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Name or AITA registration number"
              className="bg-background focus-visible:ring-power-orange h-11 w-full rounded-lg border pr-3 pl-10 shadow-sm focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
            />
          </div>
          {/* A visible button, not an sr-only one: on a phone keyboard the
              go-key is not obvious, and this is the page's primary action. */}
          <button
            type="submit"
            className="bg-power-orange focus-visible:ring-power-orange inline-flex h-11 shrink-0 items-center rounded-lg px-4 text-sm font-semibold text-white shadow-sm transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
          >
            Search
          </button>
        </div>
      </form>

      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label
            htmlFor="ranking-state"
            className="text-muted-foreground mb-1.5 block text-xs font-medium"
          >
            State
          </label>
          <select
            id="ranking-state"
            value={state}
            onChange={(event) => apply({ state: event.target.value || null })}
            className={selectClass}
          >
            <option value="">All states</option>
            {states.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        </div>

        {dates.length > 1 && (
          <div>
            <label
              htmlFor="ranking-date"
              className="text-muted-foreground mb-1.5 block text-xs font-medium"
            >
              Week
            </label>
            <select
              id="ranking-date"
              value={date}
              onChange={(event) => apply({ date: event.target.value || null })}
              className={selectClass}
            >
              <option value="">Latest</option>
              {dates.map((entry) => {
                const iso = entry.asOnDate.slice(0, 10);
                return (
                  <option key={iso} value={iso}>
                    {formatAsOn(entry.asOnDate)}
                  </option>
                );
              })}
            </select>
          </div>
        )}

        {hasFilters && (
          <button
            type="button"
            onClick={() => apply({ state: null, date: null, search: null })}
            className="text-muted-foreground hover:text-foreground focus-visible:ring-power-orange inline-flex h-10 items-center gap-1.5 rounded-lg border px-3 text-sm font-medium shadow-sm transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
          >
            <X className="h-4 w-4" aria-hidden />
            Clear
          </button>
        )}
      </div>
    </div>
  );
}
