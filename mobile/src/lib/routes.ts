import type { Href } from "expo-router";

// Typed-route generation lists these index screens under a different name than the URL they serve,
// so the plain paths are cast once here instead of at every call site.
export const RANKINGS_HOME = "/rankings" as Href;
export const ROADMAP_HOME = "/roadmap" as Href;
