import { Request, Response } from "express";
import { Booking } from "../models/Booking";
import { Venue } from "../models/Venue";
import { User } from "../models/User";
import Academy from "../../admin/models/Academy";
import { BookingPaymentTransaction } from "../models/BookingPayment";
import {
  renderInvoicePdf,
  formatInvoiceDate as formatInvoiceDateDisplay,
  type InvoiceData,
  type InvoiceDetailField,
  type InvoiceLineItem,
} from "../../shared/services/InvoiceService";
import { formatStateWithGstCode, guessPlaceOfSupply } from "../../shared/utils/invoiceGst";
import { extractPhonePePaymentMethodLabel } from "../../shared/utils/paymentMethod";
import { recordBookingEventFor } from "../services/BookingEventService";
import { WalletService } from "../services/WalletService";
import {
  cancelBooking,
  checkInBookingByCode,
  confirmMockPaymentSuccess,
  createBookingWaitlistEntry,
  getAlternateVenueSlots,
  getUserBookings,
  getCoachBookings,
  getVenueBookingsForDate,
  getVenueListerBookings,
  initiateBooking,
  initiateGroupBooking,
  respondToBookingInvitation,
  coverUnpaidShares,
  confirmBookingByProvider,
  getUserBookingInvitations,
  countUserBookingInvitations,
  updatePaymentStatus,
  validatePromoCodeForUser,
  rejectBookingByProvider,
  rescheduleBookingByCoach,
  processBookingRefund,
} from "../services/BookingService";
import { computeBookingFees } from "../services/PricingRates";
import { deliveryAddressLine } from "../services/BookingDelivery";
import {
  getPhonePeOrderStatus,
  initiatePhonePePayment,
  isPhonePeGatewayError,
  validatePhonePeCallback,
} from "../../shared/services/PhonePeService";
import { generateDynamicSlots } from "../../utils/booking";
import {
  isWithinOpeningHours,
  combineDateAndTimeIST,
  IST_OFFSET_MINUTES,
} from "../../utils/openingHours";
import { getPaginationParams } from "../../utils/pagination";
import { transformDocument } from "../../middleware/responseTransform";
import { log as __rootLog } from "../../utils/logger";
const log = __rootLog.child("booking");

/**
 * Initiate a new booking
 * POST /api/bookings/initiate
 */
export const initiateNewBooking = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = req.user;
    if (!user) {
      res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
      return;
    }

    if (user.role !== "Player" && user.role !== "Parent") {
      res.status(403).json({
        success: false,
        message: "Booking is available for player and parent accounts.",
      });
      return;
    }

    const result = await initiateBooking({
      userId: user.id,
      ...req.body,
      date: new Date(req.body.date),
    });

    res.status(201).json({
      success: true,
      message: "Booking created successfully",
      data: {
        booking: result.booking.toJSON(),
      },
    });
  } catch (error) {
    log.error("[initiateNewBooking] Error details:", {
      body: req.body,
      errorMessage: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    res.status(400).json({
      success: false,
      message: error instanceof Error ? error.message : "Failed to initiate booking",
    });
  }
};

/**
 * Get user's bookings
 * GET /api/bookings/my-bookings
 */
/**
 * Get user's bookings
 * GET /api/bookings/my-bookings
 */
export const getMyBookings = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user?.id) {
      res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
      return;
    }

    const userId = req.user.id;

    const { page, limit } = getPaginationParams(req.query.page, req.query.limit, 20, 100);

    let result;

    // Different logic based on role
    if (req.user.role === "VenueLister") {
      result = await getVenueListerBookings(req.user.id, page, limit);
    } else if (req.user.role === "Coach") {
      result = await getCoachBookings(req.user.id, page, limit);
    } else {
      // For PLAYER and others, get bookings they made
      result = await getUserBookings(req.user.id, page, limit);
    }

    res.status(200).json({
      success: true,
      message: "Bookings retrieved successfully",
      data: result.bookings,
      pagination: {
        total: result.total,
        page: result.page,
        totalPages: result.totalPages,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : "Failed to fetch bookings",
    });
  }
};

/**
 * Get booking by ID
 * GET /api/bookings/:bookingId
 */
export const getBookingById = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user?.id) {
      res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
      return;
    }

    const bookingId = (req.params as Record<string, unknown>).bookingId as string;

    const booking = await Booking.findById(bookingId)
      .select("+checkInCode")
      .populate([
        { path: "userId" },
        { path: "venueId" },
        {
          path: "coachId",
          populate: { path: "userId", select: "name email phone" },
        },
        { path: "academyId" },
        { path: "participantId" },
      ]);

    if (!booking) {
      res.status(404).json({
        success: false,
        message: "Booking not found",
      });
      return;
    }

    const getRefId = (value: unknown): string | null => {
      if (!value || typeof value !== "object") return null;
      const asRecord = value as Record<string, unknown>;
      const id = asRecord._id || asRecord.id;
      return id ? String(id) : null;
    };

    const isAdmin = req.user.role === "Admin";
    const bookingOwnerId = getRefId(booking.userId) || String(booking.userId);
    const isBookingOwner = bookingOwnerId === req.user.id;

    let isVenueOwner = false;
    if (booking.venueId && req.user.role === "VenueLister") {
      // venueId is already fully populated above (line ~201) — no need to
      // re-fetch it just to read ownerId off the same document.
      const venueOwnerId = (booking.venueId as any)?.ownerId;
      isVenueOwner = Boolean(venueOwnerId && venueOwnerId.toString() === req.user.id);
    }

    if (!isAdmin && !isBookingOwner && !isVenueOwner) {
      res.status(403).json({
        success: false,
        message: "Forbidden",
      });
      return;
    }

    // Transform booking to include id field
    const bookingData = transformDocument(booking.toObject());

    res.status(200).json({
      success: true,
      message: "Booking retrieved successfully",
      data: bookingData,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : "Failed to fetch booking",
    });
  }
};

