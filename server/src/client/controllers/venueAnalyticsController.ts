import { Request, Response } from "express";
import { getVenueEarnings, getVenueAnalytics } from "../services/VenueAnalyticsService";
import { asyncHandler } from "../../middleware/asyncHandler";
import { AppError } from "../../utils/AppError";

export const getVenueEarningsHandler = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    if (!req.user?.id) {
      throw new AppError("Unauthorized", 401);
    }
    const data = await getVenueEarnings(req.user.id);
    res.status(200).json({ success: true, message: "Venue earnings retrieved", data });
  }
);

export const getVenueAnalyticsHandler = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    if (!req.user?.id) {
      throw new AppError("Unauthorized", 401);
    }
    const data = await getVenueAnalytics(req.user.id);
    res.status(200).json({ success: true, message: "Venue analytics retrieved", data });
  }
);
