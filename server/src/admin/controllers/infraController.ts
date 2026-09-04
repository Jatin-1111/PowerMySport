import { Request, Response } from "express";
import { getInfraMetrics, getInfraOverview } from "../services/InfraMonitoringService";
import { asyncHandler } from "../../middleware/asyncHandler";

export const getInfraOverviewController = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const forceFresh = req.query.fresh === "true";
    const data = await getInfraOverview(forceFresh);
    res.status(200).json({
      success: true,
      message: "Infrastructure overview retrieved",
      data,
    });
  }
);

export const getInfraMetricsController = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const hours = Math.min(168, Math.max(1, Number(req.query.hours) || 6));
    const forceFresh = req.query.fresh === "true";
    const data = await getInfraMetrics(hours, forceFresh);
    res.status(200).json({
      success: true,
      message: "Infrastructure metrics retrieved",
      data,
    });
  }
);
