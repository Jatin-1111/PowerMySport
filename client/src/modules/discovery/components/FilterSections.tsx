"use client";

import { cn } from "@/utils/cn";

/**
 * The filter panel sections every discovery tab (coaches, venues, academies,
 * experts) shares, so a price range, a rating floor and a sort order look and
 * behave the same wherever a parent meets them. Tab-specific controls sit above
 * these; the order below them is always price, rating, sort.
 */

const choice = (selected: boolean) =>
  cn(
    "rounded-xl border py-2.5 text-sm font-semibold transition-all",
    selected
      ? "border-power-orange text-power-orange bg-orange-50"
      : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50"
  );

const moneyInput =
  "focus:border-power-orange w-full rounded-xl border border-slate-200 bg-slate-50 py-3 pl-7 pr-3 text-sm text-slate-900 focus:bg-white focus:outline-none";

export function PriceRangeSection({
  label,
  min,
  max,
  onMinChange,
  onMaxChange,
}: {
  /** Names the price and its unit, e.g. "Price Range (₹/hr)". */
  label: string;
  min: string;
  max: string;
  onMinChange: (value: string) => void;
  onMaxChange: (value: string) => void;
}) {
  return (
    <div>
      <label className="mb-3 block text-sm font-bold text-slate-900">{label}</label>
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400">₹</span>
          <input
            type="number"
            min="0"
            inputMode="numeric"
            value={min}
            onChange={(e) => onMinChange(e.target.value)}
            placeholder="Min"
            aria-label={`${label}, minimum`}
            className={moneyInput}
          />
        </div>
        <div className="h-0.5 w-4 rounded-full bg-slate-300" />
        <div className="relative flex-1">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400">₹</span>
          <input
            type="number"
            min="0"
            inputMode="numeric"
            value={max}
            onChange={(e) => onMaxChange(e.target.value)}
            placeholder="Max"
            aria-label={`${label}, maximum`}
            className={moneyInput}
          />
        </div>
      </div>
    </div>
  );
}

const RATING_OPTIONS = [
  { val: "0", label: "Any" },
  { val: "3", label: "3+ ★" },
  { val: "4", label: "4+ ★" },
  { val: "4.5", label: "4.5+ ★" },
];

export function RatingSection({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div>
      <label className="mb-3 block text-sm font-bold text-slate-900">Minimum Rating</label>
      <div className="grid grid-cols-4 gap-2">
        {RATING_OPTIONS.map((opt) => (
          <button
            key={opt.val}
            type="button"
            onClick={() => onChange(opt.val)}
            className={choice(value === opt.val)}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}

const SORT_OPTIONS = [
  { val: "relevance", label: "Recommended" },
  { val: "ratingDesc", label: "Top Rated" },
  { val: "priceAsc", label: "Price (Low to High)" },
  { val: "priceDesc", label: "Price (High to Low)" },
];

export function SortSection({
  value,
  onChange,
  extraOptions = [],
}: {
  value: string;
  onChange: (value: string) => void;
  /** Sort orders only one tab has, e.g. "Nearest" for coaches. Shown after Recommended. */
  extraOptions?: { val: string; label: string }[];
}) {
  const options = [SORT_OPTIONS[0], ...extraOptions, ...SORT_OPTIONS.slice(1)];
  return (
    <div>
      <label className="mb-3 block text-sm font-bold text-slate-900">Sort By</label>
      <div className="grid grid-cols-2 gap-2">
        {options.map((opt) => (
          <button
            key={opt.val}
            type="button"
            onClick={() => onChange(opt.val)}
            className={choice(value === opt.val)}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}

/** The active-filter chip text for a price range, the same in every tab. */
export const priceRangeLabel = (min: string, max: string): string =>
  `${min ? `₹${min}` : "₹0"} to ${max ? `₹${max}` : "any"}`;
