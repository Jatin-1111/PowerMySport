"use client";

import { formatAsOn, type RankingDate } from "@/modules/rankings/api";
import { Search, X } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, useTransition } from "react";

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
}: {
  states: string[];
  dates: RankingDate[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const currentSearch = searchParams.get("search") ?? "";
  const [search, setSearch] = useState(currentSearch);

  // Keep the box in step when the URL changes underneath it — browser back, or
  // the Clear button below.
  useEffect(() => setSearch(currentSearch), [currentSearch]);

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
    "h-10 rounded-md border bg-background px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-power-orange focus-visible:ring-offset-2";

  return (
    <div
      className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end"
      data-pending={isPending ? "" : undefined}
    >
      <div className="flex-1 sm:min-w-[16rem]">
        <label htmlFor="ranking-search" className="mb-1.5 block text-sm font-medium">
          Player name or registration no.
        </label>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            apply({ search: search.trim() || null });
          }}
          className="relative"
        >
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <input
            id="ranking-search"
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="e.g. Aarav, or 438220"
            className="h-10 w-full rounded-md border bg-background pl-9 pr-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-power-orange focus-visible:ring-offset-2"
          />
          <button type="submit" className="sr-only">
            Search
          </button>
        </form>
      </div>

      <div>
        <label htmlFor="ranking-state" className="mb-1.5 block text-sm font-medium">
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
          <label htmlFor="ranking-date" className="mb-1.5 block text-sm font-medium">
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
          className="inline-flex h-10 items-center gap-1.5 rounded-md border px-3 text-sm font-medium text-muted-foreground shadow-sm transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-power-orange focus-visible:ring-offset-2"
        >
          <X className="h-4 w-4" aria-hidden />
          Clear
        </button>
      )}
    </div>
  );
}
