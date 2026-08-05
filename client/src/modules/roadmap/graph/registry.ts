// ─── Graph registry ─────────────────────────────────────────────────────────
//
// One entry point for the UI: hand it a sport plus the macro stages the roadmap
// already computed, get back a graph. Authored maps win; everything else is
// derived from the archetype skeleton so no sport renders an empty canvas.

import { MacroLevel } from "@/modules/sports/config/macroLevels";
import { Archetype } from "@/modules/sports/config/sportArchetypes";

import { deriveGraph } from "./derive";
import { CHESS_GRAPH } from "./maps/chess";
import { CRICKET_GRAPH } from "./maps/cricket";
import { TENNIS_GRAPH } from "./maps/tennis";
import { GoalId, GraphEdge, GraphNode, PathwayGraph } from "./types";

/** Keyed by normalized sport name. Add a map here to upgrade a sport from derived. */
const AUTHORED: Record<string, PathwayGraph> = {
  tennis: TENNIS_GRAPH,
  chess: CHESS_GRAPH,
  cricket: CRICKET_GRAPH,
};

function normalize(sportNameOrSlug: string): string {
  return sportNameOrSlug
    .trim()
    .toLowerCase()
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ");
}

export function hasAuthoredGraph(sportNameOrSlug: string): boolean {
  return normalize(sportNameOrSlug) in AUTHORED;
}

export function getPathwayGraph(
  sportName: string,
  archetype: Archetype,
  macroLevels: MacroLevel[],
): PathwayGraph {
  const authored = AUTHORED[normalize(sportName)];
  if (authored) return authored;
  return deriveGraph(sportName, archetype, macroLevels);
}

// ─── Lookup helpers ─────────────────────────────────────────────────────────

export function nodeById(
  graph: PathwayGraph,
  id: string | null,
): GraphNode | undefined {
  if (!id) return undefined;
  return graph.nodes.find((n) => n.id === id);
}

export function edgeById(
  graph: PathwayGraph,
  id: string | null,
): GraphEdge | undefined {
  if (!id) return undefined;
  return graph.edges.find((e) => e.id === id);
}

/** Edges leaving a node — what the inspector lists as "where this leads". */
export function outgoingEdges(graph: PathwayGraph, nodeId: string): GraphEdge[] {
  return graph.edges.filter((e) => e.from === nodeId);
}

/** Edges arriving at a node — what the inspector lists as "how you get here". */
export function incomingEdges(graph: PathwayGraph, nodeId: string): GraphEdge[] {
  return graph.edges.filter((e) => e.to === nodeId);
}

/**
 * The node a child currently sits on, from their raw pathway level (1–5).
 * Prefers a `stage` node — a raw level can be shared with a milestone, and
 * "you are here" belongs on the tier, not on the checkpoint.
 */
export function nodeForRawLevel(
  graph: PathwayGraph,
  rawLevel: number | null,
): GraphNode | undefined {
  if (!rawLevel) return undefined;
  const matches = graph.nodes.filter((n) => n.rawLevel === rawLevel);
  return matches.find((n) => n.kind === "stage") ?? matches[0];
}

/** Goals the graph actually terminates, in the order its author listed them. */
export function reachableGoals(graph: PathwayGraph): GoalId[] {
  const terminal = new Set(
    graph.nodes.filter((n) => n.goalId).map((n) => n.goalId as GoalId),
  );
  return graph.goals.filter((g) => terminal.has(g));
}
