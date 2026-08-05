import {
  groupLevelsIntoMacro,
  type MacroLevel,
} from "@/modules/sports/config/macroLevels";
import type { Archetype } from "@/modules/sports/config/sportArchetypes";
import { describe, expect, it } from "vitest";

import { deriveGraph } from "./derive";
import {
  layoutGraph,
  orderedRoute,
  routeEdges,
  subgraphForGoal,
} from "./geometry";
import { GOAL_ORDER, GOALS, goalForAmbition, sortGoals } from "./goals";
import { CHESS_GRAPH } from "./maps/chess";
import { CRICKET_GRAPH } from "./maps/cricket";
import { TENNIS_GRAPH } from "./maps/tennis";
import {
  getPathwayGraph,
  hasAuthoredGraph,
  nodeForRawLevel,
  reachableGoals,
} from "./registry";
import type { PathwayGraph } from "./types";

// Minimal PathwayLevel stub — grouping only reads `level`.
const level = (n: number) =>
  ({
    level: n,
    label: `L${n}`,
    title: "",
    description: "",
    keyFocus: "",
    ageRange: `${n + 6} – ${n + 9} years`,
    competitions: "",
    steps: [],
  }) as never;

const FIVE_LEVELS = [1, 2, 3, 4, 5].map(level);
const ARCHETYPES: Archetype[] = ["federation", "ranking", "rating", "standard"];

const AUTHORED: PathwayGraph[] = [TENNIS_GRAPH, CHESS_GRAPH, CRICKET_GRAPH];

const derived = (archetype: Archetype): PathwayGraph =>
  deriveGraph("Testball", archetype, groupLevelsIntoMacro(FIVE_LEVELS, archetype));

const ALL_GRAPHS = (): { name: string; graph: PathwayGraph }[] => [
  ...AUTHORED.map((g) => ({ name: g.sportName, graph: g })),
  ...ARCHETYPES.map((a) => ({ name: `derived:${a}`, graph: derived(a) })),
];

// ─── Structural integrity ───────────────────────────────────────────────────
//
// These are the invariants that make an authoring mistake a test failure rather
// than a silently broken canvas — a dangling edge id used to just vanish.

describe("graph structure", () => {
  it("every edge connects two nodes that exist", () => {
    for (const { name, graph } of ALL_GRAPHS()) {
      const ids = new Set(graph.nodes.map((n) => n.id));
      for (const e of graph.edges) {
        expect(ids.has(e.from), `${name}: edge ${e.id} from`).toBe(true);
        expect(ids.has(e.to), `${name}: edge ${e.id} to`).toBe(true);
      }
    }
  });

  it("node and edge ids are unique within a graph", () => {
    for (const { name, graph } of ALL_GRAPHS()) {
      const nodeIds = graph.nodes.map((n) => n.id);
      const edgeIds = graph.edges.map((e) => e.id);
      expect(new Set(nodeIds).size, `${name}: nodes`).toBe(nodeIds.length);
      expect(new Set(edgeIds).size, `${name}: edges`).toBe(edgeIds.length);
    }
  });

  it("has exactly one start node, and startNodeId points at it", () => {
    for (const { name, graph } of ALL_GRAPHS()) {
      const starts = graph.nodes.filter((n) => n.kind === "start");
      expect(starts, `${name}`).toHaveLength(1);
      expect(starts[0].id, `${name}`).toBe(graph.startNodeId);
    }
  });

  it("every declared goal has exactly one terminal node", () => {
    for (const { name, graph } of ALL_GRAPHS()) {
      for (const goalId of graph.goals) {
        const terminals = graph.nodes.filter((n) => n.goalId === goalId);
        expect(terminals, `${name}: goal ${goalId}`).toHaveLength(1);
      }
    }
  });

  it("every goal terminal is reachable by at least one inbound edge", () => {
    for (const { name, graph } of ALL_GRAPHS()) {
      for (const terminal of graph.nodes.filter((n) => n.goalId)) {
        const inbound = graph.edges.filter((e) => e.to === terminal.id);
        expect(inbound.length, `${name}: ${terminal.id}`).toBeGreaterThan(0);
      }
    }
  });

  it("puts every node in a lane the graph actually declares", () => {
    for (const { name, graph } of ALL_GRAPHS()) {
      expect(graph.lanes.length, `${name}: no lanes`).toBeGreaterThan(0);
      for (const n of graph.nodes) {
        expect(n.lane, `${name}: ${n.id}.lane`).toBeGreaterThanOrEqual(0);
        expect(n.lane, `${name}: ${n.id}.lane`).toBeLessThan(graph.lanes.length);
      }
      const ids = graph.lanes.map((l) => l.id);
      expect(new Set(ids).size, `${name}: duplicate lane ids`).toBe(ids.length);
      for (const l of graph.lanes) {
        expect(l.label.length, `${name}: lane ${l.id} label`).toBeGreaterThan(2);
      }
    }
  });

  it("never authors two nodes into the same lane and the same column", () => {
    // The layout de-collides as a safety net, at the cost of knocking one card
    // off its lane centreline. Catching it here keeps that from happening
    // silently — the fix is always to move one of the two to another lane.
    for (const { name, graph } of ALL_GRAPHS()) {
      const seen = new Map<string, string>();
      for (const n of layoutGraph(graph).nodes) {
        const cell = `${n.layer}:${n.lane}`;
        expect(
          seen.get(cell),
          `${name}: ${n.id} collides with ${seen.get(cell)} at column ${n.layer}, lane ${n.lane}`,
        ).toBeUndefined();
        seen.set(cell, n.id);
      }
    }
  });

  it("never leaves a non-start node stranded with no inbound edge", () => {
    for (const { name, graph } of ALL_GRAPHS()) {
      for (const n of graph.nodes) {
        if (n.id === graph.startNodeId) continue;
        const inbound = graph.edges.filter((e) => e.to === n.id);
        expect(inbound.length, `${name}: ${n.id} unreachable`).toBeGreaterThan(0);
      }
    }
  });
});

