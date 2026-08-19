"use client";

import { useRef, useState } from "react";
import { formatAsOn, formatPoints } from "../utils/insights";

/**
 * Rank over time, with a readout for any week on the line.
 *
 * Deliberately dependency-free — this is one line on one axis, and pulling a
 * charting library onto a marketing route to draw it would cost more in bundle
 * than the feature is worth.
 *
 * ── Why the geometry is SVG and everything else is HTML ──────────────────────
 * The first version drew the whole chart — line, dots, axis labels — inside one
 * `viewBox="0 0 640 190"` SVG scaled with `preserveAspectRatio` left at its
 * default. Two things were wrong with that, both invisible until measured:
 *
 *   1. It letterboxed. In a 790px-wide card the drawing occupied 102px→730px,
 *      leaving ~160px of dead space, because a 3.37 aspect box cannot fill a
 *      3.80 aspect container.
 *   2. SVG text scales with the viewBox. The axis labels rendered at 11px on a
 *      desktop card and would have shrunk to about 6px on a 375px phone — on the
 *      page whose entire brief is readability.
 *
 * So the SVG now holds only the filled area and the line, uses a 0–100 viewBox
 * with `preserveAspectRatio="none"` so it stretches to fill exactly, and keeps
 * an even stroke via `vector-effect="non-scaling-stroke"`. Everything that has
 * to stay legible — gridlines, axis labels, dots, the readout — is HTML
 * positioned in percentages.
 *
 * That choice pays for itself twice: because the viewBox is 0–100 and stretched,
 * an SVG coordinate and a CSS percentage are the same number, so there is no
 * mapping between the two coordinate systems to get wrong.
 *
 * ── The inversion, and why it is said out loud ───────────────────────────────
 * Rank 1 sits at the top, because "the line goes up when things improve" is what
 * every reader expects and a chart that reads backwards is worse than no chart.
 * The extremes are labelled on the axis and the direction is stated in words, so
 * a parent never has to work out which way is good.
 */

export interface TrajectoryPoint {
  asOnDate: string;
  rank: number;
  /** Optional: older payloads and the cached ones do not carry it. */
  totalPoints?: number | undefined;
}

/**
 * Percent insets inside the plot box. Dots are drawn at 10px across and centred
 * on their coordinate, so a point at a true 0% or 100% would be sliced in half
 * by the edge of the box.
 */
const INSET = { top: 8, bottom: 8, left: 2, right: 2 } as const;

