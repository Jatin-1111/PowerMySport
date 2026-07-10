import { Request, Response } from "express";
import PDFDocument from "pdfkit";
import { Booking } from "../models/Booking";
import { Venue } from "../models/Venue";
import { User } from "../models/User";
import { BookingPaymentTransaction } from "../models/BookingPayment";
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
  updatePaymentStatus,
  validatePromoCodeForUser,
  rejectBookingByProvider,
  rescheduleBookingByCoach,
  processBookingRefund,
} from "../services/BookingService";
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

/**
 * Initiate a new booking
 * POST /api/bookings/initiate
 */
export const initiateNewBooking = async (
  req: Request,
  res: Response,
): Promise<void> => {
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
    console.error("[initiateNewBooking] Error details:", {
      body: req.body,
      errorMessage: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    res.status(400).json({
      success: false,
      message:
        error instanceof Error ? error.message : "Failed to initiate booking",
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

    const userId = req.user.id;

    const { page, limit } = getPaginationParams(
      req.query.page,
      req.query.limit,
      20,
      100,
    );

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
      message:
        error instanceof Error ? error.message : "Failed to fetch bookings",
    });
  }
};

/**
 * Get booking by ID
 * GET /api/bookings/:bookingId
 */
export const getBookingById = async (
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

    const bookingId = (req.params as Record<string, unknown>)
      .bookingId as string;

    const booking = await Booking.findById(bookingId)
      .select("+checkInCode")
      .populate("userId venueId coachId participantId");

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
      const venue = await Venue.findById(booking.venueId).select("ownerId");
      isVenueOwner = Boolean(
        venue && venue.ownerId?.toString() === req.user.id,
      );
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
      message:
        error instanceof Error ? error.message : "Failed to fetch booking",
    });
  }
};

const formatCurrency = (value: number): string => {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value);
};

const formatInvoiceDate = (date: Date): string => {
  return date.toLocaleDateString("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

const buildInvoiceNumber = (bookingId: string, bookingDate: Date): string => {
  const datePart = bookingDate.toISOString().slice(0, 10).replace(/-/g, "");
  const suffix = bookingId.slice(-6).toUpperCase();
  return `INV-${datePart}-${suffix}`;
};

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

const getStatusPalette = (status: string): { fill: string; text: string } => {
  switch (status) {
    case "COMPLETED":
      return { fill: "#DCFCE7", text: "#166534" };
    case "CONFIRMED":
      return { fill: "#E0F2FE", text: "#075985" };
    case "IN_PROGRESS":
      return { fill: "#FEF3C7", text: "#92400E" };
    case "CANCELLED":
    case "NO_SHOW":
      return { fill: "#FEE2E2", text: "#991B1B" };
    case "PENDING_INVITES":
    case "PENDING_CONFIRMATION":
    default:
      return { fill: "#FFEDD5", text: "#C2410C" };
  }
};

const formatPaymentLabel = (value: string): string =>
  value === "SPLIT" ? "Split payment" : "Single payment";

const formatBookingTypeLabel = (value: string): string =>
  value === "GROUP" ? "Group booking" : "Individual booking";

const canGenerateInvoiceForStatus = (status: string): boolean => {
  return ["CONFIRMED", "IN_PROGRESS", "COMPLETED", "NO_SHOW"].includes(status);
};

const collectPdfBuffer = async (
  doc: InstanceType<typeof PDFDocument>,
): Promise<Buffer> => {
  const chunks: Buffer[] = [];
  return new Promise((resolve, reject) => {
    doc.on("data", (chunk: Buffer | string) =>
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)),
    );
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
    doc.end();
  });
};

/**
 * Download booking invoice PDF
 * GET /api/bookings/:bookingId/invoice/pdf
 */
