import { Booking, BookingDocument } from "../models/Booking";
import { Venue } from "../models/Venue";
import { Coach } from "../models/Coach";
import { User } from "../models/User";
import { doTimesOverlap } from "../utils/booking";
import {
  calculateSplitAmounts,
  validatePaymentStatus,
  generateMockPaymentLink,
} from "../utils/payment";
import { getBookingExpirationTime } from "../utils/timer";
import { generateQRCode, generateVerificationURL } from "../utils/qrcode";
import { v4 as uuidv4 } from "uuid";

export interface InitiateBookingPayload {
  userId: string;
  venueId: string;
  coachId?: string;
  date: Date;
  startTime: string;
  endTime: string;
}

export interface InitiateBookingResponse {
  booking: BookingDocument;
  paymentLinks: Array<{
    userId: string;
    userType: "VENUE_LISTER" | "COACH";
    amount: number;
    paymentLink: string;
  }>;
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
    status: { $in: ["PENDING_PAYMENT", "CONFIRMED"] },
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
 * Initiate a new booking with split payments
 * This creates the booking in PENDING_PAYMENT status and generates payment links
 */
export const initiateBooking = async (
  payload: InitiateBookingPayload,
): Promise<InitiateBookingResponse> => {
  try {
    // Fetch venue to get price and owner
    const venue = await Venue.findById(payload.venueId).populate("ownerId");
    if (!venue) {
      throw new Error("Venue not found");
    }

    // Check if slot is available for venue
    const venueAvailable = await isSlotAvailable(
      payload.venueId,
      payload.date,
      payload.startTime,
      payload.endTime,
    );

    if (!venueAvailable) {
      throw new Error("Selected time slot is already booked for this venue");
    }

    // Calculate venue price
    const startParts = payload.startTime.split(":");
    const endParts = payload.endTime.split(":");
    const startHour = parseInt(startParts[0] || "0", 10);
    const endHour = parseInt(endParts[0] || "0", 10);
    const hours = endHour - startHour;
    const venuePrice = hours * venue.pricePerHour;

    let coachPrice = 0;
    let coachUserId: string | undefined;

    // If coach is requested, validate and calculate coach price
    if (payload.coachId) {
      const coach = await Coach.findById(payload.coachId).populate("userId");
      if (!coach) {
        throw new Error("Coach not found");
      }

      // Check if venue allows external coaches
      if (coach.serviceMode !== "OWN_VENUE" && !venue.allowExternalCoaches) {
        throw new Error("This venue does not allow external coaches");
      }

      // Check coach availability (imported from CoachService logic)
      const coachAvailable = await checkCoachAvailabilityForBooking(
        payload.coachId,
        payload.date,
        payload.startTime,
        payload.endTime,
      );

      if (!coachAvailable) {
        throw new Error("Coach is not available for the selected time slot");
      }

      coachPrice = hours * coach.hourlyRate;
      coachUserId = (coach.userId as any)._id.toString();
    }

    // Calculate split payments
    const venueOwnerId = (venue.ownerId as any)._id.toString();
    const payments = calculateSplitAmounts(
      venuePrice,
      venueOwnerId,
      coachPrice > 0 ? coachPrice : undefined,
      coachUserId,
    );

    // Generate payment links for each payment
    const paymentLinks = payments.map((payment) => ({
      userId: payment.userId,
      userType: payment.userType,
      amount: payment.amount,
      paymentLink: generateMockPaymentLink(
        payment.userId,
        payment.amount,
        "temp-booking-id", // Will be updated after booking is created
      ),
    }));

    // Add payment links to payments
    payments.forEach((payment, index) => {
      const link = paymentLinks[index]?.paymentLink;
      if (link) {
        payment.paymentLink = link;
      }
    });

    // Create booking
    const booking = new Booking({
      userId: payload.userId,
      venueId: payload.venueId,
      coachId: payload.coachId,
      date: payload.date,
      startTime: payload.startTime,
      endTime: payload.endTime,
      payments,
      totalAmount: venuePrice + coachPrice,
      status: "PENDING_PAYMENT",
      expiresAt: getBookingExpirationTime(),
    });

    await booking.save();

    // Update payment links with actual booking ID
    const updatedPaymentLinks = paymentLinks.map((link) => ({
      ...link,
      paymentLink: generateMockPaymentLink(
        link.userId,
        link.amount,
        booking._id.toString(),
      ),
    }));

    // Update booking with correct payment links
    booking.payments.forEach((payment, index) => {
      const link = updatedPaymentLinks[index]?.paymentLink;
      if (link) {
        payment.paymentLink = link;
      }
    });
    await booking.save();

    return {
      booking,
      paymentLinks: updatedPaymentLinks,
    };
  } catch (error) {
    throw new Error(
      `Failed to initiate booking: ${error instanceof Error ? error.message : "Unknown error"}`,
    );
  }
};

/**
 * Update payment status for a specific payment in a booking
 * If all payments are complete, generate QR code and confirm booking
 */
export const updatePaymentStatus = async (
  bookingId: string,
  userId: string,
  status: "PAID",
): Promise<BookingDocument> => {
  try {
    const booking = await Booking.findById(bookingId);
    if (!booking) {
      throw new Error("Booking not found");
    }

    // Check if booking has expired
    if (booking.status === "EXPIRED") {
      throw new Error("Booking has expired");
    }

    if (new Date() > booking.expiresAt) {
      booking.status = "EXPIRED";
      await booking.save();
      throw new Error("Booking has expired");
    }

    // Find the payment for this user
    const payment = booking.payments.find(
      (p) => p.userId.toString() === userId,
    );
    if (!payment) {
      throw new Error("Payment not found for this user");
    }

    // Update payment status
    payment.status = status;
    payment.paidAt = new Date();

    // Check if all payments are complete
    if (validatePaymentStatus(booking.payments)) {
      // All payments complete - confirm booking and generate QR code
      booking.status = "CONFIRMED";

      // Generate verification token
      const verificationToken = uuidv4();
      booking.verificationToken = verificationToken;

      // Generate QR code with verification URL
      const verificationURL = generateVerificationURL(verificationToken);
      const qrCodeDataURL = await generateQRCode(verificationURL);
      booking.qrCode = qrCodeDataURL;
    }

    await booking.save();
    return booking;
  } catch (error) {
    throw new Error(
      `Failed to update payment status: ${error instanceof Error ? error.message : "Unknown error"}`,
    );
  }
};

/**
 * Get all bookings for a user
 */
export const getUserBookings = async (
  userId: string,
): Promise<BookingDocument[]> => {
  return Booking.find({ userId })
    .populate("venueId coachId")
    .sort({ date: -1 });
};

/**
 * Get all bookings for a venue (for venue owners)
 */
export const getVenueBookings = async (
  venueId: string,
): Promise<BookingDocument[]> => {
  return Booking.find({
    venueId,
    status: { $in: ["PENDING_PAYMENT", "CONFIRMED"] },
  })
    .populate("userId coachId")
    .sort({ date: 1 });
};

/**
 * Get all bookings for a venue lister (across all their venues)
 */
export const getVenueListerBookings = async (
  ownerId: string,
): Promise<BookingDocument[]> => {
  // Find all venues owned by this user
  const venues = await Venue.find({ ownerId });
  const venueIds = venues.map((v) => v._id);

  // Find all bookings for these venues
  return Booking.find({
    venueId: { $in: venueIds },
    status: { $in: ["PENDING_PAYMENT", "CONFIRMED"] },
  })
    .populate("userId venueId coachId")
    .sort({ date: -1 });
};

/**
 * Cancel a booking
 */
export const cancelBooking = async (
  bookingId: string,
): Promise<BookingDocument | null> => {
  return Booking.findByIdAndUpdate(
    bookingId,
    { status: "CANCELLED" },
    { new: true },
  );
};

/**
 * Verify a booking using verification token
 */
export const verifyBooking = async (
  verificationToken: string,
): Promise<BookingDocument | null> => {
  return Booking.findOne({ verificationToken })
    .select("+verificationToken")
    .populate("userId venueId coachId");
};

/**
 * Helper function to check coach availability (duplicated from CoachService to avoid circular dependency)
 */
const checkCoachAvailabilityForBooking = async (
  coachId: string,
  date: Date,
  startTime: string,
  endTime: string,
): Promise<boolean> => {
  const coach = await Coach.findById(coachId);
  if (!coach) return false;

  // Check day availability
  const dayOfWeek = date.getDay();
  const dayAvailability = coach.availability.find(
    (a) => a.dayOfWeek === dayOfWeek,
  );

  if (!dayAvailability) return false;

  if (
    startTime < dayAvailability.startTime ||
    endTime > dayAvailability.endTime
  ) {
    return false;
  }

  // Check for existing bookings
  const existingBooking = await Booking.findOne({
    coachId,
    date: {
      $gte: new Date(date.getFullYear(), date.getMonth(), date.getDate()),
      $lt: new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1),
    },
    status: { $in: ["PENDING_PAYMENT", "CONFIRMED"] },
    $or: [
      { startTime: { $lte: startTime }, endTime: { $gt: startTime } },
      { startTime: { $lt: endTime }, endTime: { $gte: endTime } },
      { startTime: { $gte: startTime }, endTime: { $lte: endTime } },
    ],
  });

  return !existingBooking;
};

// Legacy function for backward compatibility
export const createBooking = initiateBooking;
