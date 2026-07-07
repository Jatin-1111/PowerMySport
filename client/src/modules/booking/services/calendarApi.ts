import axiosInstance from "@/lib/api/axios";

export type CalendarEventType =
  "IMPORTANT" | "COMPETITION" | "TRAINING" | "REMINDER" | "OTHER";

export interface CalendarBooking {
  id: string;
  _id?: string;
  date: string;
  startTime: string;
  endTime: string;
  status: string;
  sport: string;
  venueId?: { name?: string } | string | null;
  coachId?: { userId?: { name?: string } | string } | string | null;
}

export interface CalendarEvent {
  id: string;
  title: string;
  date: string;
  color: string;
  type: CalendarEventType;
  notes?: string;
}

export const EVENT_TYPE_LABELS: Record<CalendarEventType, string> = {
  IMPORTANT: "Important",
  COMPETITION: "Competition",
  TRAINING: "Training",
  REMINDER: "Reminder",
  OTHER: "Other",
};

export const EVENT_TYPE_COLORS: Record<CalendarEventType, string> = {
  IMPORTANT: "#f97316",
  COMPETITION: "#8b5cf6",
  TRAINING: "#10b981",
  REMINDER: "#3b82f6",
  OTHER: "#6b7280",
};

export const EVENT_TYPE_BG: Record<CalendarEventType, string> = {
  IMPORTANT: "bg-orange-100 text-orange-700",
  COMPETITION: "bg-indigo-100 text-indigo-700",
  TRAINING: "bg-emerald-100 text-emerald-700",
  REMINDER: "bg-indigo-100 text-indigo-700",
  OTHER: "bg-slate-100 text-slate-600",
};

export const calendarApi = {
  getBookings: async (
    startDate: string,
    endDate: string,
  ): Promise<CalendarBooking[]> => {
    const res = await axiosInstance.get("/calendar/bookings", {
      params: { startDate, endDate },
    });
    return res.data.data.bookings as CalendarBooking[];
  },

  getEvents: async (
    startDate?: string,
    endDate?: string,
  ): Promise<CalendarEvent[]> => {
    const res = await axiosInstance.get("/calendar/events", {
      params: startDate && endDate ? { startDate, endDate } : {},
    });
    return res.data.data.events as CalendarEvent[];
  },

  createEvent: async (payload: {
    title: string;
    date: string;
    color?: string;
    type?: CalendarEventType;
    notes?: string;
  }): Promise<CalendarEvent> => {
    const res = await axiosInstance.post("/calendar/events", payload);
    return res.data.data.event as CalendarEvent;
  },

  updateEvent: async (
    id: string,
    payload: Partial<{
      title: string;
      date: string;
      color: string;
      type: CalendarEventType;
      notes: string;
    }>,
  ): Promise<CalendarEvent> => {
    const res = await axiosInstance.put(`/calendar/events/${id}`, payload);
    return res.data.data.event as CalendarEvent;
  },

  deleteEvent: async (id: string): Promise<void> => {
    await axiosInstance.delete(`/calendar/events/${id}`);
  },
};
