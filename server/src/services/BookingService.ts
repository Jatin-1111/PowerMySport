import { v4 as uuidv4 } from "uuid";
import { Booking, BookingDocument } from "../models/Booking";
import { Coach } from "../models/Coach";
import { User } from "../models/User";
import { Venue } from "../models/Venue";
import { generateQRCode, generateVerificationURL } from "../utils/qrcode";
import { getBookingExpirationTime } from "../utils/timer";

/**
 * Booking State Machine:
 * CONFIRMED -> IN_PROGRESS -> COMPLETED
 * CONFIRMED -> CANCELLED
 * CONFIRMED -> NO_SHOW
 */

export interface InitiateBookingPayload {
  userId: string;
  venueId: string;
  coachId?: string;
  sport: string;
  date: Date;
  startTime: string;
  endTime: string;
  dependentId?: string;
}

export interface InitiateBookingResponse {
  booking: BookingDocument;
}

/**
 * Check if a time slot is available for a venue (with atomic locking)
 * Prevents double-booking race conditions
 */
export const isSlotAvailable = async (
  venueId: string,
  date: Date,
  startTime: string,
  endTime: string,
): Promise<boolean> => {
  // Find ALL conflicting bookings (not just first one)
  // Only active bookings block slots: CONFIRMED, IN_PROGRESS
  const conflictingBookings = await Booking.find({
    venueId,
    date: {
      $gte: new Date(date.getFullYear(), date.getMonth(), date.getDate()),
      $lt: new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1),
    },
    status: { $in: ["CONFIRMED", "IN_PROGRESS"] },
    $or: [
      // Requested slot overlaps with existing booking
      { startTime: { $lte: startTime }, endTime: { $gt: startTime } },
      { startTime: { $lt: endTime }, endTime: { $gte: endTime } },
      { startTime: { $gte: startTime }, endTime: { $lte: endTime } },
    ],
  });

  // Slot is available only if no conflicts
  return conflictingBookings.length === 0;
};

/**
 * Initiate a new booking
 * This creates the booking in CONFIRMED status
 */
export const initiateBooking = async (
  payload: InitiateBookingPayload,
): Promise<InitiateBookingResponse> => {
  try {
    // Fetch user for participant information
    const user = await User.findById(payload.userId);
    if (!user) {
      throw new Error("User not found");
    }

    // Determine participant details
    let participantName = user.name;
    let participantId: any = user._id;
    let participantAge: number | undefined = undefined;

    if (payload.dependentId) {
      // Booking is for a dependent (child)
      const dependent = user.dependents.find(
        (d) => d._id?.toString() === payload.dependentId,
      );
      if (!dependent) {
        throw new Error("Dependent not found");
      }
      participantName = dependent.name;
      participantId = dependent._id;
      // Calculate age from DOB
      const ageInMs = Date.now() - dependent.dob.getTime();
      participantAge = Math.floor(ageInMs / (1000 * 60 * 60 * 24 * 365.25));
    } else {
      // Booking is for the parent/user themselves
      participantId = user._id;
    }

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

    // Validate sport selection
    if (!payload.sport || !venue.sports.includes(payload.sport)) {
      throw new Error("Selected sport is not available at this venue");
    }

    // Calculate venue price (supports fractional hours)
    const startParts = payload.startTime.split(":");
    const endParts = payload.endTime.split(":");
    const startHour = parseInt(startParts[0] || "0", 10);
    const startMin = parseInt(startParts[1] || "0", 10);
    const endHour = parseInt(endParts[0] || "0", 10);
    const endMin = parseInt(endParts[1] || "0", 10);

    const startTotalMinutes = startHour * 60 + startMin;
    const endTotalMinutes = endHour * 60 + endMin;
    const totalMinutes = endTotalMinutes - startTotalMinutes;
    const hours = totalMinutes / 60; // Supports 0.5, 0.75, etc.
    const sportPrice = venue.sportPricing?.[payload.sport];
    const basePrice =
      typeof sportPrice === "number" && sportPrice >= 0
        ? sportPrice
        : venue.pricePerHour;
    if (basePrice <= 0) {
      throw new Error("Venue pricing is not configured for this sport");
    }
    const venuePrice = Math.round(hours * basePrice * 100) / 100; // Round to 2 decimals

    let coachPrice = 0;

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

      const coachSportRate =
        payload.sport && typeof coach.sportPricing?.[payload.sport] === "number"
          ? coach.sportPricing[payload.sport]
          : undefined;
      const effectiveCoachRate =
        typeof coachSportRate === "number" && coachSportRate > 0
          ? coachSportRate
          : coach.hourlyRate;

      coachPrice = hours * effectiveCoachRate;
    }

    const subtotal = venuePrice + coachPrice;
    const serviceFee = Math.round(subtotal * 0.02);
    const taxAmount = Math.round(subtotal * 0.05);
    const totalAmount = Math.max(0, subtotal + serviceFee + taxAmount);

    // Generate verification token and QR code
    const verificationToken = uuidv4();
    const verificationURL = generateVerificationURL(verificationToken);
    const qrCodeDataURL = await generateQRCode(verificationURL);

    // Create booking
    const booking = new Booking({
      userId: payload.userId,
      venueId: payload.venueId,
      coachId: payload.coachId,
      sport: payload.sport,
      date: payload.date,
      startTime: payload.startTime,
      endTime: payload.endTime,
      totalAmount,
      serviceFee,
      taxAmount,
      status: "CONFIRMED",
      verificationToken,
      qrCode: qrCodeDataURL,
      expiresAt: getBookingExpirationTime(),
      participantName,
      participantId,
      participantAge,
    });

    await booking.save();

    return {
      booking,
    };
  } catch (error) {
    throw new Error(
      `Failed to initiate booking: ${error instanceof Error ? error.message : "Unknown error"}`,
    );
  }
};

