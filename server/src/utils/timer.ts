import { Booking } from "../models/Booking";

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
 * Check and expire bookings that have passed their expiration time
 * This should be run as a background job/cron
 */
export const expireOldBookings = async (): Promise<number> => {
  try {
    const now = new Date();

    const result = await Booking.updateMany(
      {
        status: "PENDING_PAYMENT",
        expiresAt: { $lte: now },
      },
      {
        $set: { status: "EXPIRED" },
      },
    );

    return result.modifiedCount;
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
