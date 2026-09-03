// Helper function to format opening hours for display
type DayHours = {
  isOpen: boolean;
  openTime?: string;
  closeTime?: string;
  slots?: Array<{ startTime: string; endTime: string }>;
};

type OpeningHours = Record<string, DayHours>;

export function formatOpeningHours(openingHours: OpeningHours | string | null | undefined): string {
  // Handle legacy string format
  if (typeof openingHours === "string") {
    return openingHours;
  }

  // Handle structured format
  if (typeof openingHours === "object" && openingHours !== null) {
    const days = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];

    const openDays: string[] = [];
    const closedDays: string[] = [];

    days.forEach((day) => {
      const dayHours = openingHours[day];
      if (dayHours?.isOpen) {
        const slots = Array.isArray(dayHours.slots)
          ? dayHours.slots
          : dayHours.openTime && dayHours.closeTime
            ? [{ startTime: dayHours.openTime, endTime: dayHours.closeTime }]
            : [];
        const slotLabel =
          slots.length > 0
            ? slots.map((slot) => `${slot.startTime}-${slot.endTime}`).join(", ")
            : "N/A";

        openDays.push(`${day.charAt(0).toUpperCase() + day.slice(1)}: ${slotLabel}`);
      } else {
        closedDays.push(day.charAt(0).toUpperCase() + day.slice(1));
      }
    });

    let result = "";
    if (openDays.length > 0) {
      result += openDays.join(", ");
    }
    if (closedDays.length > 0) {
      result += ` | Closed: ${closedDays.join(", ")}`;
    }

    return result || "No hours specified";
  }

  return "No hours specified";
}
