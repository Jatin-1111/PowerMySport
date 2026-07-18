import { Server } from "socket.io";
import prisma from "../../lib/prisma";
import { Prisma } from "@prisma/client";
import type { Notification, NotificationCategory } from "@prisma/client";
import { sendEmail } from "../../utils/email";
import * as pushNotificationService from "./pushNotificationService";

// `type` is kept as a validated string column in Postgres (the enum was too
// large for a DB enum — see SCHEMA_CHANGES). The union is preserved here so the
// TYPE_TO_* maps and public signatures stay strongly typed exactly as before.
export type NotificationType =
  | "FRIEND_REQUEST"
  | "FRIEND_REQUEST_ACCEPTED"
  | "FRIEND_REQUEST_DECLINED"
  | "FRIEND_REMOVED"
  | "BOOKING_INVITATION"
  | "BOOKING_CONFIRMED"
  | "BOOKING_CANCELLED"
  | "BOOKING_STATUS_UPDATED"
  | "BOOKING_REMINDER"
  | "SESSION_LINK_REQUIRED"
  | "INVITATION_EXPIRY"
  | "PAYMENT_FAILED"
  | "PAYMENT_CONFIRMED"
  | "PAYMENT_REFUND"
  | "PAYMENT_SPLIT_RECEIVED"
  | "PAYOUT_PROCESSED"
  | "REVIEW_POSTED"
  | "REVIEW_RESPONSE"
  | "REVIEW_REMINDER"
  | "COACH_VERIFICATION_PENDING"
  | "COACH_VERIFICATION_REVIEW"
  | "COACH_VERIFICATION_VERIFIED"
  | "COACH_VERIFICATION_REJECTED"
  | "VENUE_APPROVAL_PENDING"
  | "VENUE_APPROVAL_APPROVED"
  | "VENUE_APPROVAL_REJECTED"
  | "VENUE_MARKED_FOR_REVIEW"
  | "ACADEMY_APPROVED"
  | "ACADEMY_REJECTED"
  | "DISPUTE_FILED"
  | "DISPUTE_RESOLVED"
  | "MESSAGE_RECEIVED"
  | "PLAN_CHECKIN";

export interface NotificationData {
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  data?: Record<string, unknown>;
  category?: NotificationCategory;
}

export interface SendOptions {
  persistToDb?: boolean;
  sendSocket?: boolean;
  sendEmail?: boolean;
  sendPush?: boolean;
  emailTemplate?: string;
  emailData?: Record<string, unknown>;
}

// Shape of the notificationPreferences Json config (read/written wholesale).
type PreferenceChannel = Partial<Record<string, boolean>>;
interface NotificationPreferences {
  inApp?: PreferenceChannel;
  email?: PreferenceChannel;
  push?: PreferenceChannel;
}

// Notification type to category mapping
const TYPE_TO_CATEGORY: Record<NotificationType, NotificationCategory> = {
  FRIEND_REQUEST: "SOCIAL",
  FRIEND_REQUEST_ACCEPTED: "SOCIAL",
  FRIEND_REQUEST_DECLINED: "SOCIAL",
  FRIEND_REMOVED: "SOCIAL",
  BOOKING_INVITATION: "BOOKING",
  BOOKING_CONFIRMED: "BOOKING",
  BOOKING_CANCELLED: "BOOKING",
  BOOKING_STATUS_UPDATED: "BOOKING",
  BOOKING_REMINDER: "BOOKING",
  SESSION_LINK_REQUIRED: "BOOKING",
  INVITATION_EXPIRY: "BOOKING",
  PAYMENT_FAILED: "PAYMENT",
  PAYMENT_CONFIRMED: "PAYMENT",
  PAYMENT_REFUND: "PAYMENT",
  PAYMENT_SPLIT_RECEIVED: "PAYMENT",
  PAYOUT_PROCESSED: "PAYMENT",
  REVIEW_POSTED: "REVIEW",
  REVIEW_RESPONSE: "REVIEW",
  REVIEW_REMINDER: "REVIEW",
  COACH_VERIFICATION_PENDING: "Admin",
  COACH_VERIFICATION_REVIEW: "Admin",
  COACH_VERIFICATION_VERIFIED: "Admin",
  COACH_VERIFICATION_REJECTED: "Admin",
  VENUE_APPROVAL_PENDING: "Admin",
  VENUE_APPROVAL_APPROVED: "Admin",
  VENUE_APPROVAL_REJECTED: "Admin",
  VENUE_MARKED_FOR_REVIEW: "Admin",
  ACADEMY_APPROVED: "Admin",
  ACADEMY_REJECTED: "Admin",
  DISPUTE_FILED: "Admin",
  DISPUTE_RESOLVED: "Admin",
  MESSAGE_RECEIVED: "COMMUNITY",
  PLAN_CHECKIN: "COMMUNITY",
};