const buildInvoiceNumber = (bookingId: string, bookingDate: Date): string => {
  const datePart = bookingDate.toISOString().slice(0, 10).replace(/-/g, "");
  const suffix = bookingId.slice(-6).toUpperCase();
  return `INV-${datePart}-${suffix}`;
};

const buildRefId = (prefix: string, bookingId: string): string =>
  `${prefix}-${bookingId.slice(-6).toUpperCase()}`;

const getReferenceId = (value: unknown): string | null => {
  if (!value || typeof value !== "object") return null;
  const asRecord = value as Record<string, unknown>;
  const id = asRecord._id || asRecord.id;
  return id ? String(id) : null;
};

const formatStatusLabel = (value: string): string =>
  value
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());

const formatPaymentTypeLabel = (value: string): string =>
  value === "SPLIT" ? "Split payment" : "Single payment";

const formatBookingTypeLabel = (value: string): string =>
  value === "GROUP" ? "Group booking" : "Individual booking";

const canGenerateInvoiceForStatus = (status: string): boolean => {
  return ["CONFIRMED", "IN_PROGRESS", "COMPLETED", "NO_SHOW"].includes(status);
};

const diffMinutes = (startTime: string, endTime: string): number => {
  const [sh = 0, sm = 0] = startTime.split(":").map(Number);
  const [eh = 0, em = 0] = endTime.split(":").map(Number);
  return eh * 60 + em - (sh * 60 + sm);
};

/**
 * Download booking invoice PDF (venue / coach / academy bookings)
 * GET /api/bookings/:bookingId/invoice/pdf
 */
