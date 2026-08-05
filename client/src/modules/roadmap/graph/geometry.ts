// ─── Graph geometry ─────────────────────────────────────────────────────────
//
// A lane-aligned, orthogonally-routed flowchart. Two rules produce the whole
// look, and both exist because the free-form version broke them:
//
//   THE PROGRESS AXIS IS COMPUTED. A node's position along the flow is its
//   longest structural distance from the start, so an edge can only ever point
//   forwards and "further along" always means "further along".
//
//   THE TRACK AXIS IS AUTHORED, AND SHARED. Every node in a lane sits on that
//   lane's single centreline. Authored free positions let adjacent cards land 4px
//   apart, which reads as jitter rather than as structure; a shared centreline
//   makes a track a rail you can follow with a finger.
//
// Edges are then routed as right angles rather than curves: a stub out of the
// source, a run across inside the empty channel between two ranks, a long run
// along a card-free corridor, and a stub into the target. Long bezier sweeps
// crossed the diagram at arbitrary angles and turned five side routes into one
// ball of string; a right-angled line that only ever travels along a lane or
// between two ranks cannot do that.
//
// ─── Orientation ─────────────────────────────────────────────────────────────
//
// Everything below is computed in FLOW SPACE — `along` is the progress axis and
// `across` is the track axis — and projected to screen coordinates only at the
// end. That indirection buys the thing a laid-out-left-to-right pathway could
// never have: a map with twelve ranks and five tracks is 4800px wide and 1250px
// tall, which is four screens of horizontal panning and a mostly empty page.
// Turned on its side it is 1700 × 2700 — one screen wide, and scrolled down the
// way every other page on the web is read.

import { GraphEdge, GraphNode, NodeKind, PathwayGraph } from "./types";

export type Orientation = "horizontal" | "vertical";

/**
 * Card footprints, in layout pixels. Stated in on-screen terms (width × height)
 * because that is what the card component lays out; which of the two lies along
 * the flow depends on the orientation.
 *
 * Vertical cards are narrower and taller than horizontal ones on purpose. Across
 * the flow, five tracks have to fit the width of a browser panel, so every pixel
 * of card width costs the whole diagram scale — whereas along the flow there is
 * as much room as the reader is willing to scroll.
 */
const SIZES: Record<Orientation, Record<NodeKind, { w: number; h: number }>> = {
  horizontal: {
    start: { w: 268, h: 118 },
    stage: { w: 316, h: 136 },
    milestone: { w: 316, h: 136 },
    goal: { w: 296, h: 118 },
  },
  vertical: {
    start: { w: 248, h: 112 },
    stage: { w: 280, h: 150 },
    milestone: { w: 280, h: 150 },
    goal: { w: 272, h: 130 },
  },
};

/** Clearance kept between a line and a card it passes. */
const CLEAR_PAD = 9;
/** Minimum clear gap between two cards that collide inside one rank. */
const MIN_STACK_GAP = 24;

interface Metrics {
  orientation: Orientation;
  size: Record<NodeKind, { w: number; h: number }>;
  /** Card extent along the flow, and across it. */
  alongSpan: (kind: NodeKind) => number;
  acrossSpan: (kind: NodeKind) => number;
  /** Distance between rank centrelines, and between lane centrelines. */
  layerStep: number;
  laneStep: number;
  padAlongStart: number;
  padAlongEnd: number;
  padAcrossStart: number;
  padAcrossEnd: number;
  /** Half-width available for stacking parallel runs inside one channel. */
  channelHalf: number;
  /** How far a corridor run may be nudged off its rail. */
  railLimit: number;
}