export function RankTrajectory({
  points,
  label,
}: {
  points: TrajectoryPoint[];
  label: string;
}) {
  const plotRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState<number | null>(null);

  const ordered = [...points].sort(
    (a, b) => new Date(a.asOnDate).getTime() - new Date(b.asOnDate).getTime(),
  );

  // Hooks must run before any early return, so the guard sits after them.
  if (ordered.length < 2) return null;

  const ranks = ordered.map((p) => p.rank);
  const best = Math.min(...ranks);
  const worst = Math.max(...ranks);
  // A flat line still needs a non-zero span or every point lands on one pixel.
  const span = worst - best || 1;

  const spread = {
    x: 100 - INSET.left - INSET.right,
    y: 100 - INSET.top - INSET.bottom,
  };

  const coords = ordered.map((point, index) => ({
    ...point,
    x: INSET.left + (index / (ordered.length - 1)) * spread.x,
    // (rank - best) / span == 0 for the best rank, which must be at the TOP.
    y: INSET.top + ((point.rank - best) / span) * spread.y,
  }));

  const line = coords
    .map((c, i) => `${i === 0 ? "M" : "L"} ${c.x.toFixed(2)} ${c.y.toFixed(2)}`)
    .join(" ");
  const area = `${line} L ${coords[coords.length - 1]!.x.toFixed(2)} 100 L ${coords[0]!.x.toFixed(2)} 100 Z`;

  const first = ordered[0]!;
  const last = ordered[ordered.length - 1]!;
  const improved = last.rank < first.rank;
  const bestIndex = coords.findIndex((c) => c.rank === best);

  const summary =
    `${label}: rank ${first.rank} on ${formatAsOn(first.asOnDate)} ` +
    `to rank ${last.rank} on ${formatAsOn(last.asOnDate)}, ` +
    `best ${best} across ${ordered.length} weeks.`;

  /** Nearest point to a pointer position, so the whole plot is a hover target. */
  const locate = (clientX: number) => {
    const box = plotRef.current?.getBoundingClientRect();
    if (!box || box.width === 0) return;
    const percent = ((clientX - box.left) / box.width) * 100;
    let nearest = 0;
    let closest = Infinity;
    coords.forEach((c, i) => {
      const distance = Math.abs(c.x - percent);
      if (distance < closest) {
        closest = distance;
        nearest = i;
      }
    });
    setActive(nearest);
  };

  const step = (delta: number) => {
    setActive((current) => {
      const next = (current ?? (delta > 0 ? -1 : ordered.length)) + delta;
      return Math.min(ordered.length - 1, Math.max(0, next));
    });
  };

  const shown = active === null ? null : coords[active]!;
  const previous = active !== null && active > 0 ? coords[active - 1]! : null;
  // Positive means the rank improved that week.
  const movement = previous && shown ? previous.rank - shown.rank : null;

  return (
    <figure className="mt-4">
      <div className="flex">
        {/* Y axis in its own gutter rather than as padding inside the viewBox,
            which is what lets the plot stretch to the full width of the card. */}
        <div className="relative w-12 shrink-0 sm:w-14" style={{ height: "13rem" }}>
          <span
            className="absolute right-1.5 text-[10px] font-medium leading-none text-muted-foreground"
            style={{ top: `${INSET.top}%`, transform: "translateY(-1.35rem)" }}
          >
            better ↑
          </span>
          <span
            className="absolute right-1.5 text-[11px] leading-none tabular-nums text-muted-foreground"
            style={{ top: `${INSET.top}%`, transform: "translateY(-50%)" }}
          >
            #{best.toLocaleString("en-IN")}
          </span>
          <span
            className="absolute right-1.5 text-[11px] leading-none tabular-nums text-muted-foreground"
            style={{ top: `${100 - INSET.bottom}%`, transform: "translateY(-50%)" }}
          >
            #{worst.toLocaleString("en-IN")}
          </span>
        </div>

        <div
          ref={plotRef}
          role="group"
          tabIndex={0}
          aria-label={`${summary} Use the left and right arrow keys to read each week.`}
          className="relative flex-1 rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-power-orange focus-visible:ring-offset-2"
          style={{ height: "13rem" }}
          onPointerMove={(event) => locate(event.clientX)}
          onPointerDown={(event) => locate(event.clientX)}
          onPointerLeave={() => setActive(null)}
          onBlur={() => setActive(null)}
          onKeyDown={(event) => {
            if (event.key === "ArrowRight") {
              event.preventDefault();
              step(1);
            } else if (event.key === "ArrowLeft") {
              event.preventDefault();
              step(-1);
            } else if (event.key === "Home") {
              event.preventDefault();
              setActive(0);
            } else if (event.key === "End") {
              event.preventDefault();
              setActive(ordered.length - 1);
            } else if (event.key === "Escape") {
              setActive(null);
            }
          }}
        >
          {/* Gridlines at the two extremes of the data. Evenly spaced ticks would
              invent intermediate values that are not in the data, and on a range
              of 270 to 1,560 the round numbers between them mean nothing. */}
          {[INSET.top, 100 - INSET.bottom].map((top) => (
            <span
              key={top}
              aria-hidden
              className="absolute inset-x-0 border-t border-border"
              style={{ top: `${top}%` }}
            />
          ))}

          <svg
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            className="absolute inset-0 h-full w-full overflow-visible"
            role="img"
            aria-label={summary}
          >
            <path d={area} fill="var(--power-orange)" opacity="0.08" />
            <path
              d={line}
              fill="none"
              stroke="var(--power-orange)"
              strokeWidth="2"
              strokeLinejoin="round"
              strokeLinecap="round"
              // Without this the stretch would thin the stroke horizontally and
              // fatten it vertically, which is exactly the artefact that makes a
              // `preserveAspectRatio="none"` chart look broken.
              vectorEffect="non-scaling-stroke"
            />
          </svg>

          {/* Dots as HTML: circles inside a stretched viewBox come out as
              ellipses, and these have to stay round at every width. */}
          {coords.map((c, index) => (
            <span
              key={c.asOnDate}
              aria-hidden
              className={`absolute rounded-full bg-rank-accent transition-transform ${
                active === index ? "scale-150" : ""
              }`}
              style={{
                left: `${c.x}%`,
                top: `${c.y}%`,
                width: index === bestIndex ? "8px" : "5px",
                height: index === bestIndex ? "8px" : "5px",
                transform: "translate(-50%, -50%)",
              }}
            />
          ))}

          {/* The high point ringed, since it is the one moment on the line a
              parent will want to find again. */}
          <span
            aria-hidden
            className="absolute rounded-full border border-rank-accent/50"
            style={{
              left: `${coords[bestIndex]!.x}%`,
              top: `${coords[bestIndex]!.y}%`,
              width: "18px",
              height: "18px",
              transform: "translate(-50%, -50%)",
            }}
          />

          {shown && (
            <>
              <span
                aria-hidden
                className="absolute top-0 bottom-0 border-l border-dashed border-rank-accent/50"
                style={{ left: `${shown.x}%` }}
              />
              <Readout
                x={shown.x}
                y={shown.y}
                asOnDate={shown.asOnDate}
                rank={shown.rank}
                totalPoints={shown.totalPoints}
                movement={movement}
              />
            </>
          )}
        </div>
      </div>

      {/* Dates under the plot, aligned to the gutter above. */}
      <div className="ml-12 flex justify-between text-[11px] text-muted-foreground sm:ml-14">
        <span>{formatAsOn(first.asOnDate)}</span>
        <span>{formatAsOn(last.asOnDate)}</span>
      </div>

      {/* What a mouse reveals one week at a time, said once for everyone. */}
      <span className="sr-only" aria-live="polite">
        {shown
          ? `${formatAsOn(shown.asOnDate)}: rank ${shown.rank}${
              movement === null
                ? ""
                : movement === 0
                  ? ", unchanged from the week before"
                  : `, ${Math.abs(movement)} places ${movement > 0 ? "up" : "down"} from the week before`
            }.`
          : ""}
      </span>

      <figcaption className="mt-2 text-sm leading-relaxed text-muted-foreground">
        Point at any dot to see that week.{" "}
        <span className="font-medium text-foreground">
          {improved
            ? `Up ${(first.rank - last.rank).toLocaleString("en-IN")} places`
            : last.rank === first.rank
              ? "No change"
              : `Down ${(last.rank - first.rank).toLocaleString("en-IN")} places`}{" "}
          over {ordered.length} weeks, best of #{best.toLocaleString("en-IN")}.
        </span>
      </figcaption>
    </figure>
  );
}

