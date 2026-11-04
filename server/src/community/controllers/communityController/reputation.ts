import { Request, Response } from "express";
import { CommunityService } from "../../services/CommunityService";
import { getOptionalUserId, getUserId, toAppError } from "./shared";
import { asyncHandler } from "../../../middleware/asyncHandler";

export const getMyCommunityReputation = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    try {
      const data = await CommunityService.getMyReputation(getUserId(req));
      res.status(200).json({
        success: true,
        message: "Reputation fetched",
        data,
      });
    } catch (error) {
      throw toAppError(error, "Failed to fetch reputation");
    }
  }
);

export const searchCommunity = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  try {
    const q = typeof req.query.q === "string" ? req.query.q : "";
    const rawType = typeof req.query.type === "string" ? req.query.type.toUpperCase() : "ALL";
    const type =
      rawType === "POST" || rawType === "BLOG" ? (rawType as "POST" | "BLOG") : ("ALL" as const);
    const limit = Number(req.query.limit) || 20;

    const data = await CommunityService.searchCommunity(getOptionalUserId(req), q, { type, limit });

    res.status(200).json({
      success: true,
      message: "Search complete",
      data,
    });
  } catch (error) {
    throw toAppError(error, "Search failed");
  }
});

export const listCommunityLeaderboard = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    try {
      const limit = Number(req.query.limit) || 15;
      const data = await CommunityService.listLeaderboard(getUserId(req), limit);
      res.status(200).json({
        success: true,
        message: "Leaderboard fetched",
        data,
      });
    } catch (error) {
      throw toAppError(error, "Failed to fetch leaderboard");
    }
  }
);

export const listCommunityFollows = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    try {
      const data = await CommunityService.listFollows(getUserId(req));
      res.status(200).json({
        success: true,
        message: "Follows fetched",
        data,
      });
    } catch (error) {
      throw toAppError(error, "Failed to fetch follows");
    }
  }
);

export const toggleCommunityFollow = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { kind, targetId } = req.body as {
        kind: "GROUP" | "TOPIC";
        targetId: string;
      };
      const data = await CommunityService.toggleFollow(getUserId(req), {
        kind,
        targetId,
      });
      res.status(200).json({
        success: true,
        message: data.following ? "Followed" : "Unfollowed",
        data,
      });
    } catch (error) {
      throw toAppError(error, "Failed to update follow");
    }
  }
);

export const importCommunityFollows = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { items } = req.body as {
        items: { kind: "GROUP" | "TOPIC"; targetId: string }[];
      };
      const data = await CommunityService.importFollows(getUserId(req), items);
      res.status(200).json({
        success: true,
        message: "Follows imported",
        data,
      });
    } catch (error) {
      throw toAppError(error, "Failed to import follows");
    }
  }
);