function metricsFor(orientation: Orientation): Metrics {
  const size = SIZES[orientation];
  const kinds = Object.values(size);
  const widest = Math.max(...kinds.map((s) => s.w));
  const tallest = Math.max(...kinds.map((s) => s.h));
  const horizontal = orientation === "horizontal";

  const alongMax = horizontal ? widest : tallest;
  const acrossMax = horizontal ? tallest : widest;
  const layerStep = alongMax + (horizontal ? 68 : 74);
  const laneStep = acrossMax + 44;

  return {
    orientation,
    size,
    alongSpan: (k) => (horizontal ? size[k].w : size[k].h),
    acrossSpan: (k) => (horizontal ? size[k].h : size[k].w),
    layerStep,
    laneStep,
    // Leading padding carries the lane labels — a left-hand gutter when the flow
    // runs sideways, a header strip above it when the flow runs down.
    padAlongStart: horizontal ? 200 : 132,
    padAlongEnd: 100,
    // And across the flow, the rank labels: nothing when the flow runs sideways,
    // the age rail down the left when it runs down.
    padAcrossStart: horizontal ? 88 : 132,
    padAcrossEnd: horizontal ? 88 : 80,
    channelHalf: (layerStep - alongMax) / 2 - CLEAR_PAD,
    railLimit: (laneStep - acrossMax) / 2 - CLEAR_PAD - 4,
  };
}

export interface PlacedNode extends GraphNode {
  /** Projected centre, in screen coordinates. */
  cx: number;
  cy: number;
  w: number;
  h: number;
  /** Computed rank along the flow. */
  layer: number;
  /** Centre and extent in flow space, which is what the router works in. */
  along: number;
  across: number;
  alongSpan: number;
  acrossSpan: number;
}

/**
 * A lane's resolved geometry. `start`/`end`/`centre` are ACROSS-axis values —
 * y when the flow runs sideways, x when it runs down — so a consumer has to
 * consult `GraphLayout.orientation` before painting with them.
 */
export interface LaneBand {
  index: number;
  id: string;
  label: string;
  start: number;
  end: number;
  /** Shared centreline every card in the lane sits on. */
  centre: number;
}

/**
 * A rank's resolved geometry, plus the age window it represents.
 *
 * This is what makes the diagram legible without a caption: the flow axis stops
 * being an abstract "further along" and becomes "your child is nine, so you are
 * here". The band is taken from the most central card in the rank.
 */
export interface LayerBand {
  index: number;
  /** ALONG-axis centreline of the rank. */
  centre: number;
  ageBand?: string;
}

export interface GraphLayout {
  orientation: Orientation;
  nodes: PlacedNode[];
  width: number;
  height: number;
  /** Number of ranks, for callers that want to reason about density. */
  layers: number;
  lanes: LaneBand[];
  ranks: LayerBand[];
}

// ─── Rank assignment ────────────────────────────────────────────────────────

/**
 * Longest-path layering over the advancing edges.
 *
 * `overreach` is excluded — it spans most of the map by design, and letting it
 * stretch the ranks it leaps over would flatten the very structure the diagram
 * exists to show. `bypass` IS included, at weight 1: a fast track still has to
 * land strictly ahead of where it started, or it draws as a sideways line in a
 * one-directional chart. Because layering takes the LONGEST path, a genuine
 * shortcut still visibly skips ranks wherever the ladder is longer.
 */
function computeLayers(graph: PathwayGraph): Map<string, number> {
  const structural = graph.edges.filter((e) => e.kind !== "overreach");

  const outgoing = new Map<string, string[]>();
  const indegree = new Map<string, number>();
  for (const n of graph.nodes) {
    outgoing.set(n.id, []);
    indegree.set(n.id, 0);
  }
  for (const e of structural) {
    if (!outgoing.has(e.from) || !indegree.has(e.to)) continue;
    outgoing.get(e.from)!.push(e.to);
    indegree.set(e.to, indegree.get(e.to)! + 1);
  }

  const layer = new Map<string, number>(graph.nodes.map((n) => [n.id, 0]));
  const remaining = new Map(indegree);
  const queue = graph.nodes
    .filter((n) => remaining.get(n.id) === 0)
    .map((n) => n.id);

  // Kahn's algorithm, relaxing to the longest path as we go.
  while (queue.length > 0) {
    const id = queue.shift()!;
    for (const next of outgoing.get(id) ?? []) {
      layer.set(next, Math.max(layer.get(next)!, layer.get(id)! + 1));
      remaining.set(next, remaining.get(next)! - 1);
      if (remaining.get(next) === 0) queue.push(next);
    }
  }

  // Anything still at rank 0 that isn't the start was only reachable by a
  // non-structural edge. Nudge it off the start rank so it can't sit on top of
  // the entry point.
  for (const n of graph.nodes) {
    if (n.id !== graph.startNodeId && layer.get(n.id) === 0) layer.set(n.id, 1);
  }

  // Every destination shares the final rank, so the far end of the diagram reads
  // as a menu of outcomes rather than a ragged fringe.
  const deepest = Math.max(...layer.values());
  for (const n of graph.nodes) {
    if (n.goalId) layer.set(n.id, deepest);
  }

  return layer;
}

