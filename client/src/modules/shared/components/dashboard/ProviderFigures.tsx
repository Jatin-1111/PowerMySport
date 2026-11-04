import { FIGURE_GRID } from "@/modules/shared/ui/FigureGrid";
import { StatTile } from "@/modules/shared/ui/StatTile";
import { formatRupees, monthTrend, plural } from "@/modules/shared/utils/figures";
import type { EarningsData } from "@/types";

/**
 * The headline figures on a provider's overview (a coach or a venue): the first
 * tile is wider and outlined because it is the one the page is about. Money is
 * rupees as the earnings API returns it; nothing is estimated. The people count
 * comes from a separate request, so when only that fails the rest stay on screen
 * and say so. The rating comes from data the page already has, so it never
 * depends on that request.
 */
export function ProviderFigures({
  earnings,
  people,
  peopleFailed,
  peopleLabel,
  rating,
  noReviewsHint = "Clients can review after a completed session",
}: {
  earnings: EarningsData;
  /** Everyone who has booked, and how many came back. */
  people: { total: number; returning: number } | undefined;
  peopleFailed: boolean;
  peopleLabel: string;
  /** Null when nobody has reviewed yet. */
  rating: { value: number; count: number } | null;
  /** The line under "No reviews yet", worded for who reviews. */
  noReviewsHint?: string;
}) {
  const trend = monthTrend(earnings.thisMonth.total, earnings.lastMonth.total);

  return (
    <div className={FIGURE_GRID}>
      <StatTile
        emphasis
        label="Earned this month"
        value={formatRupees(earnings.thisMonth.total)}
        sub={`${plural(earnings.thisMonth.sessions, "completed session")}${trend ? ", against last month" : ""}`}
        trend={trend}
      />
      <StatTile
        label="Still to come"
        value={formatRupees(earnings.pending.total)}
        sub={plural(earnings.pending.sessions, "confirmed session")}
      />
      {people ? (
        <StatTile label={peopleLabel} value={people.total} sub={`${people.returning} returning`} />
      ) : (
        <StatTile
          label={peopleLabel}
          value={<span className="text-2xl">Unavailable</span>}
          sub={peopleFailed ? "We could not load this. Refresh to try again." : "Loading"}
        />
      )}
      {rating ? (
        <StatTile
          label="Rating"
          value={rating.value.toFixed(1)}
          sub={plural(rating.count, "review")}
        />
      ) : (
        <StatTile
          label="Rating"
          value={<span className="text-2xl">No reviews yet</span>}
          sub={noReviewsHint}
        />
      )}
    </div>
  );
}