export const downloadBookingInvoicePdf = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user?.id) {
      res.status(401).json({ success: false, message: "Unauthorized" });
      return;
    }

    const bookingId = (req.params as Record<string, unknown>).bookingId as string;

    const booking = await Booking.findById(bookingId)
      .select("+checkInCode")
      .populate([
        { path: "userId" },
        { path: "venueId" },
        {
          path: "coachId",
          populate: { path: "userId", select: "name email phone" },
        },
        { path: "academyId" },
        { path: "participantId" },
      ]);

    if (!booking) {
      res.status(404).json({ success: false, message: "Booking not found" });
      return;
    }

    const isAdmin = req.user.role === "Admin";
    const bookingOwnerId = getReferenceId(booking.userId) || String(booking.userId);
    const isBookingOwner = bookingOwnerId === req.user.id;

    let isVenueOwner = false;
    if (booking.venueId && req.user.role === "VenueLister") {
      // venueId is already fully populated above — no need to re-fetch it
      // just to read ownerId off the same document.
      const venueOwnerId = (booking.venueId as any)?.ownerId;
      isVenueOwner = Boolean(venueOwnerId && venueOwnerId.toString() === req.user.id);
    }

    if (!isAdmin && !isBookingOwner && !isVenueOwner) {
      res.status(403).json({ success: false, message: "Forbidden" });
      return;
    }

    if (!canGenerateInvoiceForStatus(booking.status)) {
      res.status(409).json({
        success: false,
        message: "Invoice will be available after the coach confirms your booking.",
      });
      return;
    }

    const bookingDate = new Date(booking.date);
    const invoiceNumber = buildInvoiceNumber(booking.id, bookingDate);

    const user = booking.userId as any;
    const venue = booking.venueId as any;
    const coach = booking.coachId as any;
    const academy = booking.academyId as any;

    const kind: "VENUE" | "COACH" | "ACADEMY" = academy ? "ACADEMY" : coach ? "COACH" : "VENUE";

    const serviceFee = booking.serviceFee || 0;
    const taxAmount = booking.taxAmount || 0;
    const discountAmount = booking.discountAmount || 0;
    const baseAmount = booking.totalAmount - serviceFee - taxAmount + discountAmount;
    const subtotalForGst = baseAmount + serviceFee - discountAmount;
    const gstRatePercent =
      subtotalForGst > 0 && taxAmount > 0 ? Math.round((taxAmount / subtotalForGst) * 100) : 0;

    const durationMinutes = diffMinutes(booking.startTime, booking.endTime);

    // The address the session was actually delivered at, snapshotted onto the
    // booking when it was made. Reading it here — rather than the provider's
    // live profile — is what stops an invoice's place of supply from changing
    // after issue, and is the only source that is correct for a freelance coach
    // (who has no own venue to read an address from).
    const deliveredAddress = deliveryAddressLine(booking.delivery);

    let providerName = "Provider";
    let providerAddressLines: string[] = [];
    let providerGst: string | undefined;
    let placeOfSupply = "-";
    let itemDescription = "";
    let itemNote = "";
    let subtitle = "Tax Invoice";
    let detailsSectionTitle = "Booking details";
    let refIdLabel = "Booking ID";
    let refId = buildRefId("BK", booking.id);
    let detailLabel = "Venue";
    let detailValue = "-";

    if (kind === "VENUE") {
      providerName = venue?.name || "Venue";
      const venueAddress = deliveredAddress || venue?.address;
      providerAddressLines = venueAddress ? [venueAddress] : [];
      providerGst = venue?.gstNumber;
      placeOfSupply = guessPlaceOfSupply(venueAddress);
      itemDescription = `Court rental — ${venue?.name || "Venue"}`;
      itemNote = `${durationMinutes} minutes · SAC 999652`;
      subtitle = "Tax Invoice · Venue booking";
      detailLabel = "Venue";
      detailValue = providerName;
    } else if (kind === "COACH") {
      const coachUser = coach?.userId as any;
      const coachName = coachUser?.name || "Coach";
      providerName = `${coachName} · ${booking.sport}`;
      // Was `coach.ownVenueDetails.address` unconditionally, which is undefined
      // for a freelance coach and reflects the coach's *current* profile rather
      // than the address the session was sold against.
      const coachAddress = deliveredAddress || coach?.ownVenueDetails?.address;
      providerAddressLines = coachAddress ? [coachAddress] : [];
      providerGst = coach?.gstNumber;
      placeOfSupply = guessPlaceOfSupply(coachAddress);
      itemDescription = `Personal coaching session — ${booking.sport}`;
      itemNote = `${durationMinutes} minutes with ${coachName} · SAC 999293`;
      subtitle = "Tax Invoice · Coach booking";
      detailLabel = "Coach";
      detailValue = coachName;
    } else {
      providerName = academy?.name || "Academy";
      providerAddressLines = deliveredAddress
        ? [deliveredAddress]
        : [
            academy?.address,
            [academy?.city, academy?.state, academy?.pincode].filter(Boolean).join(", "),
          ].filter((line): line is string => Boolean(line));
      providerGst = academy?.gstNumber;
      placeOfSupply = academy?.state
        ? formatStateWithGstCode(academy.state)
        : guessPlaceOfSupply(academy?.address);
      itemDescription = `Academy session — ${booking.sport}`;
      itemNote = `${durationMinutes} minutes · SAC 999293`;
      subtitle = "Tax Invoice · Academy enrolment";
      detailsSectionTitle = "Enrolment details";
      refIdLabel = "Enrolment ID";
      refId = buildRefId("AC", booking.id);
      detailLabel = "Academy";
      detailValue = providerName;
    }

    const lineItems: InvoiceLineItem[] = [
      {
        description: itemDescription,
        note: itemNote,
        qty: 1,
        rate: baseAmount,
      },
    ];
    if (serviceFee > 0) {
      lineItems.push({
        description: "Platform convenience fee",
        note: "Booking engine & payment processing",
        qty: 1,
        rate: serviceFee,
      });
    }

    const detailFields: InvoiceDetailField[] = [
      { label: detailLabel, value: detailValue },
      { label: "Sport", value: booking.sport },
      { label: "Date", value: formatInvoiceDateDisplay(bookingDate) },
      {
        label: "Time (IST)",
        value: `${booking.startTime} — ${booking.endTime}`,
      },
      { label: refIdLabel, value: refId },
      {
        label: "Booking type",
        value: formatBookingTypeLabel(booking.bookingType),
      },
      {
        label: "Payment type",
        value: formatPaymentTypeLabel(booking.paymentType),
      },
      {
        label: "Participant",
        value: booking.participantName || user?.name || "-",
      },
    ];

    const transaction = await BookingPaymentTransaction.findOne({
      bookingId: booking._id,
      status: "COMPLETED",
    }).sort({ updatedAt: -1 });

    const paidAt = transaction?.updatedAt || booking.paymentConfirmedAt;

    const invoiceData: InvoiceData = {
      invoiceNumber,
      issueDate: new Date(),
      subtitle,
      billedTo: {
        name: user?.name || "Customer",
        email: user?.email || "-",
        phone: user?.phone || "-",
      },
      placeOfSupply,
      serviceProvider: {
        name: providerName,
        addressLines: providerAddressLines.length ? providerAddressLines : ["-"],
        gstin: providerGst,
      },
      detailsSectionTitle,
      detailsBadge: formatStatusLabel(booking.status),
      detailFields,
      lineItems,
      payment: {
        method: extractPhonePePaymentMethodLabel(transaction),
        merchantOrderId: transaction?.merchantOrderId || "-",
        transactionId: transaction?.phonepeOrderId,
        paidAt,
      },
      discountLabel: booking.promoCode,
      discountAmount,
      gstRatePercent,
      gstAmount: taxAmount,
      totalAmount: booking.totalAmount,
    };

    const pdfBuffer = await renderInvoicePdf(invoiceData);

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${invoiceNumber}.pdf"`);
    res.status(200).send(pdfBuffer);
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : "Failed to generate invoice",
    });
  }
};

