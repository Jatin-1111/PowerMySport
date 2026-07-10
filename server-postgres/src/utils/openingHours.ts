import { OpeningHours } from "../types/index";

/** UTC+05:30 — every "HH:mm" booking time string is always an IST wall-clock time. */
export const IST_OFFSET_MINUTES = 5 * 60 + 30;

/**
 * Combines a UTC-midnight-anchored booking date (parsed from "YYYY-MM-DD",
 * which the spec always treats as UTC) with an IST wall-clock "HH:mm" time
 * into the correct UTC instant — via pure UTC millisecond arithmetic, so the
 * result does NOT depend on the server process's local timezone. Using
 * Date#setHours here instead would silently shift the result by up to 5.5
 * hours on any server not running in IST (e.g. a cloud server left at its
 * UTC default), which is a real, if intermittent, source of "wrong booking
 * time" bugs.
 */
export const combineDateAndTimeIST = (date: Date, time: string): Date => {
  const [hourPart, minutePart] = time.split(":");
  const hour = parseInt(hourPart || "0", 10);
  const minute = parseInt(minutePart || "0", 10);

  const utcMidnight = Date.UTC(
    date.getUTCFullYear(),
    date.getUTCMonth(),
    date.getUTCDate(),
  );
  const minutesSinceUtcMidnight = hour * 60 + minute - IST_OFFSET_MINUTES;
  return new Date(utcMidnight + minutesSinceUtcMidnight * 60 * 1000);
};

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

  // Booking dates are always UTC-midnight-anchored (parsed from a plain
  // "YYYY-MM-DD" string). Using the UTC day-of-week keeps this correct
  // regardless of the server process's local timezone — .getDay() would
  // read the wrong day-of-week on any server not running in IST.
  const dayOfWeek = bookingDate.getUTCDay(); // 0 = Sunday, 1 = Monday, etc.
  const dayName = dayNames[dayOfWeek];

  // Safety check (should never happen as getUTCDay() returns 0-6)
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

  // Convert times to comparable numbers (e.g., "09:30" -> 930)
  const toMinutes = (time: string): number => {
    const [hours, minutes] = time.split(":").map(Number);
    return (hours || 0) * 60 + (minutes || 0);
  };

  const bookingStartMinutes = toMinutes(startTime);
  const bookingEndMinutes = toMinutes(endTime);

  const normalizedSlots =
    dayHours.slots && dayHours.slots.length > 0
      ? dayHours.slots
      : dayHours.openTime && dayHours.closeTime
        ? [{ startTime: dayHours.openTime, endTime: dayHours.closeTime }]
        : [];

  if (normalizedSlots.length === 0) {
    return {
      isValid: false,
      message: "Venue operating hours are not configured",
    };
  }

  const isWithinAnySlot = normalizedSlots.some((slot) => {
    const slotStartMinutes = toMinutes(slot.startTime);
    const slotEndMinutes = toMinutes(slot.endTime);
    return (
      bookingStartMinutes >= slotStartMinutes &&
      bookingEndMinutes <= slotEndMinutes
    );
  });

  if (!isWithinAnySlot) {
    const formattedSlots = normalizedSlots
      .map((slot) => `${slot.startTime}-${slot.endTime}`)
      .join(", ");

    return {
      isValid: false,
      message: `Venue is available only during: ${formattedSlots}. Your booking is ${startTime}-${endTime}`,
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
  // See isWithinOpeningHours above — UTC day-of-week for the same reason.
  return dayNames[date.getUTCDay()] || "Unknown";
};
