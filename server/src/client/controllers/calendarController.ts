import { Request, Response } from "express";
import mongoose from "mongoose";
import { Booking } from "../models/Booking";
import { UserCalendarEvent } from "../models/UserCalendarEvent";

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
        .json({ success: false, message: "startDate and endDate are required" });
      return;
    }

    const start = new Date(startDate);
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      res.status(400).json({ success: false, message: "Invalid date format" });
      return;
    }

    const bookings = await Booking.find({
      userId: new mongoose.Types.ObjectId(user.id),
      date: { $gte: start, $lte: end },
      status: { $nin: ["CANCELLED"] },
    })
      .select("date startTime endTime status sport venueId coachId")
      .populate("venueId", "name")
      .populate({
        path: "coachId",
        populate: { path: "userId", select: "name" },
      })
      .sort({ date: 1, startTime: 1 })
      .lean();

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

    // Use a plain object filter to avoid FilterQuery generic complexity
    const filter: Record<string, unknown> = {
      userId: new mongoose.Types.ObjectId(user.id),
    };

    if (startDate && endDate) {
      const start = new Date(startDate);
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      filter.date = { $gte: start, $lte: end };
    }

    const events = await UserCalendarEvent.find(filter as any)
      .sort({ date: 1 })
      .lean();

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
    const count = await UserCalendarEvent.countDocuments({
      userId: new mongoose.Types.ObjectId(user.id),
    });
    if (count >= 200) {
      res
        .status(400)
        .json({ success: false, message: "Maximum 200 calendar events allowed" });
      return;
    }

    const payload: Record<string, unknown> = {
      userId: new mongoose.Types.ObjectId(user.id),
      title: title.trim().slice(0, 120),
      date: parsedDate,
      color: color ?? "#f97316",
      type: type ?? "IMPORTANT",
    };
    if (notes?.trim()) {
      payload.notes = notes.trim().slice(0, 500);
    }

    const event = await UserCalendarEvent.create(payload);

    res.status(201).json({
      success: true,
      message: "Event created",
      data: { event: (event as any).toJSON() },
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

    const update: Record<string, unknown> = {};
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
    if (type !== undefined) update.type = type;
    if (notes !== undefined) update.notes = notes?.trim().slice(0, 500) ?? "";

    const event = await UserCalendarEvent.findOneAndUpdate(
      {
        _id: new mongoose.Types.ObjectId(id),
        userId: new mongoose.Types.ObjectId(user.id),
      } as any,
      update,
      { new: true, runValidators: true },
    );

    if (!event) {
      res.status(404).json({ success: false, message: "Event not found" });
      return;
    }

    res.json({ success: true, data: { event: (event as any).toJSON() } });
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
    const event = await UserCalendarEvent.findOneAndDelete({
      _id: new mongoose.Types.ObjectId(id),
      userId: new mongoose.Types.ObjectId(user.id),
    } as any);

    if (!event) {
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
