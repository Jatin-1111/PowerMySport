import { Request, Response } from "express";
import { Booking } from "../../models/Booking";
import { BookingPaymentTransaction } from "../../models/BookingPayment";
import {
  renderInvoicePdf,
  formatInvoiceDate as formatInvoiceDateDisplay,
  type InvoiceData,
  type InvoiceDetailField,
  type InvoiceLineItem,
} from "../../../shared/services/InvoiceService";
import { formatStateWithGstCode, guessPlaceOfSupply } from "../../../shared/utils/invoiceGst";
import { extractPhonePePaymentMethodLabel } from "../../../shared/utils/paymentMethod";
import { deliveryAddressLine } from "../../services/BookingDelivery";

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
