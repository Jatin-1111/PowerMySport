import { Button } from "@/modules/shared/ui/Button";
import { StatusTag } from "@/modules/shared/ui/StatusTag";
import { TEXT_LINK } from "@/modules/shared/ui/textLink";
import { plural } from "@/modules/shared/utils/figures";
import { formatSportLabel, getCoverPhoto } from "@/modules/venue/utils/inventoryFlow";
import { describeVenueStatus, priceFromLabel } from "@/modules/venue/utils/overview";
import type { Venue } from "@/types";
import { ArrowUpRight, Building2 } from "lucide-react";
import Link from "next/link";

const idOf = (venue: Venue): string => venue.id || venue._id || "";

/**
 * The owner's venues as a ruled list. Each row says where the venue stands with
 * our review (and why, when something is wrong), what it costs and how it is
 * rated, and carries its own edit and delete. A venue that is not live has no
 * public page yet, so the preview link only appears once it is.
 */
export function VenueRows({
  venues,
  onEdit,
  onDelete,
}: {
  venues: Venue[];
  onEdit: (venue: Venue) => void;
  onDelete: (venueId: string) => void;
}) {
  return (
    <ul className="border-hairline border-t">
      {venues.map((venue, index) => {
        const status = describeVenueStatus(venue);
        const cover = getCoverPhoto(venue);
        const reviews = venue.reviewCount ?? 0;
        const address =
          venue.address ||
          (venue.location?.coordinates
            ? `${venue.location.coordinates[1].toFixed(4)}, ${venue.location.coordinates[0].toFixed(4)}`
            : "Location not set");

        return (
          <li
            key={idOf(venue) || index}
            className="border-hairline grid gap-x-6 gap-y-4 border-b py-6 sm:grid-cols-[7rem_minmax(0,1fr)] xl:grid-cols-[7rem_minmax(0,1fr)_auto]"
          >
            <div className="bg-paper-deep flex aspect-[4/3] items-center justify-center overflow-hidden rounded-md sm:h-[5.25rem] sm:w-28">
              {cover ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={cover}
                  alt={`${venue.name}, cover photo`}
                  className="h-full w-full object-cover"
                />
              ) : (
                <Building2
                  size={24}
                  strokeWidth={1.5}
                  className="text-ink-ash"
                  aria-hidden="true"
                />
              )}
            </div>

            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                <h3 className="text-ink min-w-0 truncate text-lg font-semibold">{venue.name}</h3>
                <StatusTag tone={status.tone}>{status.tag}</StatusTag>
              </div>
              <p className="text-ink-body mt-1 text-sm">{address}</p>
              <p className="text-ink-body mt-1 text-sm tabular-nums">
                {[
                  venue.sports.map(formatSportLabel).join(", "),
                  priceFromLabel(venue),
                  reviews > 0 && venue.rating
                    ? `${venue.rating.toFixed(1)} from ${plural(reviews, "review")}`
                    : "No reviews yet",
                ]
                  .filter(Boolean)
                  .join(", ")}
              </p>
              {status.headline && status.body && (
                <p className="text-ink-body mt-3 max-w-[60ch] text-pretty border-l-2 border-amber-700/40 pl-4 text-sm">
                  {status.body}
                </p>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-x-5 gap-y-2 sm:col-start-2 xl:col-start-3">
              <Button
                size="sm"
                variant="secondary"
                className="min-h-11"
                onClick={() => onEdit(venue)}
                aria-label={`Edit ${venue.name}`}
              >
                Edit
              </Button>
              {status.tone === "live" && (
                <Link
                  href={`/venues/${idOf(venue)}`}
                  className={`${TEXT_LINK} ring-offset-paper min-h-11 text-sm`}
                >
                  View public page
                  <ArrowUpRight size={16} strokeWidth={1.5} aria-hidden="true" />
                </Link>
              )}
              <button
                type="button"
                onClick={() => onDelete(idOf(venue))}
                className="text-ink decoration-ink/30 hover:decoration-ink focus-visible:ring-ink ring-offset-paper min-h-11 rounded-sm px-1 text-sm font-semibold underline underline-offset-4 transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
                aria-label={`Delete ${venue.name}`}
              >
                Delete
              </button>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