// Notification type to preference key mapping
const TYPE_TO_PREFERENCE_KEY: Record<
  NotificationType,
  | "friendRequests"
  | "bookingInvitations"
  | "bookingConfirmations"
  | "bookingReminders"
  | "bookingCancellations"
  | "reviews"
  | "payments"
  | "admin"
  | "marketing"
> = {
  FRIEND_REQUEST: "friendRequests",
  FRIEND_REQUEST_ACCEPTED: "friendRequests",
  FRIEND_REQUEST_DECLINED: "friendRequests",
  FRIEND_REMOVED: "friendRequests",
  BOOKING_INVITATION: "bookingInvitations",
  BOOKING_CONFIRMED: "bookingConfirmations",
  BOOKING_CANCELLED: "bookingCancellations",
  BOOKING_STATUS_UPDATED: "bookingConfirmations",
  BOOKING_REMINDER: "bookingReminders",
  SESSION_LINK_REQUIRED: "bookingReminders",
  INVITATION_EXPIRY: "bookingInvitations",
  PAYMENT_FAILED: "payments",
  PAYMENT_CONFIRMED: "payments",
  PAYMENT_REFUND: "payments",
  PAYMENT_SPLIT_RECEIVED: "payments",
  PAYOUT_PROCESSED: "payments",
  REVIEW_POSTED: "reviews",
  REVIEW_RESPONSE: "reviews",
  REVIEW_REMINDER: "reviews",
  COACH_VERIFICATION_PENDING: "admin",
  COACH_VERIFICATION_REVIEW: "admin",
  COACH_VERIFICATION_VERIFIED: "admin",
  COACH_VERIFICATION_REJECTED: "admin",
  VENUE_APPROVAL_PENDING: "admin",
  VENUE_APPROVAL_APPROVED: "admin",
  VENUE_APPROVAL_REJECTED: "admin",
  VENUE_MARKED_FOR_REVIEW: "admin",
  ACADEMY_APPROVED: "admin",
  ACADEMY_REJECTED: "admin",
  DISPUTE_FILED: "admin",
  DISPUTE_RESOLVED: "admin",
  MESSAGE_RECEIVED: "friendRequests", // Reuse for community
  PLAN_CHECKIN: "friendRequests", // Reuse for community
};

let socketInstance: Server | null = null;

export const setNotificationSocketInstance = (io: Server) => {
  socketInstance = io;
};

export class NotificationService {
  /**
   * Create and persist a notification to the database
   */
  static async create(data: NotificationData): Promise<Notification> {
    const category = data.category || TYPE_TO_CATEGORY[data.type];

    const notification = await prisma.notification.create({
      data: {
        userId: data.userId,
        type: data.type,
        category,
        title: data.title,
        message: data.message,
        data: (data.data || {}) as Prisma.InputJsonValue,
        isRead: false,
      },
    });

    return notification;
  }

