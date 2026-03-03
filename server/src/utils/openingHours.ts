import { OpeningHours } from "../types";

/**
 * Validate if a booking time falls within venue opening hours
 */
export const isWithinOpeningHours = (
  bookingDate: Date,
  startTime: string,
  endTime: string,
  openingHours: OpeningHours,
): { isValid: boolean; message?: string } => {
  const dayNames = [
    "sunday",
    "monday",
    "tuesday",
    "wednesday",
    "thursday",
    "friday",
    "saturday",
  ] as const;

  const dayOfWeek = bookingDate.getDay(); // 0 = Sunday, 1 = Monday, etc.
  const dayName = dayNames[dayOfWeek];

  // Safety check (should never happen as getDay() returns 0-6)
  if (!dayName) {
    return {
      isValid: false,
      message: "Invalid booking date",
    };
  }

  const dayHours = openingHours[dayName];

  // Check if venue is open on this day
  if (!dayHours || !dayHours.isOpen) {
    return {
      isValid: false,
      message: `Venue is closed on ${dayName.charAt(0).toUpperCase() + dayName.slice(1)}s`,
    };
  }

  // Validate opening hours are set
  if (!dayHours.openTime || !dayHours.closeTime) {
    return {
      isValid: false,
      message: "Venue operating hours are not configured",
    };
  }

  const venueOpen = dayHours.openTime;
  const venueClose = dayHours.closeTime;

  // Convert times to comparable numbers (e.g., "09:30" -> 930)
  const toMinutes = (time: string): number => {
    const [hours, minutes] = time.split(":").map(Number);
    return (hours || 0) * 60 + (minutes || 0);
  };

  const bookingStartMinutes = toMinutes(startTime);
  const bookingEndMinutes = toMinutes(endTime);
  const venueOpenMinutes = toMinutes(venueOpen);
  const venueCloseMinutes = toMinutes(venueClose);

  // Check if booking falls within operating hours
  if (bookingStartMinutes < venueOpenMinutes) {
    return {
      isValid: false,
      message: `Venue opens at ${venueOpen}. Your booking starts at ${startTime}`,
    };
  }

  if (bookingEndMinutes > venueCloseMinutes) {
    return {
      isValid: false,
      message: `Venue closes at ${venueClose}. Your booking ends at ${endTime}`,
    };
  }

  return { isValid: true };
};

/**
 * Get the day name from a date
 */
export const getDayName = (date: Date): string => {
  const dayNames = [
    "Sunday",
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
  ];
  return dayNames[date.getDay()] || "Unknown";
};
