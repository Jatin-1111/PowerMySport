import { Request, Response } from "express";
import {
  getInfraMetrics,
  getInfraOverview,
} from "../services/InfraMonitoringService";

export const getInfraOverviewController = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const forceFresh = req.query.fresh === "true";
    const data = await getInfraOverview(forceFresh);
    res.status(200).json({
      success: true,
      message: "Infrastructure overview retrieved",
      data,
    });
  } catch (error) {
    res.status(502).json({
      success: false,
      message:
        error instanceof Error
          ? error.message
          : "Failed to retrieve infrastructure overview",
    });
  }
};

export const getInfraMetricsController = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const hours = Math.min(168, Math.max(1, Number(req.query.hours) || 6));
    const forceFresh = req.query.fresh === "true";
    const data = await getInfraMetrics(hours, forceFresh);
    res.status(200).json({
      success: true,
      message: "Infrastructure metrics retrieved",
      data,
    });
  } catch (error) {
    res.status(502).json({
      success: false,
      message:
        error instanceof Error
          ? error.message
          : "Failed to retrieve infrastructure metrics",
    });
  }
};
