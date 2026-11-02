import { ArrowRight } from "lucide-react";
import Link from "next/link";
import type { AcademyAnalyticsSummary, OwnAcademy } from "../types";
import { plural } from "../utils/format";
import { TEXT_LINK } from "./StatusBand";

/**
 * Facts about the listing, as a definition list. Rows come only from data we
 * hold; a row whose data is missing is left out rather than shown as zero.
 */
export function AtAGlance({
  academy,
  analytics,
  unreadNotifications,
}: {
  academy: OwnAcademy;
  analytics: AcademyAnalyticsSummary | undefined;
  unreadNotifications: number;
}) {
  const rows: Array<{ label: string; value: string }> = [
    { label: "Sports", value: academy.sports.join(", ") || "None listed" },
    { label: "Venues listed", value: String(academy.venueCount) },
    { label: "Coaches listed", value: String(academy.coachCount) },
  ];
  if (analytics) {
    rows.push({
      label: "Sessions completed",
      value: `${analytics.overview.completedSessions} of ${analytics.overview.totalSessions}`,
    });
  }

  return (
    <section aria-labelledby="glance-heading">
      <div className="flex items-baseline justify-between gap-4">
        <h2 id="glance-heading" className="text-ink text-base font-semibold">
          Your academy
        </h2>
        <Link href="/academy/settings" className={`${TEXT_LINK} ring-offset-paper text-sm`}>
          Edit details
          <ArrowRight size={16} strokeWidth={1.5} aria-hidden="true" />
        </Link>
      </div>

      <dl className="border-hairline mt-4 border-t">
        {rows.map((row) => (
          <div
            key={row.label}
            className="border-hairline flex items-baseline justify-between gap-6 border-b py-3.5"
          >
            <dt className="text-ink-body">{row.label}</dt>
            <dd className="text-ink text-right font-medium tabular-nums">{row.value}</dd>
          </div>
        ))}
      </dl>

      {unreadNotifications > 0 && (
        <p className="mt-5">
          <Link href="/academy/notifications" className={`${TEXT_LINK} ring-offset-paper`}>
            {plural(unreadNotifications, "unread notification")}
            <ArrowRight size={16} strokeWidth={1.5} aria-hidden="true" />
          </Link>
        </p>
      )}
    </section>
  );
}
