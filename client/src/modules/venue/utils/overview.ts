import type { StatusTone } from "@/modules/shared/ui/StatusTag";
import { formatRupees } from "@/modules/shared/utils/figures";
import type { Booking, Venue } from "@/types";

export interface VenueStatusView {
  tone: StatusTone;
  tag: string;
  /** Sentence for the status band; null when nothing needs saying. */
  headline: string | null;
  body: string | null;
  action: { label: string; href: string } | null;
}

const ONBOARDING = "/onboarding";
const INVENTORY = "/venue-lister/inventory";

/**
 * Where a venue stands with our review, in the owner's terms. Venues saved
 * before reviews existed have no `lifecycle`, so it falls back to the older
 * approval status. Only a venue that is not live gets a headline: a live venue
 * needs no explaining.
 */
export const describeVenueStatus = (venue: Venue): VenueStatusView => {
  const state =
    venue.lifecycle ??
    (venue.approvalStatus === "APPROVED"
      ? "APPROVED"
      : venue.approvalStatus === "REJECTED"
        ? "REJECTED"
        : venue.approvalStatus === "REVIEW"
          ? "NEEDS_INFO"
          : "SUBMITTED");

  switch (state) {
    case "APPROVED":
      return { tone: "live", tag: "Live", headline: null, body: null, action: null };
    case "DRAFT":
      return {
        tone: "neutral",
        tag: "Setup in progress",
        headline: `Finish setting up ${venue.name || "your venue"}`,
        body: "We start reviewing a venue once every setup step is done and submitted. What you have entered so far is saved.",
        action: { label: "Continue setup", href: ONBOARDING },
      };
    case "SUBMITTED":
      return {
        tone: "pending",
        tag: "In review",
        headline: `${venue.name || "Your venue"} is in review`,
        body: "We check the details and documents you sent before the venue is shown to players. This page updates as soon as there is a decision.",
        action: null,
      };
    case "NEEDS_INFO":
      return {
        tone: "pending",
        tag: "Needs more information",
        headline: `${venue.name || "Your venue"} needs a few changes`,
        body:
          venue.reviewNotes || "Our team asked for more information before approving this venue.",
        action: { label: "Update your venue", href: INVENTORY },
      };
    case "REJECTED":
      return {
        tone: "alert",
        tag: "Not approved",
        headline: `${venue.name || "Your venue"} was not approved`,
        body: venue.rejectionReason || "Our team did not approve this venue.",
        action: { label: "Update your venue", href: INVENTORY },
      };
    case "SUSPENDED":
      return {
        tone: "alert",
        tag: "Suspended",
        headline: `${venue.name || "Your venue"} is suspended`,
        body: "It is hidden from players while the suspension lasts. Contact us if you think this is a mistake.",
        action: null,
      };
  }
};

/** The one venue that most needs the owner's attention, or null when all are live. */
export const venueNeedingAttention = (venues: Venue[]): Venue | null => {
  const rank = (venue: Venue) => {
    const view = describeVenueStatus(venue);
    if (!view.headline) return 99;
    return view.tone === "alert" ? 0 : view.action ? 1 : 2;
  };
  const sorted = venues
    .filter((venue) => describeVenueStatus(venue).headline)
    .sort((a, b) => rank(a) - rank(b));
  return sorted[0] ?? null;
};

/** Rating across every venue, weighted by how many reviews each has. Null when nobody has reviewed. */
export const averageRating = (venues: Venue[]): { value: number; count: number } | null => {
  let count = 0;
  let sum = 0;
  for (const venue of venues) {
    const reviews = venue.reviewCount ?? 0;
    if (reviews > 0 && venue.rating) {
      count += reviews;
      sum += venue.rating * reviews;
    }
  }
  return count > 0 ? { value: sum / count, count } : null;
};

/** The name of the venue a booking is for: populated on the booking, else looked up by id. */
export const bookingVenueName = (booking: Booking, venues: Venue[]): string => {
  if (booking.venue?.name) return booking.venue.name;
  const ref = booking.venueId;
  if (ref && typeof ref === "object") return ref.name || "Your venue";
  return venues.find((venue) => venue.id === ref || venue._id === ref)?.name ?? "Your venue";
};

/** What the venue itself earns from a booking: its own payout line, else the booking total. */
export const venueEarning = (booking: Booking): number => {
  const line = booking.payments?.find((payment) => payment.userType === "VenueLister");
  return line?.amount ?? booking.totalAmount;
};

/** The lowest hourly price a venue lists, across its sports. */
export const startingPrice = (venue: Venue): number => {
  const prices = [venue.pricePerHour, ...Object.values(venue.sportPricing ?? {})].filter(
    (price): price is number => typeof price === "number" && price > 0
  );
  return prices.length ? Math.min(...prices) : 0;
};

export const priceFromLabel = (venue: Venue): string => {
  const price = startingPrice(venue);
  return price > 0 ? `From ${formatRupees(price)} an hour` : "No price set";
};
