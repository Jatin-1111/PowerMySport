import {
  ScheduledNotification,
  ReminderInterval,
  ScheduledNotificationStatus,
} from "../models/ScheduledNotification";
import { NotificationService } from "./NotificationService";
import { NotificationCategory } from "../models/Notification";
import pushNotificationService from "./pushNotificationService";
import { sendBookingReminderEmail } from "../utils/email";
import mongoose from "mongoose";

interface BookingReminderData {
  bookingId: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  bookingDate: Date;
  startTime: string;
  endTime: string;
  sport: string;
  venueName: string | undefined;
  coachName: string | undefined;
}

interface ReminderChannels {
  email: boolean;
  push: boolean;
  inApp: boolean;
}

export class ScheduledNotificationService {
  /**
   * Create booking reminders for a confirmed booking
   */
  static async createBookingReminders(
    bookingData: BookingReminderData,
    userPreferences: {
      enabled?: boolean;
      intervals?: {
        twentyFourHours?: boolean;
        oneHour?: boolean;
        fifteenMinutes?: boolean;
      };
    },
    channels: ReminderChannels,
  ): Promise<void> {
    try {
      // Use defaults if preferences are not set
      const enabled = userPreferences.enabled ?? true;
      const intervals = {
        twentyFourHours: userPreferences.intervals?.twentyFourHours ?? true,
        oneHour: userPreferences.intervals?.oneHour ?? true,
        fifteenMinutes: userPreferences.intervals?.fifteenMinutes ?? true,
      };

      if (!enabled) {
        console.log("Booking reminders disabled for user:", bookingData.userId);
        return;
      }

      const bookingDateTime = this.combineDateTime(
        bookingData.bookingDate,
        bookingData.startTime,
      );

      const reminders: Array<{
        interval: ReminderInterval;
        minutesBefore: number;
        enabled: boolean;
      }> = [
        {
          interval: "24_HOURS",
          minutesBefore: 24 * 60,
          enabled: intervals.twentyFourHours,
        },
        {
          interval: "1_HOUR",
          minutesBefore: 60,
          enabled: intervals.oneHour,
        },
        {
          interval: "15_MINUTES",
          minutesBefore: 15,
          enabled: intervals.fifteenMinutes,
        },
      ];

      const serviceName =
        bookingData.venueName || bookingData.coachName || "your session";

      for (const reminder of reminders) {
        if (!reminder.enabled) continue;

        const scheduledFor = new Date(
          bookingDateTime.getTime() - reminder.minutesBefore * 60 * 1000,
        );

        // Don't schedule reminders in the past
        if (scheduledFor < new Date()) {
          console.log(
            `Skipping ${reminder.interval} reminder for booking ${bookingData.bookingId} - time has passed`,
          );
          continue;
        }

        const title = this.getReminderTitle(reminder.interval);
        const body = this.getReminderBody(
          reminder.interval,
          bookingData.sport,
          serviceName,
          bookingData.startTime,
        );

        await ScheduledNotification.create({
          userId: bookingData.userId,
          type: "BOOKING_REMINDER",
          interval: reminder.interval,
          scheduledFor,
          status: "PENDING",
          bookingId: bookingData.bookingId,
          title,
          body,
          data: {
            bookingId: bookingData.bookingId.toString(),
            url: `/bookings/${bookingData.bookingId}`,
            sport: bookingData.sport,
            startTime: bookingData.startTime,
            endTime: bookingData.endTime,
          },
          channels: {
            email: channels.email,
            push: channels.push,
            inApp: channels.inApp,
          },
        });

        console.log(
          `Created ${reminder.interval} reminder for booking ${bookingData.bookingId} at ${scheduledFor.toISOString()}`,
        );
      }
    } catch (error) {
      console.error("Error creating booking reminders:", error);
      throw error;
    }
  }

  /**
   * Cancel all pending reminders for a booking (when booking is cancelled)
   */
  static async cancelBookingReminders(
    bookingId: mongoose.Types.ObjectId,
  ): Promise<number> {
    try {
      const result = await ScheduledNotification.updateMany(
        {
          bookingId,
          status: "PENDING",
        },
        {
          $set: { status: "CANCELLED" as ScheduledNotificationStatus },
        },
      );

      console.log(
        `Cancelled ${result.modifiedCount} reminders for booking ${bookingId}`,
      );
      return result.modifiedCount;
    } catch (error) {
      console.error("Error cancelling booking reminders:", error);
      throw error;
    }
  }

