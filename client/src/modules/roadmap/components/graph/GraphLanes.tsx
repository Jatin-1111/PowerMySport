"use client";

// ─── Lane bands, lane gutter & rank rail ────────────────────────────────────
//
// The layout aligns every card in a track onto one centreline; these pieces are
// what make that alignment mean something. Without them a parent sees rows of
// cards and has to infer why those particular cards share a row.
//
// Bands ride inside the transformed layer, so they scale and pan with the
// diagram. Labels do NOT — they're pinned to the edges of the viewport and track
// only the relevant half of the transform, so "which track is this" and "what age
// is this" survive scrolling to the far end of a 2700px map.
//
// Everything here reads `orientation` because the two axes swap: when the flow
// runs down, tracks are columns and the lane labels become a header strip, while
// the ranks become rows with the age rail down the left.

import { GraphLayout, LaneBand, LayerBand, PlacedNode } from "../../graph/geometry";
import { PathwayLane } from "../../graph/types";
import { LANE_TONES } from "./tokens";
import { Transform } from "./useGraphViewport";

/** Below roughly half scale the tracks are too close for labels to land right. */
const LABEL_FLOOR = 0.44;

interface LaneProps {
  layout: GraphLayout;
  /** Authored lane records, for the tone. Indexed to match `layout.lanes`. */
  authored: PathwayLane[];
}

/**
 * Behind the cards, in diagram space.
 *
 * Neutral on purpose. Washing each band in its own lane colour was tried and
 * read as a rainbow — competing hues across a diagram whose line styles and goal
 * accents already spend the colour budget. Alternate tracks simply mute the dot
 * grid, which is enough to see them; the lane's colour appears only where it does
 * work: the gutter tick, the card's stripe, and its icon tile.
 */
export function LaneBands({ layout }: { layout: GraphLayout }) {
  const vertical = layout.orientation === "vertical";
  return (
    <div aria-hidden className="absolute left-0 top-0">
      {layout.lanes
        .filter((lane) => lane.index % 2 === 0)
        .map((lane) => (
          <div
            key={lane.id}
            className="absolute bg-white/65"
            style={
              vertical
                ? {
                    left: lane.start,
                    top: 0,
                    width: lane.end - lane.start,
                    height: layout.height,
                  }
                : {
                    left: 0,
                    top: lane.start,
                    width: layout.width,
                    height: lane.end - lane.start,
                  }
            }
          />
        ))}
    </div>
  );
}

/**
 * Captions in the empty stretch of a track that doesn't start at the beginning.
 *
 * A blank half-track invites the reading "nothing here"; the honest reading is
 * "not yet", and the age it does open at is exactly what a parent is trying to
 * work out. Costs nothing to render and turns dead space into an answer.
 */
export function LaneOnsetNotes({ layout }: { layout: GraphLayout }) {
  const vertical = layout.orientation === "vertical";
  const lead = Math.min(
    ...layout.nodes.map((n) => n.along - n.alongSpan / 2),
  );

  const notes = layout.lanes.flatMap((lane) => {
    const first = layout.nodes
      .filter((n: PlacedNode) => n.lane === lane.index && !n.goalId && n.ageBand)
      .sort((a, b) => a.layer - b.layer)[0];
    // Only worth saying when there's genuinely a gap to explain.
    if (!first || first.layer < 3) return [];
    return [{ lane, ageBand: first.ageBand as string }];
  });

  return (
    <div aria-hidden className="absolute left-0 top-0">
      {notes.map(({ lane, ageBand }) =>
        vertical ? (
          <div
            key={lane.id}
            className="absolute text-center text-[15px] font-semibold leading-snug text-slate-300"
            style={{
              left: lane.start + 16,
              top: lead + 8,
              width: lane.end - lane.start - 32,
            }}
          >
            Opens up
            <br />
            around {ageBand}
          </div>
        ) : (
          <div
            key={lane.id}
            className="absolute flex items-center gap-2.5 whitespace-nowrap text-[16px] font-semibold text-slate-300"
            style={{ left: lead, top: lane.centre - 11 }}
          >
            <span className="h-1.5 w-1.5 rounded-full bg-slate-200" />
            This track opens up around {ageBand}
          </div>
        ),
      )}
    </div>
  );
}