// ─── Placement ──────────────────────────────────────────────────────────────

export function layoutGraph(graph: PathwayGraph): GraphLayout {
  const m = metricsFor(graph.orientation ?? "horizontal");
  const horizontal = m.orientation === "horizontal";
  const layerOf = computeLayers(graph);
  const layers = Math.max(...layerOf.values()) + 1;
  const laneCount = Math.max(
    graph.lanes.length,
    ...graph.nodes.map((n) => n.lane + 1),
  );

  const alongMax = Math.max(
    ...Object.keys(m.size).map((k) => m.alongSpan(k as NodeKind)),
  );
  const layerAlong = (i: number) =>
    m.padAlongStart + alongMax / 2 + i * m.layerStep;
  const laneAcross = (i: number) =>
    m.padAcrossStart + i * m.laneStep + m.laneStep / 2;

  const flow = graph.nodes.map((n) => ({
    node: n,
    layer: layerOf.get(n.id) ?? 0,
    along: layerAlong(layerOf.get(n.id) ?? 0),
    across: laneAcross(n.lane),
  }));

  // Safety net, not the layout: two nodes authored into the same lane AND the
  // same rank would otherwise draw on top of each other. Pushing the later one
  // off its centreline costs that one card its alignment, which is the correct
  // trade — and the test suite flags the collision so it gets authored out.
  const byLayer = new Map<number, typeof flow>();
  for (const f of flow) {
    byLayer.set(f.layer, [...(byLayer.get(f.layer) ?? []), f]);
  }
  for (const rank of byLayer.values()) {
    rank.sort((a, b) => a.across - b.across);
    for (let i = 1; i < rank.length; i++) {
      const prev = rank[i - 1];
      const cur = rank[i];
      const min =
        prev.across +
        m.acrossSpan(prev.node.kind) / 2 +
        m.acrossSpan(cur.node.kind) / 2 +
        MIN_STACK_GAP;
      if (cur.across < min) cur.across = min;
    }
  }

  const nodes: PlacedNode[] = flow.map((f) => {
    const { w, h } = m.size[f.node.kind];
    return {
      ...f.node,
      w,
      h,
      layer: f.layer,
      along: f.along,
      across: f.across,
      alongSpan: m.alongSpan(f.node.kind),
      acrossSpan: m.acrossSpan(f.node.kind),
      cx: horizontal ? f.along : f.across,
      cy: horizontal ? f.across : f.along,
    };
  });

  const lanes: LaneBand[] = Array.from({ length: laneCount }, (_, i) => ({
    index: i,
    id: graph.lanes[i]?.id ?? `lane-${i}`,
    label: graph.lanes[i]?.label ?? "",
    start: m.padAcrossStart + i * m.laneStep,
    end: m.padAcrossStart + (i + 1) * m.laneStep,
    centre: laneAcross(i),
  }));

  // The age against a rank is read off the TRUNK only.
  //
  // Taking it from whichever card the rank happened to hold produced a rail that
  // ran "18–22, 17+, 20+" — because those ranks are parallel branches at
  // different life stages, not consecutive years, and a rail that appears to go
  // backwards reads as a bug. Following the trunk instead means the ages stop
  // where the routes diverge, which is the honest answer: past the national
  // circuit there is no single age any more.
  const trunk = graph.lanes.findIndex((l) => l.tone === "ladder");
  const ranks: LayerBand[] = Array.from({ length: layers }, (_, i) => ({
    index: i,
    centre: layerAlong(i),
    ageBand: nodes.find(
      (n) => n.layer === i && n.lane === trunk && n.ageBand,
    )?.ageBand,
  }));

  const alongEnd = Math.max(...nodes.map((n) => n.along + n.alongSpan / 2));
  const acrossEnd = Math.max(...nodes.map((n) => n.across + n.acrossSpan / 2));
  const alongTotal = alongEnd + m.padAlongEnd;
  const acrossTotal = Math.max(
    m.padAcrossStart + laneCount * m.laneStep + m.padAcrossEnd,
    acrossEnd + m.padAcrossEnd,
  );

  return {
    orientation: m.orientation,
    nodes,
    width: horizontal ? alongTotal : acrossTotal,
    height: horizontal ? acrossTotal : alongTotal,
    layers,
    lanes,
    ranks,
  };
}

