/**
 * Hides the part of a URL that is a credential before the URL is written to a log.
 *
 * A shared profile is opened by a link whose last segment is the secret: anyone holding it can
 * read the profile until it expires or is stopped. A request log that records the whole path
 * would turn every log reader, and every log store, into someone who holds every link.
 *
 * Apply this wherever a request's URL is logged or recorded. Routes that match are reported by
 * their route pattern anyway; this covers the lines that print the raw URL.
 */
const SHARE_TOKEN = /^(\/api\/share\/)[^/?#]+/;

export const redactPath = (url: string): string => url.replace(SHARE_TOKEN, "$1:token");
