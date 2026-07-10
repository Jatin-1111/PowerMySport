import { Request, Response } from "express";
import {
  getCoachEarnings,
  getCoachAnalytics,
} from "../services/CoachAnalyticsService";

export const getCoachEarningsHandler = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    if (!req.user?.id) {
      res.status(401).json({ success: false, message: "Unauthorized" });
      return;
    }
    const data = await getCoachEarnings(req.user.id);
    res
      .status(200)
      .json({ success: true, message: "Earnings retrieved", data });
  } catch (error) {
    res
      .status(500)
      .json({
        success: false,
        message:
          error instanceof Error ? error.message : "Failed to fetch earnings",
      });
  }
};

export const getCoachAnalyticsHandler = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    if (!req.user?.id) {
      res.status(401).json({ success: false, message: "Unauthorized" });
      return;
    }
    const data = await getCoachAnalytics(req.user.id);
    res
      .status(200)
      .json({ success: true, message: "Analytics retrieved", data });
  } catch (error) {
    res
      .status(500)
      .json({
        success: false,
        message:
          error instanceof Error ? error.message : "Failed to fetch analytics",
      });
  }
};
