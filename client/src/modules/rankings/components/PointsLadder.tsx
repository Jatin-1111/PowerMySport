import type { RankingBenchmark } from "../services/api";
import { formatPoints, tierLabel } from "../utils/insights";

/**
 * How many points each level takes.
 *
 * The single most useful panel on the page, and the reason is arithmetic a rank
 * cannot do: a parent looking at "312nd" has no idea whether the next level is a
 * season away or a fortnight away. Here they can see that the top 250 is sixteen
 * points off and the top 100 is another ninety — two facts that turn a number
 * into a plan.
 *
 * Bars, not a line: the tiers are 1, 10, 25, 50, 100, 250, 500 — ordered but not
 * evenly spaced, and drawing them along a continuous axis would invent a curve
 * whose steepness is an artefact of the tier list rather than the data. Ordered
 * categories with one measure is a bar chart.
 *
 * Every bar carries its value, so nothing here is readable only by colour or only
 * by length. The row text is what a screen reader gets; the bar is decoration on
 * top of it.
 */
export function PointsLadder({
  benchmarks,
  listLabel,
  /**
   * Junior lists are read by parents; the open-age lists are read by the players
   * themselves. "Find your child's points total" on Men's Singles is addressed to
   * the wrong person entirely.
   */
  parentAudience = true,
}: {
  benchmarks: RankingBenchmark[];
  listLabel: string;
  parentAudience?: boolean;
}) {
  // One rung is not a ladder, and a single bar is a worse stat tile.
  if (benchmarks.length < 2) return null;

  const peak = Math.max(...benchmarks.map((b) => b.points));
  if (peak <= 0) return null;

  return (
    <section className="rounded-xl border bg-card p-5 sm:p-6">
      <h3 className="text-base font-semibold tracking-tight">
        How many points each level takes
      </h3>
      <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
        Each row is a level of the {listLabel} list, and the number beside it is
        the points a player needed this week to be inside it. Find{" "}
        {parentAudience ? "your child’s" : "a player’s"} points total — the
        next row up is the next target.
      </p>

      <ol className="mt-5 space-y-2.5">
        {benchmarks.map((benchmark) => {
          const share = (benchmark.points / peak) * 100;
          return (
            <li key={benchmark.rank} className="flex items-center gap-3">
              <span className="w-20 shrink-0 text-xs font-medium text-muted-foreground sm:w-24 sm:text-sm">
                {tierLabel(benchmark.rank)}
              </span>
              {/* Track and fill are decorative — the numbers either side say the
                  same thing, which is what keeps this readable in forced-colours
                  mode and for anyone who cannot see the fill at all. */}
              <span
                className="h-2.5 flex-1 overflow-hidden rounded-full bg-rank-track"
                aria-hidden
              >
                <span
                  className="block h-full rounded-full bg-rank-accent"
                  style={{ width: `${Math.max(share, 1.5)}%` }}
                />
              </span>
              <span className="w-16 shrink-0 text-right text-sm font-semibold tabular-nums sm:w-20">
                {formatPoints(benchmark.points)}
              </span>
              <span className="sr-only">points</span>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
