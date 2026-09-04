import { Request, Response } from "express";
import mongoose from "mongoose";
import { Booking } from "../models/Booking";
import { UserCalendarEvent } from "../models/UserCalendarEvent";
import { asyncHandler } from "../../middleware/asyncHandler";
import { AppError } from "../../utils/AppError";

/**
 * GET /api/calendar/bookings?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD
 * Returns all non-cancelled bookings for the authenticated user in the given date range.
 * Optimised for calendar dot rendering — only selects fields needed for the UI.
 */
export const getCalendarBookings = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const user = req.user;
    if (!user) {
      throw new AppError("Unauthorized", 401);
    }

    const { startDate, endDate } = req.query as {
      startDate?: string;
      endDate?: string;
    };

    if (!startDate || !endDate) {
      throw new AppError("startDate and endDate are required", 400);
    }

    const start = new Date(startDate);
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      throw new AppError("Invalid date format", 400);
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
  }
);

/**
 * GET /api/calendar/events?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD
 * Returns all personal calendar events for the user (optionally filtered by date range).
 */
export const getCalendarEvents = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const user = req.user;
    if (!user) {
      throw new AppError("Unauthorized", 401);
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
  }
);

/**
 * POST /api/calendar/events
 * Create a new personal calendar event.
 */
export const createCalendarEvent = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const user = req.user;
    if (!user) {
      throw new AppError("Unauthorized", 401);
    }

    const { title, date, color, type, notes } = req.body as {
      title?: string;
      date?: string;
      color?: string;
      type?: string;
      notes?: string;
    };

    if (!title?.trim() || !date) {
      throw new AppError("title and date are required", 400);
    }

    const parsedDate = new Date(date);
    if (isNaN(parsedDate.getTime())) {
      throw new AppError("Invalid date", 400);
    }

    // Enforce per-user event cap to prevent unbounded growth
    const count = await UserCalendarEvent.countDocuments({
      userId: new mongoose.Types.ObjectId(user.id),
    });
    if (count >= 200) {
      throw new AppError("Maximum 200 calendar events allowed", 400);
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
  }
);

/**
 * PUT /api/calendar/events/:id
 * Update an existing personal calendar event (owner-scoped).
 */
export const updateCalendarEvent = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const user = req.user;
    if (!user) {
      throw new AppError("Unauthorized", 401);
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
        throw new AppError("Invalid date", 400);
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
      { new: true, runValidators: true }
    );

    if (!event) {
      throw new AppError("Event not found", 404);
    }

    res.json({ success: true, data: { event: (event as any).toJSON() } });
  }
);

/**
 * DELETE /api/calendar/events/:id
 * Delete a personal calendar event (owner-scoped).
 */
export const deleteCalendarEvent = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const user = req.user;
    if (!user) {
      throw new AppError("Unauthorized", 401);
    }

    const { id } = req.params as { id: string };
    const event = await UserCalendarEvent.findOneAndDelete({
      _id: new mongoose.Types.ObjectId(id),
      userId: new mongoose.Types.ObjectId(user.id),
    } as any);

    if (!event) {
      throw new AppError("Event not found", 404);
    }

    res.json({ success: true, message: "Event deleted" });
  }
);