export const downloadBookingInvoicePdf = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    if (!req.user?.id) {
      res.status(401).json({ success: false, message: "Unauthorized" });
      return;
    }

    const bookingId = (req.params as Record<string, unknown>)
      .bookingId as string;

    const booking = await Booking.findById(bookingId)
      .select("+checkInCode")
      .populate("userId venueId coachId participantId");

    if (!booking) {
      res.status(404).json({ success: false, message: "Booking not found" });
      return;
    }

    const isAdmin = req.user.role === "Admin";
    const bookingOwnerId =
      getReferenceId(booking.userId) || String(booking.userId);
    const isBookingOwner = bookingOwnerId === req.user.id;

    let isVenueOwner = false;
    if (booking.venueId && req.user.role === "VenueLister") {
      const venue = await Venue.findById(booking.venueId).select("ownerId");
      isVenueOwner = Boolean(
        venue && venue.ownerId?.toString() === req.user.id,
      );
    }

    if (!isAdmin && !isBookingOwner && !isVenueOwner) {
      res.status(403).json({ success: false, message: "Forbidden" });
      return;
    }

    if (!canGenerateInvoiceForStatus(booking.status)) {
      res.status(409).json({
        success: false,
        message:
          "Invoice will be available after the coach confirms your booking.",
      });
      return;
    }

    const bookingDate = new Date(booking.date);
    const invoiceNumber = buildInvoiceNumber(booking.id, bookingDate);
    const issueDate = formatInvoiceDate(new Date());

    const user = booking.userId as any;
    const venue = booking.venueId as any;
    const coach = booking.coachId as any;

    const providerName =
      venue?.name ||
      (coach ? `${coach.sports?.[0] || "Coach"} Coach` : "Provider");
    const providerAddress =
      venue?.address || coach?.ownVenueDetails?.address || "-";
    const providerGst = venue?.gstNumber || coach?.gstNumber || "-";

    const serviceFee = booking.serviceFee || 0;
    const taxAmount = booking.taxAmount || 0;
    const discountAmount = booking.discountAmount || 0;
    const subtotal =
      booking.totalAmount - serviceFee - taxAmount + discountAmount;
    const discountLabel =
      discountAmount > 0
        ? `-${formatCurrency(discountAmount)}`
        : formatCurrency(0);

    const doc = new PDFDocument({ size: "A4", margin: 48 });
    const brand = {
      slate: "#0F172A",
      orange: "#E97316",
      line: "#E2E8F0",
      text: "#0F172A",
      muted: "#64748B",
      soft: "#F8FAFC",
      white: "#FFFFFF",
    };
    const pageLeft = doc.page.margins.left;
    const pageTop = doc.page.margins.top;
    const pageWidth =
      doc.page.width - doc.page.margins.left - doc.page.margins.right;
    const halfWidth = (pageWidth - 12) / 2;
    const startY = pageTop;
    let currentY = startY;

    const drawSectionCard = (
      x: number,
      y: number,
      width: number,
      height: number,
      title: string,
    ): void => {
      doc.save();
      doc
        .roundedRect(x, y, width, height, 16)
        .fillAndStroke(brand.white, brand.line);
      doc.restore();
      doc
        .fillColor(brand.muted)
        .font("Helvetica-Bold")
        .fontSize(9)
        .text(title.toUpperCase(), x + 16, y + 14, {
          width: width - 32,
          characterSpacing: 0.8,
        });
    };

    const drawKeyValue = (
      x: number,
      y: number,
      label: string,
      value: string,
      width: number,
    ): number => {
      doc
        .fillColor(brand.muted)
        .font("Helvetica")
        .fontSize(8)
        .text(label, x, y, { width });
      const valueY = y + 13;
      doc
        .fillColor(brand.text)
        .font("Helvetica-Bold")
        .fontSize(10)
        .text(value, x, valueY, { width });
      return valueY + Math.max(18, doc.heightOfString(value, { width }) + 4);
    };

    const headerHeight = 120;
    doc.save();
    doc
      .roundedRect(pageLeft, currentY, pageWidth, headerHeight, 20)
      .fill(brand.slate);
    doc.restore();
    doc.save();
    doc.roundedRect(pageLeft, currentY, pageWidth, 10, 20).fill(brand.orange);
    doc.restore();

    doc
      .fillColor(brand.white)
      .font("Helvetica-Bold")
      .fontSize(24)
      .text("PowerMySport", pageLeft + 20, currentY + 24, {
        width: pageWidth - 240,
      });
    doc
      .fillColor("#E2E8F0")
      .font("Helvetica")
      .fontSize(10)
      .text("Booking invoice", pageLeft + 20, currentY + 56);
    doc
      .fillColor("#CBD5E1")
      .font("Helvetica")
      .fontSize(9)
      .text(
        "Premium sports bookings, designed for a clean and reliable checkout experience.",
        pageLeft + 20,
        currentY + 72,
        { width: pageWidth - 260 },
      );

    const statusPalette = getStatusPalette(booking.status);
    const statusText = formatStatusLabel(booking.status);
    const statusChipX = pageLeft + pageWidth - 176;

    doc.save();
    doc
      .roundedRect(statusChipX, currentY + 24, 132, 26, 13)
      .fill(statusPalette.fill);
    doc.restore();
    doc
      .fillColor(statusPalette.text)
      .font("Helvetica-Bold")
      .fontSize(9)
      .text(statusText, statusChipX, currentY + 32, {
        width: 132,
        align: "center",
      });

    doc
      .fillColor("#CBD5E1")
      .font("Helvetica")
      .fontSize(8)
      .text("Invoice number", statusChipX, currentY + 60, {
        width: 132,
        align: "center",
      });
    doc
      .fillColor(brand.white)
      .font("Helvetica-Bold")
      .fontSize(10)
      .text(invoiceNumber, statusChipX, currentY + 73, {
        width: 132,
        align: "center",
      });

    currentY += headerHeight + 16;

    const infoCardHeight = 128;
    drawSectionCard(pageLeft, currentY, halfWidth, infoCardHeight, "Billed To");
    drawSectionCard(
      pageLeft + halfWidth + 12,
      currentY,
      halfWidth,
      infoCardHeight,
      "Provider",
    );

    let leftValueY = drawKeyValue(
      pageLeft + 16,
      currentY + 32,
      "Customer",
      user?.name || "Customer",
      halfWidth - 32,
    );
    leftValueY = drawKeyValue(
      pageLeft + 16,
      leftValueY + 6,
      "Email",
      user?.email || "-",
      halfWidth - 32,
    );
    drawKeyValue(
      pageLeft + 16,
      leftValueY + 6,
      "Phone",
      user?.phone || "-",
      halfWidth - 32,
    );

    let rightValueY = drawKeyValue(
      pageLeft + halfWidth + 28,
      currentY + 32,
      "Venue / Coach",
      providerName,
      halfWidth - 32,
    );
    rightValueY = drawKeyValue(
      pageLeft + halfWidth + 28,
      rightValueY + 6,
      "Address",
      providerAddress,
      halfWidth - 32,
    );
    drawKeyValue(
      pageLeft + halfWidth + 28,
      rightValueY + 6,
      "GST",
      providerGst,
      halfWidth - 32,
    );

    currentY += infoCardHeight + 16;

    const summaryHeight = 164;
    drawSectionCard(
      pageLeft,
      currentY,
      pageWidth,
      summaryHeight,
      "Booking Summary",
    );

    const summaryItems = [
      {
        label: "Date",
        value: formatInvoiceDate(bookingDate),
      },
      {
        label: "Time",
        value: `${booking.startTime} - ${booking.endTime}`,
      },
      {
        label: "Sport",
        value: booking.sport,
      },
      {
        label: "Participant",
        value: booking.participantName || user?.name || "-",
      },
      {
        label: "Booking Type",
        value: formatBookingTypeLabel(booking.bookingType),
      },
      {
        label: "Payment Type",
        value: formatPaymentLabel(booking.paymentType),
      },
    ];

    const summaryColWidth = (pageWidth - 48) / 3;
    summaryItems.forEach((item, index) => {
      const column = index % 3;
      const row = Math.floor(index / 3);
      const x = pageLeft + 16 + column * (summaryColWidth + 8);
      const y = currentY + 34 + row * 48;
      doc
        .fillColor(brand.muted)
        .font("Helvetica")
        .fontSize(8)
        .text(item.label, x, y, { width: summaryColWidth - 8 });
      doc
        .fillColor(brand.text)
        .font("Helvetica-Bold")
        .fontSize(10)
        .text(item.value, x, y + 13, { width: summaryColWidth - 8 });
    });

    currentY += summaryHeight + 16;

    const pricingHeight = 150;
    drawSectionCard(pageLeft, currentY, pageWidth, pricingHeight, "Pricing");

    const pricingRows = [
      { label: "Subtotal", value: formatCurrency(subtotal), muted: true },
      { label: "Platform Fee", value: formatCurrency(serviceFee), muted: true },
      { label: "Taxes", value: formatCurrency(taxAmount), muted: true },
      { label: "Discount", value: discountLabel, muted: true },
    ];

    let pricingY = currentY + 36;
    pricingRows.forEach((row) => {
      doc
        .fillColor(row.muted ? brand.muted : brand.text)
        .font("Helvetica")
        .fontSize(9)
        .text(row.label, pageLeft + 16, pricingY, { width: pageWidth - 120 });
      doc
        .fillColor(brand.text)
        .font(
          row.label === "Discount" && discountAmount > 0
            ? "Helvetica-Bold"
            : "Helvetica",
        )
        .fontSize(9)
        .text(row.value, pageLeft + 16, pricingY, {
          width: pageWidth - 32,
          align: "right",
        });
      pricingY += 22;
    });

    doc
      .moveTo(pageLeft + 16, currentY + 122)
      .lineTo(pageLeft + pageWidth - 16, currentY + 122)
      .lineWidth(1)
      .stroke(brand.line);

    doc
      .fillColor(brand.text)
      .font("Helvetica-Bold")
      .fontSize(11)
      .text("Total Paid", pageLeft + 16, currentY + 130, {
        width: pageWidth - 120,
      });
    doc
      .fillColor(brand.orange)
      .font("Helvetica-Bold")
      .fontSize(15)
      .text(
        formatCurrency(booking.totalAmount),
        pageLeft + 16,
        currentY + 126,
        {
          width: pageWidth - 32,
          align: "right",
        },
      );

    currentY += pricingHeight + 16;

    doc
      .fillColor(brand.muted)
      .font("Helvetica")
      .fontSize(8)
      .text(
        "This is a system generated invoice. For support, reach out to the PowerMySport team.",
        pageLeft,
        currentY,
        { width: pageWidth },
      );

    const pdfBuffer = await collectPdfBuffer(doc);

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${invoiceNumber}.pdf"`,
    );
    res.status(200).send(pdfBuffer);
  } catch (error) {
    res.status(500).json({
      success: false,
      message:
        error instanceof Error ? error.message : "Failed to generate invoice",
    });
  }
};

