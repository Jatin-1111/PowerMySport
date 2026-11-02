import { StatusTag } from "@/modules/shared/ui/StatusTag";
import { bookingKey, bookingPlayerName } from "@/modules/shared/utils/bookingDisplay";
import { formatRupees } from "@/modules/shared/utils/figures";
import type { Booking, Coach } from "@/types";
import { bookingPlace, bookingStatusView } from "../../utils/bookings";
import { whenLabel } from "../../utils/overview";

/** Sessions as a ruled list: when, who and where, then the amount and the status. */
export function SessionRows({
  sessions,
  now,
  coach,
}: {
  sessions: Booking[];
  now: Date;
  coach: Coach | null;
}) {
  return (
    <ul className="border-hairline border-t">
      {sessions.map((booking, index) => {
        const status = bookingStatusView(booking.status);
        return (
          <li
            key={bookingKey(booking, index)}
            className="border-hairline grid gap-x-8 gap-y-2 border-b py-4 sm:grid-cols-[minmax(0,15rem)_minmax(0,1fr)_auto] sm:items-center"
          >
            <p className="text-ink font-medium tabular-nums">{whenLabel(booking, now)}</p>
            <div className="min-w-0">
              <p className="text-ink truncate font-medium">{bookingPlayerName(booking)}</p>
              <p className="text-ink-body truncate text-sm">
                <span className="capitalize">{booking.sport}</span>, {bookingPlace(booking, coach)}
              </p>
            </div>
            <div className="flex items-center gap-4 sm:justify-end">
              <p className="text-ink font-medium tabular-nums">
                {formatRupees(booking.totalAmount)}
              </p>
              <StatusTag tone={status.tone}>{status.tag}</StatusTag>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
