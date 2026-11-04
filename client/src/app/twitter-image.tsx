/**
 * X reads the same frame as everyone else.
 *
 * Re-exported rather than duplicated: a second template would drift, and there
 * is no reason for a link to look different on one network. Declaring it at the
 * root also stops X falling back to the stale static PNG the metadata used to
 * name.
 */
export { default, alt, size, contentType } from "./opengraph-image";
