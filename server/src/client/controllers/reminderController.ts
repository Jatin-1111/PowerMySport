import { Request, Response, NextFunction } from "express";
import { ScheduledNotificationService } from "../services/ScheduledNotificationService";
import { ReminderMonitoringService } from "../services/ReminderMonitoringService";
import { z } from "zod";
import { User } from "../models/User";

/**
 * Get user's reminder preferences
 * GET /api/reminders/preferences
 */
export const getReminderPreferences = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const userId = req.user!.id;

    const user = await User.findById(userId).select("reminderPreferences");

    if (!user) {
      res.status(404).json({
        success: false,
        message: "User not found",
      });
      return;
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
  } catch (error) {
    next(error);
  }
};

/**
 * Update user's reminder preferences
 * PATCH /api/reminders/preferences
 */
export const updateReminderPreferences = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
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

    const validatedData = schema.parse(req.body);

    const user = await User.findByIdAndUpdate(
      userId,
      {
        $set: {
          "reminderPreferences.bookingReminders":
            validatedData.bookingReminders,
        },
      },
      { new: true, runValidators: true },
    ).select("reminderPreferences");

    if (!user) {
      res.status(404).json({
        success: false,
        message: "User not found",
      });
      return;
    }

    res.json({
      success: true,
      message: "Reminder preferences updated successfully",
      data: user.reminderPreferences,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({
        success: false,
        message: "Invalid request data",
        errors: error.issues,
      });
      return;
    }
    next(error);
  }
};

/**
 * Get user's upcoming reminders
 * GET /api/reminders/upcoming
 */
export const getUpcomingReminders = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const userId = req.user!.id;
    const limit = Math.min(parseInt(req.query.limit as string) || 10, 50);

    const reminders =
      await ScheduledNotificationService.getUserUpcomingReminders(
        userId as any,
        limit,
      );

    res.json({
      success: true,
      data: reminders,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get user's reminder statistics
 * GET /api/reminders/stats
 */
export const getReminderStats = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const userId = req.user!.id;

    const stats = await ScheduledNotificationService.getUserReminderStats(
      userId as any,
    );

    res.json({
      success: true,
      data: stats,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Manually trigger reminder processing (admin/dev only)
 * POST /api/reminders/process
 */
export const processRemindersManually = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    // Optional: Add admin check
    // if (req.user!.role !== "ADMIN") {
    //   res.status(403).json({ success: false, message: "Forbidden" });
    //   return;
    // }

    const batchSize = Math.min(
      parseInt(req.query.batchSize as string) || 100,
      500,
    );

    const stats =
      await ScheduledNotificationService.processPendingReminders(batchSize);

    res.json({
      success: true,
      message: "Reminders processed successfully",
      data: stats,
    });
  } catch (error) {
    next(error);
  }
};
/**
 * Get monitoring statistics
 * GET /api/reminders/monitoring/stats
 */
export const getMonitoringStats = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const stats = await ReminderMonitoringService.getMonitoringStats();

    res.json({
      success: true,
      data: stats,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Check scheduler health
 * GET /api/reminders/monitoring/health
 */
export const checkSchedulerHealth = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const healthStatus = await ReminderMonitoringService.checkSchedulerHealth();

    res.json({
      success: true,
      data: healthStatus,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get failed reminders
 * GET /api/reminders/monitoring/failed
 */
export const getFailedReminders = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
    const failedReminders =
      await ReminderMonitoringService.getFailedReminders(limit);

    res.json({
      success: true,
      data: failedReminders,
      count: failedReminders.length,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Trigger health check manually (admin)
 * POST /api/reminders/monitoring/health-check
 */
export const triggerHealthCheck = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    // Optional: Add admin role check here
    // if (req.user?.role !== 'ADMIN') {
    //   res.status(403).json({ success: false, message: 'Admin access required' });
    //   return;
    // }

    await ReminderMonitoringService.performHealthCheck();

    res.json({
      success: true,
      message: "Health check performed successfully",
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Send daily summary manually (admin)
 * POST /api/reminders/monitoring/send-summary
 */
export const sendDailySummary = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    // Optional: Add admin role check here

    await ReminderMonitoringService.sendDailySummary();

    res.json({
      success: true,
      message: "Daily summary sent successfully",
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Retry a single failed reminder
 * POST /api/reminders/monitoring/retry/:id
 */
export const retryFailedReminder = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const { id } = req.params;

    if (!id || Array.isArray(id)) {
      res.status(400).json({
        success: false,
        message: "Reminder ID is required",
      });
      return;
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
  } catch (error) {
    next(error);
  }
};

/**
 * Retry multiple failed reminders
 * POST /api/reminders/monitoring/retry-batch
 */
export const retryMultipleReminders = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const { reminderIds } = req.body;

    if (!reminderIds || !Array.isArray(reminderIds)) {
      res.status(400).json({
        success: false,
        message: "reminderIds array is required",
      });
      return;
    }

    if (reminderIds.length === 0) {
      res.status(400).json({
        success: false,
        message: "At least one reminder ID is required",
      });
      return;
    }

    if (reminderIds.length > 100) {
      res.status(400).json({
        success: false,
        message: "Maximum 100 reminders can be retried at once",
      });
      return;
    }

    const result =
      await ReminderMonitoringService.retryMultipleReminders(reminderIds);

    res.json({
      success: result.success,
      data: result.results,
      message: `${result.results.filter((r) => r.success).length} of ${reminderIds.length} reminders queued for retry`,
    });
  } catch (error) {
    next(error);
  }
};
