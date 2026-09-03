import mongoose, { ClientSession } from "mongoose";
import { Booking, BookingDocument } from "../../models/Booking";
import { Coach } from "../../models/Coach";
import { User } from "../../models/User";
import { Venue } from "../../models/Venue";
import { BookingPaymentTransaction } from "../../models/BookingPayment";
import { combineDateAndTimeIST } from "../../../utils/openingHours";
import { recordBookingEventFor } from "../BookingEventService";
import type { BookingEventActorType, BookingEventChannel } from "../../models/BookingEvent";
import { NotificationService } from "../NotificationService";
import { ScheduledNotificationService } from "../ScheduledNotificationService";
import { getPhonePeRefundStatus } from "../../../shared/services/PhonePeService";
import { log, getDateKey, toPaise, getBookingParticipantIds } from "./shared";
import {
  sendBookingLifecycleEmails,
  initiateBookingRefunds,
  isProviderAuthorizedForBooking,
  sendBookingPaymentConfirmation,
  notifyWaitlistForFreedSlot,
} from "./notifications";

export const processBookingRefund = async (
  bookingId: string,
  refundPercentage: number,
  reason: string
): Promise<{
  booking: BookingDocument;
  refundAmount: number;
  refundPercentage: number;
  refundStatus: "PENDING" | "PROCESSED" | "REJECTED";
}> => {
  const booking = await Booking.findById(bookingId);

  if (!booking) {
    throw new Error("Booking not found");
  }

  if (booking.refundStatus === "PROCESSED") {
    throw new Error("Refund already processed for this booking");
  }

  // Only block if there is actually an in-flight PhonePe refund (INITIATED on the
  // transaction). A booking can be PENDING with no submitted refund — e.g. the
  // initial attempt failed transiently — and in that case the admin should be
  // able to re-trigger it or switch method (Store Credit / Bank Transfer).
  if (booking.refundStatus === "PENDING") {
    const inFlight = await BookingPaymentTransaction.exists({
      bookingId: booking._id,
      refundState: "INITIATED",
    });
    if (inFlight) {
      throw new Error(
        "Refund already submitted to PhonePe and is awaiting confirmation. No further action needed."
      );
    }
  }

  let refundResult: { refundStatus: "PENDING" | "PROCESSED" | "REJECTED"; refundAmount: number };
  try {
    refundResult = await initiateBookingRefunds(booking, refundPercentage, reason);
  } catch (error) {
    booking.refundStatus = "REJECTED";
    await booking.save();

    await recordBookingEventFor(booking, {
      type: "REFUND_FAILED",
      actorType: "SYSTEM",
      channel: "SYSTEM",
      summary: `Refund could not be initiated at ${refundPercentage}% — marked REJECTED`,
      metadata: {
        refundPercentage,
        reason,
        error: error instanceof Error ? error.message : String(error),
      },
    });

    throw error;
  }

  if (refundResult.refundAmount > 0) {
    booking.refundAmount = refundResult.refundAmount;
  }
  booking.refundStatus = refundResult.refundStatus;
  await booking.save();

  await recordBookingEventFor(booking, {
    type:
      refundResult.refundStatus === "REJECTED"
        ? "REFUND_FAILED"
        : refundResult.refundStatus === "PROCESSED"
          ? "REFUND_COMPLETED"
          : "REFUND_INITIATED",
    actorType: "SYSTEM",
    channel: "SYSTEM",
    amountPaise: toPaise(refundResult.refundAmount),
    summary: `Refund ${refundResult.refundStatus.toLowerCase()} at ${refundPercentage}%`,
    metadata: {
      refundPercentage,
      reason,
      refundStatus: refundResult.refundStatus,
    },
  });

  return {
    booking,
    refundAmount: refundResult.refundAmount,
    refundPercentage,
    refundStatus: refundResult.refundStatus,
  };
};