// ─── The two-gate model ─────────────────────────────────────────────────────

describe("edge semantics", () => {
  it("every graph models exactly one overreach edge, and it explains itself", () => {
    for (const { name, graph } of ALL_GRAPHS()) {
      const over = graph.edges.filter((e) => e.kind === "overreach");
      expect(over, `${name}`).toHaveLength(1);
      // The warning is the whole payload of this edge — a bare label would
      // leave the parent with "you can't" and no arithmetic.
      expect(over[0].warning, `${name}`).toBeTruthy();
      expect(over[0].warning!.length, `${name}`).toBeGreaterThan(120);
      expect(over[0].label, `${name}`).toBeTruthy();
    }
  });

  it("every fast-track edge carries an unlock checklist", () => {
    for (const { name, graph } of ALL_GRAPHS()) {
      for (const e of graph.edges.filter((x) => x.kind === "bypass")) {
        expect(e.unlocks, `${name}: ${e.id}`).toBeTruthy();
        expect(e.unlocks!.length, `${name}: ${e.id}`).toBeGreaterThan(0);
      }
    }
  });

  it("authored overreach edges separate the two gates explicitly", () => {
    for (const graph of AUTHORED) {
      const over = graph.edges.find((e) => e.kind === "overreach")!;
      // "You may enter" and "you are ready" must be answerable separately —
      // collapsing them is the exact confusion this map exists to undo.
      expect(over.eligibility, graph.sportName).toBeTruthy();
      expect(over.readiness, graph.sportName).toBeTruthy();
      expect(over.eligibility).not.toBe(over.readiness);
    }
  });

  it("edge labels stay short enough to sit on an arc", () => {
    for (const { name, graph } of ALL_GRAPHS()) {
      for (const e of graph.edges) {
        if (!e.label) continue;
        const words = e.label.trim().split(/\s+/).length;
        expect(words, `${name}: "${e.label}"`).toBeLessThanOrEqual(7);
      }
    }
  });

  it("tags every edge with at least one goal so filtering can't orphan it", () => {
    for (const { name, graph } of ALL_GRAPHS()) {
      for (const e of graph.edges) {
        expect(e.goals.length, `${name}: ${e.id}`).toBeGreaterThan(0);
      }
    }
  });
});

// ─── Authored content invariants ────────────────────────────────────────────

