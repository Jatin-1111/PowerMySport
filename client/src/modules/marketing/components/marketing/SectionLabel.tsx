import { cn } from "@/utils/cn";

interface SectionLabelProps {
  label: string;
  /** Kept so existing call sites compile; sections no longer carry a colour. */
  color?: "orange" | "green" | "blue" | "slate";
  className?: string;
}

/**
 * The small label above a marketing section heading: plain muted text in
 * sentence case, with no pill, border or colour.
 */
export function SectionLabel({ label, className }: SectionLabelProps) {
  return <span className={cn("text-ink-muted inline-block text-sm", className)}>{label}</span>;
}