export const getBookingPhonePeRefundStatus = async (
  bookingId: string
): Promise<{
  bookingId: string;
  refundStatus: "PENDING" | "PROCESSED" | "REJECTED";
  refundAmount: number;
  transactions: Array<{
    merchantOrderId: string;
    merchantRefundId: string;
    refundId?: string;
    state?: string;
    amount: number;
  }>;
}> => {
  const booking = await Booking.findById(bookingId).select("refundStatus refundAmount");

  if (!booking) {
    throw new Error("Booking not found");
  }

  const refundableTransactions = await BookingPaymentTransaction.find({
    bookingId,
    refundMerchantId: { $exists: true, $ne: null },
    // Exclude BANK_TRANSFER refunds — their IDs are not PhonePe IDs and
    // would cause the gateway call to fail or corrupt stored state.
    "refundResponse.method": { $ne: "BANK_TRANSFER" },
  }).sort({ createdAt: -1 });

  if (refundableTransactions.length === 0) {
    throw new Error("No PhonePe refund transaction found for this booking");
  }

  let hasPending = false;
  let hasFailure = false;
  let totalRefundPaise = 0;

  const transactions: Array<{
    merchantOrderId: string;
    merchantRefundId: string;
    refundId?: string;
    state?: string;
    amount: number;
  }> = [];

  for (const transaction of refundableTransactions) {
    const merchantRefundId = transaction.refundMerchantId;
    if (!merchantRefundId) {
      continue;
    }

    const refundStatus = await getPhonePeRefundStatus(merchantRefundId);
    const latestState = refundStatus.state || transaction.refundState || "PENDING";
    const latestAmount =
      typeof refundStatus.amount === "number" ? refundStatus.amount : transaction.refundAmount || 0;
    const refundId = refundStatus.refundId ?? transaction.refundId;

    if (refundId) {
      transaction.refundId = refundId;
    }
    transaction.refundState = latestState;
    transaction.refundAmount = latestAmount;
    transaction.refundResponse = refundStatus.raw;
    await transaction.save();

    if (latestState === "FAILED") {
      hasFailure = true;
    } else if (latestState !== "COMPLETED") {
      hasPending = true;
    }

    totalRefundPaise += latestAmount;

    transactions.push({
      merchantOrderId: transaction.merchantOrderId,
      merchantRefundId,
      state: latestState,
      amount: Math.round(latestAmount) / 100,
      ...(refundId ? { refundId } : {}),
    });
  }

  const aggregateRefundStatus: "PENDING" | "PROCESSED" | "REJECTED" = hasFailure
    ? "REJECTED"
    : hasPending
      ? "PENDING"
      : "PROCESSED";

  booking.refundStatus = aggregateRefundStatus;
  booking.refundAmount = Math.round(totalRefundPaise) / 100;
  await booking.save();

  return {
    bookingId,
    refundStatus: aggregateRefundStatus,
    refundAmount: Math.round(totalRefundPaise) / 100,
    transactions,
  };
};

/**
 * Cancel a booking
 */
/**
 * Cancel booking with time-based refund policy
 *
 * Refund Policy:
 * - > 48 hours before booking: 100% refund
 * - 24-48 hours before: 50% refund
 * - < 24 hours before: 0% refund (no refund)
 * - After booking start: 0% refund
 */