/**
 * Get venue availability
 * GET /api/bookings/availability/:venueId
 */
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

    const venue = await Venue.findById(venueId).select("openingHours");
    if (!venue) {
      res.status(404).json({
        success: false,
        message: "Venue not found",
      });
      return;
    }

    // Get all bookings for this venue on the specified date
    const bookedSlots = await getVenueBookingsForDate(
      venueId,
      new Date(date as string),
    );

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
      const slotEndHour =
        (Number.isFinite(closeHour) ? closeHour : 0) +
        (closeMinute > 0 ? 1 : 0);

      const intervalMinutes = (venue as any).minimumBookingDuration || 60;
      allSlots = generateDynamicSlots(
        slotStartHour,
        slotEndHour,
        intervalMinutes,
      ).filter((slot) => {
        const slotHour = parseInt(slot.split(":")[0] || "0", 10);
        const slotMin = parseInt(slot.split(":")[1] || "0", 10);

        let endMin = slotMin + intervalMinutes;
        let endHour = slotHour + Math.floor(endMin / 60);
        endMin = endMin % 60;

        const slotEnd = `${String(endHour).padStart(2, "0")}:${String(endMin).padStart(2, "0")}`;
        return isWithinOpeningHours(
          targetDate,
          slot,
          slotEnd,
          venue.openingHours,
        ).isValid;
      });
    }

    const now = new Date();
    // "Today" in IST terms, not the server's local date — a slot's date and
    // "now" are compared as real UTC instants below regardless.
    const nowIstDateKey = new Date(
      now.getTime() + IST_OFFSET_MINUTES * 60 * 1000,
    )
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
      typeof req.query.preferredStartTime === "string"
        ? req.query.preferredStartTime
        : "";
    const preferredEnd =
      typeof req.query.preferredEndTime === "string"
        ? req.query.preferredEndTime
        : "";
    const alternateSlots =
      preferredStart && preferredEnd
        ? await getAlternateVenueSlots(
            venueId,
            targetDate,
            preferredStart,
            preferredEnd,
            4,
          )
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
      message:
        error instanceof Error ? error.message : "Failed to fetch availability",
    });
  }
};