describe("funding", () => {
  it("only attaches a funding note where there is a cost to offset", () => {
    // The card renders the funding mark inside the cost line, so a note on a
    // node with no cost band would have nothing to attach to and never show.
    for (const { name, graph } of ALL_GRAPHS()) {
      for (const n of graph.nodes.filter((x) => x.fundingNote)) {
        expect(n.costBand, `${name}: ${n.id} has funding but no cost`).toBeTruthy();
        expect(n.fundingNote!.length, `${name}: ${n.id}`).toBeGreaterThan(40);
      }
    }
  });

  it("names who pays on the tiers a family is most likely to stall at", () => {
    // The map exists partly to be honest about money, and the rungs where
    // families actually give up for cost reasons are the national circuit and the
    // jump to international events. Those must say what can offset them.
    const funded = new Set(
      TENNIS_GRAPH.nodes.filter((n) => n.fundingNote).map((n) => n.id),
    );
    for (const id of ["talent", "champ", "nationals", "itf-jr", "ncaa"]) {
      expect(funded.has(id), `tennis: ${id} has no funding note`).toBe(true);
    }
  });

  it("shows money coming IN on every authored map, not just going out", () => {
    for (const g of AUTHORED) {
      const funded = g.nodes.filter((n) => n.fundingNote).length;
      expect(funded, `${g.sportName}: only ${funded} funded rungs`).toBeGreaterThanOrEqual(
        4,
      );
    }
  });
});

describe("tennis ladder ends", () => {
  it("runs the pro route past the first ranking point to the tour", () => {
    // Stopping the map at M15 implied a first professional point was the finish
    // line. It is where an Indian professional career starts — most of it is
    // then spent on the Challenger circuit.
    const route = orderedRoute(TENNIS_GRAPH, "pro");
    expect(route).toContain("challenger");
    expect(route).toContain("tour");
    expect(route.indexOf("challenger")).toBeGreaterThan(route.indexOf("itf-pro"));
    expect(route.indexOf("tour")).toBeGreaterThan(route.indexOf("challenger"));

    // And the first pro point must not connect straight to the destination.
    const shortcut = TENNIS_GRAPH.edges.find(
      (e) => e.from === "itf-pro" && e.to === "goal-pro",
    );
    expect(shortcut, "itf-pro wires straight to goal-pro again").toBeUndefined();
  });

  it("starts before ranked tennis, and admits a seven-year-old to it", () => {
    // AITA's youngest category is U-10, open from age 7. The map used to open at
    // U-12 / age 9, which told the parent of a seven-year-old to wait two years
    // they don't have to wait.
    const route = orderedRoute(TENNIS_GRAPH, "pro");
    expect(route).toContain("foundation");
    expect(route.indexOf("foundation")).toBeLessThan(route.indexOf("talent"));

    const talent = TENNIS_GRAPH.nodes.find((n) => n.id === "talent")!;
    expect(talent.ageBand).toMatch(/^7/);
    expect(talent.sublabel).toMatch(/U-10/);

    const register = TENNIS_GRAPH.edges.find(
      (e) => e.to === "talent" && e.kind === "primary",
    )!;
    expect(register.eligibility).toMatch(/age 7/);
  });
});

// ─── Path resolution ────────────────────────────────────────────────────────

describe("orderedRoute", () => {
  it("walks from the start node to the goal terminal", () => {
    for (const { name, graph } of ALL_GRAPHS()) {
      for (const goalId of reachableGoals(graph)) {
        const route = orderedRoute(graph, goalId);
        if (route.length === 0) continue;
        expect(route[0], `${name}/${goalId} start`).toBe(graph.startNodeId);
        const terminal = graph.nodes.find((n) => n.goalId === goalId)!;
        expect(route[route.length - 1], `${name}/${goalId} end`).toBe(terminal.id);
      }
    }
  });

  it("finds a walk for every reachable goal in the authored maps", () => {
    for (const graph of AUTHORED) {
      for (const goalId of reachableGoals(graph)) {
        expect(
          orderedRoute(graph, goalId).length,
          `${graph.sportName}/${goalId}`,
        ).toBeGreaterThan(1);
      }
    }
  });

  it("never routes the guided walk through a shortcut or an overreach", () => {
    // The guided walk is the one surface that implicitly recommends. It must
    // only ever traverse primary and offramp edges.
    for (const { name, graph } of ALL_GRAPHS()) {
      const risky = new Set(
        graph.edges
          .filter((e) => e.kind === "bypass" || e.kind === "overreach")
          .map((e) => `${e.from}->${e.to}`),
      );
      for (const goalId of reachableGoals(graph)) {
        const route = orderedRoute(graph, goalId);
        for (let i = 0; i < route.length - 1; i++) {
          expect(
            risky.has(`${route[i]}->${route[i + 1]}`),
            `${name}/${goalId} used a risky hop ${route[i]}->${route[i + 1]}`,
          ).toBe(false);
        }
      }
    }
  });

  it("produces no repeated nodes (no cycles in the walk)", () => {
    for (const { name, graph } of ALL_GRAPHS()) {
      for (const goalId of reachableGoals(graph)) {
        const route = orderedRoute(graph, goalId);
        expect(new Set(route).size, `${name}/${goalId}`).toBe(route.length);
      }
    }
  });
});

