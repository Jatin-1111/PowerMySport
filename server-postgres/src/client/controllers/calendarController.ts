import { Request, Response } from "express";
import prisma from "../../lib/prisma";
import type { CalendarEventType, Prisma } from "@prisma/client";

/**
 * GET /api/calendar/bookings?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD
 * Returns all non-cancelled bookings for the authenticated user in the given date range.
 * Optimised for calendar dot rendering — only selects fields needed for the UI.
 */
export const getCalendarBookings = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const user = req.user;
    if (!user) {
      res.status(401).json({ success: false, message: "Unauthorized" });
      return;
    }

    const { startDate, endDate } = req.query as {
      startDate?: string;
      endDate?: string;
    };

    if (!startDate || !endDate) {
      res
        .status(400)
        .json({
          success: false,
          message: "startDate and endDate are required",
        });
      return;
    }

    const start = new Date(startDate);
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      res.status(400).json({ success: false, message: "Invalid date format" });
      return;
    }

    const rows = await prisma.booking.findMany({
      where: {
        userId: user.id,
        date: { gte: start, lte: end },
        status: { not: "CANCELLED" },
      },
      select: {
        id: true,
        date: true,
        startTime: true,
        endTime: true,
        status: true,
        sport: true,
        venueId: true,
        coachId: true,
      },
      orderBy: [{ date: "asc" }, { startTime: "asc" }],
    });

    // String-FK "populate": batch-load venues, coaches, and coach users, then
    // reattach under the original venueId/coachId keys (was Mongoose .populate).
    const venueIds = [
      ...new Set(rows.map((b) => b.venueId).filter((v): v is string => !!v)),
    ];
    const coachIds = [
      ...new Set(rows.map((b) => b.coachId).filter((c): c is string => !!c)),
    ];

    const venues = venueIds.length
      ? await prisma.venue.findMany({
          where: { id: { in: venueIds } },
          select: { id: true, name: true },
        })
      : [];
    const coaches = coachIds.length
      ? await prisma.coach.findMany({
          where: { id: { in: coachIds } },
          select: { id: true, userId: true },
        })
      : [];
    const coachUserIds = [...new Set(coaches.map((c) => c.userId))];
    const coachUsers = coachUserIds.length
      ? await prisma.user.findMany({
          where: { id: { in: coachUserIds } },
          select: { id: true, name: true },
        })
      : [];

    const venueById = new Map(venues.map((v) => [v.id, v]));
    const userById = new Map(coachUsers.map((u) => [u.id, u]));
    const coachById = new Map(
      coaches.map((c) => [
        c.id,
        { id: c.id, userId: userById.get(c.userId) ?? null },
      ]),
    );

    const bookings = rows.map((b) => ({
      ...b,
      venueId: b.venueId ? (venueById.get(b.venueId) ?? null) : null,
      coachId: b.coachId ? (coachById.get(b.coachId) ?? null) : null,
    }));

    res.json({ success: true, data: { bookings } });
  } catch (error) {
    console.error("[getCalendarBookings]", error);
    res
      .status(500)
      .json({ success: false, message: "Failed to fetch calendar bookings" });
  }
};

/**
 * GET /api/calendar/events?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD
 * Returns all personal calendar events for the user (optionally filtered by date range).
 */
export const getCalendarEvents = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const user = req.user;
    if (!user) {
      res.status(401).json({ success: false, message: "Unauthorized" });
      return;
    }

    const { startDate, endDate } = req.query as {
      startDate?: string;
      endDate?: string;
    };

    const where: Prisma.UserCalendarEventWhereInput = {
      userId: user.id,
    };

    if (startDate && endDate) {
      const start = new Date(startDate);
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      where.date = { gte: start, lte: end };
    }

    const events = await prisma.userCalendarEvent.findMany({
      where,
      orderBy: { date: "asc" },
    });

    res.json({ success: true, data: { events } });
  } catch (error) {
    console.error("[getCalendarEvents]", error);
    res
      .status(500)
      .json({ success: false, message: "Failed to fetch calendar events" });
  }
};

