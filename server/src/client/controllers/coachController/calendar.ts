import { Request, Response } from "express";
import { blockCoachDates, getCoachCalendar, unblockCoachDate } from "../../services/CoachService";
import { asyncHandler } from "../../../middleware/asyncHandler";
import { AppError } from "../../../utils/AppError";

/**
 * Get coach calendar data for a date range
 * GET /api/coaches/my-profile/calendar?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD
 */
export const getCoachCalendarHandler = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    if (!req.user?.id) {
      throw new AppError("Unauthorized", 401);
    }

    const { startDate, endDate } = req.query as {
      startDate?: string;
      endDate?: string;
    };

    if (!startDate || !endDate) {
      throw new AppError("startDate and endDate query params are required (YYYY-MM-DD)", 400);
    }

    const start = new Date(startDate);
    const end = new Date(endDate);
    // Include the full end day
    end.setHours(23, 59, 59, 999);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      throw new AppError("Invalid date format. Use YYYY-MM-DD.", 400);
    }

    if (end < start) {
      throw new AppError("endDate must be after startDate", 400);
    }

    const data = await getCoachCalendar(req.user.id, start, end);

    res.status(200).json({
      success: true,
      message: "Calendar data retrieved",
      data,
    });
  }
);

/**
 * Block a date or date range for the coach
 * POST /api/coaches/my-profile/block-dates
 */
export const blockCoachDatesHandler = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    if (!req.user?.id) {
      throw new AppError("Unauthorized", 401);
    }

    const { startDate, endDate, reason, allDay } = req.body as {
      startDate: string;
      endDate: string;
      reason?: string;
      allDay?: boolean;
    };

    if (!startDate || !endDate) {
      throw new AppError("startDate and endDate are required", 400);
    }

    const start = new Date(startDate);
    const end = new Date(endDate);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      throw new AppError("Invalid date format", 400);
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
  }
);

/**
 * Remove a blocked date entry
 * DELETE /api/coaches/my-profile/block-dates/:blockId
 */
export const unblockCoachDateHandler = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    if (!req.user?.id) {
      throw new AppError("Unauthorized", 401);
    }

    const { blockId } = req.params as { blockId: string };
    if (!blockId) {
      throw new AppError("blockId is required", 400);
    }

    await unblockCoachDate(req.user.id, blockId);

    res.status(200).json({
      success: true,
      message: "Blocked date removed",
    });
  }
);
