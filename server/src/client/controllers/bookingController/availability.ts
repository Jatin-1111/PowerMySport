import { Request, Response } from "express";
import { Venue } from "../../models/Venue";
import {
  createBookingWaitlistEntry,
  getAlternateVenueSlots,
  getVenueBookingsForDate,
  validatePromoCodeForUser,
} from "../../services/BookingService";
import { computeBookingFees } from "../../services/PricingRates";
import { generateDynamicSlots } from "../../../utils/booking";
import {
  isWithinOpeningHours,
  combineDateAndTimeIST,
  IST_OFFSET_MINUTES,
} from "../../../utils/openingHours";
import { asyncHandler } from "../../../middleware/asyncHandler";
import { AppError } from "../../../utils/AppError";

/**
 * Get venue availability
 * GET /api/bookings/availability/:venueId
 */
export const getVenueAvailability = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const venueId = (req.params as Record<string, unknown>).venueId as string;
    const { date } = req.query;

    if (!date) {
      throw new AppError("Date parameter is required", 400);
    }

    const venue = await Venue.findById(venueId).select("openingHours");
    if (!venue) {
      throw new AppError("Venue not found", 404);
    }

    // Get all bookings for this venue on the specified date
    const bookedSlots = await getVenueBookingsForDate(venueId, new Date(date as string));

    // Map to simple {startTime, endTime} objects if not already (select already does partial)
    // But result is Mongoose documents, safest to map explicitly just in case
    const bookedTimeSlots = bookedSlots.map((b) => ({
      startTime: b.startTime,
      endTime: b.endTime,
    }));

    const targetDate = new Date(date as string);
    const dayNames = [
      "sunday",
      "monday",
      "tuesday",
      "wednesday",
      "thursday",
      "friday",
      "saturday",
    ] as const;
    // targetDate is UTC-midnight-anchored (parsed from "YYYY-MM-DD") — use
    // the UTC day-of-week so this is correct regardless of the server
    // process's local timezone (see openingHours.ts for the same fix).
    const dayName = dayNames[targetDate.getUTCDay()];
    const dayHours = dayName ? venue.openingHours?.[dayName] : null;

    let allSlots: string[] = [];

    if (dayHours?.isOpen && dayHours.openTime && dayHours.closeTime) {
      const [openHourRaw, openMinuteRaw] = dayHours.openTime.split(":");
      const [closeHourRaw, closeMinuteRaw] = dayHours.closeTime.split(":");
      const openHour = parseInt(openHourRaw || "0", 10);
      const openMinute = parseInt(openMinuteRaw || "0", 10);
      const closeHour = parseInt(closeHourRaw || "0", 10);
      const closeMinute = parseInt(closeMinuteRaw || "0", 10);

      const slotStartHour = Number.isFinite(openHour) ? openHour : 0;
      const slotEndHour = (Number.isFinite(closeHour) ? closeHour : 0) + (closeMinute > 0 ? 1 : 0);

      const intervalMinutes = (venue as any).minimumBookingDuration || 60;
      allSlots = generateDynamicSlots(slotStartHour, slotEndHour, intervalMinutes).filter(
        (slot) => {
          const slotHour = parseInt(slot.split(":")[0] || "0", 10);
          const slotMin = parseInt(slot.split(":")[1] || "0", 10);

          let endMin = slotMin + intervalMinutes;
          let endHour = slotHour + Math.floor(endMin / 60);
          endMin = endMin % 60;

          const slotEnd = `${String(endHour).padStart(2, "0")}:${String(endMin).padStart(2, "0")}`;
          return isWithinOpeningHours(targetDate, slot, slotEnd, venue.openingHours).isValid;
        }
      );
    }

    const now = new Date();
    // "Today" in IST terms, not the server's local date — a slot's date and
    // "now" are compared as real UTC instants below regardless.
    const nowIstDateKey = new Date(now.getTime() + IST_OFFSET_MINUTES * 60 * 1000)
      .toISOString()
      .slice(0, 10);
    const targetIstDateKey = targetDate.toISOString().slice(0, 10);
    const isToday = nowIstDateKey === targetIstDateKey;

    const availableSlots = allSlots.filter((slot) => {
      const slotParts = slot.split(":");
      const slotHour = parseInt(slotParts[0] || "0", 10);
      const nextHour = String(slotHour + 1).padStart(2, "0") + ":00";

      if (isToday) {
        const slotStart = combineDateAndTimeIST(targetDate, slot);

        if (slotStart <= now) {
          return false;
        }
      }

      return !bookedTimeSlots.some((booked) => {
        return (
          (slot >= booked.startTime && slot < booked.endTime) ||
          (nextHour > booked.startTime && nextHour <= booked.endTime)
        );
      });
    });

    const preferredStart =
      typeof req.query.preferredStartTime === "string" ? req.query.preferredStartTime : "";
    const preferredEnd =
      typeof req.query.preferredEndTime === "string" ? req.query.preferredEndTime : "";
    const alternateSlots =
      preferredStart && preferredEnd
        ? getAlternateVenueSlots(bookedTimeSlots, preferredStart, preferredEnd, 4)
        : [];

    res.status(200).json({
      success: true,
      message: "Availability retrieved successfully",
      data: {
        availableSlots,
        bookedSlots,
        alternateSlots,
      },
    });
  }
);

/**
 * The authoritative fee breakdown for a booking subtotal.
 *
 * The client used to compute the service fee and tax itself from
 * `NEXT_PUBLIC_*` rates — a second, independently-configured copy of numbers
 * this server owns. The two agreed only by luck, and a change to one without
 * the other would quote a price the API then refused to honour. Now the client
 * displays what this returns, so there is one source for what a customer is
 * shown and what they are charged.
 */
export const getBookingQuote = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { subtotal, discount } = req.body as {
    subtotal: number;
    discount?: number;
  };

  if (!Number.isFinite(subtotal) || subtotal < 0) {
    throw new AppError("A non-negative subtotal is required", 400);
  }

  const safeDiscount = Number.isFinite(discount) && (discount ?? 0) > 0 ? (discount as number) : 0;

  res.status(200).json({
    success: true,
    data: computeBookingFees(subtotal, safeDiscount),
  });
});

export const validateBookingPromoCode = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    if (!req.user?.id) {
      throw new AppError("Unauthorized", 401);
    }

    const { code, subtotal, hasCoach } = req.body as {
      code: string;
      subtotal: number;
      hasCoach?: boolean;
    };

    const result = await validatePromoCodeForUser(code, req.user.id, subtotal, Boolean(hasCoach));

    res.status(200).json({
      success: true,
      message: result.message || "Promo validated",
      data: result,
    });
  }
);

export const joinBookingWaitlist = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    if (!req.user?.id) {
      throw new AppError("Unauthorized", 401);
    }

    const { venueId, coachId, sport, date, startTime, endTime, alternateSlots } = req.body as {
      venueId?: string;
      coachId?: string;
      sport: string;
      date: string;
      startTime: string;
      endTime: string;
      alternateSlots?: string[];
    };

    const entry = await createBookingWaitlistEntry({
      userId: req.user.id,
      ...(venueId ? { venueId } : {}),
      ...(coachId ? { coachId } : {}),
      sport,
      date: new Date(date),
      startTime,
      endTime,
      ...(Array.isArray(alternateSlots) ? { alternateSlots } : {}),
    });

    res.status(201).json({
      success: true,
      message: "Added to waitlist successfully",
      data: {
        id: entry._id.toString(),
        status: entry.status,
      },
    });
  }
);
