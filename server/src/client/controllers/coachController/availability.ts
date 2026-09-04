import { Request, Response } from "express";
import { Booking } from "../../models/Booking";
import {
  checkCoachAvailability,
  getCoachById,
  getCoachByUserId,
  updateCoach,
} from "../../services/CoachService";
import { doTimesOverlap } from "../../../utils/booking";
import { transformDocument } from "../../../middleware/responseTransform";
import { asyncHandler } from "../../../middleware/asyncHandler";
import { AppError } from "../../../utils/AppError";

/**
 * Update coach availability by sport
 * PUT /api/coaches/my-profile/availability
 */
export const updateMyCoachAvailability = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    if (!req.user?.id || req.user.role !== "Coach") {
      throw new AppError("Coach role required", 403);
    }

    const { availabilityBySport } = req.body as {
      availabilityBySport?: Record<
        string,
        Array<{ dayOfWeek: number; startTime: string; endTime: string }>
      >;
    };

    if (!availabilityBySport || typeof availabilityBySport !== "object") {
      throw new AppError("availabilityBySport is required", 400);
    }

    const coach = await getCoachByUserId(req.user.id);
    if (!coach) {
      throw new AppError("Coach profile not found", 404);
    }

    const normalizedBySport: Record<
      string,
      Array<{ dayOfWeek: number; startTime: string; endTime: string }>
    > = {};

    for (const [sport, slots] of Object.entries(availabilityBySport)) {
      normalizedBySport[sport] = (slots || [])
        .map((slot) => ({
          dayOfWeek: Number(slot.dayOfWeek),
          startTime: String(slot.startTime),
          endTime: String(slot.endTime),
        }))
        .filter(
          (slot) =>
            Number.isInteger(slot.dayOfWeek) &&
            slot.dayOfWeek >= 0 &&
            slot.dayOfWeek <= 6 &&
            /^([01]\d|2[0-3]):([0-5]\d)$/.test(slot.startTime) &&
            /^([01]\d|2[0-3]):([0-5]\d)$/.test(slot.endTime) &&
            slot.startTime < slot.endTime
        );
    }

    const seen = new Set<string>();
    const flattened = Object.values(normalizedBySport)
      .flat()
      .filter((slot) => {
        const key = `${slot.dayOfWeek}|${slot.startTime}|${slot.endTime}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });

    const coachId = (coach.id || coach._id.toString()) as string;
    const updated = await updateCoach(coachId, {
      availabilityBySport: normalizedBySport,
      availability: flattened,
    });

    res.status(200).json({
      success: true,
      message: "Availability updated successfully",
      data: transformDocument(updated?.toJSON()),
    });
  }
);

/**
 * Check coach availability
 * GET /api/coaches/availability/:coachId
 */
export const getCoachAvailability = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const coachId = (req.params as Record<string, unknown>).coachId as string;
    const { date, startTime, endTime, sport } = req.query;

    if (!date) {
      throw new AppError("date is required", 400);
    }

    if (startTime && endTime) {
      const available = await checkCoachAvailability(
        coachId,
        new Date(date as string),
        startTime as string,
        endTime as string
      );

      res.status(200).json({
        success: true,
        message: "Availability checked successfully",
        data: {
          available,
        },
      });
      return;
    }

    const coach = await getCoachById(coachId);
    if (!coach) {
      throw new AppError("Coach not found", 404);
    }

    const targetDate = new Date(date as string);
    if (isNaN(targetDate.getTime())) {
      throw new AppError("Invalid date format. Use YYYY-MM-DD.", 400);
    }
    const dayOfWeek = targetDate.getDay();
    const availabilityBySport = (coach as any).availabilityBySport as
      Record<string, Array<{ dayOfWeek: number; startTime: string; endTime: string }>> | undefined;

    const selectedSport = typeof sport === "string" ? sport : undefined;
    const sourceSlots =
      (selectedSport && availabilityBySport?.[selectedSport]) || coach.availability || [];

    const daySlots = sourceSlots.filter((slot) => slot.dayOfWeek === dayOfWeek);

    const toMinutes = (time: string) => {
      const [hh = "0", mm = "0"] = time.split(":");
      return Number(hh) * 60 + Number(mm);
    };

    const toTime = (minutes: number) => {
      const hrs = Math.floor(minutes / 60)
        .toString()
        .padStart(2, "0");
      const mins = (minutes % 60).toString().padStart(2, "0");
      return `${hrs}:${mins}`;
    };

    const candidateSlots: string[] = [];
    daySlots.forEach((slot) => {
      const startMinutes = toMinutes(slot.startTime);
      const endMinutes = toMinutes(slot.endTime);
      for (let current = startMinutes; current + 60 <= endMinutes; current += 60) {
        const start = toTime(current);
        const end = toTime(current + 60);
        candidateSlots.push(`${start}-${end}`);
      }
    });

    const activeBookings = await Booking.find({
      coachId,
      date: {
        $gte: new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate()),
        $lt: new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate() + 1),
      },
      status: {
        $in: [
          "AWAITING_PAYMENT",
          "AWAITING_PROVIDER",
          "PENDING_INVITES",
          "CONFIRMED",
          "IN_PROGRESS",
        ],
      },
    }).select("startTime endTime");

    const bookedSlots = activeBookings.map((booking) => ({
      startTime: booking.startTime,
      endTime: booking.endTime,
    }));

    const now = new Date();
    const isToday =
      targetDate.getFullYear() === now.getFullYear() &&
      targetDate.getMonth() === now.getMonth() &&
      targetDate.getDate() === now.getDate();

    const availableSlots = candidateSlots.filter((slot) => {
      const [slotStart = "00:00", slotEnd = "00:00"] = slot.split("-");

      // Filter out past time slots for today
      if (isToday) {
        const [startHour = "0", startMinute = "0"] = slotStart.split(":");
        const slotStartDateTime = new Date(targetDate);
        slotStartDateTime.setHours(parseInt(startHour, 10), parseInt(startMinute, 10), 0, 0);

        // If the slot has already started, don't show it
        if (slotStartDateTime <= now) {
          return false;
        }
      }

      return !bookedSlots.some((booked) =>
        doTimesOverlap(slotStart, slotEnd, booked.startTime, booked.endTime)
      );
    });

    res.status(200).json({
      success: true,
      message: "Availability retrieved successfully",
      data: {
        availableSlots,
        bookedSlots,
      },
    });
  }
);
