import { randomBytes } from "crypto";
import { Booking, BookingDocument } from "../../models/Booking";
import { Coach } from "../../models/Coach";
import { User } from "../../models/User";
import { Venue } from "../../models/Venue";
import { BookingWaitlist } from "../../models/BookingWaitlist";
import { BookingPaymentTransaction } from "../../models/BookingPayment";
import { sendBookingLifecycleEmail, sendWaitlistSlotAvailableEmail } from "../../../utils/email";
import { NotificationService } from "../NotificationService";
import { ScheduledNotificationService } from "../ScheduledNotificationService";
import { initiatePhonePeRefund } from "../../../shared/services/PhonePeService";
import { log, toPaise } from "./shared";

const getBookingLifecycleRecipients = async (
  booking: BookingDocument
): Promise<Array<{ name: string; email: string; role: "Player" | "PROVIDER" }>> => {
  const recipients: Array<{
    name: string;
    email: string;
    role: "Player" | "PROVIDER";
  }> = [];

  const player = await User.findById(booking.userId).select("name email");
  if (player?.email) {
    recipients.push({
      name: player.name || "Player",
      email: player.email,
      role: "Player",
    });
  }

  if (booking.coachId) {
    const coach = await Coach.findById(booking.coachId)
      .populate("userId", "name email")
      .select("userId");
    const coachUser = coach?.userId as { name?: string; email?: string } | undefined;
    if (coachUser?.email) {
      recipients.push({
        name: coachUser.name || "Coach",
        email: coachUser.email,
        role: "PROVIDER",
      });
    }
  }

  if (booking.venueId) {
    const venue = await Venue.findById(booking.venueId)
      .populate("ownerId", "name email")
      .select("ownerId");
    const venueOwner = venue?.ownerId as { name?: string; email?: string } | undefined;
    if (venueOwner?.email) {
      recipients.push({
        name: venueOwner.name || "Venue Owner",
        email: venueOwner.email,
        role: "PROVIDER",
      });
    }
  }

  const uniqueRecipients = new Map<
    string,
    { name: string; email: string; role: "Player" | "PROVIDER" }
  >();
  for (const recipient of recipients) {
    uniqueRecipients.set(recipient.email.toLowerCase(), recipient);
  }

  return Array.from(uniqueRecipients.values());
};

export const sendBookingLifecycleEmails = async (
  booking: BookingDocument,
  state: "AWAITING_PROVIDER" | "CONFIRMED" | "CANCELLED",
  extra: {
    refundAmount?: number;
    refundPercentage?: number;
    cancellationReason?: string;
  } = {}
): Promise<void> => {
  const recipients = await getBookingLifecycleRecipients(booking);
  const venueName = (await Venue.findById(booking.venueId).select("name"))?.name || "Venue";

  await Promise.all(
    recipients.map(async (recipient) => {
      try {
        await sendBookingLifecycleEmail({
          email: recipient.email,
          name: recipient.name,
          venueName,
          sport: booking.sport,
          date: booking.date,
          startTime: booking.startTime,
          endTime: booking.endTime,
          totalAmount: booking.totalAmount,
          state,
          recipientRole: recipient.role,
          ...(booking.checkInCode && state === "CONFIRMED" && recipient.role === "Player"
            ? { checkInCode: booking.checkInCode }
            : {}),
          ...extra,
        });
      } catch (error) {
        log.error(`Failed to send booking lifecycle email to ${recipient.email}:`, error);
      }
    })
  );
};

const buildRefundTargets = (
  booking: BookingDocument,
  refundPercentage: number
): Array<{ userId: string; amountPaise: number }> => {
  const percent = Math.max(0, Math.min(100, refundPercentage));

  if (booking.payments && booking.payments.length > 0) {
    const playerPayments = booking.payments.filter(
      (payment) => payment.userType === "Player" && payment.status === "PAID"
    );

    if (playerPayments.length > 0) {
      return playerPayments.map((payment) => ({
        userId: payment.userId.toString(),
        amountPaise: toPaise((payment.amount * percent) / 100),
      }));
    }
  }

  return [
    {
      userId: booking.userId.toString(),
      amountPaise: toPaise((booking.totalAmount * percent) / 100),
    },
  ];
};

