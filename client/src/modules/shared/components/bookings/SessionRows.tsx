import { StatusTag } from "@/modules/shared/ui/StatusTag";
import { bookingKey } from "@/modules/shared/utils/bookingDisplay";
import { bookingStatusView } from "@/modules/shared/utils/bookingGroups";
import { whenLabel } from "@/modules/shared/utils/bookingTime";
import { formatRupees } from "@/modules/shared/utils/figures";
import type { Booking } from "@/types";

/**
 * Sessions as a ruled list: when, who and where, then the amount and the
 * status. `titleOf` and `placeOf` are as in RequestRows.
 */
export function SessionRows({
  sessions,
  now,
  titleOf,
  placeOf,
  amountOf = (booking) => booking.totalAmount,
}: {
  sessions: Booking[];
  now: Date;
  titleOf: (booking: Booking) => string;
  placeOf?: (booking: Booking) => string;
  /** What the provider is paid for the booking; defaults to the booking total. */
  amountOf?: (booking: Booking) => number;
}) {
  return (
    <ul className="border-hairline border-t">
      {sessions.map((booking, index) => {
        const status = bookingStatusView(booking.status);
        const place = placeOf?.(booking);
        return (
          <li
            key={bookingKey(booking, index)}
            className="border-hairline grid gap-x-8 gap-y-2 border-b py-4 sm:grid-cols-[minmax(0,15rem)_minmax(0,1fr)_auto] sm:items-center"
          >
            <p className="text-ink font-medium tabular-nums">{whenLabel(booking, now)}</p>
            <div className="min-w-0">
              <p className="text-ink truncate font-medium">{titleOf(booking)}</p>
              <p className="text-ink-body truncate text-sm">
                <span className="capitalize">{booking.sport}</span>
                {place ? `, ${place}` : ""}
              </p>
            </div>
            <div className="flex items-center gap-4 sm:justify-end">
              <p className="text-ink font-medium tabular-nums">{formatRupees(amountOf(booking))}</p>
              <StatusTag tone={status.tone}>{status.tag}</StatusTag>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
