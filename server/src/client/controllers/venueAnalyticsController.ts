import { Request, Response } from "express";
import { getVenueEarnings, getVenueAnalytics } from "../services/VenueAnalyticsService";

export const getVenueEarningsHandler = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user?.id) { res.status(401).json({ success: false, message: "Unauthorized" }); return; }
    const data = await getVenueEarnings(req.user.id);
    res.status(200).json({ success: true, message: "Venue earnings retrieved", data });
  } catch (error) {
    res.status(500).json({ success: false, message: error instanceof Error ? error.message : "Failed to fetch venue earnings" });
  }
};

export const getVenueAnalyticsHandler = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user?.id) { res.status(401).json({ success: false, message: "Unauthorized" }); return; }
    const data = await getVenueAnalytics(req.user.id);
    res.status(200).json({ success: true, message: "Venue analytics retrieved", data });
  } catch (error) {
    res.status(500).json({ success: false, message: error instanceof Error ? error.message : "Failed to fetch venue analytics" });
  }
};