// ─── Edge routing ────────────────────────────────────────────────────────────

interface Pt {
  x: number;
  y: number;
}

/** A point in flow space, before projection. */
interface Flow {
  along: number;
  across: number;
}

export interface RoutedEdge {
  edge: GraphEdge;
  /** SVG path — straight runs joined by rounded right angles. */
  d: string;
  /** The corner points the path was built from, before rounding. */
  points: Pt[];
  /** Midpoint by arc length. */
  mid: Pt;
  /**
   * Where the gate label sits: the middle of the route's longest straight run,
   * which orthogonal routing guarantees is clear of every card.
   */
  label: Pt;
  start: Pt;
  end: Pt;
}

// ─── Ports ───────────────────────────────────────────────────────────────────

/**
 * Fan a node's edges across its leading and trailing faces instead of docking
 * them all at the centre. Five lines leaving one point have to splay at five
 * different angles to get anywhere; five lines leaving five points can each
 * leave straight, which is what keeps the exits readable.
 *
 * Ordering matters as much as spacing: sorting by the other end's track means
 * the line heading to the outermost lane takes the outermost port, so edges
 * never have to cross each other just to leave the card.
 */
function portOffsets(count: number, span: number): number[] {
  if (count === 0) return [];
  if (count === 1) return [0];
  const room = Math.min(span - 36, (count - 1) * 20);
  const step = room / (count - 1);
  return Array.from({ length: count }, (_, i) => -room / 2 + i * step);
}

function computePorts(graph: PathwayGraph, byId: Map<string, PlacedNode>) {
  const out = new Map<string, number>();
  const into = new Map<string, number>();
  const end = (e: GraphEdge, side: "from" | "to") =>
    byId.get(side === "from" ? e.from : e.to)!;

  for (const node of byId.values()) {
    const outs = graph.edges.filter(
      (e) => e.from === node.id && byId.has(e.to) && byId.has(e.from),
    );
    outs.sort(
      (a, b) =>
        end(a, "to").across - end(b, "to").across ||
        end(a, "to").layer - end(b, "to").layer,
    );
    portOffsets(outs.length, node.acrossSpan).forEach((d, i) =>
      out.set(outs[i].id, d),
    );

    const ins = graph.edges.filter(
      (e) => e.to === node.id && byId.has(e.to) && byId.has(e.from),
    );
    ins.sort(
      (a, b) =>
        end(a, "from").across - end(b, "from").across ||
        end(a, "from").layer - end(b, "from").layer,
    );
    portOffsets(ins.length, node.acrossSpan).forEach((d, i) =>
      into.set(ins[i].id, d),
    );
  }

  return { out, into };
}

// ─── Corridors ───────────────────────────────────────────────────────────────

/**
 * The lines a long edge is allowed to travel along: the boundary between each
 * pair of lanes, plus one outer lane on each side of the diagram for the leaps.
 * A corridor is card-free by construction, so a run along one cannot pass
 * through a card the way a diagonal could.
 */
function corridorRails(lanes: LaneBand[], acrossTotal: number): number[] {
  const first = lanes[0].start;
  const last = lanes[lanes.length - 1].end;
  const rails = [Math.max(first / 2, 34)];
  for (let i = 1; i < lanes.length; i++) rails.push(lanes[i].start);
  rails.push(last + (acrossTotal - last) / 2);
  return rails;
}