/**
 * Get venue availability
 * GET /api/bookings/availability/:venueId
 */
export const getVenueAvailability = async (req: Request, res: Response): Promise<void> => {
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

    const venue = await Venue.findById(venueId).select("openingHours");
    if (!venue) {
      res.status(404).json({
        success: false,
        message: "Venue not found",
      });
      return;
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
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : "Failed to fetch availability",
    });
  }
};

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
export const getBookingQuote = async (req: Request, res: Response): Promise<void> => {
  try {
    const { subtotal, discount } = req.body as {
      subtotal: number;
      discount?: number;
    };

    if (!Number.isFinite(subtotal) || subtotal < 0) {
      res.status(400).json({ success: false, message: "A non-negative subtotal is required" });
      return;
    }

    const safeDiscount =
      Number.isFinite(discount) && (discount ?? 0) > 0 ? (discount as number) : 0;

    res.status(200).json({
      success: true,
      data: computeBookingFees(subtotal, safeDiscount),
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : "Failed to price booking",
    });
  }
};

export const validateBookingPromoCode = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user?.id) {
      res.status(401).json({ success: false, message: "Unauthorized" });
      return;
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
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error instanceof Error ? error.message : "Failed to validate promo",
    });
  }
};

export const joinBookingWaitlist = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user?.id) {
      res.status(401).json({ success: false, message: "Unauthorized" });
      return;
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
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error instanceof Error ? error.message : "Failed to join waitlist",
    });
  }
};

/**
 * Cancel a booking
 * DELETE /api/bookings/:bookingId
 */
export const cancelBookingById = async (req: Request, res: Response): Promise<void> => {
  try {
    const bookingId = (req.params as Record<string, unknown>).bookingId as string;
    const { cancellationReason } = (req.body ?? {}) as {
      cancellationReason?: string;
    };

    const requesterId = req.user?.id;
    if (!requesterId) {
      res.status(401).json({
        success: false,
        message: "Authentication required",
      });
      return;
    }

    const result = await cancelBooking(bookingId, requesterId, cancellationReason);

    if (!result.booking) {
      res.status(404).json({
        success: false,
        message: "Booking not found",
      });
      return;
    }

    res.status(200).json({
      success: true,
      message: `Booking cancelled successfully. ${result.refundPercentage}% refund (₹${result.refundAmount}) will be processed.`,
      data: {
        booking: result.booking,
        refundAmount: result.refundAmount,
        refundPercentage: result.refundPercentage,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : "Failed to cancel booking",
    });
  }
};

/**
 * Retry a failed refund — player-initiated
 * POST /api/bookings/:bookingId/retry-refund
 */
export const retryBookingRefund = async (req: Request, res: Response): Promise<void> => {
  try {
    const bookingId = (req.params as Record<string, unknown>).bookingId as string;
    const userId = req.user?.id;

    if (!userId) {
      res.status(401).json({ success: false, message: "Authentication required" });
      return;
    }

    const booking = await Booking.findOne({ _id: bookingId, userId }).lean();
    if (!booking) {
      res.status(404).json({ success: false, message: "Booking not found" });
      return;
    }

    if (booking.refundStatus !== "REJECTED") {
      res.status(400).json({
        success: false,
        message: "No failed refund to retry for this booking",
      });
      return;
    }

    // Compute refund percentage from the stored refundAmount; fall back to 100%.
    const totalAmount = (booking as any).totalAmount || 0;
    const storedRefund = (booking as any).refundAmount || 0;
    const refundPercentage =
      storedRefund > 0 && totalAmount > 0
        ? Math.min(100, Math.round((storedRefund / totalAmount) * 100))
        : 100;

    const result = await processBookingRefund(
      bookingId,
      refundPercentage,
      "Player-initiated refund retry"
    );

    res.status(200).json({
      success: true,
      message: "Refund retry initiated successfully.",
      data: {
        refundStatus: result.refundStatus,
        refundAmount: result.refundAmount,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : "Failed to retry refund",
    });
  }
};

/**
 * Confirm booking by provider (coach/venue)
 * POST /api/bookings/:bookingId/provider/confirm
 */
export const confirmBookingByProviderHandler = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    if (!req.user?.id) {
      res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
      return;
    }

    const bookingId = (req.params as Record<string, unknown>).bookingId as string;

    const booking = await confirmBookingByProvider(bookingId, req.user.id);

    res.status(200).json({
      success: true,
      message: "Booking confirmed successfully",
      data: booking,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error instanceof Error ? error.message : "Failed to confirm booking",
    });
  }
};

/**
 * Reject booking by provider (coach/venue)
 * POST /api/bookings/:bookingId/provider/reject
 */