export const cancelBooking = async (
  bookingId: string,
  requesterId: string,
  cancellationReason?: string
): Promise<{
  booking: BookingDocument | null;
  refundAmount: number;
  refundPercentage: number;
}> => {
  // Scope to the booking's organizer so a user can only cancel their OWN
  // booking (prevents IDOR: cancelling/refunding arbitrary bookings).
  const booking = await Booking.findOne({
    _id: bookingId,
    organizerId: requesterId,
    status: {
      $in: ["AWAITING_PAYMENT", "AWAITING_PROVIDER", "PENDING_INVITES", "CONFIRMED", "IN_PROGRESS"],
    },
  });

  if (!booking) {
    throw new Error("Booking not found or already cancelled");
  }

  // Calculate booking start time (UTC-safe — see combineDateAndTimeIST)
  const bookingStartTime = combineDateAndTimeIST(booking.date, booking.startTime);

  const now = new Date();
  const hoursUntilBooking = (bookingStartTime.getTime() - now.getTime()) / (1000 * 60 * 60);

  // Determine refund percentage based on cancellation policy
  let refundPercentage = 0;
  if (hoursUntilBooking > 48) {
    refundPercentage = 100; // Full refund
  } else if (hoursUntilBooking > 24) {
    refundPercentage = 50; // Half refund
  } else {
    refundPercentage = 0; // No refund
  }

  const refundAmount = Math.round((booking.totalAmount * refundPercentage) / 100);

  // Update booking status
  const updatedBooking = await Booking.findOneAndUpdate(
    {
      _id: bookingId,
      organizerId: requesterId,
      status: {
        $in: [
          "AWAITING_PAYMENT",
          "AWAITING_PROVIDER",
          "PENDING_INVITES",
          "CONFIRMED",
          "IN_PROGRESS",
        ],
      },
    },
    {
      $set: {
        status: "CANCELLED",
        cancelledAt: new Date(),
        cancellationReason: cancellationReason || "Cancelled by user",
        refundAmount,
        // Don't pre-set refundStatus here — PhonePe hasn't been called yet.
        // initiateBookingRefunds sets the real status (PENDING/PROCESSED/REJECTED)
        // after the gateway responds; the catch block sets REJECTED on failure.
      },
    },
    { new: true }
  );

  if (updatedBooking) {
    await recordBookingEventFor(updatedBooking, {
      type: "CANCELLED",
      fromStatus: booking.status,
      toStatus: "CANCELLED",
      actorType: "USER",
      actorUserId: requesterId,
      channel: "CLIENT_WEB",
      amountPaise: toPaise(refundAmount),
      summary: `Cancelled by organizer ${hoursUntilBooking > 0 ? `${Math.round(hoursUntilBooking)}h before start` : "after start time"} — ${refundPercentage}% refund band`,
      metadata: {
        reason: cancellationReason || "Cancelled by user",
        refundPercentage,
        hoursUntilBooking: Math.round(hoursUntilBooking * 100) / 100,
        // The policy that was applied, snapshotted. If the 48/24h bands ever
        // change, this records which rules this cancellation was judged by.
        policy: "48h=100%, 24-48h=50%, <24h=0%",
        totalAmountPaise: toPaise(booking.totalAmount),
      },
    });
  }

  // Send cancellation notifications to all participants
  if (updatedBooking) {
    const venue = await Venue.findById(updatedBooking.venueId);

    if (venue) {
      // Get all participant user IDs (organizer + accepted participants)
      const participantIds = [
        updatedBooking.organizerId.toString(),
        ...updatedBooking.participants
          .filter((p) => p.status === "ACCEPTED")
          .map((p) => p.userId.toString()),
      ];

      // Send notification to each participant
      for (const participantId of participantIds) {
        NotificationService.send({
          userId: participantId,
          type: "BOOKING_CANCELLED",
          title: "Booking Cancelled",
          message: `Your booking for ${updatedBooking.sport} at ${venue.name} has been cancelled. ${refundPercentage > 0 ? `You will receive a ${refundPercentage}% refund.` : "No refund available."}`,
          data: {
            bookingId: updatedBooking._id.toString(),
            venueName: venue.name,
            sport: updatedBooking.sport,
            date: updatedBooking.date.toISOString(),
            startTime: updatedBooking.startTime,
            endTime: updatedBooking.endTime,
            cancellationReason: cancellationReason || "Cancelled by user",
            refundAmount,
            refundPercentage,
          },
        }).catch((err: Error) =>
          log.error(`Failed to send booking cancellation notification to ${participantId}:`, err)
        );

        NotificationService.send({
          userId: participantId,
          type: "BOOKING_STATUS_UPDATED",
          title: "Booking status changed",
          message: `Your booking is now CANCELLED for ${updatedBooking.sport}.`,
          data: {
            bookingId: updatedBooking._id.toString(),
            status: "CANCELLED",
            date: updatedBooking.date.toISOString(),
            startTime: updatedBooking.startTime,
            endTime: updatedBooking.endTime,
          },
        }).catch(() => {});
      }
    }

    // Cancel all pending reminders for this booking
    ScheduledNotificationService.cancelBookingReminders(updatedBooking._id).catch((err: Error) =>
      log.error(`Failed to cancel booking reminders for ${updatedBooking._id}:`, err)
    );

    if (refundAmount > 0) {
      try {
        const refundResult = await initiateBookingRefunds(
          updatedBooking,
          refundPercentage,
          cancellationReason || "Cancelled by user"
        );
        updatedBooking.refundStatus = refundResult.refundStatus;
        updatedBooking.refundAmount = refundResult.refundAmount;
        await updatedBooking.save();
        // Notify the organizer only after the refund has actually been initiated
        NotificationService.send({
          userId: updatedBooking.organizerId.toString(),
          type: "PAYMENT_REFUND",
          title: "Refund Initiated",
          message: `A ${refundPercentage}% refund of ₹${refundAmount} has been initiated for your cancelled booking${venue ? ` at ${venue.name}` : ""}.`,
          data: {
            bookingId: updatedBooking._id.toString(),
            ...(venue ? { venueName: venue.name } : {}),
            sport: updatedBooking.sport,
            refundAmount,
            refundPercentage,
            cancellationReason: cancellationReason || "Cancelled by user",
          },
        }).catch((err: Error) => log.error(`Failed to send refund notification:`, err));
      } catch (refundError) {
        log.error(
          `Failed to initiate refund for booking ${updatedBooking._id.toString()}:`,
          refundError
        );
        // Keep as PENDING so the retry job can attempt it — never auto-reject.
        updatedBooking.refundStatus = "PENDING";
        await updatedBooking.save().catch(() => {});
      }
    }

    await sendBookingLifecycleEmails(updatedBooking, "CANCELLED", {
      cancellationReason: cancellationReason || "Cancelled by user",
      refundAmount,
      refundPercentage,
    });

    // A slot just freed up — alert anyone on the waitlist (fire-and-forget).
    void notifyWaitlistForFreedSlot(updatedBooking);
  }

  return {
    booking: updatedBooking,
    refundAmount,
    refundPercentage,
  };
};

