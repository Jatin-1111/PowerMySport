import { Request, Response } from "express";
import { CommunityService } from "../../services/CommunityService";
import { getUserId, toAppError } from "./shared";
import { asyncHandler } from "../../../middleware/asyncHandler";

export const reportCommunityContent = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { targetType, targetId, reason, details } = req.body as {
        targetType: "MESSAGE" | "GROUP" | "POST" | "ANSWER";
        targetId: string;
        reason: string;
        details?: string;
      };

      const data = await CommunityService.createReport(getUserId(req), {
        targetType,
        targetId,
        reason,
        ...(typeof details === "string" && details.trim() ? { details } : {}),
      });

      res.status(201).json({
        success: true,
        message: "Report submitted",
        data,
      });
    } catch (error) {
      throw toAppError(error, "Failed to submit report");
    }
  }
);

export const listMyCommunityReports = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    try {
      const page = Math.max(1, Number(req.query.page) || 1);
      const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));
      const data = await CommunityService.listMyReports(getUserId(req), page, limit);

      res.status(200).json({
        success: true,
        message: "Reports fetched",
        data: data.items,
        pagination: data.pagination,
      });
    } catch (error) {
      throw toAppError(error, "Failed to fetch reports");
    }
  }
);