export const validateBookingPromoCode = async (
  req: Request,
  res: Response,
): Promise<void> => {
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

    const result = await validatePromoCodeForUser(
      code,
      req.user.id,
      subtotal,
      Boolean(hasCoach),
    );

    res.status(200).json({
      success: true,
      message: result.message || "Promo validated",
      data: result,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message:
        error instanceof Error ? error.message : "Failed to validate promo",
    });
  }
};

export const joinBookingWaitlist = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    if (!req.user?.id) {
      res.status(401).json({ success: false, message: "Unauthorized" });
      return;
    }

    const {
      venueId,
      coachId,
      sport,
      date,
      startTime,
      endTime,
      alternateSlots,
    } = req.body as {
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
      message:
        error instanceof Error ? error.message : "Failed to join waitlist",
    });
  }
};

/**
 * Cancel a booking
 * DELETE /api/bookings/:bookingId
 */
export const cancelBookingById = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const bookingId = (req.params as Record<string, unknown>)
      .bookingId as string;
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

    const result = await cancelBooking(
      bookingId,
      requesterId,
      cancellationReason,
    );

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
      message:
        error instanceof Error ? error.message : "Failed to cancel booking",
    });
  }
};

/**
 * Retry a failed refund — player-initiated
 * POST /api/bookings/:bookingId/retry-refund
 */
