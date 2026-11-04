export function asString(v: unknown): string | undefined {
  return typeof v === "string" && v.trim() ? v.trim() : undefined;
}

/** Best-effort human-readable sport name from a slug (Title Case, hyphens to spaces) — good enough for prompt text. */
export function sportNameFromSlug(sportSlug: string): string {
  return sportSlug
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}