export const rejectBookingByProviderHandler = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    if (!req.user?.id) {
      res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
      return;
    }

    const bookingId = (req.params as Record<string, unknown>).bookingId as string;
    const { reason } = (req.body ?? {}) as { reason?: string };

    const result = await rejectBookingByProvider(bookingId, req.user.id, reason);

    res.status(200).json({
      success: true,
      message: "Booking rejected successfully",
      data: {
        booking: result.booking,
        refundAmount: result.refundAmount,
        refundStatus: result.refundStatus,
      },
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error instanceof Error ? error.message : "Failed to reject booking",
    });
  }
};

/**
 * Check-in to booking using random check-in code
 * POST /api/bookings/check-in/code
 */
export const checkInBookingWithCode = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user?.id) {
      res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
      return;
    }

    const { checkInCode } = req.body as { checkInCode: string };

    const booking = await checkInBookingByCode(checkInCode, req.user.id, req.user.role);

    res.status(200).json({
      success: true,
      message: "Checked in successfully",
      data: booking,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error instanceof Error ? error.message : "Check-in failed",
    });
  }
};

/**
 * Confirm mock payment success for a booking
 * POST /api/bookings/:bookingId/mock-payment-success
 */
export const confirmMockPaymentSuccessById = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user?.id) {
      res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
      return;
    }

    const bookingId = (req.params as Record<string, unknown>).bookingId as string;

    const booking = await confirmMockPaymentSuccess(bookingId, req.user.id);

    res.status(200).json({
      success: true,
      message: "Mock payment confirmed successfully",
      data: booking,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error instanceof Error ? error.message : "Failed to confirm mock payment",
    });
  }
};

const getBookingPaymentAmount = (booking: any, userId: string): number => {
  if (booking.payments && booking.payments.length > 0) {
    const userPayment = booking.payments.find(
      (payment: any) => payment.userId.toString() === userId
    );

    if (!userPayment) {
      throw new Error("No payment share found for this user");
    }

    if (userPayment.status === "PAID") {
      throw new Error("Payment is already completed for this booking");
    }

    return userPayment.amount;
  }

  if (booking.paymentConfirmedAt) {
    throw new Error("Payment is already completed for this booking");
  }

  return booking.totalAmount || 0;
};

/**
 * Initiate PhonePe payment for a booking
 * POST /api/bookings/:bookingId/phonepe/initiate
 */
export const initiatePhonePePaymentForBooking = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const authUser = req.user;
    if (!authUser?.id) {
      res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
      return;
    }

    const userId = authUser.id;

    const bookingId = (req.params as Record<string, unknown>).bookingId as string;
    const booking = await Booking.findById(bookingId).select(
      "userId totalAmount payments bookingType paymentType status paymentConfirmedAt"
    );

    if (!booking) {
      res.status(404).json({
        success: false,
        message: "Booking not found",
      });
      return;
    }

    if (booking.status === "CANCELLED") {
      res.status(400).json({
        success: false,
        message: "Cannot initiate payment for a cancelled booking",
      });
      return;
    }

    const isOrganizer = booking.userId.toString() === userId;
    const isSplitPayer =
      booking.paymentType === "SPLIT" &&
      booking.payments?.some((payment) => payment.userId.toString() === userId);

    if (!isOrganizer && !isSplitPayer) {
      res.status(403).json({
        success: false,
        message: "You are not authorized to pay for this booking",
      });
      return;
    }

    const amount = getBookingPaymentAmount(booking, userId);
    const amountInPaise = Math.round(amount * 100);

    if (amountInPaise < 100) {
      res.status(400).json({
        success: false,
        message: "Payment amount must be at least 1 INR",
      });
      return;
    }

    const merchantOrderId = `bk_${bookingId}_${Date.now()}`;
    const redirectBase =
      process.env.FRONTEND_URL || process.env.PHONEPE_REDIRECT_URL_BASE || "http://localhost:3000";
    const redirectUrl = new URL("/payment", redirectBase);
    redirectUrl.searchParams.set("status", "pending");
    redirectUrl.searchParams.set("bookingId", bookingId);
    redirectUrl.searchParams.set("merchantOrderId", merchantOrderId);
    if (req.body?.type === "coach" || req.body?.type === "venue") {
      redirectUrl.searchParams.set("type", req.body.type);
    }

    const payer = await User.findById(userId).select("phone");

    const transaction = await BookingPaymentTransaction.create({
      bookingId: booking._id,
      userId,
      merchantOrderId,
      amount: amountInPaise,
      status: "PENDING",
    });

    await recordBookingEventFor(booking, {
      type: "PAYMENT_INITIATED",
      toStatus: booking.status,
      actorType: "USER",
      actorUserId: userId,
      channel: "CLIENT_WEB",
      amountPaise: amountInPaise,
      summary: "PhonePe payment initiated",
      metadata: {
        merchantOrderId,
        method: "PHONEPE",
        transactionId: transaction._id.toString(),
        isSplitPayer: isSplitPayer && !isOrganizer,
      },
    });

    const paymentPayload: {
      merchantOrderId: string;
      amount: number;
      redirectUrl: string;
      userPhone?: string;
      metaInfo?: Record<string, string>;
    } = {
      merchantOrderId,
      amount: amountInPaise,
      redirectUrl: redirectUrl.toString(),
      metaInfo: {
        udf1: bookingId,
        udf2: userId,
      },
    };

    if (payer?.phone) {
      paymentPayload.userPhone = payer.phone;
    }

    const initResult = await initiatePhonePePayment(paymentPayload);

    if (initResult.orderId) {
      transaction.phonepeOrderId = initResult.orderId;
    }
    transaction.redirectUrl = initResult.redirectUrl;
    transaction.state = initResult.state || "PENDING";
    await transaction.save();

    res.status(200).json({
      success: true,
      message: "PhonePe payment initiated",
      data: {
        redirectUrl: initResult.redirectUrl,
        merchantOrderId,
        state: initResult.state,
      },
    });
  } catch (error) {
    const statusCode = isPhonePeGatewayError(error) ? error.statusCode : 400;

    res.status(statusCode).json({
      success: false,
      message: error instanceof Error ? error.message : "Failed to initiate PhonePe payment",
      ...(isPhonePeGatewayError(error)
        ? { data: { code: error.code, retryable: error.retryable } }
        : {}),
    });
  }
};

