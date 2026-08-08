import { formatAsOn } from "./api";

/**
 * Rank over time, as inline SVG.
 *
 * Deliberately dependency-free — this is one line on one axis, and pulling a
 * charting library onto a marketing route to draw it would cost more in bundle
 * than the feature is worth.
 *
 * The y-axis is inverted: rank 1 sits at the top, because "the line goes up
 * when things improve" is what every reader expects and a chart that reads
 * backwards is worse than no chart.
 */
export function RankTrajectory({
  points,
  label,
}: {
  points: Array<{ asOnDate: string; rank: number }>;
  label: string;
}) {
  if (points.length < 2) return null;

  const width = 640;
  const height = 160;
  const padding = { top: 12, right: 12, bottom: 12, left: 12 };

  const ordered = [...points].sort(
    (a, b) => new Date(a.asOnDate).getTime() - new Date(b.asOnDate).getTime(),
  );
  const ranks = ordered.map((p) => p.rank);
  const best = Math.min(...ranks);
  const worst = Math.max(...ranks);
  // A flat line still needs a non-zero span or every point lands on one pixel.
  const span = worst - best || 1;

  const innerWidth = width - padding.left - padding.right;
  const innerHeight = height - padding.top - padding.bottom;

  const coords = ordered.map((point, index) => {
    const x =
      padding.left +
      (ordered.length === 1 ? innerWidth / 2 : (index / (ordered.length - 1)) * innerWidth);
    // (rank - best) / span == 0 for the best rank, which must be at the TOP.
    const y = padding.top + ((point.rank - best) / span) * innerHeight;
    return { ...point, x, y };
  });

  const line = coords.map((c, i) => `${i === 0 ? "M" : "L"} ${c.x.toFixed(1)} ${c.y.toFixed(1)}`).join(" ");
  const area =
    `${line} L ${coords[coords.length - 1]!.x.toFixed(1)} ${height - padding.bottom} ` +
    `L ${coords[0]!.x.toFixed(1)} ${height - padding.bottom} Z`;

  const first = ordered[0]!;
  const last = ordered[ordered.length - 1]!;
  const improved = last.rank < first.rank;

  return (
    <figure className="mt-4">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="h-40 w-full"
        role="img"
        aria-label={
          `${label}: rank ${first.rank} on ${formatAsOn(first.asOnDate)} ` +
          `to rank ${last.rank} on ${formatAsOn(last.asOnDate)}, ` +
          `best ${best} across ${ordered.length} weeks.`
        }
      >
        <path d={area} fill="var(--power-orange)" opacity="0.08" />
        <path
          d={line}
          fill="none"
          stroke="var(--power-orange)"
          strokeWidth="2"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        {coords.map((c) => (
          <circle
            key={c.asOnDate}
            cx={c.x}
            cy={c.y}
            r={c.rank === best ? 3.5 : 2}
            fill="var(--power-orange)"
          />
        ))}
      </svg>

      <figcaption className="mt-2 flex flex-wrap items-center justify-between gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <span>
          {formatAsOn(first.asOnDate)} — rank {first.rank}
        </span>
        <span className="font-medium text-foreground">
          Best: #{best}
          <span className="mx-1.5" aria-hidden>
            ·
          </span>
          {improved
            ? `Up ${first.rank - last.rank} places`
            : last.rank === first.rank
              ? "Unchanged"
              : `Down ${last.rank - first.rank} places`}
        </span>
        <span>
          {formatAsOn(last.asOnDate)} — rank {last.rank}
        </span>
      </figcaption>
    </figure>
  );
}