export const checkInBookingByCode = async (
  checkInCode: string,
  requesterUserId: string,
  requesterRole: string
): Promise<BookingDocument> => {
  const normalizedCode = checkInCode.trim().toUpperCase();

  if (normalizedCode.length !== 8) {
    throw new Error("Check-in code must be 8 characters");
  }

  const booking = await Booking.findOne({ checkInCode: normalizedCode }).select("+checkInCode");

  if (!booking) {
    throw new Error("Invalid check-in code");
  }

  if (booking.status !== "CONFIRMED") {
    throw new Error(`Cannot check-in. Booking status is ${booking.status}`);
  }

  // Verify authorization (admin, venue owner, or assigned coach)
  if (requesterRole !== "Admin") {
    let isAuthorized = false;

    if (requesterRole === "Coach" && booking.coachId) {
      const coach = await Coach.findById(booking.coachId).select("userId");
      if (coach?.userId?.toString() === requesterUserId) {
        isAuthorized = true;
      }
    }

    if (!isAuthorized && booking.venueId) {
      const venue = await Venue.findById(booking.venueId).select("ownerId");
      if (venue?.ownerId?.toString() === requesterUserId) {
        isAuthorized = true;
      }
    }

    if (!isAuthorized) {
      throw new Error("Unauthorized to check in this booking");
    }
  }

  const now = new Date();
  const timeParts = booking.startTime.split(":").map(Number);
  const startHour = timeParts[0];
  const startMin = timeParts[1];

  if (startHour === undefined || startMin === undefined || isNaN(startHour) || isNaN(startMin)) {
    throw new Error("Invalid booking time format");
  }

  // UTC-safe — see combineDateAndTimeIST
  const bookingDateTime = combineDateAndTimeIST(booking.date, booking.startTime);

  // Check-in window: 15 minutes before start time
  const checkInWindow = new Date(bookingDateTime.getTime() - 15 * 60 * 1000);
  if (now < checkInWindow) {
    throw new Error(
      "Check-in not yet available. You can check in 15 minutes before the booking starts."
    );
  }

  // Check-in code expiration: exactly at booking end time
  const bookingEndDateTime = combineDateAndTimeIST(booking.date, booking.endTime);

  if (now > bookingEndDateTime) {
    throw new Error(
      "Check-in code has expired. Check-in is allowed only till the booking end time."
    );
  }

  const updatedBooking = await Booking.findOneAndUpdate(
    {
      _id: booking._id,
      status: "CONFIRMED",
    },
    {
      $set: { status: "IN_PROGRESS" },
    },
    { new: true }
  );

  if (!updatedBooking) {
    throw new Error("Cannot check-in. Booking status changed, please retry");
  }

  await recordBookingEventFor(updatedBooking, {
    type: "CHECKED_IN",
    fromStatus: "CONFIRMED",
    toStatus: "IN_PROGRESS",
    actorType: requesterRole === "Admin" ? "ADMIN" : "PROVIDER",
    actorUserId: requesterUserId,
    channel: requesterRole === "Admin" ? "ADMIN_PANEL" : "PROVIDER_WEB",
    summary: "Checked in with the booking's check-in code",
    metadata: {
      requesterRole,
      minutesFromScheduledStart: Math.round((now.getTime() - bookingDateTime.getTime()) / 60000),
    },
  });

  NotificationService.send({
    userId: updatedBooking.userId.toString(),
    type: "BOOKING_STATUS_UPDATED",
    title: "Booking checked in",
    message: `Your booking is now IN_PROGRESS for ${updatedBooking.sport}.`,
    data: {
      bookingId: updatedBooking._id.toString(),
      status: "IN_PROGRESS",
      date: updatedBooking.date.toISOString(),
      startTime: updatedBooking.startTime,
      endTime: updatedBooking.endTime,
    },
  }).catch(() => {});

  return updatedBooking;
};

