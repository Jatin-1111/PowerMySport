import Link from "next/link";
import type { RankingBenchmark, RankingEntry } from "./api";
import { playerHref } from "./config";
import { percentileLabel } from "./insights";
import { RankDelta } from "./RankDelta";

/**
 * The list itself.
 *
 * Three ideas drive the layout.
 *
 * **Four columns, and no more.** This table used to carry the source PDF's whole
 * point breakdown at `lg` — `25% BEST Eight DBLS. PTS.`, `POINTS CUT FOR NO SHOW
 * LATE WL`, `03-Aug-25 25 % PTS. Asian U-16` — nine columns of federation
 * shorthand. None of it helps anyone scanning for one child's name, and all of it
 * costs the reader something. The breakdown still exists, on the player's own page,
 * where a parent has asked about one player and the detail answers a question they
 * are actually holding. Here the row says who, where, and how many points.
 *
 * **Points get a bar.** The number alone makes "1,101 versus 962" a subtraction
 * problem; the bar makes the gap between the top of the list and the middle of it
 * visible in one pass. It is scaled to the list's number one, not to the current
 * page, so page 7 does not draw its own leader as full width and imply a player is
 * near the top when they are not.
 *
 * **It has to work at 375px without sideways scrolling.** Most of the traffic here
 * is a parent on a phone, and a table that scrolls horizontally is a table whose
 * right-hand columns are never read. State folds into the player cell below `md`
 * rather than overflowing.
 */
export function RankingTable({
  entries,
  sportSlug,
  listLabel,
  listSize,
  hasBaseline,
  benchmarks,
  stateFiltered,
  asOnLabel,
}: {
  entries: RankingEntry[];
  sportSlug: string;
  listLabel: string;
  listSize: number | null;
  hasBaseline: boolean;
  benchmarks: RankingBenchmark[];
  stateFiltered?: string | undefined;
  asOnLabel: string;
}) {
  // The list's number one is the yardstick. Falling back to the biggest total on
  // this page keeps the bars sane on a list too short to have a top-1 benchmark.
  const peak =
    benchmarks.find((b) => b.rank === 1)?.points ??
    Math.max(...entries.map((entry) => entry.totalPoints), 1);

  const showPercentile = listSize !== null && listSize >= 100;

  return (
    <div className="mt-5 overflow-x-auto rounded-xl border">
      <table className="w-full border-collapse text-sm">
        <caption className="sr-only">
          {listLabel} ranking{stateFiltered ? `, ${stateFiltered}` : ""}, as on{" "}
          {asOnLabel}
        </caption>
        <thead>
          <tr className="border-b bg-muted/40 text-left align-bottom">
            <th scope="col" className="px-3 py-2.5 font-semibold sm:px-4">
              Rank
            </th>
            <th scope="col" className="px-3 py-2.5 font-semibold sm:px-4">
              Player
            </th>
            <th scope="col" className="hidden px-3 py-2.5 font-semibold md:table-cell sm:px-4">
              State
            </th>
            <th scope="col" className="px-3 py-2.5 text-right font-semibold sm:px-4">
              Points
            </th>
          </tr>
        </thead>
        <tbody>
          {entries.map((entry) => (
            <tr
              key={entry._id}
              className="border-b align-top transition-colors last:border-0 hover:bg-muted/30"
            >
              <td className="px-3 py-3 sm:px-4">
                <span className="flex items-center gap-1.5">
                  <RankBadge rank={entry.rank} />
                  <RankDelta delta={entry.rankDelta} hasBaseline={hasBaseline} />
                </span>
                {showPercentile && (
                  <span className="mt-1 block text-xs text-muted-foreground">
                    {percentileLabel(entry.rank, listSize)}
                  </span>
                )}
              </td>

              <td className="px-3 py-3 sm:px-4">
                <Link
                  href={playerHref(sportSlug, entry.regNo)}
                  className="font-medium leading-snug hover:text-power-orange hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-power-orange focus-visible:ring-offset-2 rounded"
                >
                  {entry.fullName}
                </Link>
                <span className="mt-0.5 block text-xs text-muted-foreground">
                  {entry.regNo}
                  {/* "b. 2010" is an abbreviation a reader has to stop and
                      decode; the row has room for the word. */}
                  {entry.birthYear ? ` · born ${entry.birthYear}` : ""}
                </span>
                {/* Below `md` there is no State column, so the same fact rides
                    along here instead of being dropped. */}
                <span className="mt-0.5 block text-xs text-muted-foreground md:hidden">
                  {entry.state ?? entry.stateCode ?? "—"}
                  {entry.stateRank ? ` · #${entry.stateRank} in state` : ""}
                </span>
              </td>

              <td className="hidden px-3 py-3 text-muted-foreground md:table-cell sm:px-4">
                <span className="block leading-snug">
                  {entry.state ?? entry.stateCode ?? "—"}
                </span>
                {entry.stateRank && (
                  <span className="mt-0.5 block text-xs tabular-nums">
                    #{entry.stateRank}
                    {entry.stateSize ? ` of ${entry.stateSize.toLocaleString("en-IN")}` : ""}
                  </span>
                )}
              </td>

              <td className="px-3 py-3 text-right sm:px-4">
                <span className="block font-semibold tabular-nums">
                  {entry.totalPoints.toLocaleString("en-IN")}
                </span>
                {/* Left-anchored inside a fixed-width cell, so every bar in the
                    column shares one baseline and lengths compare honestly. */}
                <span
                  className="mt-1.5 block h-1 w-full overflow-hidden rounded-full bg-rank-track"
                  aria-hidden
                >
                  <span
                    className="block h-full rounded-full bg-rank-accent"
                    style={{ width: `${Math.max((entry.totalPoints / peak) * 100, 1)}%` }}
                  />
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * The top three get a tinted badge — enough to find the head of the list while
 * scrolling, not enough to turn the column into decoration. Dark text on a light
 * tint rather than white on the accent, which does not clear text contrast at this
 * size.
 */
function RankBadge({ rank }: { rank: number }) {
  if (rank > 3) {
    return <span className="font-semibold tabular-nums">{rank}</span>;
  }
  return (
    <span
      className={`inline-flex h-7 min-w-7 items-center justify-center rounded-full px-1.5 font-bold tabular-nums ${
        rank === 1 ? "bg-rank-accent/25" : "bg-rank-accent/12"
      }`}
    >
      {rank}
    </span>
  );
}
