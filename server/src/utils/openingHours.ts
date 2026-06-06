import { OpeningHours } from "../types/index";

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
  return dayNames[date.getDay()] || "Unknown";
};