  /**
   * Send notification via multiple channels (socket, email, push)
   * Orchestrates multi-channel delivery based on user preferences
   */
  static async send(
    data: NotificationData,
    options: SendOptions = {},
  ): Promise<Notification | null> {
    const {
      persistToDb = true,
      sendSocket: shouldSendSocket = true,
      sendEmail: shouldSendEmail = false,
      sendPush: shouldSendPush = true,
      emailTemplate,
      emailData = {},
    } = options;

    // Get user preferences
    const user = await prisma.user.findUnique({
      where: { id: data.userId },
      select: {
        email: true,
        name: true,
        notificationPreferences: true,
      },
    });
    if (!user) {
      console.error(`User ${data.userId} not found for notification`);
      return null;
    }

    const preferences = (user.notificationPreferences ?? undefined) as
      | NotificationPreferences
      | undefined;
    const preferenceKey = TYPE_TO_PREFERENCE_KEY[data.type];

    // Persist to database (in-app notifications)
    let notification: Notification | null = null;
    if (persistToDb) {
      // In-app notifications respect preferences (except always enabled by default)
      const inAppEnabled = preferences?.inApp?.[preferenceKey] !== false;
      if (inAppEnabled) {
        notification = await this.create(data);
      }
    }

    // Send via socket (real-time)
    if (shouldSendSocket) {
      const socketEnabled = preferences?.inApp?.[preferenceKey] !== false;
      if (socketEnabled && notification) {
        await this.sendSocket(data.userId, data.type, {
          notificationId: notification.id,
          title: data.title,
          message: data.message,
          data: data.data,
          createdAt: notification.createdAt,
        });
      }
    }

    // Send via email
    if (shouldSendEmail) {
      const emailEnabled = preferences?.email?.[preferenceKey] !== false;
      if (emailEnabled) {
        await this.sendEmailNotification(
          user.email,
          user.name,
          data.title,
          data.message,
          emailTemplate,
          emailData,
        ).catch((err) => {
          console.error("Failed to send email notification:", err);
        });
      }
    }

    // Send via push (future implementation)
    if (shouldSendPush) {
      const pushEnabled = preferences?.push?.[preferenceKey] !== false;
      if (pushEnabled) {
        await this.sendPush(data.userId, data.title, data.message, data.data);
      }
    }

    return notification;
  }

  /**
   * Send notification via Socket.IO
   */
  private static async sendSocket(
    userId: string,
    type: NotificationType,
    payload: Record<string, unknown>,
  ): Promise<void> {
    if (!socketInstance) {
      console.warn("Socket instance not initialized, cannot send notification");
      return;
    }

    // Determine which namespace to use
    const category = TYPE_TO_CATEGORY[type];
    let namespace = "/friends"; // Default to friends namespace

    if (category === "COMMUNITY") {
      namespace = "/community";
    }

    // Emit to user's room
    socketInstance
      .of(namespace)
      .to(`user:${userId}`)
      .emit("notification:new", {
        type,
        ...payload,
        timestamp: new Date().toISOString(),
      });
  }

