import { StatusTag } from "@/modules/shared/ui/StatusTag";
import { TEXT_LINK } from "@/modules/shared/ui/textLink";
import { plural } from "@/modules/shared/utils/figures";
import type { Venue } from "@/types";
import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { describeVenueStatus, priceFromLabel } from "../../utils/overview";

/** The owner's venues as a ruled list: name and status, then sports, price and rating. */
export function YourVenues({ venues }: { venues: Venue[] }) {
  return (
    <section aria-labelledby="venues-heading">
      <div className="flex items-baseline justify-between gap-4">
        <h2 id="venues-heading" className="text-ink text-base font-semibold">
          Your venues
        </h2>
        <Link href="/venue-lister/inventory" className={`${TEXT_LINK} ring-offset-paper text-sm`}>
          Manage venues
          <ArrowRight size={16} strokeWidth={1.5} aria-hidden="true" />
        </Link>
      </div>

      {venues.length === 0 ? (
        <p className="text-ink-body border-hairline mt-4 max-w-[56ch] text-pretty border-t pt-5">
          You have not added a venue yet. Add one to start taking bookings.
        </p>
      ) : (
        <ul className="border-hairline mt-4 border-t">
          {venues.map((venue) => {
            const status = describeVenueStatus(venue);
            const reviews = venue.reviewCount ?? 0;
            return (
              <li key={venue.id ?? venue._id} className="border-hairline border-b py-4">
                <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
                  <p className="text-ink min-w-0 truncate font-medium">{venue.name}</p>
                  <StatusTag tone={status.tone}>{status.tag}</StatusTag>
                </div>
                <p className="text-ink-body mt-1 text-sm tabular-nums">
                  {[
                    venue.sports.join(", "),
                    priceFromLabel(venue),
                    reviews > 0 && venue.rating
                      ? `${venue.rating.toFixed(1)} from ${plural(reviews, "review")}`
                      : "No reviews yet",
                  ]
                    .filter(Boolean)
                    .join(", ")}
                </p>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
