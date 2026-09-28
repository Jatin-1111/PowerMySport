import express from "express";
import { authMiddleware } from "../../middleware/auth";
import {
  getReminderPreferences,
  updateReminderPreferences,
  getUpcomingReminders,
  getReminderStats,
  createReminder,
} from "../controllers/reminderController";

const router = express.Router();

// All routes require authentication
router.use(authMiddleware);

// Reminder preference routes
router.get("/preferences", getReminderPreferences);
router.patch("/preferences", updateReminderPreferences);

// Create reminder
router.post("/", createReminder);

// Reminder query routes
router.get("/upcoming", getUpcomingReminders);
router.get("/stats", getReminderStats);

// Scheduler operations (process, monitoring, retries) are admin-only and
// live in admin/routes/reminderAdminRoutes.ts.

export default router;