export const retryBookingRefund = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const bookingId = (req.params as Record<string, unknown>)
      .bookingId as string;
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
      "Player-initiated refund retry",
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

    const bookingId = (req.params as Record<string, unknown>)
      .bookingId as string;

    const booking = await confirmBookingByProvider(bookingId, req.user.id);

    res.status(200).json({
      success: true,
      message: "Booking confirmed successfully",
      data: booking,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message:
        error instanceof Error ? error.message : "Failed to confirm booking",
    });
  }
};

/**
 * Reject booking by provider (coach/venue)
 * POST /api/bookings/:bookingId/provider/reject
 */
export const rejectBookingByProviderHandler = async (
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

    const bookingId = (req.params as Record<string, unknown>)
      .bookingId as string;
    const { reason } = (req.body ?? {}) as { reason?: string };

    const result = await rejectBookingByProvider(
      bookingId,
      req.user.id,
      reason,
    );

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
      message:
        error instanceof Error ? error.message : "Failed to reject booking",
    });
  }
};

/**
 * Check-in to booking using random check-in code
 * POST /api/bookings/check-in/code
 */
export const checkInBookingWithCode = async (
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

    const { checkInCode } = req.body as { checkInCode: string };

    const booking = await checkInBookingByCode(
      checkInCode,
      req.user.id,
      req.user.role,
    );

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
export const confirmMockPaymentSuccessById = async (
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

    const bookingId = (req.params as Record<string, unknown>)
      .bookingId as string;

    const booking = await confirmMockPaymentSuccess(bookingId, req.user.id);

    res.status(200).json({
      success: true,
      message: "Mock payment confirmed successfully",
      data: booking,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message:
        error instanceof Error
          ? error.message
          : "Failed to confirm mock payment",
    });
  }
};

const getBookingPaymentAmount = (booking: any, userId: string): number => {
  if (booking.payments && booking.payments.length > 0) {
    const userPayment = booking.payments.find(
      (payment: any) => payment.userId.toString() === userId,
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
  res: Response,
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

    const bookingId = (req.params as Record<string, unknown>)
      .bookingId as string;
    const booking = await Booking.findById(bookingId).select(
      "userId totalAmount payments bookingType paymentType status paymentConfirmedAt",
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
      process.env.FRONTEND_URL ||
      process.env.PHONEPE_REDIRECT_URL_BASE ||
      "http://localhost:3000";
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
      message:
        error instanceof Error
          ? error.message
          : "Failed to initiate PhonePe payment",
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
export const handlePhonePeCallback = async (
  req: Request,
  res: Response,
): Promise<void> => {
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
      );
    } else if (payload.state === "FAILED") {
      transaction.status = "FAILED";
      await updatePaymentStatus(
        transaction.bookingId.toString(),
        transaction.userId.toString(),
        "FAILED",
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
      message:
        error instanceof Error
          ? error.message
          : "Failed to process PhonePe callback",
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
export const verifyPhonePeOrderStatus = async (
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
      );
    } else if (status.state === "FAILED" && transaction.status !== "FAILED") {
      transaction.status = "FAILED";
      await updatePaymentStatus(
        transaction.bookingId.toString(),
        transaction.userId.toString(),
        "FAILED",
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
      message:
        error instanceof Error
          ? error.message
          : "Failed to verify PhonePe order status",
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
export const initiateNewGroupBooking = async (
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
      message:
        error instanceof Error
          ? error.message
          : "Failed to initiate group booking",
    });
  }
};

/**
 * Respond to a booking invitation
 * POST /api/bookings/invitations/:invitationId/respond
 */
export const respondToInvitation = async (
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

    const booking = await respondToBookingInvitation(
      req.user.id,
      invitationId as string,
      accept,
    );

    res.status(200).json({
      success: true,
      message: accept
        ? "Invitation accepted successfully"
        : "Invitation declined",
      data: booking,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message:
        error instanceof Error
          ? error.message
          : "Failed to respond to invitation",
    });
  }
};

/**
 * Get booking invitations for the current user
 * GET /api/bookings/invitations
 */
export const getMyInvitations = async (
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

    const { status } = req.query;
    const validStatus =
      status === "PENDING" || status === "ACCEPTED" || status === "DECLINED"
        ? status
        : undefined;

    const invitations = await getUserBookingInvitations(
      req.user.id,
      validStatus,
    );

    res.status(200).json({
      success: true,
      message: "Invitations retrieved successfully",
      data: invitations,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message:
        error instanceof Error ? error.message : "Failed to get invitations",
    });
  }
};

/**
 * Organizer covers unpaid shares in a split payment booking
 * POST /api/bookings/:bookingId/cover-payments
 */
export const coverUnpaidPayments = async (
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
      message:
        error instanceof Error
          ? error.message
          : "Failed to cover unpaid shares",
    });
  }
};

