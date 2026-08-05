"use client";

// ─── Canvas ─────────────────────────────────────────────────────────────────
//
// Holds the two co-transformed layers — SVG edges underneath, HTML node cards on
// top — plus the viewport controls. Both layers share one CSS transform, so
// panning and zooming never re-run layout or re-render React.

import {
  LocateFixed,
  Minus,
  Move,
  Plus,
  Scan,
  Tag,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { layoutGraph, routeEdges, subgraphForGoal } from "../../graph/geometry";
import { GoalId, PathwayGraph } from "../../graph/types";
import { GraphEdges } from "./GraphEdges";
import { LaneBands, LaneGutter, LaneOnsetNotes, RankRail } from "./GraphLanes";
import { GraphNodeCard } from "./GraphNodeCard";
import { useGraphViewport } from "./useGraphViewport";

interface GraphCanvasProps {
  graph: PathwayGraph;
  activeGoal: GoalId | null;
  selectedNodeId: string | null;
  selectedEdgeId: string | null;
  onSelectNode: (id: string) => void;
  onSelectEdge: (id: string) => void;
  /** Node the child currently sits on, from their profile. */
  currentNodeId: string | null;
  /** Goal terminal matching the family's stated ambition. */
  goalTargetNodeId: string | null;
  /** Pan/zoom to this node when it changes — used by the guided walk. */
  focusNodeId: string | null;
}

function ControlButton({
  label,
  onClick,
  active,
  children,
}: {
  label: string;
  onClick: () => void;
  active?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      data-graph-interactive
      onClick={onClick}
      aria-label={label}
      title={label}
      aria-pressed={active}
      className={`flex h-9 w-9 items-center justify-center rounded-xl border shadow-sm backdrop-blur transition ${
        active
          ? "border-power-orange bg-power-orange text-white"
          : "border-slate-200 bg-white/95 text-slate-600 hover:border-slate-400 hover:text-slate-900"
      }`}
    >
      {children}
    </button>
  );
}

export function GraphCanvas({
  graph,
  activeGoal,
  selectedNodeId,
  selectedEdgeId,
  onSelectNode,
  onSelectEdge,
  currentNodeId,
  goalTargetNodeId,
  focusNodeId,
}: GraphCanvasProps) {
  const layout = useMemo(() => layoutGraph(graph), [graph]);
  const routed = useMemo(() => routeEdges(graph, layout), [graph, layout]);

  const {
    containerRef,
    transform,
    animating,
    isPanning,
    fit,
    reset,
    zoomBy,
    focusPoint,
    handlers,
  } = useGraphViewport(layout.width, layout.height, layout.orientation);

  // Gate labels are ON by default. They were opt-in on the theory that a clean
  // canvas reads better, and it does — but a parent looking at unlabelled lines
  // has no way to know what any of them means, and nobody is standing next to
  // them to explain it. The map has to answer for itself.
  const [labelsAlways, setLabelsAlways] = useState(true);

  const { activeNodeIds, activeEdgeIds } = useMemo(() => {
    if (!activeGoal) {
      return {
        activeNodeIds: new Set<string>(),
        activeEdgeIds: new Set<string>(),
      };
    }
    const sub = subgraphForGoal(graph, activeGoal);
    return { activeNodeIds: sub.nodeIds, activeEdgeIds: sub.edgeIds };
  }, [graph, activeGoal]);

  // Bring a programmatically-selected node into view without yanking the zoom.
  useEffect(() => {
    if (!focusNodeId) return;
    const node = layout.nodes.find((n) => n.id === focusNodeId);
    if (node) focusPoint(node.cx, node.cy);
  }, [focusNodeId, layout, focusPoint]);

  // Below roughly a third scale, even a pill-backed label is unreadable.
  const showLabels = transform.scale > 0.34;
  const vertical = layout.orientation === "vertical";

  /**
   * Left edge of the goal column, in diagram space. Everything right of this is
   * an outcome rather than a step, and saying so with a band is what stops the
   * final column reading as just one more tier.
   */
  const outcomeAt = useMemo(() => {
    const goals = layout.nodes.filter((n) => n.goalId);
    if (goals.length === 0) return null;
    return Math.min(...goals.map((n) => n.along - n.alongSpan / 2)) - 52;
  }, [layout]);

  return (
    // `select-none` matters more than it looks: without it, dragging to pan
    // sweeps a text selection across every card and label the cursor crosses,
    // and the parent is left with the map highlighted blue.
    <div
      ref={containerRef}
      {...handlers}
      className={`relative h-[520px] touch-none select-none overflow-hidden bg-slate-50/40 bg-[radial-gradient(circle_at_1px_1px,#dde4ed_1px,transparent_0)] [background-size:26px_26px] sm:h-[640px] lg:h-[740px] xl:h-[820px] ${
        isPanning ? "cursor-grabbing" : "cursor-grab"
      }`}
    >
      <div
        className="absolute left-0 top-0 origin-top-left"
        style={{
          width: layout.width,
          height: layout.height,
          transform: `translate(${transform.tx}px, ${transform.ty}px) scale(${transform.scale})`,
          transition: animating
            ? "transform 420ms cubic-bezier(0.22, 1, 0.36, 1)"
            : "none",
        }}
      >
        <LaneBands layout={layout} />

        {/* The arrival band — where the journey stops being steps and becomes
            outcomes. Without it the final rank read as one more tier. */}
        {outcomeAt !== null && (
          <div
            aria-hidden
            className={`absolute border-dashed border-slate-300 ${
              vertical ? "border-t" : "border-l"
            }`}
            style={
              vertical
                ? {
                    left: 0,
                    top: outcomeAt,
                    width: layout.width,
                    height: layout.height - outcomeAt,
                    background:
                      "linear-gradient(180deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.72) 40%, rgba(255,255,255,0.92) 100%)",
                  }
                : {
                    left: outcomeAt,
                    top: 0,
                    width: layout.width - outcomeAt,
                    height: layout.height,
                    background:
                      "linear-gradient(90deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.72) 40%, rgba(255,255,255,0.92) 100%)",
                  }
            }
          >
            <span
              className="absolute text-[13px] font-black uppercase tracking-[0.28em] text-slate-300"
              style={vertical ? { left: 148, top: 20 } : { left: 24, top: 32 }}
            >
              Where it leads
            </span>
          </div>
        )}

        <LaneOnsetNotes layout={layout} />

        <GraphEdges
          routed={routed}
          width={layout.width}
          height={layout.height}
          activeEdgeIds={activeEdgeIds}
          selectedEdgeId={selectedEdgeId}
          selectedNodeId={selectedNodeId}
          onSelectEdge={onSelectEdge}
          showLabels={showLabels}
          labelsAlways={labelsAlways}
        />

        {layout.nodes.map((node) => (
          <GraphNodeCard
            key={node.id}
            node={node}
            tone={graph.lanes[node.lane]?.tone ?? "ladder"}
            active={activeNodeIds.size === 0 || activeNodeIds.has(node.id)}
            selected={selectedNodeId === node.id}
            isCurrent={currentNodeId === node.id}
            isGoalTarget={goalTargetNodeId === node.id}
            onSelect={onSelectNode}
          />
        ))}
      </div>

      <RankRail layout={layout} transform={transform} />
      <LaneGutter layout={layout} authored={graph.lanes} transform={transform} />

      {/* The screen-space "Today" / "Where it leads" chips that used to sit in
          these corners are gone: the dark start card and the Outcomes band say
          the same thing in diagram space, and the top-right chip sat exactly
          where the overreach edge's label lands. */}

      {/* Viewport controls */}
      <div className="absolute bottom-3 right-3 flex flex-col gap-1.5">
        <ControlButton label="Zoom in" onClick={() => zoomBy(1.2)}>
          <Plus className="h-4 w-4" />
        </ControlButton>
        <ControlButton label="Zoom out" onClick={() => zoomBy(0.83)}>
          <Minus className="h-4 w-4" />
        </ControlButton>
        <ControlButton label="See the whole map" onClick={() => fit(true)}>
          <Scan className="h-4 w-4" />
        </ControlButton>
        <ControlButton label="Back to the start" onClick={() => reset(true)}>
          <LocateFixed className="h-4 w-4" />
        </ControlButton>
        <ControlButton
          label={labelsAlways ? "Hide all step names" : "Show all step names"}
          active={labelsAlways}
          onClick={() => setLabelsAlways((v) => !v)}
        >
          <Tag className="h-4 w-4" />
        </ControlButton>
      </div>

      {/* Drag hint — the affordance isn't obvious on a static screenshot */}
      <div className="pointer-events-none absolute bottom-3 left-3 flex items-center gap-1.5 rounded-full border border-slate-200 bg-white/85 px-2.5 py-1 text-[10px] font-semibold text-slate-400 backdrop-blur">
        <Move className="h-3 w-3" />
        {vertical ? "Drag down to follow the path" : "Drag sideways to follow the path"}
      </div>
    </div>
  );
}
