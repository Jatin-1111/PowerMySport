import { StatTile } from "@/modules/shared/ui/StatTile";
import { FIGURE_GRID } from "@/modules/shared/ui/FigureGrid";
import type { EarningsData } from "@/types";
import type { AcademyAnalyticsSummary } from "../types";
import { formatRupees, monthTrend, plural } from "../utils/format";

/**
 * Four figures, the first one wider and outlined because it is the one the page
 * is about. Money is rupees as the bookings API returns it; nothing here is
 * estimated or rounded up. The student figure comes from a separate request, so
 * when only that fails the other three stay on screen and say so.
 */
export function FigureStrip({
  earnings,
  analytics,
  analyticsFailed,
}: {
  earnings: EarningsData;
  analytics: AcademyAnalyticsSummary | undefined;
  analyticsFailed: boolean;
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
        sub={`${plural(earnings.pending.sessions, "session")} confirmed or running`}
      />
      <StatTile
        label="Earned all time"
        value={formatRupees(earnings.allTime.total)}
        sub={`${plural(earnings.allTime.sessions, "completed session")}`}
      />
      {analytics ? (
        <StatTile
          label="Students"
          value={analytics.overview.totalStudents}
          sub={`${analytics.overview.returningStudents} returning`}
        />
      ) : (
        <StatTile
          label="Students"
          value={<span className="text-2xl">Unavailable</span>}
          sub={analyticsFailed ? "We could not load this. Refresh to try again." : "Loading"}
        />
      )}
    </div>
  );
}
