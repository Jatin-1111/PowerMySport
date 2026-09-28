import { Router } from "express";

import {
  checkSchedulerHealth,
  getFailedReminders,
  getMonitoringStats,
  processRemindersManually,
  retryFailedReminder,
  retryMultipleReminders,
  sendDailySummary,
  triggerHealthCheck,
} from "../../client/controllers/reminderController";
import { adminMiddleware, authMiddleware, requirePermission } from "../../middleware/auth";

const router = Router();

// Reminder scheduler operations. These used to live on /api/reminders behind
// plain user auth, so any signed-in user could read other users' failed
// reminders and trigger real sends against production.
router.use(authMiddleware, adminMiddleware);

// Reads need `notifications:view`; anything that sends email or re-queues
// reminders to real users needs `notifications:manage` (which implies view).
const canView = requirePermission("notifications:view");
const canManage = requirePermission("notifications:manage");

router.get("/monitoring/stats", canView, getMonitoringStats);
router.get("/monitoring/health", canView, checkSchedulerHealth);
router.get("/monitoring/failed", canView, getFailedReminders);

router.post("/process", canManage, processRemindersManually);
router.post("/monitoring/health-check", canManage, triggerHealthCheck);
router.post("/monitoring/send-summary", canManage, sendDailySummary);
router.post("/monitoring/retry/:id", canManage, retryFailedReminder);
router.post("/monitoring/retry-batch", canManage, retryMultipleReminders);

export default router;