/**
 * Confirm mock payment success and send booking confirmation email once
 */
export const confirmMockPaymentSuccess = async (
  bookingId: string,
  userId: string
): Promise<BookingDocument> => {
  const booking = await Booking.findById(bookingId).select("+checkInCode");

  if (!booking) {
    throw new Error("Booking not found");
  }

  if (booking.userId.toString() !== userId) {
    throw new Error("Unauthorized to confirm this booking");
  }

  if (booking.status === "CANCELLED") {
    throw new Error("Cannot confirm payment for a cancelled booking");
  }

  await Booking.findOneAndUpdate(
    {
      _id: bookingId,
      userId,
      status: { $ne: "CANCELLED" },
      paymentConfirmedAt: { $exists: false },
    },
    {
      $set: { paymentConfirmedAt: new Date() },
    }
  );

  const emailClaimedBooking = await Booking.findOneAndUpdate(
    {
      _id: bookingId,
      userId,
      status: { $in: ["AWAITING_PROVIDER", "CONFIRMED"] },
      confirmationEmailSentAt: { $exists: false },
    },
    {
      $set: { confirmationEmailSentAt: new Date() },
    },
    { new: true }
  ).select("+checkInCode");

  if (emailClaimedBooking) {
    await sendBookingLifecycleEmails(
      emailClaimedBooking,
      emailClaimedBooking.status === "CONFIRMED" ? "CONFIRMED" : "AWAITING_PROVIDER"
    );
  }

  const updatedBooking = await Booking.findById(bookingId).select("+checkInCode");
  if (!updatedBooking) {
    throw new Error("Booking not found");
  }

  // Send payment confirmation notification
  const venue = await Venue.findById(updatedBooking.venueId).select("name");
  NotificationService.send({
    userId: userId,
    type: "PAYMENT_CONFIRMED",
    title: "Payment Confirmed",
    message: `Your payment for ${updatedBooking.sport} at ${venue?.name || "the venue"} has been confirmed!`,
    data: {
      bookingId: updatedBooking._id.toString(),
      venueName: venue?.name || "Venue",
      sport: updatedBooking.sport,
      date: updatedBooking.date.toISOString(),
      startTime: updatedBooking.startTime,
      endTime: updatedBooking.endTime,
      totalAmount: updatedBooking.totalAmount,
    },
  }).catch((err: Error) =>
    log.error(`Failed to send payment confirmation notification to ${userId}:`, err)
  );
  if (updatedBooking.status !== "CONFIRMED") {
    NotificationService.send({
      userId: userId,
      type: "BOOKING_STATUS_UPDATED",
      title: "Awaiting provider confirmation",
      message: `Your booking for ${updatedBooking.sport} is awaiting provider confirmation.`,
      data: {
        bookingId: updatedBooking._id.toString(),
        status: updatedBooking.status,
        date: updatedBooking.date.toISOString(),
        startTime: updatedBooking.startTime,
        endTime: updatedBooking.endTime,
      },
    }).catch(() => {});

    return updatedBooking;
  }

  NotificationService.send({
    userId: userId,
    type: "BOOKING_CONFIRMED",
    title: "Booking confirmed",
    message: `Your booking for ${updatedBooking.sport} is confirmed.`,
    data: {
      bookingId: updatedBooking._id.toString(),
      status: updatedBooking.status,
      date: updatedBooking.date.toISOString(),
      startTime: updatedBooking.startTime,
      endTime: updatedBooking.endTime,
    },
  }).catch(() => {});

  // Create booking reminders
  const user = await User.findById(userId).select("reminderPreferences notificationPreferences");
  if (user && user.reminderPreferences?.bookingReminders?.enabled) {
    ScheduledNotificationService.createBookingReminders(
      {
        bookingId: updatedBooking._id,
        userId: updatedBooking.userId,
        bookingDate: updatedBooking.date,
        startTime: updatedBooking.startTime,
        endTime: updatedBooking.endTime,
        sport: updatedBooking.sport,
        venueName: venue?.name,
        coachName: undefined,
      },
      user.reminderPreferences.bookingReminders,
      {
        email: user.notificationPreferences?.email?.bookingReminders ?? true,
        push: user.notificationPreferences?.push?.bookingReminders ?? true,
        inApp: user.notificationPreferences?.inApp?.bookingReminders ?? true,
      }
    ).catch((err: Error) => log.error(`Failed to create booking reminders for ${userId}:`, err));
  }

  return updatedBooking;
};

