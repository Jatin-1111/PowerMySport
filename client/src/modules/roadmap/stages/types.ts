// ─── Stage guide ────────────────────────────────────────────────────────────
//
// The pathway as a set of numbered stages a parent steps through one at a time,
// which is the shape the PowerMySport handbooks were written in before anything
// was drawn on a canvas. `resources/content/tennis.ts` says so in its own header:
// the handbook has nine stages, and they were folded onto four rendered ones to
// fit the archetype skeleton. This unfolds them again.
//
// Nothing here is new research. Every figure and claim is lifted from the
// authored pathway graph (`graph/maps/*.ts`) or the authored guide
// (`resources/content/*.ts`) — the two places in this repo where tennis has
// actually been researched. Where a stage wants detail those don't carry, it
// links to the full guide rather than inventing it.

/** A unit of stage content, rendered generically so content stays data. */
export type StageBlock =
  | { kind: "prose"; text: string }
  | {
      kind: "list";
      title?: string;
      items: string[];
      /** `check` for things to aim at, `cross` for things to avoid. */
      tone?: "check" | "cross" | "bullet";
    }
  | { kind: "pairs"; title?: string; rows: { label: string; value: string }[] }
  | {
      kind: "callout";
      tone: "goal" | "warn" | "money";
      title: string;
      text: string;
    };

export type StageTabId =
  | "overview"
  | "topics"
  | "expect"
  | "tips"
  | "resources";

export interface StageTab {
  id: StageTabId;
  blocks: StageBlock[];
}

export interface GuideStage {
  /** Anchor-safe id, used in the URL hash so a stage can be linked directly. */
  id: string;
  /** "Getting Started" — the age goes in `ageLabel`, not the title. */
  title: string;
  /** Bracketed age in the stage list, where the mockup shows "(4–8)". */
  ageLabel?: string;
  /** Full age window for the header card. */
  ageRange?: string;
  /** Two lines under the title in the stage list. */
  listNote: string;
  /** One line under the stage heading. */
  subtitle: string;
  /** The "Goal of this stage" callout. */
  goal: string;
  /** Ticked topic list beside the overview. */
  atAGlance: string[];
  /** Raw pathway level (1–5) this stage sits on, where it maps to one. */
  rawLevel?: number;
  tabs: StageTab[];
}

/**
 * Where the family's own state sits in the federation's map, already resolved.
 * The reader knows which state was picked, so it can answer "which zone am I in"
 * rather than telling a parent to go and look it up.
 */
export interface StateGrouping {
  label: string;
  note?: string;
  groups: { name: string; states: string[] }[];
}

export interface StageGuide {
  sport: string;
  /** Slug for the deep guide at /resources/[sport], when one exists. */
  resourceSlug?: string;
  stateGroups?: StateGrouping;
  stages: GuideStage[];
}

export const STAGE_TAB_LABELS: Record<StageTabId, string> = {
  overview: "Overview",
  topics: "Key Topics",
  // Every producer fills this tab with what a rung DEMANDS — the two gates and
  // the criteria to move up (fromApi), what selectors look for (derive), what a
  // late start or a given build actually costs you (tennis). "What to Expect"
  // read as a promise about the experience and made requirement lists look
  // misfiled.
  expect: "What It Takes",
  tips: "Tips for Parents",
  resources: "Resources",
};

/** Tab order is fixed, so the strip doesn't reshuffle between stages. */
export const STAGE_TAB_ORDER: StageTabId[] = [
  "overview",
  "topics",
  "expect",
  "tips",
  "resources",
];
