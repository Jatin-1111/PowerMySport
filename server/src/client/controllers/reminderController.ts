import { Request, Response } from "express";
import { asyncHandler } from "../../middleware/asyncHandler";
import { AppError } from "../../utils/AppError";
import { ScheduledNotificationService } from "../services/ScheduledNotificationService";
import { ScheduledNotification } from "../models/ScheduledNotification";
import { ReminderMonitoringService } from "../services/ReminderMonitoringService";
import { z } from "zod";
import { User } from "../models/User";

/**
 * Get user's reminder preferences
 * GET /api/reminders/preferences
 */
export const getReminderPreferences = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const userId = req.user!.id;

    const user = await User.findById(userId).select("reminderPreferences");

    if (!user) {
      throw new AppError("User not found", 404);
    }

    // Return default preferences if not set
    const reminderPreferences = user.reminderPreferences || {
      bookingReminders: {
        enabled: true,
        intervals: {
          twentyFourHours: true,
          oneHour: true,
          fifteenMinutes: true,
        },
      },
    };

    res.json({
      success: true,
      data: reminderPreferences,
    });
  }
);

/**
 * Update user's reminder preferences
 * PATCH /api/reminders/preferences
 */
export const updateReminderPreferences = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const userId = req.user!.id;

    // Validate request body
    const schema = z.object({
      bookingReminders: z
        .object({
          enabled: z.boolean().optional(),
          intervals: z
            .object({
              twentyFourHours: z.boolean().optional(),
              oneHour: z.boolean().optional(),
              fifteenMinutes: z.boolean().optional(),
            })
            .optional(),
        })
        .optional(),
    });

    let validatedData;
    try {
      validatedData = schema.parse(req.body);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({
          success: false,
          message: "Invalid request data",
          errors: error.issues,
        });
        return;
      }
      throw error;
    }

    const user = await User.findByIdAndUpdate(
      userId,
      {
        $set: {
          "reminderPreferences.bookingReminders": validatedData.bookingReminders,
        },
      },
      { new: true, runValidators: true }
    ).select("reminderPreferences");

    if (!user) {
      throw new AppError("User not found", 404);
    }

    res.json({
      success: true,
      message: "Reminder preferences updated successfully",
      data: user.reminderPreferences,
    });
  }
);

/**
 * Get user's upcoming reminders
 * GET /api/reminders/upcoming
 */
export const getUpcomingReminders = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const userId = req.user!.id;
    const limit = Math.min(parseInt(req.query.limit as string) || 10, 50);

    const reminders = await ScheduledNotificationService.getUserUpcomingReminders(
      userId as any,
      limit
    );

    res.json({
      success: true,
      data: reminders,
    });
  }
);

/**
 * Get user's reminder statistics
 * GET /api/reminders/stats
 */
export const getReminderStats = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const userId = req.user!.id;

  const stats = await ScheduledNotificationService.getUserReminderStats(userId as any);

  res.json({
    success: true,
    data: stats,
  });
});

/**
 * Manually trigger reminder processing (admin/dev only)
 * POST /api/reminders/process
 */
export const processRemindersManually = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    // Optional: Add admin check
    // if (req.user!.role !== "Admin") {
    //   res.status(403).json({ success: false, message: "Forbidden" });
    //   return;
    // }

    const batchSize = Math.min(parseInt(req.query.batchSize as string) || 100, 500);

    const stats = await ScheduledNotificationService.processPendingReminders(batchSize);

    res.json({
      success: true,
      message: "Reminders processed successfully",
      data: stats,
    });
  }
);
/**
 * Get monitoring statistics
 * GET /api/reminders/monitoring/stats
 */
export const getMonitoringStats = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const stats = await ReminderMonitoringService.getMonitoringStats();

    res.json({
      success: true,
      data: stats,
    });
  }
);

/**
 * Check scheduler health
 * GET /api/reminders/monitoring/health
 */
export const checkSchedulerHealth = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const healthStatus = await ReminderMonitoringService.checkSchedulerHealth();

    res.json({
      success: true,
      data: healthStatus,
    });
  }
);

/**
 * Get failed reminders
 * GET /api/reminders/monitoring/failed
 */
export const getFailedReminders = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
    const failedReminders = await ReminderMonitoringService.getFailedReminders(limit);

    res.json({
      success: true,
      data: failedReminders,
      count: failedReminders.length,
    });
  }
);

/**
 * Trigger health check manually (admin)
 * POST /api/reminders/monitoring/health-check
 */
export const triggerHealthCheck = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    // Optional: Add admin role check here
    // if (req.user?.role !== 'Admin') {
    //   res.status(403).json({ success: false, message: 'Admin access required' });
    //   return;
    // }

    await ReminderMonitoringService.performHealthCheck();

    res.json({
      success: true,
      message: "Health check performed successfully",
    });
  }
);

/**
 * Send daily summary manually (admin)
 * POST /api/reminders/monitoring/send-summary
 */
export const sendDailySummary = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  // Optional: Add admin role check here

  await ReminderMonitoringService.sendDailySummary();

  res.json({
    success: true,
    message: "Daily summary sent successfully",
  });
});

/**
 * Retry a single failed reminder
 * POST /api/reminders/monitoring/retry/:id
 */
export const retryFailedReminder = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;

    if (!id || Array.isArray(id)) {
      throw new AppError("Reminder ID is required", 400);
    }

    const result = await ReminderMonitoringService.retryFailedReminder(id);

    if (result.success) {
      res.json({
        success: true,
        message: result.message,
      });
    } else {
      res.status(400).json({
        success: false,
        message: result.message,
      });
    }
  }
);

/**
 * Retry multiple failed reminders
 * POST /api/reminders/monitoring/retry-batch
 */
export const retryMultipleReminders = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const { reminderIds } = req.body;

    if (!reminderIds || !Array.isArray(reminderIds)) {
      throw new AppError("reminderIds array is required", 400);
    }

    if (reminderIds.length === 0) {
      throw new AppError("At least one reminder ID is required", 400);
    }

    if (reminderIds.length > 100) {
      throw new AppError("Maximum 100 reminders can be retried at once", 400);
    }

    const result = await ReminderMonitoringService.retryMultipleReminders(reminderIds);

    res.json({
      success: result.success,
      data: result.results,
      message: `${result.results.filter((r) => r.success).length} of ${reminderIds.length} reminders queued for retry`,
    });
  }
);

/**
 * Create a new reminder
 * POST /api/reminders
 */
export const createReminder = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const userId = req.user!.id;
  const { type, itemName, itemType, daysFromNow } = req.body;

  if (type === "PATHWAY_DOCUMENT_REMINDER") {
    const scheduledFor = new Date();
    scheduledFor.setDate(scheduledFor.getDate() + (daysFromNow || 7));

    await ScheduledNotification.create({
      userId,
      type,
      interval: "7_DAYS",
      scheduledFor,
      status: "PENDING",
      title: "Document Reminder",
      body: `It's time to gather your documents for ${itemName}!`,
      data: { itemName, itemType },
      channels: { inApp: true, email: true },
    });

    res.json({ success: true, message: "Reminder created successfully" });
    return;
  }

  res.status(400).json({ success: false, message: "Invalid type" });
});