/**
 * `context` attributes the resulting audit event to the surface that drove it
 * — the same payment can be confirmed by the user's browser returning from
 * PhonePe, by the webhook, or by a reconciliation job, and the log is much
 * less useful if all three look identical. Defaults to the gateway/webhook
 * pairing since that is the authoritative path.
 */
export const updatePaymentStatus = async (
  bookingId: string,
  payerUserId: string,
  status: "PAID" | "PENDING" | "FAILED",
  session?: ClientSession,
  context?: {
    actorType?: BookingEventActorType;
    channel?: BookingEventChannel;
    actorUserId?: string;
    metadata?: Record<string, unknown>;
  }
): Promise<BookingDocument> => {
  const bookingQuery = Booking.findById(bookingId);
  if (session) {
    bookingQuery.session(session);
  }

  const booking = await bookingQuery;

  if (!booking) {
    throw new Error("Booking not found");
  }

  const wasPaymentConfirmed = Boolean(booking.paymentConfirmedAt);

  if (booking.payments && booking.payments.length > 0) {
    booking.payments = booking.payments.map((payment) => {
      if (payment.userId.toString() !== payerUserId) {
        return payment;
      }

      // Use toObject() to safely spread Mongoose subdocuments
      const plain =
        typeof (payment as any).toObject === "function" ? (payment as any).toObject() : payment;
      return {
        ...plain,
        status,
        ...(status === "PAID" ? { paidAt: new Date() } : {}),
      };
    });
  }

  // Set paymentConfirmedAt when all PLAYER entries are PAID.
  // VENUE_LISTER/COACH entries represent payee splits (payout tracking)
  // and are released by the scheduled payout job, not by the player paying.
  if (
    status === "PAID" &&
    (!booking.payments.length ||
      booking.payments
        .filter((payment) => payment.userType === "Player")
        .every((payment) => payment.status === "PAID"))
  ) {
    booking.paymentConfirmedAt = new Date();

    // The booking is now fully paid, so it moves from "we are waiting on the
    // customer" to "we are waiting on the provider". This transition is the
    // reason AWAITING_PAYMENT and AWAITING_PROVIDER are separate states: it
    // used to be expressed only by paymentConfirmedAt appearing on a booking
    // whose status never changed, which meant every consumer had to know to
    // check a timestamp to understand what the booking was waiting for.
    if (booking.status === "AWAITING_PAYMENT") {
      booking.status = "AWAITING_PROVIDER";
    }
  }

  if (session) {
    await booking.save({ session });
  } else {
    await booking.save();
  }

  const payerShare = booking.payments?.find((payment) => payment.userId.toString() === payerUserId);
  const eventActorType = context?.actorType ?? "GATEWAY";
  const eventChannel = context?.channel ?? "WEBHOOK";

  if (status === "PAID") {
    await recordBookingEventFor(booking, {
      type: "PAYMENT_CONFIRMED",
      toStatus: booking.status,
      actorType: eventActorType,
      actorUserId: context?.actorUserId ?? payerUserId,
      channel: eventChannel,
      amountPaise: toPaise(payerShare?.amount ?? booking.totalAmount),
      summary: booking.paymentConfirmedAt
        ? "Payment confirmed — booking fully paid"
        : "Payment received for one share — awaiting remaining shares",
      metadata: {
        payerUserId,
        fullyPaid: Boolean(booking.paymentConfirmedAt),
        ...(context?.metadata ?? {}),
      },
    });
  }

  if (status === "PAID" && booking.paymentConfirmedAt && !wasPaymentConfirmed) {
    await sendBookingPaymentConfirmation(bookingId);
  }

  // Send payment status notification and delete booking if failed
  if (status === "FAILED") {
    // Recorded BEFORE the delete below. The booking document is about to be
    // destroyed outright, so this event is the only durable trace that it
    // ever existed — which is much of the point of having an audit log.
    await recordBookingEventFor(booking, {
      type: "PAYMENT_FAILED",
      fromStatus: booking.status,
      actorType: eventActorType,
      actorUserId: context?.actorUserId ?? payerUserId,
      channel: eventChannel,
      amountPaise: toPaise(payerShare?.amount ?? booking.totalAmount),
      summary: "Payment failed — booking document hard-deleted by updatePaymentStatus",
      metadata: {
        payerUserId,
        bookingDeleted: true,
        sport: booking.sport,
        date: getDateKey(booking.date),
        startTime: booking.startTime,
        endTime: booking.endTime,
        ...(context?.metadata ?? {}),
      },
    });

    // Automatically delete the booking if payment fails
    // This removes unpaid bookings from showing up for coaches/venues/players
    if (session) {
      await Booking.deleteOne({ _id: booking._id }, { session });
    } else {
      await Booking.deleteOne({ _id: booking._id });
    }

    const venue = await Venue.findById(booking.venueId).select("name");
    NotificationService.send({
      userId: payerUserId,
      type: "PAYMENT_FAILED",
      title: "Payment Failed",
      message: `Your payment for ${booking.sport} at ${venue?.name || "the venue"} has failed. Please try again.`,
      data: {
        bookingId: booking._id.toString(),
        venueName: venue?.name || "Venue",
        sport: booking.sport,
        date: booking.date.toISOString(),
        startTime: booking.startTime,
        endTime: booking.endTime,
        amount: booking.payments.find((p) => p.userId.toString() === payerUserId)?.amount || 0,
      },
    }).catch((err: Error) =>
      log.error(`Failed to send payment failed notification to ${payerUserId}:`, err)
    );
  }

  return booking;
};

