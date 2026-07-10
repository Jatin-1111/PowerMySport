/**
 * Check if two time ranges overlap
 * @param start1 Start time in "HH:mm" format
 * @param end1 End time in "HH:mm" format
 * @param start2 Start time in "HH:mm" format
 * @param end2 End time in "HH:mm" format
 */
export const doTimesOverlap = (
  start1: string,
  end1: string,
  start2: string,
  end2: string,
): boolean => {
  const timeToMinutes = (time: string): number => {
    const parts = time.split(":");
    const hours = parseInt(parts[0] || "0", 10);
    const minutes = parseInt(parts[1] || "0", 10);
    return hours * 60 + minutes;
  };

  const start1Min = timeToMinutes(start1);
  const end1Min = timeToMinutes(end1);
  const start2Min = timeToMinutes(start2);
  const end2Min = timeToMinutes(end2);

  return start1Min < end2Min && start2Min < end1Min;
};

/**
 * Format time string for display
 */
export const formatTime = (timeStr: string): string => {
  const parts = timeStr.split(":");
  const hours = parts[0] || "0";
  const minutes = parts[1] || "00";
  const hour = parseInt(hours, 10);
  const ampm = hour >= 12 ? "PM" : "AM";
  const displayHour = hour % 12 || 12;
  return `${displayHour}:${minutes} ${ampm}`;
};

/**
 * Get available slots for a venue on a specific date
 */
export const generateDynamicSlots = (
  startHour: number = 6,
  endHour: number = 22,
  intervalMinutes: number = 60,
): string[] => {
  const slots: string[] = [];
  let currentHour = startHour;
  let currentMinute = 0;

  while (currentHour < endHour) {
    slots.push(
      `${String(currentHour).padStart(2, "0")}:${String(currentMinute).padStart(2, "0")}`,
    );

    currentMinute += intervalMinutes;
    if (currentMinute >= 60) {
      currentHour += Math.floor(currentMinute / 60);
      currentMinute = currentMinute % 60;
    }
  }

  return slots;
};