  /**
   * Send email notification
   */
  private static async sendEmailNotification(
    email: string,
    name: string,
    title: string,
    message: string,
    template?: string,
    templateData?: Record<string, unknown>,
  ): Promise<void> {
    // If a custom template is provided, use it
    if (template && templateData) {
      // Custom email templates handled elsewhere (e.g., sendFriendRequestEmail)
      return;
    }

    // Default generic notification email
    await sendEmail({
      to: email,
      subject: title,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #FF6B35;">${title}</h2>
          <p style="color: #333; line-height: 1.6;">Hi ${name},</p>
          <p style="color: #333; line-height: 1.6;">${message}</p>
          <p style="color: #666; font-size: 14px; margin-top: 30px;">
            This is an automated notification from PowerMySport.
          </p>
        </div>
      `,
    });
  }

  /**
   * Send push notification (placeholder for future implementation)
   */
  private static async sendPush(
    userId: string,
    title: string,
    message: string,
    data?: Record<string, unknown>,
  ): Promise<void> {
    try {
      const pushService = pushNotificationService;

      if (!pushService.isVapidConfigured()) {
        return;
      }

      const user = await prisma.user.findUnique({
        where: { id: userId },
        include: { pushSubscriptions: true },
      });
      const subscriptions = user?.pushSubscriptions || [];

      if (!subscriptions.length) {
        return;
      }

      const payload = {
        title,
        body: message,
        icon: "/icon-192x192.png",
        badge: "/badge-72x72.png",
        data: {
          ...(data || {}),
          timestamp: new Date().toISOString(),
        },
      };

      const result = await pushService.sendPushNotificationToMultiple(
        // PushSubscription rows are flattened in Postgres; reshape to the
        // { endpoint, keys: { p256dh, auth } } contract the push service expects.
        subscriptions.map((sub) => ({
          endpoint: sub.endpoint,
          keys: { p256dh: sub.p256dh, auth: sub.auth },
        })),
        payload,
      );

      if (result.expiredEndpoints.length > 0) {
        await prisma.pushSubscription.deleteMany({
          where: {
            userId,
            endpoint: { in: result.expiredEndpoints },
          },
        });
      }
    } catch (error) {
      console.error("Failed to send push notification:", error);
    }
  }

  /**
   * Mark a notification as read
   */
  static async markRead(
    notificationId: string,
    userId: string,
  ): Promise<Notification | null> {
    // Ownership is enforced in the where clause (id + userId); updateMany lets us
    // scope by the non-unique userId. Re-fetch to return the updated row.
    const result = await prisma.notification.updateMany({
      where: { id: notificationId, userId },
      data: { isRead: true, readAt: new Date() },
    });

    if (result.count === 0) {
      return null;
    }

    return prisma.notification.findUnique({ where: { id: notificationId } });
  }

  /**
   * Mark all notifications as read for a user
   */
  static async markAllRead(userId: string): Promise<number> {
    const result = await prisma.notification.updateMany({
      where: {
        userId,
        isRead: false,
        deletedAt: null,
      },
      data: {
        isRead: true,
        readAt: new Date(),
      },
    });

    return result.count;
  }

  /**
   * Get notifications for a user (paginated)
   */
  static async getUserNotifications(
    userId: string,
    page: number = 1,
    limit: number = 50,
    filters?: {
      category?: NotificationCategory;
      isRead?: boolean;
    },
  ): Promise<{ notifications: Notification[]; total: number; pages: number }> {
    const where: Prisma.NotificationWhereInput = {
      userId,
      deletedAt: null,
    };

    if (filters?.category) {
      where.category = filters.category;
    }

    if (filters?.isRead !== undefined) {
      where.isRead = filters.isRead;
    }

    const skip = (page - 1) * limit;

    const [notifications, total] = await Promise.all([
      prisma.notification.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.notification.count({ where }),
    ]);

    return {
      notifications,
      total,
      pages: Math.ceil(total / limit),
    };
  }

  /**
   * Get unread notification count for a user
   */
  static async getUnreadCount(
    userId: string,
    category?: NotificationCategory,
  ): Promise<number> {
    const where: Prisma.NotificationWhereInput = {
      userId,
      isRead: false,
      deletedAt: null,
    };

    if (category) {
      where.category = category;
    }

    const count = await prisma.notification.count({ where });
    return count;
  }

  /**
   * Soft delete a notification
   */
  static async deleteNotification(
    notificationId: string,
    userId: string,
  ): Promise<Notification | null> {
    const result = await prisma.notification.updateMany({
      where: { id: notificationId, userId },
      data: { deletedAt: new Date() },
    });

    if (result.count === 0) {
      return null;
    }

    return prisma.notification.findUnique({ where: { id: notificationId } });
  }

  /**
   * Delete old notifications (cleanup job)
   */
  static async cleanupExpiredNotifications(): Promise<number> {
    const result = await prisma.notification.deleteMany({
      where: {
        expiresAt: { lte: new Date() },
      },
    });

    return result.count;
  }
}
