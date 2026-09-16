import type { RankingProjection } from "../services/api";
import { formatAsOn, formatPoints } from "../utils/insights";

/**
 * What happens next, from the weekly lists we hold.
 *
 * ── Why this panel exists ────────────────────────────────────────────────────
 * Every other panel on this page describes the present: the rank, the field it
 * sits in, what the rungs above cost. A parent's actual question is the one
 * nobody answers, because answering it needs last year's lists as well as this
 * week's: is my child going up or down, and what happens if they stop playing?
 *
 * ── The three numbers, and the honesty each one needs ────────────────────────
 * 1. **Movement** is exact. It is two published lists subtracted.
 * 2. **Points at risk** is a CEILING, not a forecast. AITA counts the best 8
 *    results from a rolling 52 weeks, so a result ageing out is replaced by the
 *    ninth-best, and the real fall is the difference. We cannot see the
 *    replacement, so the number here is the most it can cost. The copy says
 *    "up to" every time it appears, and the method line under the panel says why.
 * 3. **Time to the next level** extends a rate the player has already achieved.
 *    It is phrased as "at last year's rate" on the face of it, not in a footnote,
 *    because a parent who reads it as a promise has been misled by this page.
 *
 * ── What is deliberately not here ────────────────────────────────────────────
 * No projected rank, and no target date. Rank depends on what every other player
 * does, which we cannot model, and a date would read as a commitment made on a
 * child's behalf.
 */

const weeksPhrase = (weeks: number): string => {
  if (weeks <= 1) return "about a week";
  if (weeks < 9) return `about ${weeks} weeks`;
  const months = Math.round(weeks / 4.345);
  return months <= 1 ? "about a month" : `about ${months} months`;
};

/** A change, written so the direction is in the words and not only the sign. */
function MovementLine({
  label,
  movement,
}: {
  label: string;
  movement: { points: number; rank: number } | null;
}) {
  if (!movement) return null;

  const { points, rank } = movement;
  const steady = points === 0 && rank === 0;
  const detail = steady
    ? "no change"
    : [
        points === 0
          ? null
          : `${points > 0 ? "up" : "down"} ${formatPoints(Math.abs(points))} points`,
        rank === 0 ? null : `${rank > 0 ? "up" : "down"} ${Math.abs(rank)} places`,
      ]
        .filter(Boolean)
        .join(", ");

  return (
    <div className="flex items-baseline justify-between gap-4 py-2">
      <span className="text-muted-foreground text-sm">{label}</span>
      <span className="text-right text-sm font-semibold tabular-nums">{detail}</span>
    </div>
  );
}

export function SeasonOutlook({
  projection,
  listLabel,
  /** Junior lists are read by parents; the open-age lists by the players. */
  parentAudience = true,
}: {
  projection: RankingProjection;
  listLabel: string;
  parentAudience?: boolean;
}) {
  const { movement, activity, atRisk, toNextTier, window } = projection;
  const subject = parentAudience ? "your child" : "this player";

  // With one comparison and nothing else, the trajectory chart above has already
  // said everything this panel could, and said it better.
  const hasMovement = Boolean(movement.fourWeeks || movement.twelveWeeks);
  if (!hasMovement && !atRisk && !toNextTier) return null;

  const idle = activity.weeksSinceLastRise !== null && activity.weeksSinceLastRise >= 12;

  return (
    <section className="bg-card rounded-xl border p-5 sm:p-6">
      <h3 className="text-base font-semibold tracking-tight">
        What happens next on the {listLabel} list
      </h3>
      <p className="text-muted-foreground mt-1 text-sm leading-relaxed">
        Worked out from every published list we hold for {subject}, not from this week alone.
      </p>

      <div className="divide-border mt-4 divide-y">
        <MovementLine label="Last 4 weeks" movement={movement.fourWeeks} />
        <MovementLine label="Last 12 weeks" movement={movement.twelveWeeks} />
        <MovementLine label="Last 12 months" movement={movement.fiftyTwoWeeks} />
      </div>

      {activity.weeksSinceLastRise !== null && (
        <p className="text-muted-foreground mt-4 text-sm leading-relaxed">
          A new result last counted{" "}
          <span className="text-foreground font-semibold">
            {weeksPhrase(activity.weeksSinceLastRise)} ago
          </span>
          {activity.improvingWeeks > 0 && (
            <>
              . Over the past year the total rose in {activity.improvingWeeks}{" "}
              {activity.improvingWeeks === 1 ? "week" : "weeks"}, by{" "}
              {formatPoints(activity.averageRise)} points on average
            </>
          )}
          .
        </p>
      )}

      {atRisk && atRisk.nextTwelveWeeks > 0 && (
        <div className="bg-muted/40 mt-4 rounded-lg p-4">
          <p className="text-sm font-semibold">
            Up to {formatPoints(atRisk.nextTwelveWeeks)} points could drop off in the next three
            months
          </p>
          <p className="text-muted-foreground mt-1 text-sm leading-relaxed">
            {atRisk.nextFourWeeks > 0 && (
              <>Up to {formatPoints(atRisk.nextFourWeeks)} of that within four weeks. </>
            )}
            Results stop counting a year after they were earned, so points earned last season fall
            away unless newer results replace them. This is the most it can cost, not a forecast:
            each result that drops off is replaced by the next best one, which we cannot see.
            {idle && " Nothing new has counted for a while, so this is the number to watch."}
          </p>
        </div>
      )}

      {toNextTier && (
        <p className="mt-4 text-sm leading-relaxed">
          The top {toNextTier.rank} needs {formatPoints(toNextTier.points)} points,{" "}
          {formatPoints(toNextTier.gap)} more than {subject} has now.{" "}
          {toNextTier.estimatedWeeks !== null ? (
            <span className="text-muted-foreground">
              At the rate they have gained points over the past year, that is{" "}
              {weeksPhrase(toNextTier.estimatedWeeks)} of the same form.
            </span>
          ) : (
            <span className="text-muted-foreground">
              {toNextTier.weeklyRate > 0
                ? "At the rate they have gained points over the past year, that is more than two years away, so it would take a different season rather than more of the same."
                : "The total has not risen in the period we hold, so there is no rate here to work from."}
            </span>
          )}
        </p>
      )}

      <p className="text-muted-foreground mt-4 text-xs leading-relaxed">
        Based on {window.listsHeld} published lists between {formatAsOn(window.from)} and{" "}
        {formatAsOn(window.to)}.
        {!window.coversFullCycle &&
          " That is less than a full 52-week scoring cycle, so results earned before we began mirroring these lists are not visible here."}
      </p>
    </section>
  );
}