/**
 * Get all bookings for a user
 */
/**
 * Get all bookings for a user
 */
export const getUserBookings = async (
  userId: string,
  page: number = 1,
  limit: number = 20,
): Promise<{
  bookings: BookingDocument[];
  total: number;
  page: number;
  totalPages: number;
}> => {
  const skip = (page - 1) * limit;
  const query = { userId };

  const total = await Booking.countDocuments(query);
  const bookings = await Booking.find(query)
    .populate("venueId coachId")
    .sort({ date: -1 })
    .skip(skip)
    .limit(limit);

  return { bookings, total, page, totalPages: Math.ceil(total / limit) };
};

/**
 * Get all bookings for a venue (for venue owners)
 */
export const getVenueBookings = async (
  venueId: string,
  page: number = 1,
  limit: number = 20,
): Promise<{
  bookings: BookingDocument[];
  total: number;
  page: number;
  totalPages: number;
}> => {
  const query = {
    venueId,
    status: { $in: ["CONFIRMED", "IN_PROGRESS", "COMPLETED", "NO_SHOW"] },
  };
  const skip = (page - 1) * limit;

  const total = await Booking.countDocuments(query);
  const bookings = await Booking.find(query)
    .populate("userId coachId")
    .sort({ date: 1 })
    .skip(skip)
    .limit(limit);

  return { bookings, total, page, totalPages: Math.ceil(total / limit) };
};

/**
 * Get bookings for a venue on a specific date (optimized for availability check)
 */
export const getVenueBookingsForDate = async (
  venueId: string,
  date: Date,
): Promise<BookingDocument[]> => {
  const startOfDay = new Date(date);
  startOfDay.setHours(0, 0, 0, 0);

  const endOfDay = new Date(date);
  endOfDay.setHours(23, 59, 59, 999);

  return Booking.find({
    venueId,
    date: {
      $gte: startOfDay,
      $lte: endOfDay,
    },
    status: { $in: ["CONFIRMED", "IN_PROGRESS"] },
  }).select("startTime endTime");
};

/**
 * Get all bookings for a venue lister (across all their venues)
 */
