import { Opportunity } from "../../shared/models/Opportunity";
import { AppError } from "../../utils/AppError";

/** A title as a page address: lower case, hyphens, no punctuation, at most 72 characters. */
export const slugify = (value: string): string =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 72);

/** The first address for this title that no entry already uses ("title", "title-2", ...). */
export async function uniqueSlug(title: string): Promise<string> {
  const base = slugify(title) || "entry";
  for (let n = 1; n < 50; n += 1) {
    const candidate = n === 1 ? base : `${base}-${n}`;
    if (!(await Opportunity.exists({ slug: candidate }))) return candidate;
  }
  throw new AppError("Could not find a free slug for this title.", 400);
}
