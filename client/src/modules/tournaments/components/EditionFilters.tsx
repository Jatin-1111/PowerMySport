import Link from "next/link";

import type { EditionFacets, FacetOption } from "../services/editionListing";
import { tournamentListHref, type TournamentListState } from "../utils/listHref";

// ─── Filters for one sport's tournament list ────────────────────────────────
//
// Links, not a form: every filtered view has its own URL, so it works before
// JavaScript loads, the back button undoes a filter, and a parent can send
// "Under-14 Championship Series in October" to another parent as one link.
//
// A row only appears when it has a choice to offer. A sport whose calendar
// carries no event types gets no "Type of event" row, rather than one with
// nothing in it.

type FilterKey = "category" | "age" | "month";

const ROWS: Array<{ key: FilterKey; facet: keyof EditionFacets; label: string }> = [
  { key: "category", facet: "categories", label: "Type of event" },
  { key: "age", facet: "ages", label: "Age group" },
  { key: "month", facet: "months", label: "Month" },
];

const chipClass = (selected: boolean) =>
  `inline-flex min-h-9 items-center gap-1.5 rounded-lg border px-3 text-[13px] font-semibold transition ${
    selected
      ? "bg-power-orange-solid border-power-orange-solid text-white"
      : "hover:border-power-orange/50 border-slate-200 bg-white text-slate-700 hover:text-orange-700"
  }`;

function FilterRow({
  sportSlug,
  state,
  filterKey,
  label,
  options,
}: {
  sportSlug: string;
  state: TournamentListState;
  filterKey: FilterKey;
  label: string;
  options: FacetOption[];
}) {
  const selected = state[filterKey];
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:gap-4">
      <p className="shrink-0 pt-2 text-[12px] font-bold uppercase tracking-wider text-slate-500 sm:w-32">
        {label}
      </p>
      <ul className="flex flex-wrap gap-2">
        <li>
          <Link
            href={tournamentListHref(sportSlug, state, { [filterKey]: undefined })}
            aria-current={!selected ? "true" : undefined}
            className={chipClass(!selected)}
          >
            All
          </Link>
        </li>
        {options.map((option) => (
          <li key={option.value}>
            <Link
              href={tournamentListHref(sportSlug, state, { [filterKey]: option.value })}
              aria-current={selected === option.value ? "true" : undefined}
              className={chipClass(selected === option.value)}
            >
              {option.label}
              <span className={selected === option.value ? "text-orange-100" : "text-slate-500"}>
                {option.count}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function EditionFilters({
  sportSlug,
  state,
  facets,
}: {
  sportSlug: string;
  state: TournamentListState;
  facets: EditionFacets;
}) {
  const rows = ROWS.filter((row) => facets[row.facet].length > 1 || Boolean(state[row.key]));
  if (rows.length === 0) return null;

  const anyApplied = ROWS.some((row) => state[row.key]);

  return (
    <section
      aria-label="Filter tournaments"
      className="mb-6 space-y-3 rounded-lg border border-slate-200 bg-white p-4 sm:p-5"
    >
      {rows.map((row) => (
        <FilterRow
          key={row.key}
          sportSlug={sportSlug}
          state={state}
          filterKey={row.key}
          label={row.label}
          options={facets[row.facet]}
        />
      ))}
      {anyApplied && (
        <div className="border-t border-slate-100 pt-3">
          <Link
            href={tournamentListHref(sportSlug, state, {
              category: undefined,
              age: undefined,
              month: undefined,
            })}
            className="text-[13px] font-bold text-orange-700 hover:text-orange-800"
          >
            Clear all filters
          </Link>
        </div>
      )}
    </section>
  );
}
