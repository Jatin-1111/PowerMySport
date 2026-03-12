import { Request, Response, NextFunction } from "express";
import { NotificationService } from "../services/NotificationService";
import { NotificationCategory } from "../models/Notification";
import { z } from "zod";
import * as pushNotificationService from "../services/pushNotificationService";
import { User as UserModel } from "../models/User";

/**
 * Get notifications for the authenticated user
 * GET /api/notifications
 */
export const getNotifications = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const userId = req.user!.id;
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
    const category = req.query.category as NotificationCategory | undefined;
    const isRead =
      req.query.isRead === "true"
        ? true
        : req.query.isRead === "false"
          ? false
          : undefined;

    const result = await NotificationService.getUserNotifications(
      userId,
      page,
      limit,
      {
        ...(category && { category }),
        ...(isRead !== undefined && { isRead }),
      },
    );

    res.json({
      success: true,
      data: result.notifications,
      pagination: {
        page,
        limit,
        total: result.total,
        pages: result.pages,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get unread notification count
 * GET /api/notifications/unread-count
 */
export const getUnreadCount = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const userId = req.user!.id;
    const category = req.query.category as NotificationCategory | undefined;

    const count = await NotificationService.getUnreadCount(userId, category);

    res.json({
      success: true,
      count,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Mark a notification as read
 * PATCH /api/notifications/:id/read
 */
export const markNotificationRead = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const userId = req.user!.id;
    const notificationId = req.params.id;

    if (!notificationId || Array.isArray(notificationId)) {
      res.status(400).json({
        success: false,
        message: "Invalid notification ID",
      });
      return;
    }

    const notification = await NotificationService.markRead(
      notificationId,
      userId,
    );

    if (!notification) {
      res.status(404).json({
        success: false,
        message: "Notification not found",
      });
      return;
    }

    res.json({
      success: true,
      data: notification,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Mark all notifications as read
 * PATCH /api/notifications/read-all
 */
export const markAllNotificationsRead = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const userId = req.user!.id;

    const count = await NotificationService.markAllRead(userId);

    res.json({
      success: true,
      message: `${count} notifications marked as read`,
      count,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Delete a notification (soft delete)
 * DELETE /api/notifications/:id
 */
export const deleteNotification = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const userId = req.user!.id;
    const notificationId = req.params.id;

    if (!notificationId || Array.isArray(notificationId)) {
      res.status(400).json({
        success: false,
        message: "Invalid notification ID",
      });
      return;
    }

    const notification = await NotificationService.deleteNotification(
      notificationId,
      userId,
    );

    if (!notification) {
      res.status(404).json({
        success: false,
        message: "Notification not found",
      });
      return;
    }

    res.json({
      success: true,
      message: "Notification deleted",
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get user's notification preferences
 * GET /api/users/me/notification-preferences
 */
export const getNotificationPreferences = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const { User } = await import("../models/User.js");
    const userId = req.user!.id;

    const user = await User.findById(userId).select("notificationPreferences");

    if (!user) {
      res.status(404).json({
        success: false,
        message: "User not found",
      });
      return;
    }

    res.json({
      success: true,
      data: user.notificationPreferences || {},
    });
  } catch (error) {
    next(error);
  }
};

const notificationPreferencesSchema = z.object({
  email: z
    .object({
      friendRequests: z.boolean().optional(),
      bookingInvitations: z.boolean().optional(),
      bookingConfirmations: z.boolean().optional(),
      bookingReminders: z.boolean().optional(),
      bookingCancellations: z.boolean().optional(),
      reviews: z.boolean().optional(),
      payments: z.boolean().optional(),
      admin: z.boolean().optional(),
      marketing: z.boolean().optional(),
    })
    .optional(),
  push: z
    .object({
      friendRequests: z.boolean().optional(),
      bookingInvitations: z.boolean().optional(),
      bookingConfirmations: z.boolean().optional(),
      bookingReminders: z.boolean().optional(),
      bookingCancellations: z.boolean().optional(),
      reviews: z.boolean().optional(),
      payments: z.boolean().optional(),
      admin: z.boolean().optional(),
      marketing: z.boolean().optional(),
    })
    .optional(),
  inApp: z
    .object({
      friendRequests: z.boolean().optional(),
      bookingInvitations: z.boolean().optional(),
      bookingConfirmations: z.boolean().optional(),
      bookingReminders: z.boolean().optional(),
      bookingCancellations: z.boolean().optional(),
      reviews: z.boolean().optional(),
      payments: z.boolean().optional(),
      admin: z.boolean().optional(),
      marketing: z.boolean().optional(),
    })
    .optional(),
});

/**
 * Update user's notification preferences
 * PATCH /api/users/me/notification-preferences
 */
export const updateNotificationPreferences = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const { User } = await import("../models/User.js");
    const userId = req.user!.id;
    const preferences = notificationPreferencesSchema.parse(req.body);

    const user = await User.findByIdAndUpdate(
      userId,
      {
        $set: {
          "notificationPreferences.email": preferences.email,
          "notificationPreferences.push": preferences.push,
          "notificationPreferences.inApp": preferences.inApp,
        },
      },
      { new: true, runValidators: true },
    ).select("notificationPreferences");

    if (!user) {
      res.status(404).json({
        success: false,
        message: "User not found",
      });
      return;
    }

    res.json({
      success: true,
      message: "Notification preferences updated",
      data: user.notificationPreferences,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({
        success: false,
        message: "Invalid preferences format",
        errors: error.issues,
      });
      return;
    }
    next(error);
  }
};

/**
 * Subscribe to push notifications
 * POST /api/notifications/push/subscribe
 */
export const subscribeToPush = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const { User } = await import("../models/User.js");
    const userId = req.user!.id;

    const subscriptionSchema = z.object({
      endpoint: z.string().url(),
      keys: z.object({
        p256dh: z.string(),
        auth: z.string(),
      }),
      userAgent: z.string().optional(),
    });

    const subscription = subscriptionSchema.parse(req.body);

    // Check if subscription already exists
    const user = await User.findById(userId);
    if (!user) {
      res.status(404).json({
        success: false,
        message: "User not found",
      });
      return;
    }

    const existingSubscription = user.pushSubscriptions?.find(
      (sub) => sub.endpoint === subscription.endpoint,
    );

    if (existingSubscription) {
      res.json({
        success: true,
        message: "Push subscription already exists",
        data: existingSubscription,
      });
      return;
    }

    // Add new subscription
    const updatedUser = await User.findByIdAndUpdate(
      userId,
      {
        $push: {
          pushSubscriptions: {
            endpoint: subscription.endpoint,
            keys: subscription.keys,
            userAgent: subscription.userAgent || "Unknown",
            createdAt: new Date(),
          },
        },
      },
      { new: true },
    ).select("pushSubscriptions");

    res.status(201).json({
      success: true,
      message: "Push subscription created successfully",
      data: updatedUser?.pushSubscriptions?.[
        updatedUser.pushSubscriptions.length - 1
      ],
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({
        success: false,
        message: "Invalid subscription format",
        errors: error.issues,
      });
      return;
    }
    next(error);
  }
};

/**
 * Unsubscribe from push notifications
 * DELETE /api/notifications/push/unsubscribe
 */
export const unsubscribeFromPush = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const { User } = await import("../models/User.js");
    const userId = req.user!.id;

    const endpointSchema = z.object({
      endpoint: z.string().url(),
    });

    const { endpoint } = endpointSchema.parse(req.body);

    const updatedUser = await User.findByIdAndUpdate(
      userId,
      {
        $pull: {
          pushSubscriptions: { endpoint },
        },
      },
      { new: true },
    ).select("pushSubscriptions");

    if (!updatedUser) {
      res.status(404).json({
        success: false,
        message: "User not found",
      });
      return;
    }

    res.json({
      success: true,
      message: "Push subscription removed successfully",
      data: updatedUser.pushSubscriptions,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({
        success: false,
        message: "Invalid endpoint format",
        errors: error.issues,
      });
      return;
    }
    next(error);
  }
};

/**
 * Get user's push subscriptions
 * GET /api/notifications/push/subscriptions
 */
export const getPushSubscriptions = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const { User } = await import("../models/User.js");
    const userId = req.user!.id;

    const user = await User.findById(userId).select("pushSubscriptions");

    if (!user) {
      res.status(404).json({
        success: false,
        message: "User not found",
      });
      return;
    }

    res.json({
      success: true,
      data: user.pushSubscriptions || [],
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Send test push notification
 * POST /api/notifications/push/test
 */
export const sendTestPushNotification = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const pushService = pushNotificationService;
    const User = UserModel;
    const userId = req.user!.id;

    // Check if VAPID is configured
    if (!pushService.isVapidConfigured()) {
      res.status(500).json({
        success: false,
        message: "VAPID keys are not configured on the server",
      });
      return;
    }

    // Get user's push subscriptions
    const user = await User.findById(userId).select("pushSubscriptions");

    if (
      !user ||
      !user.pushSubscriptions ||
      user.pushSubscriptions.length === 0
    ) {
      res.status(400).json({
        success: false,
        message:
          "No push subscriptions found. Please enable push notifications first.",
      });
      return;
    }

    // Send test notification to all user's subscriptions
    const payload = {
      title: "Test Notification from Server",
      body: "This is a test push notification from PowerMySport backend!",
      icon: "/icon-192x192.png",
      badge: "/badge-72x72.png",
      data: {
        url: "/notifications",
        timestamp: new Date().toISOString(),
      },
    };

    const result = await pushService.sendPushNotificationToMultiple(
      user.pushSubscriptions as any[],
      payload,
    );

    // Remove expired subscriptions from database
    if (result.expiredEndpoints.length > 0) {
      await User.findByIdAndUpdate(userId, {
        $pull: {
          pushSubscriptions: {
            endpoint: { $in: result.expiredEndpoints },
          },
        },
      });
    }

    res.json({
      success: true,
      message: "Test push notification sent",
      data: {
        sentTo: user.pushSubscriptions.length,
        successful: result.successful,
        failed: result.failed,
        expiredSubscriptions: result.expiredEndpoints.length,
      },
    });
  } catch (error) {
    console.error("Error sending test push notification:", error);
    next(error);
  }
};

/**
 * Get VAPID configuration status
 * GET /api/notifications/push/vapid-status
 */
export const getVapidStatus = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const pushService = pushNotificationService;

    const isConfigured = pushService.isVapidConfigured();

    res.json({
      success: true,
      data: {
        configured: isConfigured,
        publicKey: isConfigured ? pushService.getVapidPublicKey() : null,
      },
    });
  } catch (error) {
    next(error);
  }
};
