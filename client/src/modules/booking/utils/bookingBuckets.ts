import type { Booking } from "@/types";

/**
 * Which bucket of the parent's booking list a booking belongs in.
 *
 * Kept free of React so the categorization rule can be tested on its own — it is
 * the part that decides whether a booking shows up at all.
 */
export type BookingTabId = "venues" | "coaches" | "academies" | "experts";

/**
 * Split a parent's bookings by provider kind.
 *
 * `providerType` is authoritative and comes from the server. The id-based
 * fallback is only for rows written before that field existed; note that it
 * checks expertId first, because an in-person consultation can also carry a
 * venue and would otherwise be filed as a venue booking.
 */
export const bucketBookings = (
  bookings: Booking[],
): Record<BookingTabId, Booking[]> => {
  const buckets: Record<BookingTabId, Booking[]> = {
    venues: [],
    coaches: [],
    academies: [],
    experts: [],
  };

  for (const booking of bookings) {
    const kind =
      booking.providerType ??
      (booking.expertId
        ? "EXPERT"
        : booking.academyId
          ? "ACADEMY"
          : booking.coachId
            ? "COACH"
            : "VENUE");

    if (kind === "EXPERT") buckets.experts.push(booking);
    else if (kind === "ACADEMY") buckets.academies.push(booking);
    else if (kind === "COACH") buckets.coaches.push(booking);
    else buckets.venues.push(booking);
  }

  return buckets;
};