export const confirmBookingByProvider = async (
  bookingId: string,
  providerUserId: string
): Promise<BookingDocument> => {
  const booking = await Booking.findById(bookingId).select("+checkInCode");

  if (!booking) {
    throw new Error("Booking not found");
  }

  if (booking.status !== "AWAITING_PROVIDER") {
    throw new Error("Booking is not awaiting confirmation");
  }

  const isAuthorized = await isProviderAuthorizedForBooking(booking, providerUserId);
  if (!isAuthorized) {
    throw new Error("Not authorized to confirm this booking");
  }

  if (!booking.paymentConfirmedAt) {
    throw new Error("Payment has not been confirmed yet");
  }

  const previousStatus = booking.status;
  booking.status = "CONFIRMED";
  await booking.save();

  await recordBookingEventFor(booking, {
    type: "PROVIDER_CONFIRMED",
    fromStatus: previousStatus,
    toStatus: "CONFIRMED",
    actorType: "PROVIDER",
    actorUserId: providerUserId,
    channel: "PROVIDER_WEB",
    summary: "Provider accepted the booking",
  });

  const venue = await Venue.findById(booking.venueId).select("name");
  const participantIds = getBookingParticipantIds(booking);

  for (const participantId of participantIds) {
    NotificationService.send({
      userId: participantId,
      type: "BOOKING_CONFIRMED",
      title: "Booking confirmed",
      message: `Your booking for ${booking.sport} at ${venue?.name || "the venue"} is confirmed.`,
      data: {
        bookingId: booking._id.toString(),
        venueName: venue?.name || "Venue",
        sport: booking.sport,
        date: booking.date.toISOString(),
        startTime: booking.startTime,
        endTime: booking.endTime,
        status: booking.status,
      },
    }).catch(() => {});
  }

  await sendBookingLifecycleEmails(booking, "CONFIRMED");

  const user = await User.findById(booking.userId).select(
    "reminderPreferences notificationPreferences"
  );
  if (user && user.reminderPreferences?.bookingReminders?.enabled) {
    ScheduledNotificationService.createBookingReminders(
      {
        bookingId: booking._id,
        userId: booking.userId,
        bookingDate: booking.date,
        startTime: booking.startTime,
        endTime: booking.endTime,
        sport: booking.sport,
        venueName: venue?.name,
        coachName: undefined,
      },
      user.reminderPreferences.bookingReminders,
      {
        email: user.notificationPreferences?.email?.bookingReminders ?? true,
        push: user.notificationPreferences?.push?.bookingReminders ?? true,
        inApp: user.notificationPreferences?.inApp?.bookingReminders ?? true,
      }
    ).catch((err: Error) =>
      log.error(`Failed to create booking reminders for ${booking.userId.toString()}:`, err)
    );
  }

  return booking;
};

/**
 * Reschedule a confirmed booking to a new date/time — coach-initiated.
 * Only CONFIRMED bookings can be rescheduled.
 */