describe("subgraphForGoal", () => {
  it("keeps only nodes and edges tagged for that goal", () => {
    const { nodeIds, edgeIds } = subgraphForGoal(TENNIS_GRAPH, "college");
    for (const id of nodeIds) {
      expect(
        TENNIS_GRAPH.nodes.find((n) => n.id === id)!.goals,
      ).toContain("college");
    }
    for (const id of edgeIds) {
      expect(TENNIS_GRAPH.edges.find((e) => e.id === id)!.goals).toContain(
        "college",
      );
    }
  });

  it("excludes the pro-only ITF pro rung from the college subgraph", () => {
    const { nodeIds } = subgraphForGoal(TENNIS_GRAPH, "college");
    expect(nodeIds.has("itf-pro")).toBe(false);
    expect(nodeIds.has("ncaa")).toBe(true);
  });
});

// ─── Geometry ───────────────────────────────────────────────────────────────

describe("layered layout", () => {
  it("puts the start node alone in the leftmost column", () => {
    for (const { name, graph } of ALL_GRAPHS()) {
      const { nodes } = layoutGraph(graph);
      const start = nodes.find((n) => n.id === graph.startNodeId)!;
      expect(start.layer, `${name}`).toBe(0);
      const alsoInColumnZero = nodes.filter((n) => n.layer === 0);
      expect(alsoInColumnZero.map((n) => n.id), `${name}`).toEqual([start.id]);
      // Leftmost by geometry too, not just by index.
      const leading = Math.min(...nodes.map((n) => n.along));
      expect(start.along, `${name}`).toBe(leading);
    }
  });

  it("puts every goal terminal in the single rightmost column", () => {
    for (const { name, graph } of ALL_GRAPHS()) {
      const { nodes } = layoutGraph(graph);
      const maxLayer = Math.max(...nodes.map((n) => n.layer));
      const goalNodes = nodes.filter((n) => n.goalId);
      for (const g of goalNodes) {
        expect(g.layer, `${name}: ${g.id}`).toBe(maxLayer);
      }
      // And nothing that isn't a goal shares that column.
      for (const n of nodes.filter((x) => x.layer === maxLayer)) {
        expect(n.goalId, `${name}: ${n.id} in goal column`).toBeTruthy();
      }
    }
  });

  it("makes every advancing edge point strictly rightward", () => {
    // This is the promise the layout makes to the parent: further right always
    // means further along. Only the overreach arc is exempt — it's explicitly a
    // leap across the map, and it still runs left to right anyway.
    for (const { name, graph } of ALL_GRAPHS()) {
      const { nodes } = layoutGraph(graph);
      const layerOf = new Map(nodes.map((n) => [n.id, n.layer]));
      for (const e of graph.edges) {
        if (e.kind === "overreach") continue;
        expect(
          layerOf.get(e.to)! > layerOf.get(e.from)!,
          `${name}: ${e.id} (${layerOf.get(e.from)} → ${layerOf.get(e.to)})`,
        ).toBe(true);
      }
    }
  });

  it("keeps at least one genuine column-skipping fast track per authored map", () => {
    // Layering uses the longest path, so a real shortcut still visibly jumps
    // ahead. If every bypass advanced by exactly one column, none of them would
    // be shortcuts and the dotted styling would be a lie.
    for (const graph of AUTHORED) {
      const { nodes } = layoutGraph(graph);
      const layerOf = new Map(nodes.map((n) => [n.id, n.layer]));
      const skips = graph.edges
        .filter((e) => e.kind === "bypass")
        .map((e) => layerOf.get(e.to)! - layerOf.get(e.from)!);
      // A map that shows the open-but-not-ready trap and no legitimate shortcut
      // implies none exists, which is never true. Both must be on the diagram.
      expect(skips.length, `${graph.sportName} has no fast track at all`)
        .toBeGreaterThan(0);
      expect(Math.max(...skips), graph.sportName).toBeGreaterThanOrEqual(2);
    }
  });

  it("sits every card in a lane on that lane's single centreline", () => {
    // This is the alignment promise. If any card drifts off its lane, the
    // diagram stops reading as rows and starts reading as scatter.
    for (const { name, graph } of ALL_GRAPHS()) {
      const { nodes, lanes } = layoutGraph(graph);
      for (const n of nodes) {
        expect(n.across, `${name}: ${n.id}`).toBe(lanes[n.lane].centre);
      }
    }
  });

  it("orders lane bands top to bottom without gaps or overlaps", () => {
    for (const { name, graph } of ALL_GRAPHS()) {
      const { lanes, width, height, orientation } = layoutGraph(graph);
      const acrossTotal = orientation === "vertical" ? width : height;
      for (let i = 0; i < lanes.length; i++) {
        expect(lanes[i].start, `${name}: lane ${i}`).toBeLessThan(lanes[i].centre);
        expect(lanes[i].centre, `${name}: lane ${i}`).toBeLessThan(lanes[i].end);
        if (i > 0) expect(lanes[i].start, `${name}: lane ${i}`).toBe(lanes[i - 1].end);
      }
      expect(lanes[lanes.length - 1].end, `${name}`).toBeLessThanOrEqual(acrossTotal);
    }
  });

  it("never overlaps two cards stacked in the same column", () => {
    for (const { name, graph } of ALL_GRAPHS()) {
      const { nodes } = layoutGraph(graph);
      const columns = new Map<number, typeof nodes>();
      for (const n of nodes) {
        columns.set(n.layer, [...(columns.get(n.layer) ?? []), n]);
      }
      for (const [layer, column] of columns) {
        const sorted = [...column].sort((a, b) => a.across - b.across);
        for (let i = 1; i < sorted.length; i++) {
          const gap =
            sorted[i].across -
            sorted[i].acrossSpan / 2 -
            (sorted[i - 1].across + sorted[i - 1].acrossSpan / 2);
          expect(
            gap,
            `${name}: col ${layer} — ${sorted[i - 1].id} / ${sorted[i].id}`,
          ).toBeGreaterThanOrEqual(0);
        }
      }
    }
  });

  it("keeps every card inside the reported diagram bounds", () => {
    for (const { name, graph } of ALL_GRAPHS()) {
      const { nodes, width, height } = layoutGraph(graph);
      for (const n of nodes) {
        expect(n.cx - n.w / 2, `${name}: ${n.id} left`).toBeGreaterThanOrEqual(0);
        expect(n.cy - n.h / 2, `${name}: ${n.id} top`).toBeGreaterThanOrEqual(0);
        expect(n.cx + n.w / 2, `${name}: ${n.id} right`).toBeLessThanOrEqual(width);
        expect(n.cy + n.h / 2, `${name}: ${n.id} bottom`).toBeLessThanOrEqual(height);
      }
    }
  });

  it("never grows wider across the flow than a single panel", () => {
    // This is the constraint that decided five tracks per authored map. A sixth
    // pushes the across axis past ~2100px, and fitting that to a browser panel
    // drops the default zoom below the point where a card title is legible — so
    // adding a lane means consolidating one, not just appending.
    for (const { name, graph } of ALL_GRAPHS()) {
      const { width, height, orientation } = layoutGraph(graph);
      const acrossTotal = orientation === "vertical" ? width : height;
      expect(acrossTotal, `${name}: ${acrossTotal}px across the flow`).toBeLessThanOrEqual(
        2100,
      );
    }
  });

  it("lays the diagram out along its longer axis", () => {
    // The point of the orientation choice: whichever axis the ranks run along has
    // to be the long one, or the reader pans across a mostly empty canvas.
    for (const { name, graph } of ALL_GRAPHS()) {
      const { width, height, orientation } = layoutGraph(graph);
      const alongTotal = orientation === "vertical" ? height : width;
      const acrossTotal = orientation === "vertical" ? width : height;
      expect(alongTotal, `${name}`).toBeGreaterThan(acrossTotal);
    }
  });
});

