import { cn } from "@/utils/cn";

/*
 * Colours come from the warm-paper theme tokens in globals.css (`paper`,
 * `paper-deep`, `ink`, `ink-body`, `ink-muted`, `hairline`); see client/DESIGN.md.
 */

/** Small sentence-case line above a heading, in the muted warm grey. */
export function SectionKicker({ label, className }: { label: string; className?: string }) {
  return <p className={cn("text-ink-muted mb-5 text-sm font-medium", className)}>{label}</p>;
}

/** Large light serif heading shared by the homepage sections. */
export const SECTION_HEADING =
  "font-editorial text-balance text-4xl font-light leading-[1.08] text-ink sm:text-5xl lg:text-6xl";

/** Body copy under a heading: capped near 60 characters, no orphaned last words. */
export const SECTION_LEAD = "max-w-[56ch] text-pretty text-lg leading-relaxed text-ink-body";
