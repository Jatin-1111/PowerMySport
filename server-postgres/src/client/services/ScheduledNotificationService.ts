import prisma from "../../lib/prisma";
import { Prisma } from "@prisma/client";
import { NotificationService } from "./NotificationService";
import pushNotificationService from "./pushNotificationService";
import { sendBookingReminderEmail } from "../../utils/email";

// Was imported from the Mongoose model; kept as a local union now that
// `interval` is a validated String column in Postgres.
type ReminderInterval = "24_HOURS" | "1_HOUR" | "15_MINUTES";

interface BookingReminderData {
  // IDs are cuid strings in Postgres (were ObjectIds under Mongoose).
  bookingId: string;
  userId: string;
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

        await prisma.scheduledNotification.create({
          data: {
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
            } as Prisma.InputJsonValue,
            // channels (embedded obj) flattened -> chEmail/chPush/chInApp
            chEmail: channels.email,
            chPush: channels.push,
            chInApp: channels.inApp,
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
  static async cancelBookingReminders(bookingId: string): Promise<number> {
    try {
      const result = await prisma.scheduledNotification.updateMany({
        where: {
          bookingId,
          status: "PENDING",
        },
        data: { status: "CANCELLED" },
      });

      console.log(
        `Cancelled ${result.count} reminders for booking ${bookingId}`,
      );
      return result.count;
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
      const pendingReminders = await prisma.scheduledNotification.findMany({
        where: {
          status: "PENDING",
          scheduledFor: { lte: now },
        },
        take: batchSize,
      });

      // String-FK "populate": batch-load the referenced users + bookings and
      // join in code (no relation is defined for these ref columns).
      const userIds = [...new Set(pendingReminders.map((r) => r.userId))];
      const bookingIds = [
        ...new Set(
          pendingReminders
            .map((r) => r.bookingId)
            .filter((b): b is string => !!b),
        ),
      ];

      const users = userIds.length
        ? await prisma.user.findMany({
            where: { id: { in: userIds } },
            include: { pushSubscriptions: true },
          })
        : [];
      const userById = new Map(users.map((u) => [u.id, u]));

      const bookings = bookingIds.length
        ? await prisma.booking.findMany({ where: { id: { in: bookingIds } } })
        : [];
      const bookingById = new Map(bookings.map((b) => [b.id, b]));

      const stats = {
        processed: pendingReminders.length,
        sent: 0,
        failed: 0,
      };

      for (const reminder of pendingReminders) {
        try {
          let booking: (typeof bookings)[number] | null = null;
          if (reminder.type === "BOOKING_REMINDER") {
            booking = reminder.bookingId
              ? bookingById.get(reminder.bookingId) ?? null
              : null;
            if (!booking || booking.status === "CANCELLED") {
              await prisma.scheduledNotification.update({
                where: { id: reminder.id },
                data: { status: "CANCELLED" },
              });
              console.log(
                `Cancelled reminder ${reminder.id} - booking no longer valid`,
              );
              continue;
            }
          }

          const user = userById.get(reminder.userId) ?? null;
          if (!user) {
            await prisma.scheduledNotification.update({
              where: { id: reminder.id },
              data: {
                status: "FAILED",
                failedAt: new Date(),
                failureReason: "User not found",
              },
            });
            stats.failed++;
            continue;
          }

          // Send through enabled channels
          const sendPromises: Promise<any>[] = [];

          // In-app notification
          if (reminder.chInApp) {
            sendPromises.push(
              NotificationService.create({
                userId: reminder.userId,
                type: "BOOKING_REMINDER",
                category: "BOOKING",
                title: reminder.title,
                message: reminder.body,
                data: (reminder.data || {}) as Record<string, unknown>,
              }),
            );
          }

          // Push notification
          if (
            reminder.chPush &&
            user.pushSubscriptions &&
            user.pushSubscriptions.length > 0
          ) {
            sendPromises.push(
              pushNotificationService.sendPushNotificationToMultiple(
                // Flattened rows -> { endpoint, keys: { p256dh, auth } }.
                user.pushSubscriptions.map((sub) => ({
                  endpoint: sub.endpoint,
                  keys: { p256dh: sub.p256dh, auth: sub.auth },
                })),
                {
                  title: reminder.title,
                  body: reminder.body,
                  icon: "/icon-192x192.png",
                  badge: "/badge-72x72.png",
                  data: (reminder.data || {}) as Record<string, unknown>,
                },
              ),
            );
          }

          // Email notification
          if (reminder.chEmail) {
            if (reminder.type === "BOOKING_REMINDER" && booking) {
              sendPromises.push(
                sendBookingReminderEmail({
                  email: user.email,
                  name: user.name,
                  // The original populate never selected the venue name, so this
                  // always fell back to "the venue" in this flow.
                  venueName: "the venue",
                  sport: booking.sport,
                  date: booking.date,
                  startTime: booking.startTime,
                  endTime: booking.endTime,
                  interval: reminder.interval as
                    | "24_HOURS"
                    | "1_HOUR"
                    | "15_MINUTES",
                  bookingId: reminder.bookingId ?? "",
                }).catch((err) => {
                  console.error("Failed to send reminder email:", err);
                  // Return rejected promise to count as failure
                  return Promise.reject(err);
                }),
              );
            }
          }

          await Promise.allSettled(sendPromises);

          // Mark as sent
          await prisma.scheduledNotification.update({
            where: { id: reminder.id },
            data: { status: "SENT", sentAt: new Date() },
          });

          stats.sent++;
          console.log(
            `Sent reminder ${reminder.id} for booking ${booking?.id}`,
          );
        } catch (error) {
          console.error(`Error processing reminder ${reminder.id}:`, error);

          await prisma.scheduledNotification.update({
            where: { id: reminder.id },
            data: {
              status: "FAILED",
              failedAt: new Date(),
              failureReason:
                error instanceof Error ? error.message : String(error),
              retryCount: { increment: 1 },
            },
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
  static async getUserUpcomingReminders(userId: string, limit: number = 10) {
    const reminders = await prisma.scheduledNotification.findMany({
      where: {
        userId,
        status: "PENDING",
        scheduledFor: { gt: new Date() },
      },
      orderBy: { scheduledFor: "asc" },
      take: limit,
    });

    // TODO(prisma): the Mongo version populated `bookingId` in place with
    // { date, startTime, sport }. There is no relation for this String-FK ref,
    // so we attach the booking under a separate `booking` key instead.
    const bookingIds = [
      ...new Set(
        reminders.map((r) => r.bookingId).filter((b): b is string => !!b),
      ),
    ];
    const bookings = bookingIds.length
      ? await prisma.booking.findMany({
          where: { id: { in: bookingIds } },
          select: { id: true, date: true, startTime: true, sport: true },
        })
      : [];
    const bookingById = new Map(bookings.map((b) => [b.id, b]));

    return reminders.map((r) => ({
      ...r,
      booking: r.bookingId ? bookingById.get(r.bookingId) ?? null : null,
    }));
  }

  /**
   * Get reminder statistics for a user
   */
  static async getUserReminderStats(userId: string) {
    const grouped = await prisma.scheduledNotification.groupBy({
      by: ["status"],
      where: { userId },
      _count: { _all: true },
    });

    return grouped.reduce(
      (acc, stat) => {
        acc[stat.status.toLowerCase()] = stat._count._all;
        return acc;
      },
      {
        pending: 0,
        sent: 0,
        failed: 0,
        cancelled: 0,
      } as Record<string, number>,
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
