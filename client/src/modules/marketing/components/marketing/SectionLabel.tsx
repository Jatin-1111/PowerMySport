import { cn } from "@/utils/cn";

interface SectionLabelProps {
  label: string;
  color?: "orange" | "green" | "blue" | "slate";
  className?: string;
}

const colorMap = {
  orange: "bg-orange-50 border-orange-200/80 text-power-orange",
  green: "bg-emerald-50 border-emerald-200/80 text-emerald-700",
  blue: "bg-indigo-50 border-indigo-200/80 text-indigo-700",
  slate: "bg-slate-50 border-slate-200/80 text-slate-600",
};

/**
 * Standardized eyebrow/label pill used across all marketing section headers.
 */
export function SectionLabel({
  label,
  color = "slate",
  className,
}: SectionLabelProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-3.5 py-1 text-xs font-semibold uppercase tracking-[0.18em]",
        colorMap[color],
        className,
      )}
    >
      {label}
    </span>
  );
}
