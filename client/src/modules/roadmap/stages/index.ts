// ─── Stage-guide registry ───────────────────────────────────────────────────
//
// Same shape as the pathway-graph and resource-guide registries: authored wins
// where it exists, and a sport without it renders the pathway view it already
// had rather than an empty nine-stage shell.
//
// Tennis only, deliberately. The nine stages are the handbook's, and a handbook
// is a piece of research, not a template — pouring another sport into these
// headings would put invented specifics in front of a parent making a decision
// about money. The other sports keep the reading view until their handbook is
// written.

import { TENNIS_STAGE_GUIDE } from "./tennis";
import type { StageGuide } from "./types";

const GUIDES: Record<string, StageGuide> = {
  tennis: TENNIS_STAGE_GUIDE,
};

export function stageGuideFor(sportNameOrSlug: string): StageGuide | undefined {
  const key = sportNameOrSlug.trim().toLowerCase().replace(/\s+/g, "-");
  return GUIDES[key];
}

export function hasStageGuide(sportNameOrSlug: string): boolean {
  return !!stageGuideFor(sportNameOrSlug);
}

export * from "./types";