/** Track names, pinned to the edge of the viewport the tracks run from. */
export function LaneGutter({
  layout,
  authored,
  transform,
}: LaneProps & { transform: Transform }) {
  if (transform.scale < LABEL_FLOOR) return null;
  const vertical = layout.orientation === "vertical";

  const chip = (lane: LaneBand) => {
    const tone = authored[lane.index]?.tone;
    const accent = LANE_TONES[tone ?? "ladder"];
    return (
      <div
        key={lane.id}
        className={`absolute flex gap-1.5 ${
          vertical ? "flex-col items-center" : "flex-col"
        }`}
        style={
          vertical
            ? {
                left: transform.tx + lane.centre * transform.scale,
                top: 8,
                width: 150,
                transform: "translateX(-50%)",
              }
            : {
                left: 14,
                right: 10,
                top: transform.ty + lane.centre * transform.scale,
                transform: "translateY(-50%)",
              }
        }
      >
        <span
          className="h-[3px] w-6 rounded-full"
          style={{ background: accent.hex }}
        />
        <span
          className={`text-[10px] font-black uppercase leading-tight tracking-widest text-slate-500 ${
            vertical ? "text-center" : ""
          }`}
        >
          {lane.label}
        </span>
      </div>
    );
  };

  // Opaque, with a rule along its inner edge: a frozen header that the diagram
  // slides underneath, the way a spreadsheet's row and column headers behave. A
  // translucent wash instead left the nearest cards looking faded the moment the
  // parent scrolled.
  return (
    <div
      aria-hidden
      className={
        vertical
          ? "pointer-events-none absolute inset-x-0 top-0 h-[46px] border-b border-slate-200/70 bg-white/95 backdrop-blur-sm"
          : "pointer-events-none absolute inset-y-0 left-0 w-[124px] border-r border-slate-200/70 bg-white/95 backdrop-blur-sm"
      }
    >
      {layout.lanes.map(chip)}
    </div>
  );
}

/**
 * The age each rank represents, down the side of the flow.
 *
 * This is the piece that lets the diagram be read without a caption. Left to
 * itself the flow axis only says "further along"; with the ages against it, a
 * parent finds their own child on the map — "she's nine, so we're here" — which
 * is the first question any of them actually has.
 *
 * Only drawn for a vertical flow, where the across-axis padding leaves a clean
 * column for it. A horizontal flow spends that edge on the lane gutter.
 */
export function RankRail({
  layout,
  transform,
}: {
  layout: GraphLayout;
  transform: Transform;
}) {
  if (layout.orientation !== "vertical") return null;
  if (transform.scale < LABEL_FLOOR) return null;

  // Repeating "14–18 years" down consecutive ranks is noise, so a rank only gets
  // a label when it differs from the one above it. The windows deliberately
  // overlap — a child can be entering U-10 events at seven while still on the
  // green ball — because that is what actually happens.
  const rows: { rank: LayerBand; label: string }[] = [];
  let previous = "";
  for (const rank of layout.ranks) {
    if (!rank.ageBand || rank.ageBand === previous) continue;
    previous = rank.ageBand;
    rows.push({ rank, label: rank.ageBand });
  }

  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-y-0 left-0 w-[96px] border-r border-slate-200/70 bg-white/95 pt-[46px] backdrop-blur-sm"
    >
      <span className="absolute left-3 top-[54px] text-[9px] font-black uppercase leading-tight tracking-widest text-slate-300">
        Typical
        <br />
        age
      </span>
      {rows.map(({ rank, label }) => (
        <div
          key={rank.index}
          className="absolute left-3 right-2 flex items-center gap-2"
          style={{
            top: transform.ty + rank.centre * transform.scale,
            transform: "translateY(-50%)",
          }}
        >
          <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-slate-300" />
          <span className="text-[11px] font-bold leading-tight text-slate-500">
            {label}
          </span>
        </div>
      ))}
    </div>
  );
}