/**
 * Handle PhonePe callback
 * POST /api/bookings/phonepe/callback
 */
export const handlePhonePeCallback = async (req: Request, res: Response): Promise<void> => {
  try {
    const authorizationHeader = req.headers["authorization"] as string;
    if (!authorizationHeader) {
      res.status(401).json({
        success: false,
        message: "Missing PhonePe authorization header",
      });
      return;
    }

    const rawBody = (req as any).rawBody || JSON.stringify(req.body);
    const callback = validatePhonePeCallback(authorizationHeader, rawBody);
    const payload = callback.payload || {};

    const merchantOrderId = payload.originalMerchantOrderId;
    if (!merchantOrderId) {
      res.status(400).json({
        success: false,
        message: "Missing merchant order id in callback",
      });
      return;
    }

    const transaction = await BookingPaymentTransaction.findOne({
      merchantOrderId,
    });
    if (!transaction) {
      res.status(404).json({
        success: false,
        message: "Payment transaction not found",
      });
      return;
    }

    transaction.callbackPayload = callback as any;
    transaction.phonepeOrderId = payload.orderId || transaction.phonepeOrderId;
    transaction.state = payload.state || transaction.state;

    if (payload.state === "COMPLETED") {
      transaction.status = "COMPLETED";
      await updatePaymentStatus(
        transaction.bookingId.toString(),
        transaction.userId.toString(),
        "PAID",
        undefined,
        {
          actorType: "GATEWAY",
          channel: "WEBHOOK",
          metadata: {
            merchantOrderId: transaction.merchantOrderId,
            gatewayState: payload.state,
            source: "phonepe_callback",
          },
        }
      );
    } else if (payload.state === "FAILED") {
      transaction.status = "FAILED";
      await updatePaymentStatus(
        transaction.bookingId.toString(),
        transaction.userId.toString(),
        "FAILED",
        undefined,
        {
          actorType: "GATEWAY",
          channel: "WEBHOOK",
          metadata: {
            merchantOrderId: transaction.merchantOrderId,
            gatewayState: payload.state,
            source: "phonepe_callback",
          },
        }
      );
    }

    await transaction.save();

    res.status(200).json({
      success: true,
      message: "PhonePe callback processed",
    });
  } catch (error) {
    const statusCode = isPhonePeGatewayError(error) ? error.statusCode : 400;

    res.status(statusCode).json({
      success: false,
      message: error instanceof Error ? error.message : "Failed to process PhonePe callback",
      ...(isPhonePeGatewayError(error)
        ? { data: { code: error.code, retryable: error.retryable } }
        : {}),
    });
  }
};

/**
 * Verify PhonePe order status
 * GET /api/bookings/phonepe/status/:merchantOrderId
 */