  /**
   * Process pending reminders that are due to be sent
   */
  static async processPendingReminders(batchSize: number = 100): Promise<{
    processed: number;
    sent: number;
    failed: number;
  }> {
    try {
      const now = new Date();

      // Find pending reminders that are due
      const pendingReminders = await ScheduledNotification.find({
        status: "PENDING",
        scheduledFor: { $lte: now },
      })
        .limit(batchSize)
        .populate(
          "userId",
          "email name notificationPreferences pushSubscriptions",
        )
        .populate("bookingId", "status date startTime sport");

      const stats = {
        processed: pendingReminders.length,
        sent: 0,
        failed: 0,
      };

      for (const reminder of pendingReminders) {
        try {
          // Check if booking still exists and is still valid
          const booking = reminder.bookingId as any;
          if (!booking || booking.status === "CANCELLED") {
            await ScheduledNotification.findByIdAndUpdate(reminder._id, {
              status: "CANCELLED",
            });
            console.log(
              `Cancelled reminder ${reminder._id} - booking no longer valid`,
            );
            continue;
          }

          const user = reminder.userId as any;
          if (!user) {
            await ScheduledNotification.findByIdAndUpdate(reminder._id, {
              status: "FAILED",
              failedAt: new Date(),
              failureReason: "User not found",
            });
            stats.failed++;
            continue;
          }

          // Send through enabled channels
          const sendPromises: Promise<any>[] = [];

          // In-app notification
          if (reminder.channels.inApp) {
            sendPromises.push(
              NotificationService.create({
                userId: reminder.userId._id.toString(),
                type: "BOOKING_REMINDER",
                category: "BOOKING",
                title: reminder.title,
                message: reminder.body,
                data: reminder.data || {},
              }),
            );
          }

          // Push notification
          if (
            reminder.channels.push &&
            user.pushSubscriptions &&
            user.pushSubscriptions.length > 0
          ) {
            sendPromises.push(
              pushNotificationService.sendPushNotificationToMultiple(
                user.pushSubscriptions,
                {
                  title: reminder.title,
                  body: reminder.body,
                  icon: "/icon-192x192.png",
                  badge: "/badge-72x72.png",
                  data: reminder.data || {},
                },
              ),
            );
          }

          // Email notification
          if (reminder.channels.email) {
            sendPromises.push(
              sendBookingReminderEmail({
                email: user.email,
                name: user.name,
                venueName: booking.venue?.name || "the venue",
                sport: booking.sport,
                date: booking.date,
                startTime: booking.startTime,
                endTime: booking.endTime,
                interval: reminder.interval,
                bookingId: reminder.bookingId?.toString() || "",
              }).catch((err) => {
                console.error("Failed to send reminder email:", err);
                // Return rejected promise to count as failure
                return Promise.reject(err);
              }),
            );
          }

          await Promise.allSettled(sendPromises);

          // Mark as sent
          await ScheduledNotification.findByIdAndUpdate(reminder._id, {
            status: "SENT",
            sentAt: new Date(),
          });

          stats.sent++;
          console.log(
            `Sent reminder ${reminder._id} for booking ${booking._id}`,
          );
        } catch (error) {
          console.error(`Error processing reminder ${reminder._id}:`, error);

          await ScheduledNotification.findByIdAndUpdate(reminder._id, {
            status: "FAILED",
            failedAt: new Date(),
            failureReason:
              error instanceof Error ? error.message : String(error),
            $inc: { retryCount: 1 },
          });

          stats.failed++;
        }
      }

      console.log(
        `Processed ${stats.processed} reminders: ${stats.sent} sent, ${stats.failed} failed`,
      );

      return stats;
    } catch (error) {
      console.error("Error processing pending reminders:", error);
      throw error;
    }
  }

  /**
   * Get upcoming reminders for a user
   */
  static async getUserUpcomingReminders(
    userId: mongoose.Types.ObjectId,
    limit: number = 10,
  ) {
    return ScheduledNotification.find({
      userId,
      status: "PENDING",
      scheduledFor: { $gt: new Date() },
    })
      .sort({ scheduledFor: 1 })
      .limit(limit)
      .populate("bookingId", "date startTime sport");
  }

  /**
   * Get reminder statistics for a user
   */
  static async getUserReminderStats(userId: mongoose.Types.ObjectId) {
    const stats = await ScheduledNotification.aggregate([
      { $match: { userId: new mongoose.Types.ObjectId(userId.toString()) } },
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
        },
      },
    ]);

    return stats.reduce(
      (acc, stat) => {
        acc[stat._id.toLowerCase()] = stat.count;
        return acc;
      },
      {
        pending: 0,
        sent: 0,
        failed: 0,
        cancelled: 0,
      },
    );
  }

  /**
   * Combine date and time string into a single Date object
   */
  private static combineDateTime(date: Date, timeString: string): Date {
    const timeComponents = timeString.split(":").map(Number);
    const hours: number = timeComponents[0] || 0;
    const minutes: number = timeComponents[1] || 0;

    const combined = new Date(date);
    combined.setHours(hours, minutes, 0, 0);
    return combined;
  }

  /**
   * Get reminder title based on interval
   */
  private static getReminderTitle(interval: ReminderInterval): string {
    switch (interval) {
      case "24_HOURS":
        return "Booking Tomorrow";
      case "1_HOUR":
        return "Booking in 1 Hour";
      case "15_MINUTES":
        return "Booking in 15 Minutes";
      default:
        return "Upcoming Booking Reminder";
    }
  }

  /**
   * Get reminder body based on interval and booking details
   */
  private static getReminderBody(
    interval: ReminderInterval,
    sport: string,
    serviceName: string,
    startTime: string,
  ): string {
    switch (interval) {
      case "24_HOURS":
        return `Your ${sport} session at ${serviceName} is tomorrow at ${startTime}. See you there!`;
      case "1_HOUR":
        return `Your ${sport} session at ${serviceName} starts in 1 hour at ${startTime}. Time to get ready!`;
      case "15_MINUTES":
        return `Your ${sport} session at ${serviceName} starts in 15 minutes at ${startTime}. Don't be late!`;
      default:
        return `Reminder: Your ${sport} session at ${serviceName} is coming up at ${startTime}.`;
    }
  }
}
