import express from "express";
import { authMiddleware } from "../middleware/auth";
import {
  getReminderPreferences,
  updateReminderPreferences,
  getUpcomingReminders,
  getReminderStats,
  processRemindersManually,
  getMonitoringStats,
  checkSchedulerHealth,
  getFailedReminders,
  triggerHealthCheck,
  sendDailySummary,
  retryFailedReminder,
  retryMultipleReminders,
} from "../controllers/reminderController";

const router = express.Router();

// All routes require authentication
router.use(authMiddleware);

// Reminder preference routes
router.get("/preferences", getReminderPreferences);
router.patch("/preferences", updateReminderPreferences);

// Reminder query routes
router.get("/upcoming", getUpcomingReminders);
router.get("/stats", getReminderStats);

// Manual processing (for testing/admin)
router.post("/process", processRemindersManually);

// Monitoring endpoints
router.get("/monitoring/stats", getMonitoringStats);
router.get("/monitoring/health", checkSchedulerHealth);
router.get("/monitoring/failed", getFailedReminders);
router.post("/monitoring/health-check", triggerHealthCheck);
router.post("/monitoring/send-summary", sendDailySummary);
router.post("/monitoring/retry/:id", retryFailedReminder);
router.post("/monitoring/retry-batch", retryMultipleReminders);

export default router;
