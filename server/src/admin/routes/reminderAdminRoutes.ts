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
import {
  adminMiddleware,
  authMiddleware,
  requirePermission,
  superAdminMiddleware,
} from "../../middleware/auth";

const router = Router();

// Reminder scheduler operations. These used to live on /api/reminders behind
// plain user auth, so any signed-in user could read other users' failed
// reminders and trigger real sends against production.
router.use(authMiddleware, adminMiddleware);

// Read-only monitoring: same tier as the Server tab's infra monitoring.
const canView = requirePermission("analytics:view");
router.get("/monitoring/stats", canView, getMonitoringStats);
router.get("/monitoring/health", canView, checkSchedulerHealth);
router.get("/monitoring/failed", canView, getFailedReminders);

// Anything that sends email or re-queues reminders to real users is System
// Admin only.
router.post("/process", superAdminMiddleware, processRemindersManually);
router.post("/monitoring/health-check", superAdminMiddleware, triggerHealthCheck);
router.post("/monitoring/send-summary", superAdminMiddleware, sendDailySummary);
router.post("/monitoring/retry/:id", superAdminMiddleware, retryFailedReminder);
router.post("/monitoring/retry-batch", superAdminMiddleware, retryMultipleReminders);

export default router;