describe("edge routing", () => {
  it("routes every edge into a finite path", () => {
    for (const { name, graph } of ALL_GRAPHS()) {
      const routed = routeEdges(graph, layoutGraph(graph));
      expect(routed.length, `${name}`).toBe(graph.edges.length);
      for (const r of routed) {
        expect(r.d, `${name}: ${r.edge.id}`).toMatch(/^M [\d.-]+ [\d.-]+ L /);
        expect(r.d).not.toContain("NaN");
        expect(r.points.length, `${name}: ${r.edge.id}`).toBeGreaterThanOrEqual(2);
        expect(Number.isFinite(r.mid.x), `${name}: ${r.edge.id} mid`).toBe(true);
        expect(Number.isFinite(r.label.y), `${name}: ${r.edge.id} label`).toBe(true);
      }
    }
  });

  it("builds every route out of purely horizontal and vertical runs", () => {
    // The no-diagonals rule is what keeps a dense map readable: a line is either
    // travelling along a lane or crossing between two columns, never cutting a
    // corner across the diagram.
    for (const { name, graph } of ALL_GRAPHS()) {
      for (const r of routeEdges(graph, layoutGraph(graph))) {
        for (let i = 0; i < r.points.length - 1; i++) {
          const p = r.points[i];
          const q = r.points[i + 1];
          const axisAligned =
            Math.abs(p.x - q.x) < 0.6 || Math.abs(p.y - q.y) < 0.6;
          expect(
            axisAligned,
            `${name}: ${r.edge.id} segment ${i} is diagonal`,
          ).toBe(true);
        }
      }
    }
  });

  it("never draws a line through the middle of a card it isn't connected to", () => {
    // The single biggest complaint about the curved version: long sweeps to the
    // goal column crossed straight over four other tiers on the way.
    for (const { name, graph } of ALL_GRAPHS()) {
      const layout = layoutGraph(graph);
      for (const r of routeEdges(graph, layout)) {
        const own = new Set([r.edge.from, r.edge.to]);
        for (let i = 0; i < r.points.length - 1; i++) {
          const p = r.points[i];
          const q = r.points[i + 1];
          const crossed = layout.nodes.find(
            (n) =>
              !own.has(n.id) &&
              Math.max(p.x, q.x) >= n.cx - n.w / 2 &&
              Math.min(p.x, q.x) <= n.cx + n.w / 2 &&
              Math.max(p.y, q.y) >= n.cy - n.h / 2 &&
              Math.min(p.y, q.y) <= n.cy + n.h / 2,
          );
          expect(
            crossed?.id,
            `${name}: ${r.edge.id} runs through ${crossed?.id}`,
          ).toBeUndefined();
        }
      }
    }
  });

  it("separates edges that leave or arrive at the same card", () => {
    // Every line docking at one centre point has to splay at a different angle
    // to get anywhere, which is what made the exits unreadable.
    for (const { name, graph } of ALL_GRAPHS()) {
      const layout = layoutGraph(graph);
      const routed = routeEdges(graph, layout);
      // Ports spread ACROSS the flow, so which screen axis to read depends on
      // the orientation — every exit from one card shares its along-coordinate.
      const across = (p: { x: number; y: number }) =>
        layout.orientation === "vertical" ? p.x : p.y;
      for (const key of ["from", "to"] as const) {
        const groups = new Map<string, number[]>();
        for (const r of routed) {
          const at = across(key === "from" ? r.start : r.end);
          const id = r.edge[key];
          groups.set(id, [...(groups.get(id) ?? []), at]);
        }
        for (const [id, offsets] of groups) {
          if (offsets.length < 2) continue;
          expect(
            new Set(offsets.map((v) => v.toFixed(1))).size,
            `${name}: ${id}.${key}`,
          ).toBe(offsets.length);
        }
      }
    }
  });

  it("docks forward edges to the right port and the left port", () => {
    const layout = layoutGraph(TENNIS_GRAPH);
    const byId = new Map(layout.nodes.map((n) => [n.id, n]));
    for (const r of routeEdges(TENNIS_GRAPH, layout)) {
      const from = byId.get(r.edge.from)!;
      const to = byId.get(r.edge.to)!;
      if (to.layer <= from.layer) continue;
      const vertical = layout.orientation === "vertical";
      const startAlong = vertical ? r.start.y : r.start.x;
      const endAlong = vertical ? r.end.y : r.end.x;
      expect(startAlong, r.edge.id).toBeGreaterThanOrEqual(from.along);
      expect(endAlong, r.edge.id).toBeLessThanOrEqual(to.along);
    }
  });

  it("keeps gate labels clear of the node cards", () => {
    // Labels drawn under a card is what produced the truncated "nt Seri" and
    // "junior s" fragments in the first pass.
    for (const { name, graph } of ALL_GRAPHS()) {
      const layout = layoutGraph(graph);
      const routed = routeEdges(graph, layout);
      let buried = 0;
      for (const r of routed) {
        if (!r.edge.label) continue;
        const hit = layout.nodes.some(
          (n) =>
            Math.abs(r.label.x - n.cx) < n.w / 2 &&
            Math.abs(r.label.y - n.cy) < n.h / 2,
        );
        if (hit) buried++;
      }
      expect(buried, `${name}: ${buried} labels sit inside a card`).toBe(0);
    }
  });

  it("drops edges pointing at missing nodes instead of throwing", () => {
    const broken: PathwayGraph = {
      ...TENNIS_GRAPH,
      edges: [
        ...TENNIS_GRAPH.edges,
        {
          id: "ghost",
          from: "start",
          to: "does-not-exist",
          kind: "primary",
          goals: ["pro"],
        },
      ],
    };
    const routed = routeEdges(broken, layoutGraph(broken));
    expect(routed.map((r) => r.edge.id)).not.toContain("ghost");
    expect(routed).toHaveLength(TENNIS_GRAPH.edges.length);
  });
});