/**
 * The hovered week, as a small card.
 *
 * Anchoring flips near the edges instead of the card being clamped away from its
 * point. A tooltip that detaches from the thing it describes on exactly the two
 * ends of the line — the first and last week, which are the two a parent looks at
 * most — would be worse than one that simply changes which corner it hangs from.
 */
function Readout({
  x,
  y,
  asOnDate,
  rank,
  totalPoints,
  movement,
}: {
  x: number;
  y: number;
  asOnDate: string;
  rank: number;
  totalPoints?: number | undefined;
  movement: number | null;
}) {
  const anchorLeft = x < 22;
  const anchorRight = x > 78;
  // Near the top of the plot there is no room above the point for the card.
  const below = y < 34;

  return (
    <div
      aria-hidden
      className="pointer-events-none absolute z-10 whitespace-nowrap rounded-lg border border-border bg-card px-2.5 py-2 shadow-md"
      style={{
        left: `${x}%`,
        top: `${y}%`,
        transform: [
          anchorLeft ? "translateX(0)" : anchorRight ? "translateX(-100%)" : "translateX(-50%)",
          below ? "translateY(1rem)" : "translateY(calc(-100% - 1rem))",
        ].join(" "),
      }}
    >
      <p className="text-[11px] font-medium text-muted-foreground">
        {formatAsOn(asOnDate)}
      </p>
      <p className="mt-0.5 flex items-baseline gap-2">
        <span className="text-base font-bold tabular-nums">
          #{rank.toLocaleString("en-IN")}
        </span>
        {movement !== null && movement !== 0 && (
          <span
            className={`text-xs font-semibold tabular-nums ${
              movement > 0 ? "text-rank-delta-up" : "text-rank-delta-down"
            }`}
          >
            {movement > 0 ? "▲" : "▼"} {Math.abs(movement).toLocaleString("en-IN")}
          </span>
        )}
        {movement === 0 && (
          <span className="text-xs text-muted-foreground">no change</span>
        )}
      </p>
      {totalPoints !== undefined && (
        <p className="text-[11px] tabular-nums text-muted-foreground">
          {formatPoints(totalPoints)} points
        </p>
      )}
    </div>
  );
}