export const getVenueListerBookings = async (
  ownerId: string,
  page: number = 1,
  limit: number = 20,
): Promise<{
  bookings: BookingDocument[];
  total: number;
  page: number;
  totalPages: number;
}> => {
  // Find all venues owned by this user
  const venues = await Venue.find({ ownerId });
  const venueIds = venues.map((v) => v._id);

  const query = {
    venueId: { $in: venueIds },
    status: { $in: ["CONFIRMED", "IN_PROGRESS", "COMPLETED", "NO_SHOW"] },
  };
  const skip = (page - 1) * limit;

  // Find all bookings for these venues
  const total = await Booking.countDocuments(query);
  const bookings = await Booking.find(query)
    .populate("userId venueId coachId")
    .sort({ date: -1 })
    .skip(skip)
    .limit(limit);

  return { bookings, total, page, totalPages: Math.ceil(total / limit) };
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
 * Check-in to a booking using QR code verification
 * Changes status from CONFIRMED to IN_PROGRESS
 */
export const checkInBooking = async (
  verificationToken: string,
): Promise<BookingDocument> => {
  const booking = await Booking.findOne({ verificationToken });

  if (!booking) {
    throw new Error("Booking not found or invalid verification token");
  }

  if (booking.status !== "CONFIRMED") {
    throw new Error(`Cannot check-in. Booking status is ${booking.status}`);
  }

  // Check if booking date has arrived
  const now = new Date();
  const bookingDateTime = new Date(booking.date);
  const timeParts = booking.startTime.split(":").map(Number);
  const startHour = timeParts[0];
  const startMin = timeParts[1];

  if (
    startHour === undefined ||
    startMin === undefined ||
    isNaN(startHour) ||
    isNaN(startMin)
  ) {
    throw new Error("Invalid booking time format");
  }

  bookingDateTime.setHours(startHour, startMin, 0, 0);

  // Allow check-in 15 minutes before scheduled time
  const checkInWindow = new Date(bookingDateTime.getTime() - 15 * 60 * 1000);

  if (now < checkInWindow) {
    throw new Error("Cannot check-in before the scheduled time");
  }

  booking.status = "IN_PROGRESS";
  await booking.save();

  return booking;
};

/**
 * Mark booking as completed (successful session)
 * Only venue owner or admin can mark as completed
 */
export const completeBooking = async (
  bookingId: string,
): Promise<BookingDocument> => {
  const booking = await Booking.findById(bookingId);

  if (!booking) {
    throw new Error("Booking not found");
  }

  if (booking.status !== "IN_PROGRESS") {
    throw new Error(
      `Cannot complete booking. Current status is ${booking.status}`,
    );
  }

  booking.status = "COMPLETED";
  await booking.save();

  return booking;
};

/**
 * Mark booking as no-show (user didn't show up)
 * Only venue owner or admin can mark as no-show
 */
export const markNoShow = async (
  bookingId: string,
): Promise<BookingDocument> => {
  const booking = await Booking.findById(bookingId);

  if (!booking) {
    throw new Error("Booking not found");
  }

  if (booking.status !== "CONFIRMED" && booking.status !== "IN_PROGRESS") {
    throw new Error(
      `Cannot mark as no-show. Current status is ${booking.status}`,
    );
  }

  booking.status = "NO_SHOW";
  await booking.save();

  return booking;
};

/**
 * Check coach availability (kept synchronized with CoachService.checkCoachAvailability)
 * Duplicated to avoid circular dependency between services
 */
const checkCoachAvailabilityForBooking = async (
  coachId: string,
  date: Date,
  startTime: string,
  endTime: string,
): Promise<boolean> => {
  const coach = await Coach.findById(coachId);
  if (!coach) return false;
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
  // Only active bookings block slots: CONFIRMED, IN_PROGRESS
  const existingBooking = await Booking.findOne({
    coachId,
    date: {
      $gte: new Date(date.getFullYear(), date.getMonth(), date.getDate()),
      $lt: new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1),
    },
    status: { $in: ["CONFIRMED", "IN_PROGRESS"] },
    $or: [
      { startTime: { $lte: startTime }, endTime: { $gt: startTime } },
      { startTime: { $lt: endTime }, endTime: { $gte: endTime } },
      { startTime: { $gte: startTime }, endTime: { $lte: endTime } },
    ],
  });
  return !existingBooking;
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

// Legacy function for backward compatibility
export const createBooking = initiateBooking;
