/**
 * Expert profiles that must stay out of search even though they are active.
 *
 * A profile created to test booking in production is a real, active expert as
 * far as the API is concerned, so the `isActive` checks on the profile page and
 * the sitemap do not exclude it. Left alone it gets indexed with a Person block,
 * a price and a rating that no real parent earned.
 *
 * `KNOWN_TEST_EXPERT_IDS` is the committed list, so the exclusion applies on the
 * next deploy without an env change. `SEO_EXCLUDED_EXPERT_IDS` (comma separated)
 * adds more without a deploy. Prefer deactivating an expert in admin when the
 * profile is not needed for testing; this is for the ones that must stay active.
 */
const KNOWN_TEST_EXPERT_IDS: readonly string[] = ["6a649c2da23135da4b5a7a03"];

function excludedIds(): Set<string> {
  const fromEnv = (process.env.SEO_EXCLUDED_EXPERT_IDS ?? "")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);
  return new Set([...KNOWN_TEST_EXPERT_IDS, ...fromEnv]);
}

/** True when this expert's profile should not be indexed or listed in the sitemap. */
export function isExcludedFromSearch(expertId: string | undefined | null): boolean {
  return Boolean(expertId) && excludedIds().has(expertId as string);
}