export const initiateBookingRefunds = async (
  booking: BookingDocument,
  refundPercentage: number,
  reason: string
): Promise<{
  refundStatus: "PENDING" | "PROCESSED" | "REJECTED";
  refundAmount: number;
}> => {
  const targets = buildRefundTargets(booking, refundPercentage).filter(
    (target) => target.amountPaise >= 100
  );

  if (targets.length === 0) {
    throw new Error("No refundable payment amount found for this booking");
  }

  let hasPending = false;
  let totalRefundPaise = 0;
  let skippedRefundPaise = 0;

  for (const target of targets) {
    // Accept PENDING transactions too — payment may still be settling at PhonePe
    // when the user cancels immediately after paying. The retry job picks these up.
    const transaction = await BookingPaymentTransaction.findOne({
      bookingId: booking._id,
      userId: target.userId,
      status: { $in: ["COMPLETED", "PENDING"] },
    }).sort({ createdAt: -1 });

    if (!transaction) {
      // No payment record at all — defer to retry job rather than hard-fail.
      hasPending = true;
      continue;
    }

    // Payment still settling — defer, retry job will attempt once it's COMPLETED.
    if (transaction.status !== "COMPLETED") {
      hasPending = true;
      skippedRefundPaise += target.amountPaise;
      continue;
    }

    // Skip already-initiated or completed refunds — allow FAILED to be retried.
    if (transaction.refundState && transaction.refundState !== "FAILED") {
      hasPending = transaction.refundState !== "COMPLETED";
      skippedRefundPaise += transaction.refundAmount || target.amountPaise;
      continue;
    }

    const refundMerchantId = `rf_${Date.now()}_${randomBytes(4).toString("hex")}`;
    try {
      const refundResponse = await initiatePhonePeRefund({
        merchantRefundId: refundMerchantId,
        originalMerchantOrderId: transaction.merchantOrderId,
        amount: target.amountPaise / 100, // initiatePhonePeRefund expects rupees
      });
      const refundState = refundResponse.state || "INITIATED";
      const refundId = refundResponse.refundId ?? transaction.refundId;

      transaction.refundMerchantId = refundMerchantId;
      if (refundId) transaction.refundId = refundId;
      transaction.refundState = refundState;
      transaction.refundAmount = target.amountPaise;
      transaction.refundResponse = refundResponse.raw;
      await transaction.save();

      totalRefundPaise += target.amountPaise;

      // FAILED or INITIATED both stay PENDING — polling/retry job closes the loop.
      if (refundState !== "COMPLETED") hasPending = true;
    } catch (err) {
      // PhonePe threw — record the attempt and defer. Never hard-reject here.
      transaction.refundMerchantId = refundMerchantId;
      transaction.refundState = "FAILED";
      transaction.refundAmount = target.amountPaise;
      await transaction.save();
      hasPending = true;
      totalRefundPaise += target.amountPaise;
      log.error(
        `[initiateBookingRefunds] PhonePe call failed for booking ${booking._id}, will retry:`,
        err
      );
    }
  }

  // No transactions processed (all deferred) — stay PENDING for retry job.
  if (totalRefundPaise === 0) {
    return {
      refundStatus: "PENDING",
      refundAmount:
        skippedRefundPaise > 0
          ? skippedRefundPaise / 100
          : (booking.refundAmount ?? Math.round((booking.totalAmount * refundPercentage) / 100)),
    };
  }

  return {
    refundStatus: hasPending ? "PENDING" : "PROCESSED",
    refundAmount: Math.round(totalRefundPaise + skippedRefundPaise) / 100,
  };
};

