/**
 * Escape a user-supplied string so it can be safely embedded in a RegExp /
 * Mongo `$regex` query without enabling regex/ReDoS injection.
 *
 * Always escape untrusted input before building `new RegExp(input)` or
 * `{ $regex: input }`.
 */
export const escapeRegex = (value: string): string =>
  value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * Maximum length we allow for a user-supplied search term before building a
 * regex from it. Caps the work a single query can force the DB to do.
 */
export const MAX_SEARCH_TERM_LENGTH = 100;

/**
 * Convenience helper: trim, length-cap, and escape a search term for safe use
 * in a case-insensitive regex query.
 */
export const buildSafeSearchRegexSource = (value: string): string =>
  escapeRegex(value.trim().slice(0, MAX_SEARCH_TERM_LENGTH));
