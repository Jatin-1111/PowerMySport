// Helper function to format opening hours for display
export function formatOpeningHours(openingHours: any): string {
  // Handle legacy string format
  if (typeof openingHours === "string") {
    return openingHours;
  }

  // Handle structured format
  if (typeof openingHours === "object" && openingHours !== null) {
    const days = [
      "monday",
      "tuesday",
      "wednesday",
      "thursday",
      "friday",
      "saturday",
      "sunday",
    ];

    const openDays: string[] = [];
    const closedDays: string[] = [];

    days.forEach((day) => {
      const dayHours = openingHours[day];
      if (dayHours?.isOpen) {
        openDays.push(
          `${day.charAt(0).toUpperCase() + day.slice(1)}: ${dayHours.openTime || "N/A"} - ${dayHours.closeTime || "N/A"}`,
        );
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
