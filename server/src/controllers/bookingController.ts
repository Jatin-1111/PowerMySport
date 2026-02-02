import { Request, Response } from "express";
import {
  createBooking,
  getUserBookings,
  getVenueBookings,
  cancelBooking,
} from "../services/BookingService";
import { generateHourlySlots } from "../utils/booking";

export const createNewBooking = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    if (!req.user?.id) {
      res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
      return;
    }

    const booking = await createBooking({
      userId: req.user.id,
      ...req.body,
      date: new Date(req.body.date),
    });

    res.status(201).json({
      success: true,
      message: "Booking created successfully",
      data: booking,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message:
        error instanceof Error ? error.message : "Failed to create booking",
    });
  }
};

export const getMyBookings = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    if (!req.user?.id) {
      res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
      return;
    }

    const bookings = await getUserBookings(req.user.id);

    res.status(200).json({
      success: true,
      message: "Bookings retrieved successfully",
      data: bookings,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message:
        error instanceof Error ? error.message : "Failed to fetch bookings",
    });
  }
};

export const getVenueAvailability = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const venueId = (req.params as Record<string, unknown>).venueId as string;
    const { date } = req.query;

    if (!date) {
      res.status(400).json({
        success: false,
        message: "Date parameter is required",
      });
      return;
    }

    // Get all bookings for this venue on the specified date
    const bookings = await getVenueBookings(venueId);
    const bookedSlots = bookings
      .filter(
        (b) =>
          new Date(b.date).toDateString() ===
          new Date(date as string).toDateString(),
      )
      .map((b) => ({
        startTime: b.startTime,
        endTime: b.endTime,
      }));

    const allSlots = generateHourlySlots(6, 23);
    const availableSlots = allSlots.filter((slot) => {
      const slotParts = slot.split(":");
      const slotHour = parseInt(slotParts[0] || "0", 10);
      const nextHour = String(slotHour + 1).padStart(2, "0") + ":00";

      return !bookedSlots.some((booked) => {
        return (
          (slot >= booked.startTime && slot < booked.endTime) ||
          (nextHour > booked.startTime && nextHour <= booked.endTime)
        );
      });
    });

    res.status(200).json({
      success: true,
      message: "Availability retrieved successfully",
      data: {
        availableSlots,
        bookedSlots,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message:
        error instanceof Error ? error.message : "Failed to fetch availability",
    });
  }
};

export const cancelBookingById = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const bookingId = (req.params as Record<string, unknown>)
      .bookingId as string;

    const booking = await cancelBooking(bookingId);

    if (!booking) {
      res.status(404).json({
        success: false,
        message: "Booking not found",
      });
      return;
    }

    res.status(200).json({
      success: true,
      message: "Booking cancelled successfully",
      data: booking,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message:
        error instanceof Error ? error.message : "Failed to cancel booking",
    });
  }
};
