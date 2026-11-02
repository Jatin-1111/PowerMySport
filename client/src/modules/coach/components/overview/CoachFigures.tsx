import { StatTile } from "@/modules/shared/ui/StatTile";
import { FIGURE_GRID } from "@/modules/shared/ui/FigureGrid";
import { formatRupees, monthTrend, plural } from "@/modules/shared/utils/figures";
import type { AnalyticsData, Coach, EarningsData } from "@/types";

/**
 * Four figures, the first wider because it is the one the page is about. The
 * rating comes from the profile, which is always loaded, so it never depends on
 * the analytics request; the client count does, and says so when it is missing.
 */
export function CoachFigures({
  earnings,
  analytics,
  analyticsFailed,
  coach,
}: {
  earnings: EarningsData;
  analytics: AnalyticsData | undefined;
  analyticsFailed: boolean;
  coach: Coach;
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
      {analytics ? (
        <StatTile
          label="Clients"
          value={analytics.overview.totalClients}
          sub={`${analytics.overview.returningClients} returning`}
        />
      ) : (
        <StatTile
          label="Clients"
          value={<span className="text-2xl">Unavailable</span>}
          sub={analyticsFailed ? "We could not load this. Refresh to try again." : "Loading"}
        />
      )}
      {coach.reviewCount > 0 ? (
        <StatTile
          label="Rating"
          value={coach.rating.toFixed(1)}
          sub={plural(coach.reviewCount, "review")}
        />
      ) : (
        <StatTile
          label="Rating"
          value={<span className="text-2xl">No reviews yet</span>}
          sub="Clients can review after a completed session"
        />
      )}
    </div>
  );
}
