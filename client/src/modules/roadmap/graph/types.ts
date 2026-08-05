// ─── Pathway graph domain model ─────────────────────────────────────────────
//
// The roadmap used to be a single ladder: 5 raw levels grouped into 3–4
// archetype stages, walked bottom-to-top. That model can't express the thing
// parents actually get wrong — that there are SEVERAL routes to the same end
// goal, that some transitions are open to anyone but hopeless in practice,
// and that a few shortcuts are legitimate for a genuinely strong child.
//
// So a pathway is a directed graph:
//   • nodes = places a child can actually be (circuits, tiers, milestones)
//   • edges = transitions, each carrying TWO independent gates
//   • goals = a small, predefined set of terminal outcomes
//   • lanes = the named tracks nodes are grouped into, top to bottom
//
// The two-gate idea is the crux. An `eligibility` gate is administrative and
// verifiable ("AITA membership + age proof"). A `readiness` gate is competitive
// ("UTR 13+"). The classic parent error — entering an ATP-level draw at twelve
// — is an edge where eligibility is OPEN and readiness is years away. Modelling
// both lets us render that edge honestly instead of pretending it doesn't exist.

import { Archetype } from "@/modules/sports/config/sportArchetypes";

// ─── Goals ───────────────────────────────────────────────────────────────────

/**
 * A closed set, from which each sport declares the subset it genuinely reaches.
 * Closed so that a parent comparing two sports compares like with like; a subset
 * because a destination a sport cannot deliver is worse than a missing one — see
 * the note in `goals.ts` on why tennis carries no state terminal.
 */
export type GoalId =
  | "pro"
  | "national"
  | "college"
  | "job"
  | "state"
  | "thrive";

export interface PathwayGoal {
  id: GoalId;
  /** Full destination name shown on the goal node. */
  label: string;
  /** Chip-length name for the goal rail. */
  short: string;
  /** One line on what reaching this actually means. */
  blurb: string;
  /** Icon key resolved through the component token map. */
  icon: IconKey;
  accent: GoalAccent;
}

/** Hex-based palette — edges and nodes paint with inline styles, not Tailwind. */
export interface GoalAccent {
  hex: string;
  soft: string;
  ring: string;
  dark: string;
}

// ─── Lanes ───────────────────────────────────────────────────────────────────

/**
 * A named horizontal track, top to bottom.
 *
 * Lanes are the editorial spine of a map. Which lane a node sits in says what
 * KIND of route it belongs to — the pro track, the academic route, the school
 * circuit — and because every node in a lane shares one centreline, a route
 * becomes a rail a parent can follow with a finger instead of a curve they have
 * to trace. Free-form vertical placement produced a prettier sketch in which
 * nothing lined up and no two cards agreed on a baseline.
 */
export interface PathwayLane {
  id: string;
  /** Gutter label. Three or four words — it renders in a narrow strip. */
  label: string;
  /**
   * Which destination this track is heading for, which is where the lane borrows
   * its colour from. Tying the two together means the tint on a card tells a
   * parent what that card is FOR before they've read a word of it — and it can't
   * drift out of sync with the goal rail, because it's the same palette.
   *
   * `"ladder"` is the trunk every other track branches off, and takes the brand
   * accent rather than any one outcome's.
   */
  tone: LaneTone;
}

export type LaneTone = GoalId | "ladder";

// ─── Nodes ───────────────────────────────────────────────────────────────────

export type NodeKind =
  /** Single entry point. Every graph has exactly one. */
  | "start"
  /** A real competitive tier that maps onto a raw pathway level (1–5). */
  | "stage"
  /** A named checkpoint that isn't a full stage — ITF Juniors, NCAA, a quota seat. */
  | "milestone"
  /** A terminal outcome. Exactly one per goal that the sport can reach. */
  | "goal";

export type IconKey =
  | "start"
  | "coach"
  | "ball"
  | "briefcase"
  | "school"
  | "city"
  | "state"
  | "national"
  | "world"
  | "rating"
  | "trophy"
  | "medal"
  | "crown"
  | "college"
  | "timer"
  | "heart";

