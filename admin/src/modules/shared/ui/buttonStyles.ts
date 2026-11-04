import { cn } from "@/utils/cn";

/**
 * Class strings for native <button>/<Link> elements that need to look like the
 * shared Button without its wrapper. One primary action per screen: use
 * `primary`. Everything else is `outline` or `quiet`.
 */
const base =
  "inline-flex items-center justify-center gap-2 rounded-lg font-semibold whitespace-nowrap transition-colors disabled:cursor-not-allowed disabled:opacity-50";

const variants = {
  primary: "bg-deep-slate text-white hover:bg-slate-700",
  accent: "bg-power-orange-solid text-white hover:bg-orange-800",
  outline:
    "border border-slate-300 bg-white text-slate-700 hover:border-slate-400 hover:bg-slate-50",
  quiet: "text-slate-700 hover:bg-slate-100",
  danger: "bg-red-700 text-white hover:bg-red-800",
  dangerOutline: "border border-red-200 bg-white text-red-700 hover:bg-red-50",
} as const;

const sizes = {
  sm: "min-h-8 px-2.5 py-1 text-xs",
  md: "min-h-10 px-4 py-2 text-sm",
} as const;

export function btn(
  variant: keyof typeof variants = "outline",
  size: keyof typeof sizes = "md",
  extra?: string
) {
  return cn(base, variants[variant], sizes[size], extra);
}

/** Text input / select / textarea. Pair with a visible <label>. */
export const fieldClass =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-500 hover:border-slate-400 focus:border-power-orange-solid focus:outline-none focus:ring-2 focus:ring-power-orange-solid/25 disabled:bg-slate-50 disabled:text-slate-500";

export const labelClass = "mb-1 block text-sm font-medium text-slate-700";
