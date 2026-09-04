import { Request, Response } from "express";
import { getCoachEarnings, getCoachAnalytics } from "../services/CoachAnalyticsService";
import { asyncHandler } from "../../middleware/asyncHandler";
import { AppError } from "../../utils/AppError";

export const getCoachEarningsHandler = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    if (!req.user?.id) {
      throw new AppError("Unauthorized", 401);
    }
    const data = await getCoachEarnings(req.user.id);
    res.status(200).json({ success: true, message: "Earnings retrieved", data });
  }
);

export const getCoachAnalyticsHandler = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    if (!req.user?.id) {
      throw new AppError("Unauthorized", 401);
    }
    const data = await getCoachAnalytics(req.user.id);
    res.status(200).json({ success: true, message: "Analytics retrieved", data });
  }
);