/** Axis-aligned segments, so a bounding-box test is exact. */
function segmentHitsCard(
  p: Flow,
  q: Flow,
  nodes: PlacedNode[],
  skip: Set<string>,
): boolean {
  const a0 = Math.min(p.along, q.along);
  const a1 = Math.max(p.along, q.along);
  const c0 = Math.min(p.across, q.across);
  const c1 = Math.max(p.across, q.across);
  return nodes.some((n) => {
    if (skip.has(n.id)) return false;
    return (
      a1 >= n.along - n.alongSpan / 2 - CLEAR_PAD &&
      a0 <= n.along + n.alongSpan / 2 + CLEAR_PAD &&
      c1 >= n.across - n.acrossSpan / 2 - CLEAR_PAD &&
      c0 <= n.across + n.acrossSpan / 2 + CLEAR_PAD
    );
  });
}

function pathHitsCard(
  points: Flow[],
  nodes: PlacedNode[],
  skip: Set<string>,
): boolean {
  for (let i = 0; i < points.length - 1; i++) {
    if (segmentHitsCard(points[i], points[i + 1], nodes, skip)) return true;
  }
  return false;
}

// ─── Polyline construction ───────────────────────────────────────────────────

/** Drop duplicate and collinear corners so a straight run stays one segment. */
function collapse(points: Flow[]): Flow[] {
  const out: Flow[] = [];
  for (const p of points) {
    const last = out[out.length - 1];
    if (
      last &&
      Math.abs(last.along - p.along) < 0.5 &&
      Math.abs(last.across - p.across) < 0.5
    ) {
      continue;
    }
    out.push(p);
  }

  const kept: Flow[] = [];
  for (let i = 0; i < out.length; i++) {
    const prev = kept[kept.length - 1];
    const next = out[i + 1];
    const cur = out[i];
    if (prev && next) {
      const sameAcross =
        Math.abs(prev.across - cur.across) < 0.5 &&
        Math.abs(cur.across - next.across) < 0.5;
      const sameAlong =
        Math.abs(prev.along - cur.along) < 0.5 &&
        Math.abs(cur.along - next.along) < 0.5;
      if (sameAcross || sameAlong) continue;
    }
    kept.push(cur);
  }
  return kept;
}

/**
 * The canonical shape: stub forwards out of the source, a step across inside the
 * first channel, a long run along the corridor, a step across inside the last
 * channel, stub into the target. Whenever two of those coincide — the source and
 * target share a lane, or the ranks are adjacent — `collapse` folds the shape
 * down to the straight line or single elbow it really is.
 */
function buildPoints(
  a: Flow,
  b: Flow,
  stepA: number,
  stepB: number,
  corridor: number,
): Flow[] {
  return collapse([
    a,
    { along: stepA, across: a.across },
    { along: stepA, across: corridor },
    { along: stepB, across: corridor },
    { along: stepB, across: b.across },
    b,
  ]);
}

const CORNER = 16;

function dist(p: Pt, q: Pt): number {
  return Math.hypot(q.x - p.x, q.y - p.y);
}

function along(from: Pt, toward: Pt, d: number): Pt {
  const len = dist(from, toward) || 1;
  return {
    x: from.x + ((toward.x - from.x) * d) / len,
    y: from.y + ((toward.y - from.y) * d) / len,
  };
}

const f = (v: number) => v.toFixed(1);

/** Straight runs joined by quadratic fillets — a right angle without the edge. */
function roundedPath(points: Pt[]): string {
  if (points.length < 2) return "";
  let d = `M ${f(points[0].x)} ${f(points[0].y)}`;
  for (let i = 1; i < points.length - 1; i++) {
    const prev = points[i - 1];
    const cur = points[i];
    const next = points[i + 1];
    const r = Math.min(CORNER, dist(prev, cur) / 2, dist(cur, next) / 2);
    const enter = along(cur, prev, r);
    const exit = along(cur, next, r);
    d += ` L ${f(enter.x)} ${f(enter.y)} Q ${f(cur.x)} ${f(cur.y)}, ${f(exit.x)} ${f(exit.y)}`;
  }
  const last = points[points.length - 1];
  return `${d} L ${f(last.x)} ${f(last.y)}`;
}

function polylineMid(points: Pt[]): Pt {
  const total = points.reduce(
    (sum, p, i) => (i === 0 ? 0 : sum + dist(points[i - 1], p)),
    0,
  );
  let walked = 0;
  for (let i = 1; i < points.length; i++) {
    const seg = dist(points[i - 1], points[i]);
    if (walked + seg >= total / 2) {
      return along(points[i - 1], points[i], total / 2 - walked);
    }
    walked += seg;
  }
  return points[points.length - 1];
}

