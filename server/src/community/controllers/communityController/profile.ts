import { Request, Response } from "express";
import { CommunityService } from "../../services/CommunityService";
import { getUserId, handleError } from "./shared";

export const getCommunityProfile = async (req: Request, res: Response): Promise<void> => {
  try {
    const data = await CommunityService.getMyProfile(getUserId(req));
    res.status(200).json({
      success: true,
      message: "Community profile fetched",
      data,
    });
  } catch (error) {
    handleError(res, error, "Failed to fetch community profile");
  }
};

export const searchPlayers = async (req: Request, res: Response): Promise<void> => {
  try {
    const rawQuery = req.query.q;
    const query = typeof rawQuery === "string" ? rawQuery : "";
    const rawLimit = req.query.limit;
    const parsedLimit = typeof rawLimit === "string" ? Number(rawLimit) : Number.NaN;
    const limit = Number.isFinite(parsedLimit) ? parsedLimit : 10;

    const roleRaw = req.query.role;
    const role = typeof roleRaw === "string" ? roleRaw : undefined;

    const data = await CommunityService.searchPlayers(getUserId(req), query, limit, role);

    res.status(200).json({
      success: true,
      message: "Community users fetched",
      data,
    });
  } catch (error) {
    handleError(res, error, "Failed to search players");
  }
};

export const getPlayerProfile = async (req: Request, res: Response): Promise<void> => {
  try {
    const targetUserId = String(req.params.userId || "");
    if (!targetUserId) {
      throw new Error("userId is required");
    }

    const data = await CommunityService.getPlayerProfile(getUserId(req), targetUserId);

    res.status(200).json({
      success: true,
      message: "Community player profile fetched",
      data,
    });
  } catch (error) {
    handleError(res, error, "Failed to fetch player profile");
  }
};

export const updateCommunityProfile = async (req: Request, res: Response): Promise<void> => {
  try {
    const data = await CommunityService.updateMyProfile(getUserId(req), req.body);
    res.status(200).json({
      success: true,
      message: "Community privacy settings updated",
      data,
    });
  } catch (error) {
    handleError(res, error, "Failed to update community profile");
  }
};

export const getBlockedUsers = async (req: Request, res: Response): Promise<void> => {
  try {
    const data = await CommunityService.getBlockedUsers(getUserId(req));
    res.status(200).json({
      success: true,
      message: "Blocked users fetched",
      data,
    });
  } catch (error) {
    handleError(res, error, "Failed to fetch blocked users");
  }
};

export const blockUser = async (req: Request, res: Response): Promise<void> => {
  try {
    const { targetUserId } = req.body as { targetUserId: string };
    const data = await CommunityService.blockUser(getUserId(req), targetUserId);
    res.status(200).json({
      success: true,
      message: "User blocked successfully",
      data,
    });
  } catch (error) {
    handleError(res, error, "Failed to block user");
  }
};

export const unblockUser = async (req: Request, res: Response): Promise<void> => {
  try {
    const { targetUserId } = req.body as { targetUserId: string };
    const data = await CommunityService.unblockUser(getUserId(req), targetUserId);
    res.status(200).json({
      success: true,
      message: "User unblocked successfully",
      data,
    });
  } catch (error) {
    handleError(res, error, "Failed to unblock user");
  }
};
