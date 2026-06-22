import { Request, Response } from "express";
import { getAcademyEarnings, getAcademyAnalytics } from "../services/AcademyAnalyticsService";

export const getAcademyEarningsHandler = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user?.id) { res.status(401).json({ success: false, message: "Unauthorized" }); return; }
    const data = await getAcademyEarnings(req.user.id);
    res.status(200).json({ success: true, message: "Academy earnings retrieved", data });
  } catch (error) {
    res.status(500).json({ success: false, message: error instanceof Error ? error.message : "Failed to fetch academy earnings" });
  }
};

export const getAcademyAnalyticsHandler = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user?.id) { res.status(401).json({ success: false, message: "Unauthorized" }); return; }
    const data = await getAcademyAnalytics(req.user.id);
    res.status(200).json({ success: true, message: "Academy analytics retrieved", data });
  } catch (error) {
    res.status(500).json({ success: false, message: error instanceof Error ? error.message : "Failed to fetch academy analytics" });
  }
};