/** Shortest run a label pill can sit on without overhanging the cards. */
const LABEL_RUN = 130;

function labelPoint(points: Pt[], railsScreen: number[], horizontal: boolean): Pt {
  let flat: { p: Pt; len: number } | null = null;
  let upright: { p: Pt; len: number } | null = null;

  for (let i = 0; i < points.length - 1; i++) {
    const p = points[i];
    const q = points[i + 1];
    const mid = { x: (p.x + q.x) / 2, y: (p.y + q.y) / 2 };
    const len = dist(p, q);
    if (Math.abs(p.y - q.y) < 0.5) {
      if (!flat || len > flat.len) flat = { p: mid, len };
    } else if (!upright || len > upright.len) {
      upright = { p: mid, len };
    }
  }

  // A label pill is wide and short, so it wants a HORIZONTAL run to sit on
  // whichever way the flow runs. Long enough, and it sits on the line.
  if (flat && flat.len >= LABEL_RUN) return flat.p;
  if (upright && upright.len >= LABEL_RUN * 1.4) return upright.p;

  // Otherwise the run is barely wider than the channel and the pill has to
  // overhang, so float it off the line into the nearest corridor — card-free
  // space — instead of letting the cards clip it. That is what turned
  // "Find a coach" into "d a coach" on screen.
  const on = flat?.p ?? upright?.p ?? polylineMid(points);
  const cur = horizontal ? on.y : on.x;
  const rail = railsScreen.reduce((best, r) =>
    Math.abs(r - cur) < Math.abs(best - cur) ? r : best,
  );
  return horizontal ? { x: on.x, y: rail } : { x: rail, y: on.y };
}

// ─── Routing ─────────────────────────────────────────────────────────────────

interface Draft {
  edge: GraphEdge;
  a: Flow;
  b: Flow;
  firstChannel: number;
  lastChannel: number;
  corridor: number;
  /** Set when the corridor is a shared rail, so parallel runs get separated. */
  railIndex: number | null;
}

function planEdge(
  edge: GraphEdge,
  from: PlacedNode,
  to: PlacedNode,
  nodes: PlacedNode[],
  rails: number[],
  channelAlong: (i: number) => number,
  outPort: number,
  inPort: number,
): Draft {
  const a: Flow = {
    along: from.along + from.alongSpan / 2,
    across: from.across + outPort,
  };
  const b: Flow = {
    along: to.along - to.alongSpan / 2,
    across: to.across + inPort,
  };
  const firstChannel = from.layer;
  const lastChannel = Math.max(from.layer, to.layer - 1);
  const skip = new Set([from.id, to.id]);

  // Candidate corridors, best first. Staying on the source's own line ("carry
  // on, then arrive") or crossing straight to the target's ("get into position,
  // then run in") both read as intentional; a shared rail is the fallback for
  // when neither is clear.
  const candidates: { across: number; railIndex: number | null }[] = [];
  if (edge.kind !== "overreach") {
    candidates.push(
      { across: a.across, railIndex: null },
      { across: b.across, railIndex: null },
    );
  }

  // An overreach is a leap over the whole map, so it takes the outer rail on the
  // side it is heading for and flies past everything in between.
  const ranked = rails
    .map((across, railIndex) => ({ across, railIndex }))
    .sort((p, q) => {
      if (edge.kind === "overreach") {
        const outer = b.across < a.across ? 0 : rails.length - 1;
        return Math.abs(p.railIndex - outer) - Math.abs(q.railIndex - outer);
      }
      const target = (a.across + b.across) / 2;
      return Math.abs(p.across - target) - Math.abs(q.across - target);
    });
  candidates.push(...ranked);

  for (const c of candidates) {
    const points = buildPoints(
      a,
      b,
      channelAlong(firstChannel),
      channelAlong(lastChannel),
      c.across,
    );
    if (!pathHitsCard(points, nodes, skip)) {
      return {
        edge,
        a,
        b,
        firstChannel,
        lastChannel,
        corridor: c.across,
        railIndex: c.railIndex,
      };
    }
  }

  // Nothing was clear — a dense authored map can genuinely run out of corridors.
  // Take the preferred rail rather than dropping the edge.
  return {
    edge,
    a,
    b,
    firstChannel,
    lastChannel,
    corridor: ranked[0].across,
    railIndex: ranked[0].railIndex,
  };
}