export interface GraphNode {
  id: string;
  kind: NodeKind;
  label: string;
  /** Scope line under the label — "U-12 · first ranking points". */
  sublabel?: string;
  /**
   * Index into the graph's `lanes`. This is the only placement a map author
   * controls: the horizontal position is derived from the node's distance from
   * the start, so "further right" can always be trusted to mean "further along".
   */
  lane: number;
  /** Raw pathway level (1–5) this node corresponds to, when it maps to one. */
  rawLevel?: number;
  /** Goals this node lies on the way to. Drives path highlighting. */
  goals: GoalId[];
  /** The goal this node terminates, for `kind: "goal"` nodes. */
  goalId?: GoalId;
  icon?: IconKey;
  /** Typical age window at this node. */
  ageBand?: string;
  /** The sport's native progress metric here — "UTR 3–5", "AICF 1200–1400". */
  anchorBand?: string;
  /** Realistic annual all-in cost at this node. */
  costBand?: string;
  /**
   * What can help PAY for this rung — the scheme, scholarship or grant that
   * unlocks here.
   *
   * Every card carries a cost, so without this the map only ever shows money
   * flowing out and reads as more discouraging than the sport actually is. It's
   * also the sequencing a family needs: funding is not available everywhere, it
   * unlocks at specific rungs, and knowing which one changes when you commit.
   */
  fundingNote?: string;
  /** How long children typically spend here. */
  durationNote?: string;
  /** Honest attrition read — "roughly 1 in 40 move up from here". */
  funnelNote?: string;
}

// ─── Edges ───────────────────────────────────────────────────────────────────

export type EdgeKind =
  /** The normal, intended progression. Solid line. */
  | "primary"
  /**
   * A legitimate shortcut that skips a tier — but only for a child who can
   * already prove it. Dotted line, always carries an `unlocks` checklist.
   */
  | "bypass"
  /**
   * Administratively open, competitively hopeless. Dashed and warned. This is
   * the edge that exists to answer "why not just enter an ATP event?".
   */
  | "overreach"
  /**
   * A sideways route to a different (often better) goal — college, quota seat,
   * lifelong play. Thin solid line.
   */
  | "offramp";

export interface GraphEdge {
  id: string;
  from: string;
  to: string;
  kind: EdgeKind;
  /** The gate in ≤6 words. This is the edge's whole face. */
  label?: string;
  /** Administrative gate — what the rulebook requires. */
  eligibility?: string;
  /** Competitive gate — what the child must actually be able to do. */
  readiness?: string;
  /** For `bypass`: any one of these unlocks the shortcut. */
  unlocks?: string[];
  /** For `overreach`: the honest cost of trying this too early. */
  warning?: string;
  /** Typical time spent making this transition. */
  timeline?: string;
  /** Goals this transition serves. Drives path highlighting. */
  goals: GoalId[];
}

// ─── Graph ───────────────────────────────────────────────────────────────────

export interface PathwayGraph {
  sportName: string;
  archetype: Archetype;
  startNodeId: string;
  /**
   * Which way the journey runs. `"vertical"` flows top to bottom with the tracks
   * side by side; `"horizontal"` flows left to right with the tracks stacked.
   *
   * Pick whichever puts the LONGER axis under the reader's scroll. A map with a
   * dozen ranks and a handful of tracks is unreadable laid out sideways — four
   * screens of horizontal panning past a mostly empty canvas — and comfortable
   * laid out downwards. Defaults to horizontal for maps authored before the
   * choice existed.
   */
  orientation?: "horizontal" | "vertical";
  /** The tracks, in order across the flow. Every node names one by index. */
  lanes: PathwayLane[];
  nodes: GraphNode[];
  edges: GraphEdge[];
  /** Goals this sport's map actually reaches, in rail order. */
  goals: GoalId[];
  /** The sport's native progress metric, named for the parent. */
  anchorMetric?: {
    label: string;
    hint: string;
  };
  /**
   * "authored" maps are hand-placed and researched. "derived" maps are built
   * from the generic archetype skeleton so every sport renders something —
   * the UI labels them so we never imply researched depth we don't have.
   */
  source: "authored" | "derived";
}

/** A resolved route: the node sequence from start to a goal. */
export interface GraphPath {
  goalId: GoalId;
  nodeIds: string[];
  edgeIds: string[];
}