/**
 * POST /api/calendar/events
 * Create a new personal calendar event.
 */
export const createCalendarEvent = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const user = req.user;
    if (!user) {
      res.status(401).json({ success: false, message: "Unauthorized" });
      return;
    }

    const { title, date, color, type, notes } = req.body as {
      title?: string;
      date?: string;
      color?: string;
      type?: string;
      notes?: string;
    };

    if (!title?.trim() || !date) {
      res
        .status(400)
        .json({ success: false, message: "title and date are required" });
      return;
    }

    const parsedDate = new Date(date);
    if (isNaN(parsedDate.getTime())) {
      res.status(400).json({ success: false, message: "Invalid date" });
      return;
    }

    // Enforce per-user event cap to prevent unbounded growth
    const count = await prisma.userCalendarEvent.count({
      where: { userId: user.id },
    });
    if (count >= 200) {
      res
        .status(400)
        .json({
          success: false,
          message: "Maximum 200 calendar events allowed",
        });
      return;
    }

    const data: Prisma.UserCalendarEventCreateInput = {
      userId: user.id,
      title: title.trim().slice(0, 120),
      date: parsedDate,
      color: color ?? "#f97316",
      type: (type ?? "IMPORTANT") as CalendarEventType,
    };
    if (notes?.trim()) {
      data.notes = notes.trim().slice(0, 500);
    }

    const event = await prisma.userCalendarEvent.create({ data });

    res.status(201).json({
      success: true,
      message: "Event created",
      data: { event },
    });
  } catch (error) {
    console.error("[createCalendarEvent]", error);
    res
      .status(500)
      .json({ success: false, message: "Failed to create calendar event" });
  }
};

/**
 * PUT /api/calendar/events/:id
 * Update an existing personal calendar event (owner-scoped).
 */
export const updateCalendarEvent = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const user = req.user;
    if (!user) {
      res.status(401).json({ success: false, message: "Unauthorized" });
      return;
    }

    const { id } = req.params as { id: string };
    const { title, date, color, type, notes } = req.body as {
      title?: string;
      date?: string;
      color?: string;
      type?: string;
      notes?: string;
    };

    const update: Prisma.UserCalendarEventUpdateInput = {};
    if (title !== undefined) update.title = title.trim().slice(0, 120);
    if (date !== undefined) {
      const parsed = new Date(date);
      if (isNaN(parsed.getTime())) {
        res.status(400).json({ success: false, message: "Invalid date" });
        return;
      }
      update.date = parsed;
    }
    if (color !== undefined) update.color = color;
    if (type !== undefined) update.type = type as CalendarEventType;
    if (notes !== undefined) update.notes = notes?.trim().slice(0, 500) ?? "";

    // Owner-scoped: ensure the event belongs to the user before updating.
    const existing = await prisma.userCalendarEvent.findFirst({
      where: { id, userId: user.id },
      select: { id: true },
    });

    if (!existing) {
      res.status(404).json({ success: false, message: "Event not found" });
      return;
    }

    const event = await prisma.userCalendarEvent.update({
      where: { id },
      data: update,
    });

    res.json({ success: true, data: { event } });
  } catch (error) {
    console.error("[updateCalendarEvent]", error);
    res
      .status(500)
      .json({ success: false, message: "Failed to update calendar event" });
  }
};

/**
 * DELETE /api/calendar/events/:id
 * Delete a personal calendar event (owner-scoped).
 */
export const deleteCalendarEvent = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const user = req.user;
    if (!user) {
      res.status(401).json({ success: false, message: "Unauthorized" });
      return;
    }

    const { id } = req.params as { id: string };
    const result = await prisma.userCalendarEvent.deleteMany({
      where: { id, userId: user.id },
    });

    if (result.count === 0) {
      res.status(404).json({ success: false, message: "Event not found" });
      return;
    }

    res.json({ success: true, message: "Event deleted" });
  } catch (error) {
    console.error("[deleteCalendarEvent]", error);
    res
      .status(500)
      .json({ success: false, message: "Failed to delete calendar event" });
  }
};