// Legacy endpoint for backward compatibility
export const createNewBooking = initiateNewBooking;

/**
 * Get count of pending booking invitations
 * GET /api/bookings/invitations/pending-count
 */
export const getPendingInvitationsCount = async (
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

    const invitations = await getUserBookingInvitations(req.user.id, "PENDING");

    res.status(200).json({
      success: true,
      data: { count: invitations.length },
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message:
        error instanceof Error
          ? error.message
          : "Failed to get invitations count",
    });
  }
};

/**
 * Pay for a booking using Wallet Balance
 * POST /api/bookings/:bookingId/wallet/pay
 */
export const payBookingWithWallet = async (
  req: Request,
  res: Response,
): Promise<void> => {
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

    // Must be PENDING_CONFIRMATION or PENDING_INVITES
    if (
      booking.status !== "PENDING_CONFIRMATION" &&
      booking.status !== "PENDING_INVITES"
    ) {
      res.status(400).json({
        success: false,
        message: "Booking cannot be paid for in its current state",
      });
      return;
    }

    // Verify user is part of the booking (organizer or participant)
    if (
      booking.userId.toString() !== user.id &&
      booking.organizerId?.toString() !== user.id
    ) {
      // Find if they are a participant
      const isParticipant = booking.payments?.some(
        (p) => p.userId.toString() === user.id,
      );
      if (!isParticipant) {
        res.status(403).json({
          success: false,
          message: "Not authorized to pay for this booking",
        });
        return;
      }
    }

    // Calculate user's share
    const paymentShare = booking.payments?.find(
      (p) => p.userId.toString() === user.id,
    );

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
    await WalletService.debitWallet(
      user.id,
      amount,
      `Booking Payment: ${bookingId}`,
      bookingId,
    );

    const merchantOrderId = `WALLET-${Date.now()}-${Math.random().toString(36).substring(7)}`;

    // Create payment transaction
    await BookingPaymentTransaction.create({
      bookingId: booking._id,
      userId: user.id,
      merchantOrderId,
      amount,
      status: "COMPLETED",
      state: "COMPLETED",
    });

    // Update booking status
    await updatePaymentStatus(bookingId, user.id, "PAID");

    res.status(200).json({
      success: true,
      message: "Paid via wallet successfully",
    });
  } catch (error) {
    console.error("[payBookingWithWallet]", error);
    res.status(400).json({
      success: false,
      message:
        error instanceof Error ? error.message : "Failed to pay via wallet",
    });
  }
};

/**
 * Reschedule a confirmed booking — coach only
 * POST /api/bookings/:bookingId/reschedule
 */
export const rescheduleBookingHandler = async (
  req: Request,
  res: Response,
): Promise<void> => {
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
      newEndTime,
    );

    res.status(200).json({
      success: true,
      message: "Booking rescheduled successfully",
      data: transformDocument(booking.toJSON()),
    });
  } catch (error) {
    const status =
      error instanceof Error &&
      (error.message.includes("Not authorized") ||
        error.message.includes("not found"))
        ? 403
        : 400;
    res.status(status).json({
      success: false,
      message:
        error instanceof Error ? error.message : "Failed to reschedule booking",
    });
  }
};
