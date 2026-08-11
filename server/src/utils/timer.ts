import { Booking } from "../client/models/Booking";
import { BookingPaymentTransaction } from "../client/models/BookingPayment";
import { initiateRefund } from "../client/services/RefundService";
import { NotificationService } from "../client/services/NotificationService";
import { recordBookingEventFor } from "../client/services/BookingEventService";

/**
 * Set booking expiration time (10 minutes from now)
 * @returns Date object 10 minutes in the future
 */
export const getBookingExpirationTime = (): Date => {
  const expirationTime = new Date();
  expirationTime.setMinutes(expirationTime.getMinutes() + 10);
  return expirationTime;
};

/**
 * Check and expire bookings that have passed their expiration time without
 * being confirmed by the venue/coach, and auto-refund any payment already
 * collected for them.
 *
 * This should be run as a background job/cron.
 */
export const expireOldBookings = async (): Promise<number> => {
  try {
    const now = new Date();

    // NOTE: bookings awaiting venue/coach confirmation are created with
    // status "PENDING_CONFIRMATION" (see BookingService.initiateBooking) —
    // this previously queried the non-existent status "PENDING_PAYMENT",
    // which is not a valid enum value on the Booking model, so this job
    // silently matched zero documents on every run since it was written.
    const expiredCandidates = await Booking.find({
      status: "PENDING_CONFIRMATION",
      expiresAt: { $lte: now },
    });

    let expiredCount = 0;

    for (const booking of expiredCandidates) {
      try {
        // Guard the status in the filter too, in case something else raced
        // this booking to CONFIRMED/CANCELLED between the find() and here.
        const updated = await Booking.findOneAndUpdate(
          { _id: booking._id, status: "PENDING_CONFIRMATION" },
          { $set: { status: "EXPIRED" } },
        );
        if (!updated) continue;
        expiredCount++;

        await recordBookingEventFor(booking, {
          type: "EXPIRED",
          fromStatus: "PENDING_CONFIRMATION",
          toStatus: "EXPIRED",
          actorType: "SYSTEM",
          channel: "CRON",
          occurredAt: booking.expiresAt ?? now,
          summary:
            "Hold expired — venue/coach did not confirm before the deadline",
          metadata: {
            organizerId: booking.organizerId?.toString(),
            expiresAt: booking.expiresAt?.toISOString(),
          },
        });

        // Refund any payment already collected — the parent shouldn't be
        // charged for a slot the venue/coach never confirmed.
        const transaction = await BookingPaymentTransaction.findOne({
          bookingId: booking._id,
          status: "COMPLETED",
        });

        if (transaction && !transaction.refundState) {
          try {
            await initiateRefund({
              bookingPaymentTransactionId: transaction._id.toString(),
              amount: transaction.amount,
              reason:
                "Booking expired — not confirmed by the venue/coach in time",
            });

            await recordBookingEventFor(booking, {
              type: "REFUND_INITIATED",
              actorType: "SYSTEM",
              channel: "CRON",
              amountPaise: transaction.amount,
              summary: "Auto-refund initiated for an expired unconfirmed booking",
              metadata: {
                transactionId: transaction._id.toString(),
                merchantOrderId: transaction.merchantOrderId,
                trigger: "expiry_auto_refund",
              },
            });

            console.log(
              `Auto-refunded expired booking ${booking._id} (transaction ${transaction._id})`,
            );

            // Let the parent know why — a silent refund with no explanation
            // is confusing. organizerId is who's financially responsible for
            // the booking (same convention RefundService uses for cancellations).
            const rupees = (transaction.amount / 100).toLocaleString("en-IN");
            await NotificationService.send(
              {
                userId: booking.organizerId.toString(),
                type: "PAYMENT_REFUND",
                title: "Booking expired — refund initiated",
                message: `Your ${booking.sport} booking on ${booking.startTime}-${booking.endTime} wasn't confirmed by the venue/coach in time, so it has expired. We've initiated a refund of ₹${rupees} to your original payment method.`,
                data: { bookingId: booking._id.toString() },
              },
              { sendEmail: true },
            ).catch((notifyError) => {
              console.error(
                `Failed to send expiration/refund notification for booking ${booking._id}:`,
                notifyError,
              );
            });
          } catch (refundError) {
            // Don't let a refund failure block expiring the rest of the
            // batch — this booking stays EXPIRED and needs manual refund
            // follow-up, which is preferable to silently retrying forever.
            console.error(
              `Failed to auto-refund expired booking ${booking._id}:`,
              refundError,
            );

            // This is exactly the case that needs a durable trace: the booking
            // is EXPIRED, the customer is owed money, and nothing else records
            // that the automated attempt failed.
            await recordBookingEventFor(booking, {
              type: "REFUND_FAILED",
              actorType: "SYSTEM",
              channel: "CRON",
              amountPaise: transaction.amount,
              summary:
                "Auto-refund for an expired booking failed — needs manual follow-up",
              metadata: {
                transactionId: transaction._id.toString(),
                merchantOrderId: transaction.merchantOrderId,
                trigger: "expiry_auto_refund",
                error:
                  refundError instanceof Error
                    ? refundError.message
                    : String(refundError),
              },
            });
          }
        }
      } catch (error) {
        console.error(`Error expiring booking ${booking._id}:`, error);
      }
    }

    return expiredCount;
  } catch (error) {
    console.error("Error expiring bookings:", error);
    throw error;
  }
};

/**
 * Start a timer to check for expired bookings every minute
 * Call this when the server starts
 */
export const startExpirationJob = (): NodeJS.Timeout => {
  console.log("Starting booking expiration job...");

  // Run immediately on start
  expireOldBookings()
    .then((count) => {
      if (count > 0) {
        console.log(`Expired ${count} old bookings on startup`);
      }
    })
    .catch((error) => {
      console.error("Error in initial expiration check:", error);
    });

  // Then run every minute
  const interval = setInterval(() => {
    expireOldBookings()
      .then((count) => {
        if (count > 0) {
          console.log(`Expired ${count} bookings`);
        }
      })
      .catch((error) => {
        console.error("Error in expiration job:", error);
      });
  }, 60 * 1000); // Every 60 seconds

  return interval;
};
