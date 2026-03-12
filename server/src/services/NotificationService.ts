import mongoose from "mongoose";
import Notification, {
  INotification,
  NotificationCategory,
  NotificationType,
} from "../models/Notification";
import { User } from "../models/User";
import { Server } from "socket.io";
import { sendEmail } from "../utils/email";
import * as pushNotificationService from "./pushNotificationService";

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
  INVITATION_EXPIRY: "BOOKING",
  PAYMENT_FAILED: "PAYMENT",
  PAYMENT_CONFIRMED: "PAYMENT",
  PAYMENT_REFUND: "PAYMENT",
  PAYMENT_SPLIT_RECEIVED: "PAYMENT",
  REVIEW_POSTED: "REVIEW",
  REVIEW_RESPONSE: "REVIEW",
  REVIEW_REMINDER: "REVIEW",
  COACH_VERIFICATION_PENDING: "ADMIN",
  COACH_VERIFICATION_REVIEW: "ADMIN",
  COACH_VERIFICATION_VERIFIED: "ADMIN",
  COACH_VERIFICATION_REJECTED: "ADMIN",
  VENUE_APPROVAL_PENDING: "ADMIN",
  VENUE_APPROVAL_APPROVED: "ADMIN",
  VENUE_APPROVAL_REJECTED: "ADMIN",
  VENUE_MARKED_FOR_REVIEW: "ADMIN",
  DISPUTE_FILED: "ADMIN",
  DISPUTE_RESOLVED: "ADMIN",
  MESSAGE_RECEIVED: "COMMUNITY",
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
  INVITATION_EXPIRY: "bookingInvitations",
  PAYMENT_FAILED: "payments",
  PAYMENT_CONFIRMED: "payments",
  PAYMENT_REFUND: "payments",
  PAYMENT_SPLIT_RECEIVED: "payments",
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
  DISPUTE_FILED: "admin",
  DISPUTE_RESOLVED: "admin",
  MESSAGE_RECEIVED: "friendRequests", // Reuse for community
};

let socketInstance: Server | null = null;

export const setNotificationSocketInstance = (io: Server) => {
  socketInstance = io;
};

export class NotificationService {
  /**
   * Create and persist a notification to the database
   */
  static async create(data: NotificationData): Promise<INotification> {
    const category = data.category || TYPE_TO_CATEGORY[data.type];

    const notification = await Notification.create({
      userId: new mongoose.Types.ObjectId(data.userId),
      type: data.type,
      category,
      title: data.title,
      message: data.message,
      data: data.data || {},
      isRead: false,
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
  ): Promise<INotification | null> {
    const {
      persistToDb = true,
      sendSocket: shouldSendSocket = true,
      sendEmail: shouldSendEmail = false,
      sendPush: shouldSendPush = true,
      emailTemplate,
      emailData = {},
    } = options;

    // Get user preferences
    const user = await User.findById(data.userId).select(
      "email name notificationPreferences pushSubscriptions",
    );
    if (!user) {
      console.error(`User ${data.userId} not found for notification`);
      return null;
    }

    const preferences = user.notificationPreferences;
    const preferenceKey = TYPE_TO_PREFERENCE_KEY[data.type];

    // Persist to database (in-app notifications)
    let notification: INotification | null = null;
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
          notificationId: notification._id.toString(),
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

      const user = await User.findById(userId).select("pushSubscriptions");
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
        subscriptions as Array<{
          endpoint: string;
          keys: { p256dh: string; auth: string };
        }>,
        payload,
      );

      if (result.expiredEndpoints.length > 0) {
        await User.findByIdAndUpdate(userId, {
          $pull: {
            pushSubscriptions: {
              endpoint: { $in: result.expiredEndpoints },
            },
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
  ): Promise<INotification | null> {
    const notification = await Notification.findOneAndUpdate(
      {
        _id: new mongoose.Types.ObjectId(notificationId),
        userId: new mongoose.Types.ObjectId(userId),
      },
      {
        isRead: true,
        readAt: new Date(),
      },
      { new: true },
    );

    return notification;
  }

  /**
   * Mark all notifications as read for a user
   */
  static async markAllRead(userId: string): Promise<number> {
    const result = await Notification.updateMany(
      {
        userId: new mongoose.Types.ObjectId(userId),
        isRead: false,
        deletedAt: null,
      },
      {
        isRead: true,
        readAt: new Date(),
      },
    );

    return result.modifiedCount;
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
  ): Promise<{ notifications: INotification[]; total: number; pages: number }> {
    const query: Record<string, unknown> = {
      userId: new mongoose.Types.ObjectId(userId),
      deletedAt: null,
    };

    if (filters?.category) {
      query.category = filters.category;
    }

    if (filters?.isRead !== undefined) {
      query.isRead = filters.isRead;
    }

    const skip = (page - 1) * limit;

    const [notifications, total] = await Promise.all([
      Notification.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Notification.countDocuments(query),
    ]);

    return {
      notifications: notifications as INotification[],
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
    const query: Record<string, unknown> = {
      userId: new mongoose.Types.ObjectId(userId),
      isRead: false,
      deletedAt: null,
    };

    if (category) {
      query.category = category;
    }

    const count = await Notification.countDocuments(query);
    return count;
  }

  /**
   * Soft delete a notification
   */
  static async deleteNotification(
    notificationId: string,
    userId: string,
  ): Promise<INotification | null> {
    const notification = await Notification.findOneAndUpdate(
      {
        _id: new mongoose.Types.ObjectId(notificationId),
        userId: new mongoose.Types.ObjectId(userId),
      },
      {
        deletedAt: new Date(),
      },
      { new: true },
    );

    return notification;
  }

  /**
   * Delete old notifications (cleanup job)
   */
  static async cleanupExpiredNotifications(): Promise<number> {
    const result = await Notification.deleteMany({
      expiresAt: { $lte: new Date() },
    });

    return result.deletedCount;
  }
}
