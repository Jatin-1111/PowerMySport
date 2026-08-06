// ─── Reading order ──────────────────────────────────────────────────────────
//
// The same pathway graph, rearranged for someone who is going to READ it rather
// than look at it.
//
// The canvas answers "show me everything at once", which needs a viewport, a
// zoom, and a parent willing to drive one. This answers the question a parent
// actually arrives with — "what happens next, and then what?" — which needs
// nothing but a scrollbar. Both render the same nodes and edges; only the
// arrangement differs, and it lives here so the two can never disagree about
// what the pathway says.
//
// WHY NOT JUST WALK THE RANKS. Rank order is what the canvas draws down its long
// axis, and for the first half of a map it reads perfectly — it IS the ladder.
// Past the point where the ladder ends it falls apart: tennis ranks 7–10 run
// college → pro → pro → pro-and-a-career, so a reader scrolling straight down
// bounces between four unrelated futures a rung at a time. Nobody follows a
// story told that way.
//
// So the spine is the TRUNK — the lane the map itself marks as the default route
// — and everything that leaves it is attached to the rung it leaves from, then
// told properly in its own section further down. That matches how the choice is
// actually faced: you are on the ladder, and at each rung some doors open.

import {
  GraphEdge,
  GraphNode,
  PathwayGraph,
  PathwayLane,
} from "./types";
import { computeLayers } from "./geometry";

/** A transition, resolved to the node it arrives at. */
export interface FlowTransition {
  edge: GraphEdge;
  to: GraphNode;
}

export interface FlowStep {
  node: GraphNode;
  /** Rank along the flow — shared with the canvas's layering. */
  rank: number;
  /** How you get here from the previous rung. Absent on the first. */
  arrival?: GraphEdge;
  /** Everything else that leaves this rung: side routes, fast tracks, the trap. */
  branches: FlowTransition[];
}

/** A track that isn't the trunk, told as its own short chain. */
export interface FlowBranch {
  lane: PathwayLane;
  laneIndex: number;
  steps: { node: GraphNode; rank: number; arrival?: GraphEdge }[];
}

export interface FlowDestination {
  node: GraphNode;
  /** The nodes that lead into it, for "reached from …". */
  from: GraphNode[];
}

export interface PathwayFlow {
  /** Lane the spine was taken from. */
  trunkLaneIndex: number;
  trunkLane?: PathwayLane;
  spine: FlowStep[];
  branches: FlowBranch[];
  destinations: FlowDestination[];
}

/**
 * The trunk is the lane the author marked as the default route. Every authored
 * map declares one; a derived map inherits one from the skeleton. The fallback
 * is the lane the start node sits in, which is the same thing by definition for
 * any map that ever renders.
 */
function trunkLaneIndexOf(graph: PathwayGraph): number {
  const declared = graph.lanes.findIndex((l) => l.tone === "ladder");
  if (declared >= 0) return declared;
  return graph.nodes.find((n) => n.id === graph.startNodeId)?.lane ?? 0;
}

