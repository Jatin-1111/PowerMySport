import { Booking, BookingDocument } from "../models/Booking";
import { Venue } from "../models/Venue";
import { doTimesOverlap } from "../utils/booking";

export interface CreateBookingPayload {
  userId: string;
  venueId: string;
  date: Date;
  startTime: string;
  endTime: string;
}

/**
 * Check if a time slot is available for a venue
 */
export const isSlotAvailable = async (
  venueId: string,
  date: Date,
  startTime: string,
  endTime: string,
): Promise<boolean> => {
  const existingBooking = await Booking.findOne({
    venueId,
    date: {
      $gte: new Date(date.getFullYear(), date.getMonth(), date.getDate()),
      $lt: new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1),
    },
    status: "confirmed",
  });

  if (!existingBooking) {
    return true;
  }

  // Check for time overlap
  return !doTimesOverlap(
    startTime,
    endTime,
    existingBooking.startTime,
    existingBooking.endTime,
  );
};

/**
 * Create a new booking with conflict prevention
 */
export const createBooking = async (
  payload: CreateBookingPayload,
): Promise<BookingDocument> => {
  // Fetch venue to get price
  const venue = await Venue.findById(payload.venueId);
  if (!venue) {
    throw new Error("Venue not found");
  }

  // Check if slot is available
  const available = await isSlotAvailable(
    payload.venueId,
    payload.date,
    payload.startTime,
    payload.endTime,
  );

  if (!available) {
    throw new Error("Selected time slot is already booked");
  }

  // Calculate total amount (simple: 1 hour = 1 slot)
  const startParts = payload.startTime.split(":");
  const endParts = payload.endTime.split(":");
  const startHour = parseInt(startParts[0] || "0", 10);
  const endHour = parseInt(endParts[0] || "0", 10);
  const hours = endHour - startHour;
  const totalAmount = hours * venue.pricePerHour;

  const booking = new Booking({
    ...payload,
    totalAmount,
  });

  await booking.save();
  return booking;
};

/**
 * Get all bookings for a user
 */
export const getUserBookings = async (
  userId: string,
): Promise<BookingDocument[]> => {
  return Booking.find({ userId }).populate("venueId").sort({ date: -1 });
};

/**
 * Get all bookings for a venue (for vendors)
 */
export const getVenueBookings = async (
  venueId: string,
): Promise<BookingDocument[]> => {
  return Booking.find({ venueId, status: "confirmed" })
    .populate("userId")
    .sort({ date: 1 });
};

/**
 * Cancel a booking
 */
export const cancelBooking = async (
  bookingId: string,
): Promise<BookingDocument | null> => {
  return Booking.findByIdAndUpdate(
    bookingId,
    { status: "cancelled" },
    { new: true },
  );
};
