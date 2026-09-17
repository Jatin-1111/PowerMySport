/**
 * The marketing segment needs its own copy of the root frame. Not duplication
 * for its own sake — a Next resolution rule that is easy to get wrong:
 *
 * A deeper segment that declares an `openGraph` object REPLACES its ancestor's
 * openGraph entirely, including the image an ancestor's `opengraph-image` file
 * injected. `(marketing)/page.tsx` declares one for its title and description,
 * so with only `app/opengraph-image.tsx` in place the homepage — the single
 * most-shared URL on the site — rendered with no `og:image` at all. Verified by
 * reading the emitted tags, not by reasoning about them.
 *
 * A file convention in the SAME segment wins, so this restores it for the
 * homepage and every marketing route under it.
 */
export { default, alt, size, contentType } from "../opengraph-image";
