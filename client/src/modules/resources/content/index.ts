// ─── Authored guide registry ────────────────────────────────────────────────
//
// Same shape as the pathway graph registry: authored content wins where it
// exists, and a sport without it renders the generated sections alone rather than
// an empty section. Tennis is authored; the rest are pending the same handbook
// treatment.

import { TENNIS_GUIDE } from "./tennis";
import type { SportGuide } from "./types";

const GUIDES: Record<string, SportGuide> = {
  tennis: TENNIS_GUIDE,
};

export function guideFor(sportNameOrSlug: string): SportGuide | undefined {
  const key = sportNameOrSlug.trim().toLowerCase().replace(/\s+/g, "-");
  return GUIDES[key];
}

export type { SportGuide } from "./types";
