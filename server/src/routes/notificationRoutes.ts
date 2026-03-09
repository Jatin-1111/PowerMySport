import express from "express";
import { authMiddleware } from "../middleware/auth";
import {
  getNotifications,
  getUnreadCount,
  markNotificationRead,
  markAllNotificationsRead,
  deleteNotification,
  getNotificationPreferences,
  updateNotificationPreferences,
  subscribeToPush,
  unsubscribeFromPush,
  getPushSubscriptions,
  sendTestPushNotification,
  getVapidStatus,
} from "../controllers/notificationController";

const router = express.Router();

// All routes require authentication
router.use(authMiddleware);

// Notification CRUD routes
router.get("/", getNotifications);
router.get("/unread-count", getUnreadCount);
router.patch("/read-all", markAllNotificationsRead);
router.patch("/:id/read", markNotificationRead);
router.delete("/:id", deleteNotification);

// Notification preferences routes (moved from user routes)
router.get("/preferences", getNotificationPreferences);
router.patch("/preferences", updateNotificationPreferences);

// Push notification subscription routes
router.post("/push/subscribe", subscribeToPush);
router.delete("/push/unsubscribe", unsubscribeFromPush);
router.get("/push/subscriptions", getPushSubscriptions);
router.post("/push/test", sendTestPushNotification);
router.get("/push/vapid-status", getVapidStatus);

export default router;
