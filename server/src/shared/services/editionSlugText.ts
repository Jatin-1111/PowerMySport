/**
 * The text half of edition slugs, kept apart from `editionSlug.ts` because that file
 * imports the Mongoose model, and importing a model in a script is enough to create
 * its indexes in the one production database (see server/CLAUDE.md).
 */

/** "AITA CS7 (Delhi)" -> "aita-cs7-delhi" */
export function slugifyEditionName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80)
    .replace(/-+$/, "");
}
