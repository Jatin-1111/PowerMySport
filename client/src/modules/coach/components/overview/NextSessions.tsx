import { TEXT_LINK } from "@/modules/shared/ui/textLink";
import { bookingKey, bookingPlayerName } from "@/modules/shared/utils/bookingDisplay";
import type { Booking } from "@/types";
import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { whenLabel } from "../../utils/overview";

/** The next confirmed sessions as a ruled list: when, then who and what. */
export function NextSessions({
  sessions,
  now,
  failed,
}: {
  sessions: Booking[];
  now: Date;
  failed: boolean;
}) {
  return (
    <section aria-labelledby="next-heading">
      <div className="flex items-baseline justify-between gap-4">
        <h2 id="next-heading" className="text-ink text-base font-semibold">
          Next sessions
        </h2>
        <Link href="/coach/schedule" className={`${TEXT_LINK} ring-offset-paper text-sm`}>
          Open schedule
          <ArrowRight size={16} strokeWidth={1.5} aria-hidden="true" />
        </Link>
      </div>

      {failed ? (
        <p role="alert" className="text-ink-body border-hairline mt-4 border-t pt-5">
          We could not load your sessions. Refresh to try again.
        </p>
      ) : sessions.length === 0 ? (
        <p className="text-ink-body border-hairline mt-4 max-w-[56ch] text-pretty border-t pt-5">
          Nothing is booked yet. Confirmed sessions appear here, soonest first. Opening more of your
          week in the schedule makes it easier for clients to book.
        </p>
      ) : (
        <ul className="border-hairline mt-4 border-t">
          {sessions.map((booking, index) => (
            <li
              key={bookingKey(booking, index)}
              className="border-hairline flex items-baseline justify-between gap-6 border-b py-3.5"
            >
              <p className="text-ink font-medium tabular-nums">{whenLabel(booking, now)}</p>
              <p className="text-ink-body min-w-0 truncate text-right text-sm">
                {bookingPlayerName(booking)}, <span className="capitalize">{booking.sport}</span>
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