/** Spread coincident parallel lines apart, centred on their shared track. */
function slotOffsets<T>(
  members: T[],
  key: (t: T) => string,
  spacing: number,
  limit: number,
): Map<string, number> {
  const offsets = new Map<string, number>();
  if (members.length <= 1) {
    if (members.length === 1) offsets.set(key(members[0]), 0);
    return offsets;
  }
  const step = Math.min(spacing, (limit * 2) / (members.length - 1));
  members.forEach((m, i) => {
    offsets.set(key(m), (i - (members.length - 1) / 2) * step);
  });
  return offsets;
}

export function routeEdges(graph: PathwayGraph, layout: GraphLayout): RoutedEdge[] {
  const m = metricsFor(layout.orientation);
  const horizontal = layout.orientation === "horizontal";
  const byId = new Map(layout.nodes.map((n) => [n.id, n]));
  const { out, into } = computePorts(graph, byId);
  const acrossTotal = horizontal ? layout.height : layout.width;
  const rails = corridorRails(layout.lanes, acrossTotal);
  const channelAlong = (i: number) =>
    layout.ranks[Math.min(i, layout.ranks.length - 1)].centre + m.layerStep / 2;

  const drafts = graph.edges.flatMap((e) => {
    const from = byId.get(e.from);
    const to = byId.get(e.to);
    // A map referencing a node it doesn't define is an authoring bug, not a
    // runtime condition — drop the edge rather than crash the whole canvas.
    if (!from || !to) return [];
    return [
      planEdge(
        e,
        from,
        to,
        layout.nodes,
        rails,
        channelAlong,
        out.get(e.id) ?? 0,
        into.get(e.id) ?? 0,
      ),
    ];
  });

  // Two runs in one channel on the same line, or two corridor runs on one rail,
  // would draw as a single line carrying two meanings. Separate them.
  const channelOffsets = new Map<string, number>();
  const byChannel = new Map<number, Draft[]>();
  for (const d of drafts) {
    // Only claim a slot in a channel the edge genuinely turns in. A route that
    // simply runs along its own lane has no turn there, and letting it hold a
    // slot would push the real turns apart for nothing.
    const used = new Set<number>();
    if (Math.abs(d.corridor - d.a.across) > 1) used.add(d.firstChannel);
    if (Math.abs(d.corridor - d.b.across) > 1) used.add(d.lastChannel);
    for (const ch of used) {
      byChannel.set(ch, [...(byChannel.get(ch) ?? []), d]);
    }
  }
  for (const [channel, members] of byChannel) {
    members.sort((p, q) => p.a.across - q.a.across || p.b.across - q.b.across);
    for (const [id, delta] of slotOffsets(
      members,
      (d) => d.edge.id,
      13,
      m.channelHalf,
    )) {
      channelOffsets.set(`${id}|${channel}`, delta);
    }
  }

  const railOffsets = new Map<string, number>();
  const byRail = new Map<number, Draft[]>();
  for (const d of drafts) {
    if (d.railIndex === null) continue;
    byRail.set(d.railIndex, [...(byRail.get(d.railIndex) ?? []), d]);
  }
  for (const members of byRail.values()) {
    members.sort((p, q) => p.a.along - q.a.along);
    for (const [id, delta] of slotOffsets(
      members,
      (d) => d.edge.id,
      12,
      m.railLimit,
    )) {
      railOffsets.set(id, delta);
    }
  }

  const project = (p: Flow): Pt =>
    horizontal
      ? { x: p.along, y: p.across }
      : { x: p.across, y: p.along };
  const railsScreen = rails;

  return drafts.map((d) => {
    const stepA =
      channelAlong(d.firstChannel) +
      (channelOffsets.get(`${d.edge.id}|${d.firstChannel}`) ?? 0);
    const stepB =
      channelAlong(d.lastChannel) +
      (channelOffsets.get(`${d.edge.id}|${d.lastChannel}`) ?? 0);
    const corridor = d.corridor + (railOffsets.get(d.edge.id) ?? 0);
    const flowPoints = buildPoints(d.a, d.b, stepA, stepB, corridor);
    const points = flowPoints.map(project);

    return {
      edge: d.edge,
      d: roundedPath(points),
      points,
      mid: polylineMid(points),
      label: labelPoint(points, railsScreen, horizontal),
      start: project(d.a),
      end: project(d.b),
    };
  });
}