export const sendBookingPaymentConfirmation = async (bookingId: string): Promise<void> => {
  const booking = await Booking.findById(bookingId).select("+checkInCode");

  if (!booking) {
    return;
  }

  const emailClaimedBooking = await Booking.findOneAndUpdate(
    {
      _id: bookingId,
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

  const venue = await Venue.findById(booking.venueId).select("name");
  NotificationService.send({
    userId: booking.userId.toString(),
    type: "PAYMENT_CONFIRMED",
    title: "Payment Confirmed",
    message: `Your payment for ${booking.sport} at ${venue?.name || "the venue"} has been confirmed!`,
    data: {
      bookingId: booking._id.toString(),
      venueName: venue?.name || "Venue",
      sport: booking.sport,
      date: booking.date.toISOString(),
      startTime: booking.startTime,
      endTime: booking.endTime,
      totalAmount: booking.totalAmount,
    },
  }).catch((err: Error) =>
    log.error(
      `Failed to send payment confirmation notification to ${booking.userId.toString()}:`,
      err
    )
  );

  if (booking.status !== "CONFIRMED") {
    NotificationService.send({
      userId: booking.userId.toString(),
      type: "BOOKING_STATUS_UPDATED",
      title: "Awaiting provider confirmation",
      message: `Your booking for ${booking.sport} is awaiting provider confirmation.`,
      data: {
        bookingId: booking._id.toString(),
        status: booking.status,
        date: booking.date.toISOString(),
        startTime: booking.startTime,
        endTime: booking.endTime,
      },
    }).catch(() => {});

    return;
  }

  NotificationService.send({
    userId: booking.userId.toString(),
    type: "BOOKING_CONFIRMED",
    title: "Booking confirmed",
    message: `Your booking for ${booking.sport} is confirmed.`,
    data: {
      bookingId: booking._id.toString(),
      status: booking.status,
      date: booking.date.toISOString(),
      startTime: booking.startTime,
      endTime: booking.endTime,
    },
  }).catch(() => {});

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
};

export const isProviderAuthorizedForBooking = async (
  booking: BookingDocument,
  providerUserId: string
): Promise<boolean> => {
  const checks: Array<Promise<boolean>> = [];

  if (booking.coachId) {
    checks.push(
      Coach.findById(booking.coachId)
        .select("userId")
        .then((coach) => coach?.userId?.toString() === providerUserId)
    );
  }

  if (booking.venueId) {
    checks.push(
      Venue.findById(booking.venueId)
        .select("ownerId")
        .then((venue) => venue?.ownerId?.toString() === providerUserId)
    );
  }

  if (checks.length === 0) {
    return false;
  }

  const results = await Promise.all(checks);
  return results.some(Boolean);
};

/**
 * When a booking is cancelled, alert users waiting on the same slot (same
 * coach/venue + date + start time) by email, then mark their waitlist entry
 * NOTIFIED so they are not pinged repeatedly. Best-effort; never throws.
 */
export const notifyWaitlistForFreedSlot = async (booking: BookingDocument): Promise<void> => {
  try {
    const match: Record<string, unknown> = {
      status: "ACTIVE",
      date: booking.date,
      startTime: booking.startTime,
    };
    if (booking.coachId) {
      match.coachId = booking.coachId;
    } else if (booking.venueId) {
      match.venueId = booking.venueId;
    } else {
      return;
    }

    const entries = await BookingWaitlist.find(match).limit(50);
    if (entries.length === 0) {
      return;
    }

    let venueName = "your coach";
    if (booking.venueId) {
      const venue = await Venue.findById(booking.venueId).select("name").lean();
      venueName = venue?.name || "the venue";
    }

    for (const entry of entries) {
      try {
        const user = await User.findById(entry.userId).select("name email").lean();
        if (user?.email) {
          await sendWaitlistSlotAvailableEmail({
            name: user.name,
            email: user.email,
            venueName,
            sport: booking.sport,
            date: booking.date,
            startTime: booking.startTime,
            endTime: booking.endTime,
          });
        }
        entry.status = "NOTIFIED";
        await entry.save();
      } catch (perEntryError) {
        log.error("Failed to notify waitlist entry", entry._id?.toString(), perEntryError);
      }
    }
  } catch (error) {
    log.error("Failed to notify waitlist for freed slot:", error);
  }
};
