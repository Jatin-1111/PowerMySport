import Link from "next/link";
import type { RankingEntry } from "../services/api";
import { playerHref } from "../config/rankings";
import { formatPoints, percentileLabel, tierPhrase } from "../utils/insights";
import { RankDelta } from "./RankDelta";

/**
 * The searched-for player, read out properly.
 *
 * A parent who typed a name is not scanning a table — they are asking three
 * questions about one child: is this good, is it improving, what is next. The row
 * in the table below answers none of them at a glance, so the answers are lifted
 * out here: the share of the field ahead of them, their standing inside their own
 * state, the movement since last week, and the points still needed for the next
 * rung.
 *
 * Only rendered for a search that narrowed to a handful of people. Beyond that it
 * stops being a spotlight and becomes a second, worse table.
 */
export function PlayerSpotlight({
  entries,
  sportSlug,
  listSize,
  hasBaseline,
}: {
  entries: RankingEntry[];
  sportSlug: string;
  listSize: number | null | undefined;
  hasBaseline: boolean;
}) {
  if (entries.length === 0) return null;

  return (
    <ul className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {entries.map((entry) => {
        const percentile = percentileLabel(entry.rank, listSize);
        return (
          <li
            key={entry._id}
            className="rounded-lg border border-power-orange/30 bg-power-orange/[0.04] p-4"
          >
            <Link
              href={playerHref(sportSlug, entry.regNo)}
              className="font-semibold hover:text-power-orange hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-power-orange focus-visible:ring-offset-2"
            >
              {entry.fullName}
            </Link>

            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-3xl font-bold tabular-nums">#{entry.rank}</span>
              <RankDelta delta={entry.rankDelta} hasBaseline={hasBaseline} />
            </div>

            <dl className="mt-3 space-y-1 text-sm">
              {percentile && listSize && (
                <div className="flex justify-between gap-2">
                  <dt className="text-muted-foreground">Nationally</dt>
                  <dd className="text-right font-medium">
                    {percentile} of {listSize.toLocaleString("en-IN")}
                  </dd>
                </div>
              )}
              {entry.stateRank && entry.state && (
                <div className="flex justify-between gap-2">
                  <dt className="truncate text-muted-foreground">{entry.state}</dt>
                  <dd className="text-right font-medium tabular-nums">
                    #{entry.stateRank}
                    {entry.stateSize ? ` of ${entry.stateSize.toLocaleString("en-IN")}` : ""}
                  </dd>
                </div>
              )}
              <div className="flex justify-between gap-2">
                <dt className="text-muted-foreground">Points</dt>
                <dd className="text-right font-medium tabular-nums">
                  {formatPoints(entry.totalPoints)}
                </dd>
              </div>
            </dl>

            {entry.nextTier && (
              <p className="mt-3 border-t pt-3 text-sm">
                <span className="font-semibold tabular-nums">
                  {formatPoints(entry.nextTier.gap)} points
                </span>{" "}
                <span className="text-muted-foreground">
                  from the {tierPhrase(entry.nextTier.rank)}
                </span>
              </p>
            )}
          </li>
        );
      })}
    </ul>
  );
}