export const rescheduleBookingByCoach = async (
  bookingId: string,
  coachUserId: string,
  newDate: Date,
  newStartTime: string,
  newEndTime: string
): Promise<BookingDocument> => {
  if (!mongoose.Types.ObjectId.isValid(bookingId)) {
    throw new Error("Invalid booking ID");
  }

  const booking = await Booking.findById(bookingId);
  if (!booking) throw new Error("Booking not found");

  if (booking.status !== "CONFIRMED") {
    throw new Error("Only confirmed bookings can be rescheduled");
  }

  // Verify the requesting user is actually the assigned coach
  const coach = await Coach.findOne({ userId: coachUserId }).select("_id");
  if (!coach) throw new Error("Coach profile not found");

  if (!booking.coachId || booking.coachId.toString() !== coach._id.toString()) {
    throw new Error("Not authorized to reschedule this booking");
  }

  // Check that the new slot doesn't conflict with another booking
  const conflict = await Booking.findOne({
    _id: { $ne: booking._id },
    coachId: coach._id,
    date: newDate,
    status: {
      $in: ["CONFIRMED", "IN_PROGRESS", "AWAITING_PAYMENT", "AWAITING_PROVIDER"],
    },
    $or: [{ startTime: { $lt: newEndTime }, endTime: { $gt: newStartTime } }],
  });

  if (conflict) {
    throw new Error("The requested time slot conflicts with an existing booking");
  }

  const previousSlot = {
    date: getDateKey(booking.date),
    startTime: booking.startTime,
    endTime: booking.endTime,
  };

  booking.date = newDate;
  booking.startTime = newStartTime;
  booking.endTime = newEndTime;
  await booking.save();

  await recordBookingEventFor(booking, {
    type: "RESCHEDULED",
    fromStatus: booking.status,
    toStatus: booking.status,
    actorType: "PROVIDER",
    actorUserId: coachUserId,
    channel: "PROVIDER_WEB",
    summary: `Coach moved the session from ${previousSlot.date} ${previousSlot.startTime}-${previousSlot.endTime} to ${getDateKey(newDate)} ${newStartTime}-${newEndTime}`,
    metadata: {
      from: previousSlot,
      to: {
        date: getDateKey(newDate),
        startTime: newStartTime,
        endTime: newEndTime,
      },
    },
  });

  return booking;
};

export const rejectBookingByProvider = async (
  bookingId: string,
  providerUserId: string,
  reason?: string
): Promise<{
  booking: BookingDocument;
  refundAmount: number;
  refundStatus?: "PENDING" | "PROCESSED" | "REJECTED";
}> => {
  const booking = await Booking.findById(bookingId);

  if (!booking) {
    throw new Error("Booking not found");
  }

  if (booking.status !== "AWAITING_PROVIDER") {
    throw new Error("Booking is not awaiting confirmation");
  }

  const isAuthorized = await isProviderAuthorizedForBooking(booking, providerUserId);
  if (!isAuthorized) {
    throw new Error("Not authorized to reject this booking");
  }

  const statusBeforeRejection = booking.status;
  booking.status = "CANCELLED";
  booking.cancelledAt = new Date();
  booking.cancellationReason = reason || "Rejected by provider";
  await booking.save();

  await recordBookingEventFor(booking, {
    type: "PROVIDER_REJECTED",
    fromStatus: statusBeforeRejection,
    toStatus: "CANCELLED",
    actorType: "PROVIDER",
    actorUserId: providerUserId,
    channel: "PROVIDER_WEB",
    summary: "Provider declined the booking — full refund owed",
    metadata: {
      reason: booking.cancellationReason,
      wasPaid: Boolean(booking.paymentConfirmedAt),
    },
  });

  let refundAmount = 0;
  let refundStatus: "PENDING" | "PROCESSED" | "REJECTED" | undefined;
  if (booking.paymentConfirmedAt) {
    try {
      const refund = await processBookingRefund(bookingId, 100, booking.cancellationReason);
      refundAmount = refund.refundAmount;
      refundStatus = refund.refundStatus;
    } catch (error) {
      log.error("Failed to process provider rejection refund:", error);
    }
  }

  const venue = await Venue.findById(booking.venueId).select("name");
  const participantIds = getBookingParticipantIds(booking);

  for (const participantId of participantIds) {
    NotificationService.send({
      userId: participantId,
      type: "BOOKING_CANCELLED",
      title: "Booking declined",
      message: `Your booking for ${booking.sport} at ${venue?.name || "the venue"} was declined by the provider.`,
      data: {
        bookingId: booking._id.toString(),
        venueName: venue?.name || "Venue",
        sport: booking.sport,
        date: booking.date.toISOString(),
        startTime: booking.startTime,
        endTime: booking.endTime,
        status: booking.status,
        refundAmount,
        refundStatus,
      },
    }).catch(() => {});
  }

  ScheduledNotificationService.cancelBookingReminders(booking._id).catch(() => {});

  await sendBookingLifecycleEmails(booking, "CANCELLED", {
    cancellationReason: booking.cancellationReason,
    refundAmount,
    refundPercentage: 100,
  });

  return {
    booking,
    refundAmount,
    ...(refundStatus !== undefined ? { refundStatus } : {}),
  };
};
