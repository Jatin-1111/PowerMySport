"use client";

// ─── Edge layer ─────────────────────────────────────────────────────────────
//
// SVG sized to the full virtual canvas.
//
// Showing every gate label at once re-created the exact problem this redesign
// set out to fix — a wall of English on the face. So labels are earned, not
// given: a label appears when its edge is selected, when it touches the
// selected node, when it belongs to the chosen goal's route, or when it's the
// one overreach edge (whose whole job is to be noticed). Everything else stays
// a clean line until asked.

import { RoutedEdge } from "../../graph/geometry";
import { EdgeKind } from "../../graph/types";
import { EDGE_STYLES } from "./tokens";

interface GraphEdgesProps {
  routed: RoutedEdge[];
  /** Diagram dimensions, computed by the layered layout. */
  width: number;
  height: number;
  /** Edge ids in the active path. Empty set means "no goal filter applied". */
  activeEdgeIds: Set<string>;
  selectedEdgeId: string | null;
  selectedNodeId: string | null;
  onSelectEdge: (id: string) => void;
  /** Hide labels when zoomed far out, where they'd overlap into noise. */
  showLabels: boolean;
  /** Escape hatch for parents who want the whole map annotated at once. */
  labelsAlways: boolean;
}

const KINDS: EdgeKind[] = ["primary", "bypass", "overreach", "offramp"];

export function GraphEdges({
  routed,
  width,
  height,
  activeEdgeIds,
  selectedEdgeId,
  selectedNodeId,
  onSelectEdge,
  showLabels,
  labelsAlways,
}: GraphEdgesProps) {
  const filtering = activeEdgeIds.size > 0;

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className="absolute left-0 top-0 overflow-visible"
    >
      <defs>
        {/* One arrowhead per kind per dim-state — SVG markers can't inherit stroke. */}
        {KINDS.flatMap((kind) =>
          [true, false].map((active) => {
            const s = EDGE_STYLES[kind];
            return (
              <marker
                key={`${kind}-${active}`}
                id={`arrow-${kind}-${active ? "on" : "off"}`}
                viewBox="0 0 10 10"
                refX="8"
                refY="5"
                markerWidth="7"
                markerHeight="7"
                orient="auto-start-reverse"
              >
                <path
                  d="M 0 1 L 9 5 L 0 9 z"
                  fill={active ? s.hex : s.mutedHex}
                />
              </marker>
            );
          }),
        )}
      </defs>

      {/* Travelling dots along the chosen route. A static highlight tells you
          which edges belong to a goal; motion tells you which WAY they run, which
          is the one thing a still diagram of a journey can't say. Only ever drawn
          while a goal is selected, so the resting map is completely still. */}
      <style>{`
        @keyframes pms-graph-flow { to { stroke-dashoffset: -34; } }
        .pms-flow { animation: pms-graph-flow 1.1s linear infinite; }
        @media (prefers-reduced-motion: reduce) { .pms-flow { display: none; } }
        /* Animating stroke-dashoffset repaints the path every frame rather than
           compositing it, so a route of fifteen edges is real work. Cheap on a
           desktop, not worth the frame budget on a phone where the map is scaled
           down far enough that the dots barely register anyway. */
        @media (max-width: 640px) { .pms-flow { display: none; } }
      `}</style>

      {/* Strokes first, so no line is ever drawn over a label pill. */}
      {routed.map((r) => {
        const style = EDGE_STYLES[r.edge.kind];
        const isActive = !filtering || activeEdgeIds.has(r.edge.id);
        const isSelected = selectedEdgeId === r.edge.id;
        const stroke = isActive ? style.hex : style.mutedHex;

        return (
          <g key={r.edge.id}>
            {/* Soft glow behind the selected edge so it reads through crossings. */}
            {isSelected && (
              <path
                d={r.d}
                fill="none"
                stroke={style.hex}
                strokeOpacity={0.18}
                strokeWidth={style.width + 12}
                strokeLinecap="round"
              />
            )}
            <path
              d={r.d}
              fill="none"
              stroke={stroke}
              strokeWidth={isSelected ? style.width + 1 : style.width}
              strokeDasharray={style.dash}
              strokeLinecap="round"
              markerEnd={`url(#arrow-${r.edge.kind}-${isActive ? "on" : "off"})`}
              style={{ transition: "stroke 220ms ease" }}
            />
            {/* The flow. Round caps on a near-zero dash give dots rather than
                dashes, so it reads as movement along the line instead of turning
                a solid edge into a dashed one — which would collide with the
                dash patterns that already carry meaning. */}
            {filtering && isActive && (
              <path
                className="pms-flow"
                d={r.d}
                fill="none"
                stroke={style.hex}
                strokeWidth={style.width + 1.6}
                strokeDasharray="0.1 34"
                strokeLinecap="round"
                strokeOpacity={0.75}
                style={{ pointerEvents: "none" }}
              />
            )}

            {/* Invisible fat stroke purely for hit-testing — thin arcs are
                otherwise almost impossible to click, especially on touch. */}
            <path
              d={r.d}
              fill="none"
              stroke="transparent"
              strokeWidth={30}
              strokeLinecap="round"
              className="cursor-pointer"
              style={{ pointerEvents: "stroke" }}
              data-graph-interactive
              onClick={(e) => {
                e.stopPropagation();
                onSelectEdge(r.edge.id);
              }}
            />
          </g>
        );
      })}

      {/* Label pills last so they sit above every stroke. */}
      {showLabels &&
        routed.map((r) => {
          if (!r.edge.label) return null;

          const isActive = !filtering || activeEdgeIds.has(r.edge.id);
          const isSelected = selectedEdgeId === r.edge.id;
          const touchesSelectedNode =
            !!selectedNodeId &&
            (r.edge.from === selectedNodeId || r.edge.to === selectedNodeId);

          // The one edge that must always announce itself.
          const isHeadline = r.edge.kind === "overreach";

          const show =
            labelsAlways ||
            isSelected ||
            touchesSelectedNode ||
            isHeadline ||
            (filtering && isActive);
          if (!show) return null;

          const style = EDGE_STYLES[r.edge.kind];
          const emphatic = isHeadline || isSelected;

          return (
            <foreignObject
              key={`label-${r.edge.id}`}
              x={r.label.x - 170}
              y={r.label.y - 24}
              width={340}
              height={48}
              style={{ pointerEvents: "none", overflow: "visible" }}
            >
              <div
                style={{
                  display: "flex",
                  width: "100%",
                  height: "100%",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <span
                  style={{
                    maxWidth: 300,
                    padding: emphatic ? "5px 13px" : "4px 11px",
                    borderRadius: 999,
                    border: `1.5px solid ${isActive ? style.hex + (emphatic ? "00" : "33") : "#e2e8f0"}`,
                    background: emphatic
                      ? isActive
                        ? style.hex
                        : "#f8fafc"
                      : "rgba(255,255,255,0.97)",
                    color: emphatic
                      ? isActive
                        ? "#ffffff"
                        : "#94a3b8"
                      : isActive
                        ? style.hex
                        : "#94a3b8",
                    fontSize: emphatic ? 17 : 16,
                    fontWeight: emphatic ? 800 : 700,
                    letterSpacing: "-0.01em",
                    lineHeight: 1.25,
                    textAlign: "center",
                    boxShadow: emphatic
                      ? `0 4px 14px -2px ${style.hex}66`
                      : "0 2px 6px rgba(15,23,42,0.09)",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {r.edge.label}
                </span>
              </div>
            </foreignObject>
          );
        })}
    </svg>
  );
}
