import { Booking } from "../../models/Booking";
import { BookingSlotLock } from "../../models/BookingSlotLock";
import { BookingPaymentTransaction } from "../../models/BookingPayment";
import { IST_OFFSET_MINUTES } from "../../../utils/openingHours";
import { recordBookingEventFor } from "../BookingEventService";
import { log, getDateKey, toPaise, pickString, asRec } from "./shared";
import { updatePaymentStatus } from "./lifecycle";

/**
 * Cleanup stale booking slot locks
 * Removes locks for dates in the past (older than today)
 * Can be called periodically via cron job
 */
export const cleanupStaleBookingLocks = async (): Promise<number> => {
  // "Today" in IST — dateKey values are IST calendar dates (see
  // combineDateAndTimeIST), so the cutoff must be computed the same way
  // rather than the server process's local midnight.
  const todayKey = new Date(Date.now() + IST_OFFSET_MINUTES * 60 * 1000).toISOString().slice(0, 10);

  // Delete locks with dateKey < today (past dates)
  const result = await BookingSlotLock.deleteMany({
    dateKey: { $lt: todayKey },
  });

  return result.deletedCount || 0;
};

/**
 * Cleanup expired bookings
 * Deletes bookings that have passed their expiration time without payment
 * Only affects bookings that are still pending payment confirmation
 * Returns number of expired bookings deleted
 */
export const cleanupExpiredBookings = async (): Promise<number> => {
  const now = new Date();

  const filter = {
    // AWAITING_PROVIDER is intentionally absent: those bookings are PAID,
    // and deleting one would destroy the record of money owed back.
    status: { $in: ["AWAITING_PAYMENT", "PENDING_INVITES"] },
    paymentConfirmedAt: { $exists: false },
    expiresAt: { $lt: now },
  } as const;

  // Read before deleting: these documents are removed outright, so without an
  // event the abandoned checkout leaves no trace at all — and the aggregate of
  // these events is the checkout-abandonment signal.
  const expiring = await Booking.find(filter).select(
    "_id venueId coachId academyId status sport date startTime endTime totalAmount organizerId expiresAt"
  );

  if (expiring.length === 0) {
    return 0;
  }

  for (const booking of expiring) {
    await recordBookingEventFor(booking, {
      type: "EXPIRED",
      fromStatus: booking.status,
      actorType: "SYSTEM",
      channel: "CRON",
      amountPaise: toPaise(booking.totalAmount),
      occurredAt: booking.expiresAt ?? now,
      summary: "Unpaid booking passed its hold expiry and was deleted by the cleanup job",
      metadata: {
        bookingDeleted: true,
        organizerId: booking.organizerId?.toString(),
        sport: booking.sport,
        date: getDateKey(booking.date),
        startTime: booking.startTime,
        endTime: booking.endTime,
      },
    });
  }

  const result = await Booking.deleteMany({
    _id: { $in: expiring.map((booking) => booking._id) },
  });

  return result.deletedCount || 0;
};

/**
 * Reconcile a booking payment from a raw webhook payload.
 * Called by the outbox worker as a fallback after coach-subscription reconciliation.
 *
 * - Extracts merchantOrderId and payment state from the webhook payload
 * - Finds a matching BookingPaymentTransaction
 * - If found and state changed, updates both the transaction and the booking
 *
 * Returns the updated transaction, or null if no matching booking transaction was found.
 */
export const reconcileBookingPaymentFromWebhookPayload = async (
  rawPayload: unknown
): Promise<any> => {
  const payload = asRec(rawPayload);
  const inner = asRec(payload.payload);
  const data = asRec(payload.data);

  const merchantOrderId = pickString(
    payload.originalMerchantOrderId,
    payload.merchantOrderId,
    inner.originalMerchantOrderId,
    inner.merchantOrderId,
    data.originalMerchantOrderId,
    data.merchantOrderId,
    asRec(inner.paymentDetails).merchantOrderId,
    asRec(data.paymentDetails).merchantOrderId
  );

  if (!merchantOrderId) {
    return null;
  }

  // Only process booking-related transactions (merchant IDs start with "bk_")
  if (!merchantOrderId.startsWith("bk_")) {
    return null;
  }

  const transaction = await BookingPaymentTransaction.findOne({
    merchantOrderId,
  });
  if (!transaction) {
    return null;
  }

  // Extract payment state
  const rawState = pickString(
    payload.state,
    inner.state,
    data.state,
    asRec(inner.paymentDetails).state,
    asRec(data.paymentDetails).state
  );

  const normalizeState = (s?: string): string => {
    if (!s) return "PENDING";
    const upper = s.toUpperCase();
    if (upper === "COMPLETED") return "COMPLETED";
    if (upper === "FAILED") return "FAILED";
    return "PENDING";
  };

  const state = normalizeState(rawState);

  // Store the webhook callback on the transaction
  transaction.callbackPayload = payload as any;
  transaction.state = state;

  if (state === "COMPLETED" && transaction.status !== "COMPLETED") {
    transaction.status = "COMPLETED";
    await updatePaymentStatus(
      transaction.bookingId.toString(),
      transaction.userId.toString(),
      "PAID",
      undefined,
      {
        actorType: "GATEWAY",
        channel: "WEBHOOK",
        metadata: { merchantOrderId, gatewayState: state, source: "webhook" },
      }
    );
    log.info(
      `[BookingWebhook] Payment confirmed for booking ${transaction.bookingId}, merchantOrderId=${merchantOrderId}`
    );
  } else if (state === "FAILED" && transaction.status !== "FAILED") {
    transaction.status = "FAILED";
    await updatePaymentStatus(
      transaction.bookingId.toString(),
      transaction.userId.toString(),
      "FAILED",
      undefined,
      {
        actorType: "GATEWAY",
        channel: "WEBHOOK",
        metadata: { merchantOrderId, gatewayState: state, source: "webhook" },
      }
    );
    log.info(
      `[BookingWebhook] Payment failed for booking ${transaction.bookingId}, merchantOrderId=${merchantOrderId}`
    );
  }

  await transaction.save();
  return transaction;
};
