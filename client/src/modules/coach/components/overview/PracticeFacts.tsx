import { TEXT_LINK } from "@/modules/shared/ui/textLink";
import { formatRupees, plural } from "@/modules/shared/utils/figures";
import type { Coach } from "@/types";
import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { availableDays, serviceModeLabel } from "../../utils/overview";

/** Facts about the coach's listing, as a definition list. */
export function PracticeFacts({
  coach,
  unreadNotifications,
}: {
  coach: Coach;
  unreadNotifications: number;
}) {
  const days = availableDays(coach);

  const rows: Array<{ label: string; value: string }> = [
    { label: "Sports", value: coach.sports.join(", ") || "None listed" },
    { label: "Rate", value: `${formatRupees(coach.hourlyRate)} an hour` },
    { label: "How you coach", value: serviceModeLabel(coach.serviceMode) },
    { label: "Open days", value: days > 0 ? `${days} a week` : "None set" },
  ];

  return (
    <section aria-labelledby="practice-heading">
      <div className="flex items-baseline justify-between gap-4">
        <h2 id="practice-heading" className="text-ink text-base font-semibold">
          Your practice
        </h2>
        <Link href="/coach/profile" className={`${TEXT_LINK} ring-offset-paper text-sm`}>
          Edit profile
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
          <Link href="/coach/notifications" className={`${TEXT_LINK} ring-offset-paper`}>
            {plural(unreadNotifications, "unread notification")}
            <ArrowRight size={16} strokeWidth={1.5} aria-hidden="true" />
          </Link>
        </p>
      )}
    </section>
  );
}
