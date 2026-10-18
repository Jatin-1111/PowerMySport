import { cn } from "@/utils/cn";

/**
 * Prototype tokens for the warm-paper homepage direction: cream canvas, warm
 * ink, hairlines in a warm grey, and orange only on the action. Kept as
 * literals in one place so the direction can be judged before it is promoted
 * into the theme.
 */
export const PAPER = "bg-[#F8F3EA]";
export const PAPER_DEEP = "bg-[#EFE7DA]";
export const INK = "text-[#1C1B1A]";
export const HAIRLINE = "border-[#E1DCD3]";

/** Small sentence-case line above a heading, in the muted warm grey. */
export function SectionKicker({ label, className }: { label: string; className?: string }) {
  return <p className={cn("mb-5 text-sm font-medium text-[#7A766E]", className)}>{label}</p>;
}

/** Large light serif heading shared by the homepage sections. */
export const SECTION_HEADING =
  "font-editorial text-balance text-4xl font-light leading-[1.08] text-[#1C1B1A] sm:text-5xl lg:text-6xl";

/** Body copy under a heading: capped near 60 characters, no orphaned last words. */
export const SECTION_LEAD = "max-w-[56ch] text-pretty text-lg leading-relaxed text-[#4A4741]";
