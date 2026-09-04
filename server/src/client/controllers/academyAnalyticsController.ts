import { Request, Response } from "express";
import { getAcademyEarnings, getAcademyAnalytics } from "../services/AcademyAnalyticsService";
import { asyncHandler } from "../../middleware/asyncHandler";
import { AppError } from "../../utils/AppError";

export const getAcademyEarningsHandler = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    if (!req.user?.id) {
      throw new AppError("Unauthorized", 401);
    }
    const data = await getAcademyEarnings(req.user.id);
    res.status(200).json({ success: true, message: "Academy earnings retrieved", data });
  }
);

export const getAcademyAnalyticsHandler = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    if (!req.user?.id) {
      throw new AppError("Unauthorized", 401);
    }
    const data = await getAcademyAnalytics(req.user.id);
    res.status(200).json({ success: true, message: "Academy analytics retrieved", data });
  }
);
