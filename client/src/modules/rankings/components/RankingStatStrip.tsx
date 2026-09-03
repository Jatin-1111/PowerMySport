import type { RankingBenchmark } from "../services/api";
import { formatPoints } from "../utils/insights";

/**
 * The whole list in four numbers, above the fold.
 *
 * ── What changed, and why ────────────────────────────────────────────────────
 * This strip used to lead with "29 states represented". It is a true fact about
 * the list and of no use whatsoever to the person reading it, who is a parent
 * holding one child's rank and trying to work out whether it is any good. So the
 * tiles now do one job: put that child's points total on a scale. What the top
 * costs, what the middle costs, and what the very top of the sport looks like.
 *
 * A parent whose child has 78 points learns more from "the top 500 needs 44"
 * than from any amount of explanation — it says *you are already past that one*,
 * which no rank on its own ever tells them.
 *
 * Proportional figures rather than tabular — these are standalone display
 * numbers, and equal-width digits make them look loose at this size. Tabular
 * numbers are for the table below, where digits line up down a column.
 */
export function RankingStatStrip({
  listSize,
  benchmarks,
  listLabel,
}: {
  listSize: number | null;
  benchmarks: RankingBenchmark[];
  listLabel: string;
}) {
  const tierOf = (rank: number) => benchmarks.find((b) => b.rank === rank);

  const tiles: Array<{ value: string; label: string; hint: string }> = [];

  if (listSize) {
    tiles.push({
      value: listSize.toLocaleString("en-IN"),
      label: "players ranked",
      hint: `${listLabel}, all India`,
    });
  }

  // Two rungs that between them bracket most of the list. The preferred pair is
  // 100 and 500; the shorter lists (Women's Doubles runs to 345 players) never
  // reach a 500 tier, so each slot falls back to the nearest rung that exists
  // rather than the tile vanishing and leaving a three-up grid.
  const near = pick(benchmarks, [100, 50, 25]);
  const far = pick(benchmarks, [500, 250, 100]);

  if (near) {
    tiles.push({
      value: formatPoints(near.points),
      label: "points",
      hint: `to reach the top ${near.rank}`,
    });
  }
  if (far && far.rank !== near?.rank) {
    tiles.push({
      value: formatPoints(far.points),
      label: "points",
      hint: `to reach the top ${far.rank}`,
    });
  }

  const top = tierOf(1);
  if (top) {
    tiles.push({
      value: formatPoints(top.points),
      label: "points",
      hint: "held by the No. 1",
    });
  }

  if (tiles.length < 2) return null;

  return (
    // A one-pixel gap over the border colour draws the dividers, so they stay
    // correct however the grid wraps — `divide-x` breaks on a wrapped grid.
    <dl className="bg-border mt-6 grid grid-cols-2 gap-px overflow-hidden rounded-xl border md:grid-cols-4">
      {tiles.map((tile) => (
        <div key={tile.hint} className="bg-card px-4 py-3.5 sm:px-5">
          <dd className="text-2xl leading-none font-bold sm:text-3xl">{tile.value}</dd>
          <dt className="text-foreground mt-1.5 text-xs font-medium sm:text-sm">{tile.label}</dt>
          <p className="text-muted-foreground mt-0.5 truncate text-xs" title={tile.hint}>
            {tile.hint}
          </p>
        </div>
      ))}
    </dl>
  );
}

/** The first of `wanted` that this list actually has a benchmark for. */
function pick(benchmarks: RankingBenchmark[], wanted: number[]): RankingBenchmark | undefined {
  for (const rank of wanted) {
    const found = benchmarks.find((b) => b.rank === rank);
    if (found) return found;
  }
  return undefined;
}
