import { Button } from "@/modules/shared/ui/Button";
import { bookingKey, bookingPlayerName } from "@/modules/shared/utils/bookingDisplay";
import { formatRupees } from "@/modules/shared/utils/figures";
import type { Booking, Coach } from "@/types";
import { bookingPlace } from "../../utils/bookings";
import { whenLabel } from "../../utils/overview";

const DECLINE_LINK =
  "text-ink decoration-ink/30 hover:decoration-ink focus-visible:ring-ink ring-offset-paper-deep min-h-11 rounded-sm px-1 text-sm font-semibold underline underline-offset-4 transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:opacity-50";

/**
 * Requests waiting on the coach, first on the page and set apart on a tonal
 * band. Each row carries its own Confirm and Decline so a request is answered
 * where it is read. There is no undo for either answer, so the buttons name
 * what they do.
 */
export function RequestRows({
  requests,
  now,
  coach,
  approvingId,
  rejectingId,
  onApprove,
  onReject,
}: {
  requests: Booking[];
  now: Date;
  coach: Coach | null;
  approvingId: string | null;
  rejectingId: string | null;
  onApprove: (bookingId: string) => void;
  onReject: (bookingId: string) => void;
}) {
  return (
    <section aria-labelledby="requests-heading" className="bg-paper-deep rounded-2xl p-6 sm:p-8">
      <h2
        id="requests-heading"
        className="font-editorial text-ink text-balance text-2xl font-light tracking-tight sm:text-3xl"
      >
        {requests.length === 1
          ? "1 request needs your reply"
          : `${requests.length} requests need your reply`}
      </h2>
      <p className="text-ink-body mt-2 max-w-[56ch] text-pretty">
        Confirm or decline each one so the client knows where they stand.
      </p>

      <ul className="mt-6" aria-label="Pending requests">
        {requests.map((booking, index) => {
          const id = booking.id || bookingKey(booking, index);
          const busy = approvingId === id || rejectingId === id;
          const name = bookingPlayerName(booking);

          return (
            <li
              key={id}
              className="border-ink/15 flex flex-col gap-4 border-t py-5 first:border-t-0 first:pt-0 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0">
                <p className="text-ink font-medium">{name}</p>
                <p className="text-ink-body text-sm">
                  <span className="capitalize">{booking.sport}</span>, {whenLabel(booking, now)}
                </p>
                <p className="text-ink-body text-sm">{bookingPlace(booking, coach)}</p>
              </div>

              <div className="flex flex-wrap items-center gap-x-5 gap-y-2 sm:shrink-0">
                <p className="text-ink font-medium tabular-nums">
                  {formatRupees(booking.totalAmount)}
                </p>
                <Button
                  size="sm"
                  variant="secondary"
                  className="min-h-11"
                  onClick={() => onApprove(id)}
                  disabled={busy}
                  aria-label={`Confirm booking for ${name}`}
                >
                  {approvingId === id ? "Confirming" : "Confirm"}
                </Button>
                <button
                  type="button"
                  className={DECLINE_LINK}
                  onClick={() => onReject(id)}
                  disabled={busy}
                  aria-label={`Decline booking for ${name}`}
                >
                  {rejectingId === id ? "Declining" : "Decline"}
                </button>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
