import { Button } from "@/modules/shared/ui/Button";
import { bookingKey, bookingPlayerName } from "@/modules/shared/utils/bookingDisplay";
import { formatRupees, plural } from "@/modules/shared/utils/figures";
import type { Booking } from "@/types";
import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { whenLabel } from "../../utils/overview";

const SHOWN = 3;

/**
 * The one thing on the page that is waiting on the coach. It is a tonal band
 * with the page's single primary action, not a card, and it only exists while
 * there is a request to answer.
 */
export function RequestsBand({ requests, now }: { requests: Booking[]; now: Date }) {
  const count = requests.length;
  const hidden = count - SHOWN;

  return (
    <section
      aria-labelledby="requests-heading"
      className="bg-paper-deep rounded-2xl p-6 sm:p-8 xl:p-10"
    >
      <div className="grid gap-8 xl:grid-cols-12 xl:gap-14">
        <div className="xl:col-span-5">
          <h2
            id="requests-heading"
            className="font-editorial text-ink max-w-[22ch] text-balance text-3xl font-light leading-[1.1] tracking-tight sm:text-4xl"
          >
            {count === 1 ? "1 booking request needs" : `${count} booking requests need`} your reply
          </h2>
          <p className="text-ink-body mt-4 max-w-[48ch] text-pretty">
            Confirm or decline each one so the client knows where they stand.
          </p>
          <div className="mt-8">
            <Button asChild size="lg">
              <Link href="/coach/my-bookings">
                Review {count === 1 ? "request" : "requests"}
                <ArrowRight size={18} strokeWidth={1.5} aria-hidden="true" />
              </Link>
            </Button>
          </div>
        </div>

        <div className="xl:col-span-7">
          <ul aria-label="Pending requests">
            {requests.slice(0, SHOWN).map((booking, index) => (
              <li
                key={bookingKey(booking, index)}
                className="border-ink/15 flex items-baseline justify-between gap-6 border-t py-3.5 first:border-t-0 first:pt-0"
              >
                <div className="min-w-0">
                  <p className="text-ink truncate font-medium">{bookingPlayerName(booking)}</p>
                  <p className="text-ink-body text-sm">
                    <span className="capitalize">{booking.sport}</span>, {whenLabel(booking, now)}
                  </p>
                </div>
                <p className="text-ink shrink-0 font-medium tabular-nums">
                  {formatRupees(booking.totalAmount)}
                </p>
              </li>
            ))}
          </ul>
          {hidden > 0 && (
            <p className="text-ink-body border-ink/15 border-t pt-3.5 text-sm">
              and {plural(hidden, "more request")}
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