export const verifyPhonePeOrderStatus = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user?.id) {
      res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
      return;
    }

    const merchantOrderIdParam = Array.isArray(req.params.merchantOrderId)
      ? req.params.merchantOrderId[0]
      : req.params.merchantOrderId;
    if (!merchantOrderIdParam) {
      res.status(400).json({
        success: false,
        message: "merchantOrderId is required",
      });
      return;
    }

    const merchantOrderId = merchantOrderIdParam;

    const transaction = await BookingPaymentTransaction.findOne({
      merchantOrderId,
    });

    if (!transaction) {
      res.status(404).json({
        success: false,
        message: "Payment transaction not found",
      });
      return;
    }

    if (transaction.userId.toString() !== req.user.id) {
      res.status(403).json({
        success: false,
        message: "You are not authorized to access this payment",
      });
      return;
    }

    const status = await getPhonePeOrderStatus(merchantOrderId);
    transaction.lastStatusPayload = status.raw;
    transaction.state = status.state || transaction.state || "PENDING";

    if (status.state === "COMPLETED" && transaction.status !== "COMPLETED") {
      transaction.status = "COMPLETED";
      await updatePaymentStatus(
        transaction.bookingId.toString(),
        transaction.userId.toString(),
        "PAID",
        undefined,
        {
          actorType: "GATEWAY",
          channel: "CLIENT_WEB",
          metadata: {
            merchantOrderId,
            gatewayState: status.state,
            // The user's browser polled this after returning from PhonePe,
            // rather than the webhook arriving first.
            source: "phonepe_status_poll",
          },
        }
      );
    } else if (status.state === "FAILED" && transaction.status !== "FAILED") {
      transaction.status = "FAILED";
      await updatePaymentStatus(
        transaction.bookingId.toString(),
        transaction.userId.toString(),
        "FAILED",
        undefined,
        {
          actorType: "GATEWAY",
          channel: "CLIENT_WEB",
          metadata: {
            merchantOrderId,
            gatewayState: status.state,
            source: "phonepe_status_poll",
          },
        }
      );
    }

    await transaction.save();

    res.status(200).json({
      success: true,
      message: "PhonePe order status retrieved",
      data: {
        state: status.state,
        merchantOrderId,
      },
    });
  } catch (error) {
    const statusCode = isPhonePeGatewayError(error) ? error.statusCode : 400;

    res.status(statusCode).json({
      success: false,
      message: error instanceof Error ? error.message : "Failed to verify PhonePe order status",
      ...(isPhonePeGatewayError(error)
        ? { data: { code: error.code, retryable: error.retryable } }
        : {}),
    });
  }
};

// ============================================
// GROUP BOOKING ENDPOINTS
// ============================================

/**
 * Initiate a group booking with friends
 * POST /api/bookings/initiate-group
 */
export const initiateNewGroupBooking = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user?.id) {
      res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
      return;
    }

    if (req.user.role !== "Player" && req.user.role !== "Parent") {
      res.status(403).json({
        success: false,
        message: "Group booking is available for player and parent accounts.",
      });
      return;
    }

    const result = await initiateGroupBooking({
      userId: req.user.id,
      ...req.body,
      date: new Date(req.body.date),
    });

    res.status(201).json({
      success: true,
      message: "Group booking created successfully",
      data: {
        booking: result.booking.toJSON(),
      },
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error instanceof Error ? error.message : "Failed to initiate group booking",
    });
  }
};

/**
 * Respond to a booking invitation
 * POST /api/bookings/invitations/:invitationId/respond
 */
export const respondToInvitation = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user?.id) {
      res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
      return;
    }

    const { invitationId } = req.params;
    const { accept } = req.body;

    if (!invitationId || typeof invitationId !== "string") {
      res.status(400).json({
        success: false,
        message: "Invalid invitation ID",
      });
      return;
    }

    if (typeof accept !== "boolean") {
      res.status(400).json({
        success: false,
        message: "Accept field must be a boolean",
      });
      return;
    }

    const booking = await respondToBookingInvitation(req.user.id, invitationId as string, accept);

    res.status(200).json({
      success: true,
      message: accept ? "Invitation accepted successfully" : "Invitation declined",
      data: booking,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error instanceof Error ? error.message : "Failed to respond to invitation",
    });
  }
};

/**
 * Get booking invitations for the current user
 * GET /api/bookings/invitations
 */
export const getMyInvitations = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user?.id) {
      res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
      return;
    }

    const { status } = req.query;
    const validStatus =
      status === "PENDING" || status === "ACCEPTED" || status === "DECLINED" ? status : undefined;

    const invitations = await getUserBookingInvitations(req.user.id, validStatus);

    res.status(200).json({
      success: true,
      message: "Invitations retrieved successfully",
      data: invitations,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error instanceof Error ? error.message : "Failed to get invitations",
    });
  }
};

/**
 * Organizer covers unpaid shares in a split payment booking
 * POST /api/bookings/:bookingId/cover-payments
 */
export const coverUnpaidPayments = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user?.id) {
      res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
      return;
    }

    const { bookingId } = req.params;

    if (!bookingId || typeof bookingId !== "string") {
      res.status(400).json({
        success: false,
        message: "Invalid booking ID",
      });
      return;
    }

    const booking = await coverUnpaidShares(bookingId as string, req.user.id);

    res.status(200).json({
      success: true,
      message: "Unpaid shares covered successfully",
      data: booking,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error instanceof Error ? error.message : "Failed to cover unpaid shares",
    });
  }
};

// Legacy endpoint for backward compatibility
export const createNewBooking = initiateNewBooking;

/**
 * Get count of pending booking invitations
 * GET /api/bookings/invitations/pending-count
 */
export const getPendingInvitationsCount = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user?.id) {
      res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
      return;
    }

    const count = await countUserBookingInvitations(req.user.id, "PENDING");

    res.status(200).json({
      success: true,
      data: { count },
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error instanceof Error ? error.message : "Failed to get invitations count",
    });
  }
};

/**
 * Pay for a booking using Wallet Balance
 * POST /api/bookings/:bookingId/wallet/pay
 */