export function buildPathwayFlow(graph: PathwayGraph): PathwayFlow {
  const rankOf = computeLayers(graph);
  const rank = (n: GraphNode) => rankOf.get(n.id) ?? 0;
  const nodeById = new Map(graph.nodes.map((n) => [n.id, n]));
  const trunkLaneIndex = trunkLaneIndexOf(graph);

  const outgoing = new Map<string, GraphEdge[]>();
  const incoming = new Map<string, GraphEdge[]>();
  for (const e of graph.edges) {
    if (!nodeById.has(e.from) || !nodeById.has(e.to)) continue;
    outgoing.set(e.from, [...(outgoing.get(e.from) ?? []), e]);
    incoming.set(e.to, [...(incoming.get(e.to) ?? []), e]);
  }

  const byRank = (a: { rank: number }, b: { rank: number }) => a.rank - b.rank;

  // ── The spine ──
  const spineNodes = graph.nodes
    .filter((n) => n.lane === trunkLaneIndex && !n.goalId)
    .map((node) => ({ node, rank: rank(node) }))
    .sort(byRank);

  const spineIds = new Set(spineNodes.map((s) => s.node.id));

  const spine: FlowStep[] = spineNodes.map(({ node, rank: r }, i) => {
    const next = spineNodes[i + 1]?.node.id;
    const previous = spineNodes[i - 1]?.node.id;
    const out = outgoing.get(node.id) ?? [];
    const into = incoming.get(node.id) ?? [];
    return {
      node,
      rank: r,
      // How you arrive from the rung below. Straight from the previous rung
      // where there is one, otherwise from anywhere else on the ladder — never
      // the overreach edge, which is a way of arriving somewhere you shouldn't.
      arrival:
        into.find((e) => e.from === previous) ??
        into.find((e) => spineIds.has(e.from) && e.kind !== "overreach"),
      // Everything that isn't simply "carry on up the ladder". Ordered so the
      // overreach trap — the one thing on this map that exists to be noticed —
      // is never buried under a list of side routes.
      branches: out
        .filter((e) => e.to !== next)
        .map((e) => ({ edge: e, to: nodeById.get(e.to)! }))
        .sort((a, b) => branchWeight(a.edge) - branchWeight(b.edge)),
    };
  });

  // ── The other tracks ──
  const branches: FlowBranch[] = graph.lanes
    .map((lane, laneIndex) => ({ lane, laneIndex }))
    .filter(({ laneIndex }) => laneIndex !== trunkLaneIndex)
    .map(({ lane, laneIndex }) => ({
      lane,
      laneIndex,
      steps: graph.nodes
        .filter((n) => n.lane === laneIndex && !n.goalId)
        .map((node) => ({ node, rank: rank(node) }))
        .sort(byRank)
        .map(({ node, rank: r }) => ({
          node,
          rank: r,
          // Prefer the way in from earlier in this same track, so a chain reads
          // as a chain; otherwise the way in from the ladder.
          arrival: pickArrival(incoming.get(node.id) ?? [], nodeById, laneIndex),
        })),
    }))
    .filter((b) => b.steps.length > 0);

  // Any node in the trunk lane that ISN'T on the spine would silently vanish —
  // it can't, since the spine is defined as every non-goal node in that lane, but
  // a node in a lane index no lane object exists for could. Sweep them up rather
  // than drop them.
  const covered = new Set([
    ...spineIds,
    ...branches.flatMap((b) => b.steps.map((s) => s.node.id)),
  ]);
  const orphans = graph.nodes.filter((n) => !n.goalId && !covered.has(n.id));
  if (orphans.length > 0) {
    branches.push({
      lane: { id: "other", label: "Other routes", tone: "ladder" },
      laneIndex: -1,
      steps: orphans
        .map((node) => ({ node, rank: rank(node) }))
        .sort(byRank)
        .map(({ node, rank: r }) => ({
          node,
          rank: r,
          arrival: pickArrival(incoming.get(node.id) ?? [], nodeById, -1),
        })),
    });
  }

  // ── Where it all leads ──
  const destinations: FlowDestination[] = graph.nodes
    .filter((n) => !!n.goalId)
    .map((node) => ({
      node,
      from: (incoming.get(node.id) ?? [])
        .map((e) => nodeById.get(e.from))
        .filter((n): n is GraphNode => !!n),
    }));

  return {
    trunkLaneIndex,
    trunkLane: graph.lanes[trunkLaneIndex],
    spine,
    branches,
    destinations,
  };
}

/** The trap first, then fast tracks, then side routes. */
function branchWeight(e: GraphEdge): number {
  if (e.kind === "overreach") return 0;
  if (e.kind === "bypass") return 1;
  if (e.kind === "offramp") return 2;
  return 3;
}

function pickArrival(
  edges: GraphEdge[],
  nodeById: Map<string, GraphNode>,
  laneIndex: number,
): GraphEdge | undefined {
  const sameLane = edges.find(
    (e) => nodeById.get(e.from)?.lane === laneIndex && e.kind !== "overreach",
  );
  return sameLane ?? edges.find((e) => e.kind !== "overreach") ?? edges[0];
}
