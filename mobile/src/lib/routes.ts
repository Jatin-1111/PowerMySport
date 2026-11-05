import type { Href } from "expo-router";

// Typed-route generation lists these index screens under a different name than the URL they serve,
// so the plain paths are cast once here instead of at every call site.
export const RANKINGS_HOME = "/rankings" as Href;
export const ROADMAP_HOME = "/roadmap" as Href;

/**
 * The add/edit entry screen. A new route is missing from the generated types until Metro has run
 * once, so the path is cast here. `entryId` edits a stored entry; `editionSlug` and `title` start a
 * result for a tournament marked played.
 */
export function entryScreen(params: {
  childId: string;
  entryId?: string;
  editionSlug?: string;
  title?: string;
}): Href {
  return { pathname: "/children/entry", params } as unknown as Href;
}
