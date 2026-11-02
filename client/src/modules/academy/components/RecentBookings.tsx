import type { Booking } from "@/types";
import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { bookingKey, bookingPlayerName, formatRupees, formatShortDate } from "../utils/format";
import { TEXT_LINK } from "@/modules/shared/ui/textLink";

const VISIBLE = 5;

/**
 * The latest completed sessions as a ruled list, newest first. A row is a
 * name, a line of context and an amount, nothing else: every booking in this
 * list is completed, so a status badge on each would repeat the heading.
 */
export function RecentBookings({ bookings }: { bookings: Booking[] }) {
  return (
    <section aria-labelledby="recent-heading">
      <div className="flex items-baseline justify-between gap-4">
        <h2 id="recent-heading" className="text-ink text-base font-semibold">
          Recent sessions
        </h2>
        <Link href="/academy/earnings" className={`${TEXT_LINK} ring-offset-paper text-sm`}>
          All earnings
          <ArrowRight size={16} strokeWidth={1.5} aria-hidden="true" />
        </Link>
      </div>

      {bookings.length === 0 ? (
        <p className="text-ink-body border-hairline mt-4 max-w-[56ch] text-pretty border-t pt-5">
          No completed sessions yet. Each one appears here once it finishes at one of your venues or
          with one of your coaches.
        </p>
      ) : (
        <ul className="border-hairline mt-4 border-t">
          {bookings.slice(0, VISIBLE).map((booking, index) => (
            <li
              key={bookingKey(booking, index)}
              className="border-hairline flex items-baseline justify-between gap-6 border-b py-3.5"
            >
              <div className="min-w-0">
                <p className="text-ink truncate font-medium">{bookingPlayerName(booking)}</p>
                <p className="text-ink-body text-sm">
                  <span className="capitalize">{booking.sport}</span>
                  {booking.date && `, ${formatShortDate(booking.date)}`}
                </p>
              </div>
              <p className="text-ink shrink-0 font-medium tabular-nums">
                {formatRupees(booking.totalAmount)}
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