export const payBookingWithWallet = async (req: Request, res: Response): Promise<void> => {
  try {
    const bookingId = req.params.bookingId as string;
    const user = req.user;

    if (!user) {
      res.status(401).json({ success: false, message: "Unauthorized" });
      return;
    }

    const booking = await Booking.findById(bookingId);
    if (!booking) {
      res.status(404).json({ success: false, message: "Booking not found" });
      return;
    }

    // Only a booking still awaiting payment can be paid for. AWAITING_PROVIDER
    // means the money already landed, so accepting another payment there would
    // charge the customer twice.
    if (booking.status !== "AWAITING_PAYMENT" && booking.status !== "PENDING_INVITES") {
      res.status(400).json({
        success: false,
        message: "Booking cannot be paid for in its current state",
      });
      return;
    }

    // Verify user is part of the booking (organizer or participant)
    if (booking.userId.toString() !== user.id && booking.organizerId?.toString() !== user.id) {
      // Find if they are a participant
      const isParticipant = booking.payments?.some((p) => p.userId.toString() === user.id);
      if (!isParticipant) {
        res.status(403).json({
          success: false,
          message: "Not authorized to pay for this booking",
        });
        return;
      }
    }

    // Calculate user's share
    const paymentShare = booking.payments?.find((p) => p.userId.toString() === user.id);

    const amount = paymentShare ? paymentShare.amount : booking.totalAmount;

    if (paymentShare && paymentShare.status === "PAID") {
      res.status(400).json({
        success: false,
        message: "Your share of this booking is already paid",
      });
      return;
    }

    if (!paymentShare && booking.paymentConfirmedAt) {
      res.status(400).json({
        success: false,
        message: "Booking is already paid",
      });
      return;
    }

    // Deduct from wallet
    await WalletService.debitWallet(user.id, amount, `Booking Payment: ${bookingId}`, bookingId);

    const merchantOrderId = `WALLET-${Date.now()}-${Math.random().toString(36).substring(7)}`;

    // Create payment transaction.
    // BookingPaymentTransaction.amount is denominated in PAISE — the PhonePe
    // path stores Math.round(amount * 100), and every downstream reader
    // (RefundService.initiateRefund, timer.ts expireOldBookings, the refund
    // retry job in scheduledJobs.ts) divides by 100 to get rupees. Storing
    // the raw rupee figure here made wallet-paid bookings refund and report
    // 100x too small.
    await BookingPaymentTransaction.create({
      bookingId: booking._id,
      userId: user.id,
      merchantOrderId,
      amount: Math.round(amount * 100),
      status: "COMPLETED",
      state: "COMPLETED",
    });

    await recordBookingEventFor(booking, {
      type: "PAYMENT_INITIATED",
      toStatus: booking.status,
      actorType: "USER",
      actorUserId: user.id,
      channel: "CLIENT_WEB",
      amountPaise: Math.round(amount * 100),
      summary: "Wallet debited for booking payment",
      metadata: { merchantOrderId, method: "WALLET" },
    });

    // Update booking status
    await updatePaymentStatus(bookingId, user.id, "PAID", undefined, {
      actorType: "USER",
      actorUserId: user.id,
      channel: "CLIENT_WEB",
      metadata: { merchantOrderId, method: "WALLET" },
    });

    res.status(200).json({
      success: true,
      message: "Paid via wallet successfully",
    });
  } catch (error) {
    log.error("[payBookingWithWallet]", error);
    res.status(400).json({
      success: false,
      message: error instanceof Error ? error.message : "Failed to pay via wallet",
    });
  }
};

/**
 * Reschedule a confirmed booking — coach only
 * POST /api/bookings/:bookingId/reschedule
 */
export const rescheduleBookingHandler = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user?.id) {
      res.status(401).json({ success: false, message: "Unauthorized" });
      return;
    }

    const { bookingId } = req.params as { bookingId: string };
    const { newDate, newStartTime, newEndTime } = req.body as {
      newDate: string;
      newStartTime: string;
      newEndTime: string;
    };

    if (!newDate || !newStartTime || !newEndTime) {
      res.status(400).json({
        success: false,
        message: "newDate, newStartTime, and newEndTime are required",
      });
      return;
    }

    const parsedDate = new Date(newDate);
    if (isNaN(parsedDate.getTime())) {
      res.status(400).json({ success: false, message: "Invalid date format" });
      return;
    }

    const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;
    if (!timeRegex.test(newStartTime) || !timeRegex.test(newEndTime)) {
      res.status(400).json({
        success: false,
        message: "Time must be in HH:mm format",
      });
      return;
    }

    if (newStartTime >= newEndTime) {
      res.status(400).json({
        success: false,
        message: "End time must be after start time",
      });
      return;
    }

    const booking = await rescheduleBookingByCoach(
      bookingId,
      req.user.id,
      parsedDate,
      newStartTime,
      newEndTime
    );

    res.status(200).json({
      success: true,
      message: "Booking rescheduled successfully",
      data: transformDocument(booking.toJSON()),
    });
  } catch (error) {
    const status =
      error instanceof Error &&
      (error.message.includes("Not authorized") || error.message.includes("not found"))
        ? 403
        : 400;
    res.status(status).json({
      success: false,
      message: error instanceof Error ? error.message : "Failed to reschedule booking",
    });
  }
};