// ─── Registry & goals ───────────────────────────────────────────────────────

describe("registry", () => {
  it("serves authored maps for the researched sports, by name or slug", () => {
    expect(hasAuthoredGraph("Tennis")).toBe(true);
    expect(hasAuthoredGraph("table-tennis")).toBe(false);
    expect(getPathwayGraph("tennis", "ranking", []).source).toBe("authored");
    expect(getPathwayGraph("Chess", "rating", []).source).toBe("authored");
    expect(getPathwayGraph("CRICKET", "federation", []).source).toBe("authored");
  });

  it("derives a graph for any unauthored sport", () => {
    const g = getPathwayGraph(
      "Badminton",
      "ranking",
      groupLevelsIntoMacro(FIVE_LEVELS, "ranking"),
    );
    expect(g.source).toBe("derived");
    expect(g.sportName).toBe("Badminton");
    expect(g.nodes.length).toBeGreaterThan(5);
  });

  it("prefers a stage node over a milestone when both share a raw level", () => {
    // Tennis level 4 is on both AITA nationals (stage) and ITF juniors
    // (milestone) — "you are here" belongs on the tier.
    const node = nodeForRawLevel(TENNIS_GRAPH, 4);
    expect(node?.kind).toBe("stage");
    expect(node?.id).toBe("nationals");
  });

  it("returns undefined for an unknown level rather than guessing", () => {
    expect(nodeForRawLevel(TENNIS_GRAPH, 0)).toBeUndefined();
    expect(nodeForRawLevel(TENNIS_GRAPH, null)).toBeUndefined();
  });
});

