import { Request, Response } from "express";
import { blockCoachDates, getCoachCalendar, unblockCoachDate } from "../../services/CoachService";

/**
 * Get coach calendar data for a date range
 * GET /api/coaches/my-profile/calendar?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD
 */
export const getCoachCalendarHandler = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user?.id) {
      res.status(401).json({ success: false, message: "Unauthorized" });
      return;
    }

    const { startDate, endDate } = req.query as {
      startDate?: string;
      endDate?: string;
    };

    if (!startDate || !endDate) {
      res.status(400).json({
        success: false,
        message: "startDate and endDate query params are required (YYYY-MM-DD)",
      });
      return;
    }

    const start = new Date(startDate);
    const end = new Date(endDate);
    // Include the full end day
    end.setHours(23, 59, 59, 999);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      res.status(400).json({
        success: false,
        message: "Invalid date format. Use YYYY-MM-DD.",
      });
      return;
    }

    if (end < start) {
      res.status(400).json({
        success: false,
        message: "endDate must be after startDate",
      });
      return;
    }

    const data = await getCoachCalendar(req.user.id, start, end);

    res.status(200).json({
      success: true,
      message: "Calendar data retrieved",
      data,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : "Failed to fetch calendar",
    });
  }
};

/**
 * Block a date or date range for the coach
 * POST /api/coaches/my-profile/block-dates
 */
export const blockCoachDatesHandler = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user?.id) {
      res.status(401).json({ success: false, message: "Unauthorized" });
      return;
    }

    const { startDate, endDate, reason, allDay } = req.body as {
      startDate: string;
      endDate: string;
      reason?: string;
      allDay?: boolean;
    };

    if (!startDate || !endDate) {
      res.status(400).json({
        success: false,
        message: "startDate and endDate are required",
      });
      return;
    }

    const start = new Date(startDate);
    const end = new Date(endDate);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      res.status(400).json({ success: false, message: "Invalid date format" });
      return;
    }

    const block = await blockCoachDates(req.user.id, {
      startDate: start,
      endDate: end,
      ...(reason !== undefined ? { reason } : {}),
      allDay: allDay ?? true,
    });

    res.status(201).json({
      success: true,
      message: "Date range blocked successfully",
      data: block,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error instanceof Error ? error.message : "Failed to block dates",
    });
  }
};

/**
 * Remove a blocked date entry
 * DELETE /api/coaches/my-profile/block-dates/:blockId
 */
export const unblockCoachDateHandler = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user?.id) {
      res.status(401).json({ success: false, message: "Unauthorized" });
      return;
    }

    const { blockId } = req.params as { blockId: string };
    if (!blockId) {
      res.status(400).json({ success: false, message: "blockId is required" });
      return;
    }

    await unblockCoachDate(req.user.id, blockId);

    res.status(200).json({
      success: true,
      message: "Blocked date removed",
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error instanceof Error ? error.message : "Failed to unblock date",
    });
  }
};
