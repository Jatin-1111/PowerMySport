import { cn } from "@/utils/cn";

const TONES = {
  slate: "bg-slate-900/[0.04] text-slate-600 ring-slate-900/[0.06]",
  yellow: "bg-orange-50 text-power-orange-solid ring-orange-200/60",
  green: "bg-emerald-50 text-emerald-700 ring-emerald-200/60",
  blue: "bg-blue-50 text-blue-700 ring-blue-200/60",
} as const;

/** Microscopic pill tag that sits above a section heading. */
export function HomeEyebrow({
  label,
  tone = "slate",
  className,
}: {
  label: string;
  tone?: keyof typeof TONES;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-3 py-1 text-[10px] font-medium uppercase tracking-[0.2em] ring-1",
        TONES[tone],
        className
      )}
    >
      {label}
    </span>
  );
}