describe("goals", () => {
  it("reaches exactly the goals it declares, in rail order", () => {
    // Each sport declares a SUBSET of the closed catalogue, because a terminal a
    // sport cannot award is worse than a missing one. What must hold is that the
    // declaration and the terminals agree.
    for (const { name, graph } of ALL_GRAPHS()) {
      expect(reachableGoals(graph), name).toEqual(sortGoals(graph.goals));
      expect(graph.goals.length, `${name}: too few destinations`).toBeGreaterThan(2);
      for (const g of graph.goals) {
        expect(GOAL_ORDER, `${name}: unknown goal ${g}`).toContain(g);
      }
    }
  });

  it("gives every authored map a job destination and a vertical flow", () => {
    // "A job in it" is the outcome the largest number of committed players
    // actually reach, and every authored sport now names it. Vertical because a
    // ten-plus-rank ladder laid out sideways is four screens of panning.
    for (const g of AUTHORED) {
      expect(g.orientation, g.sportName).toBe("vertical");
      expect(g.goals, g.sportName).toContain("job");
      const terminal = g.nodes.find((n) => n.goalId === "job")!;
      expect(terminal.label, g.sportName).toMatch(/job/i);
    }
  });

  it("keeps a state terminal only where a state cap is genuinely a prize", () => {
    // Cricket is the exception on purpose: a Ranji cap is recognised for life
    // whether or not India follows. Tennis grades its tournaments nationally and
    // chess treats a state place as a step toward a nomination, so in both cases
    // a "State Colours" terminal would be inventing an outcome.
    expect(CRICKET_GRAPH.goals).toContain("state");
    expect(TENNIS_GRAPH.goals).not.toContain("state");
    expect(CHESS_GRAPH.goals).not.toContain("state");
  });

  it("gives tennis the four destinations an Indian family actually asks about", () => {
    // No state terminal: AITA grades its tournaments nationally and state bodies
    // host them, so there is no state cap to win the way there is in cricket.
    expect(TENNIS_GRAPH.goals).toEqual(["pro", "national", "college", "job"]);
    expect(TENNIS_GRAPH.nodes.some((n) => n.goalId === "state")).toBe(false);
  });

  it("maps every ambition to a goal the rail can preselect", () => {
    expect(goalForAmbition("professional")).toBe("pro");
    expect(goalForAmbition("national")).toBe("national");
    expect(goalForAmbition("competitive")).toBe("state");
    // Enjoyment is a destination, not an absence of one.
    expect(goalForAmbition("fun")).toBe("thrive");
    expect(goalForAmbition(undefined)).toBeNull();
  });

  it("gives every goal a palette and copy the UI can render", () => {
    for (const id of GOAL_ORDER) {
      const g = GOALS[id];
      expect(g.accent.hex).toMatch(/^#[0-9a-f]{6}$/i);
      expect(g.short.length).toBeGreaterThan(2);
      expect(g.blurb.length).toBeGreaterThan(20);
    }
  });
});

// ─── Derived graphs per archetype ───────────────────────────────────────────

describe("deriveGraph", () => {
  it("builds a usable graph for all four archetypes", () => {
    for (const archetype of ARCHETYPES) {
      const g = derived(archetype);
      expect(g.source, archetype).toBe("derived");
      expect(g.nodes.filter((n) => n.kind === "goal"), archetype).toHaveLength(5);
      expect(g.edges.length, archetype).toBeGreaterThan(5);
    }
  });

  it("carries each macro stage across with its facts intact", () => {
    const macros: MacroLevel[] = groupLevelsIntoMacro(FIVE_LEVELS, "ranking");
    const g = derived("ranking");
    for (const m of macros) {
      const node = g.nodes.find((n) => n.id === m.id);
      expect(node, m.id).toBeTruthy();
      expect(node!.label).toBe(m.label);
      expect(node!.rawLevel).toBe(m.representativeRawLevel);
      expect(node!.costBand).toBeTruthy();
    }
  });

  it("tells athletics-style sports the mark itself is the gate", () => {
    // The standard archetype is the one case where the shortcut genuinely
    // isn't available, and the copy has to say so rather than scold.
    const over = derived("standard").edges.find((e) => e.kind === "overreach")!;
    expect(over.label?.toLowerCase()).toContain("blocked");
    expect(over.warning).toMatch(/qualifying mark/i);
  });

  it("uses the archetype's own advancement vocabulary on stage hops", () => {
    expect(
      derived("federation").edges.some((e) => e.label === "Selected at trials"),
    ).toBe(true);
    expect(
      derived("rating").edges.some((e) => e.label === "Raise the rating"),
    ).toBe(true);
  });
});
