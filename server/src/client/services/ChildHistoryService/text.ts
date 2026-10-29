import { AppError } from "../../../utils/AppError";

/**
 * Cleaning for the free text a parent types into a child's history.
 *
 * Everything here is shown back as plain text, and some of it will be read by a stranger on a
 * shared profile, so it is cut down once, here: no markup, no links in running text (a result link
 * has its own field), no line breaks, no runs of spaces. Nothing else needs to trust it.
 */

/** Plain words only. An empty result is `undefined`, which is how "not given" is stored. */
export const plainText = (value: unknown, max: number): string | undefined => {
  if (typeof value !== "string") return undefined;
  const text = value
    .replace(/https?:\/\/\S+/gi, " ")
    .replace(/[<>{}[\]\\`]/g, " ")
    .replace(/[\r\n\t]+/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim()
    .slice(0, max);
  return text || undefined;
};

const MAX_URL_CHARS = 500;

/**
 * A result link a reader can open to check an entry. Only https, no embedded password, and the
 * server never fetches it. An empty string means "no link".
 */
export const cleanResultUrl = (value: unknown): string | undefined => {
  if (typeof value !== "string" || value.trim() === "") return undefined;
  const text = value.trim();
  let url: URL;
  try {
    url = new URL(text);
  } catch {
    throw new AppError("That link does not look right. Paste the full address.", 400);
  }
  if (url.protocol !== "https:" || url.username || url.password || text.length > MAX_URL_CHARS) {
    throw new AppError("A result link must start with https:// and be under 500 characters.", 400);
  }
  return url.toString();
};
