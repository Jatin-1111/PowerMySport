import { Button } from "@/modules/shared/ui/Button";
import { bookingKey } from "@/modules/shared/utils/bookingDisplay";
import { whenLabel } from "@/modules/shared/utils/bookingTime";
import { formatRupees, plural } from "@/modules/shared/utils/figures";
import type { Booking } from "@/types";
import { ArrowRight } from "lucide-react";
import Link from "next/link";

const SHOWN = 3;

/**
 * The one thing on an overview that is waiting on the provider. It is a tonal
 * band with the page's single primary action, not a card, and it only exists
 * while there is a request to answer. The answers themselves are given on the
 * bookings page `href` points to.
 */
export function RequestsBand({
  requests,
  now,
  href,
  titleOf,
  amountOf = (booking) => booking.totalAmount,
}: {
  requests: Booking[];
  now: Date;
  href: string;
  titleOf: (booking: Booking) => string;
  amountOf?: (booking: Booking) => number;
}) {
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
              <Link href={href}>
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
                  <p className="text-ink truncate font-medium">{titleOf(booking)}</p>
                  <p className="text-ink-body text-sm">
                    <span className="capitalize">{booking.sport}</span>, {whenLabel(booking, now)}
                  </p>
                </div>
                <p className="text-ink shrink-0 font-medium tabular-nums">
                  {formatRupees(amountOf(booking))}
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