// ─── Path resolution ────────────────────────────────────────────────────────

/**
 * Nodes and edges tagged for a goal. Highlighting works off tags rather than
 * graph search on purpose: an authored map knows which nodes genuinely belong
 * to a route, whereas a shortest-path walk would happily route a parent to the
 * pro tour through the `overreach` edge because it's the fewest hops.
 */
export function subgraphForGoal(graph: PathwayGraph, goalId: string) {
  const nodeIds = new Set(
    graph.nodes
      .filter((n) => n.goals.includes(goalId as never))
      .map((n) => n.id),
  );
  const edgeIds = new Set(
    graph.edges
      .filter(
        (e) =>
          e.goals.includes(goalId as never) &&
          nodeIds.has(e.from) &&
          nodeIds.has(e.to),
      )
      .map((e) => e.id),
  );
  return { nodeIds, edgeIds };
}

/**
 * The ordered walk from start to a goal along `primary`/`offramp` edges only —
 * what the "next step" stepper advances through. Bypass and overreach edges are
 * excluded so the guided walk never silently recommends a shortcut.
 */
export function orderedRoute(graph: PathwayGraph, goalId: string): string[] {
  const { nodeIds } = subgraphForGoal(graph, goalId);
  const adjacency = new Map<string, string[]>();
  for (const e of graph.edges) {
    if (e.kind === "overreach" || e.kind === "bypass") continue;
    if (!nodeIds.has(e.from) || !nodeIds.has(e.to)) continue;
    adjacency.set(e.from, [...(adjacency.get(e.from) ?? []), e.to]);
  }

  const goalNode = graph.nodes.find((n) => n.goalId === goalId);
  if (!goalNode) return [];

  // Prefer the LONGEST chain — the full ladder is the honest route, not the
  // fewest hops.
  let best: string[] = [];
  const walk = (at: string, trail: string[]) => {
    if (trail.length > graph.nodes.length) return; // cycle guard
    if (at === goalNode.id) {
      if (trail.length > best.length) best = [...trail];
      return;
    }
    for (const next of adjacency.get(at) ?? []) {
      if (trail.includes(next)) continue;
      walk(next, [...trail, next]);
    }
  };
  walk(graph.startNodeId, [graph.startNodeId]);
  return best;
}

// ─── Viewport fitting ───────────────────────────────────────────────────────

/** Scale and translation that fit a diagram of `w × h` inside a container. */
export function fitTransform(
  containerW: number,
  containerH: number,
  w: number,
  h: number,
  padding = 8,
) {
  const usableW = Math.max(containerW - padding * 2, 1);
  const usableH = Math.max(containerH - padding * 2, 1);
  const scale = Math.min(usableW / w, usableH / h);
  return {
    scale,
    tx: (containerW - w * scale) / 2,
    ty: (containerH - h * scale) / 2,
  };
}

/**
 * The default view: fit the SHORT axis at a readable scale and let the parent
 * pan along the long one. Fitting both would shrink the labels to nothing, so
 * the diagram makes the same bargain a metro map does — and which axis is short
 * depends on which way the flow runs. `fitTransform` stays available behind the
 * overview button.
 */
export function initialTransform(
  containerW: number,
  containerH: number,
  w: number,
  h: number,
  orientation: Orientation = "horizontal",
) {
  if (orientation === "vertical") {
    const scale = clamp(containerW / Math.max(w, 1), 0.42, 1);
    return {
      scale,
      tx: (containerW - w * scale) / 2,
      // Anchored at the top — the start node is the entry point.
      ty: 12,
    };
  }
  const scale = clamp(containerH / Math.max(h, 1), 0.42, 0.92);
  return {
    scale,
    tx: 12,
    ty: (containerH - h * scale) / 2,
  };
}

export function clamp(v: number, min: number, max: number) {
  return Math.min(Math.max(v, min), max);
}
