import { getOwnVenueLocationDisplay } from "@/utils/location";
import type { AcademyRef, Booking, Coach, Venue } from "@/types";

export {
  bookingStatusView,
  countByFilter,
  filterSessions,
  isRequest,
  requestsOf,
  type BookingFilter,
  type BookingStatusView,
} from "@/modules/shared/utils/bookingGroups";

/** Where the session is, on one line: the venue, the academy, or the coach's own place. */
export const bookingPlace = (booking: Booking, coach: Coach | null | undefined): string => {
  if (typeof booking.venueId === "object" && booking.venueId !== null) {
    return (booking.venueId as Venue).name || "Venue";
  }
  if (typeof booking.academyId === "object" && booking.academyId !== null) {
    return (booking.academyId as AcademyRef).name || "Academy";
  }
  const own = getOwnVenueLocationDisplay(coach?.ownVenueDetails);
  return own?.title ?? "Location on file";
};
