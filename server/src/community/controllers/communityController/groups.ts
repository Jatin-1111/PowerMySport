import { Request, Response } from "express";
import { CommunityService } from "../../services/CommunityService";
import { getOptionalUserId, getUserId, toAppError } from "./shared";
import { asyncHandler } from "../../../middleware/asyncHandler";

type GroupVisibilityInput = "PUBLIC" | "INVITE_ONLY" | "PRIVATE";

/**
 * POST /community/groups/upload-url
 */
export const getGroupImageUploadUrl = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { contentType } = req.body as {
        contentType: "image/jpeg" | "image/png" | "image/webp";
      };
      // Reusing the blog image generator for general public images
      const { S3Service } = await import("../../../shared/services/S3Service");
      const s3Service = new S3Service();
      const data = await s3Service.generateBlogImageUploadUrl(getUserId(req), contentType);
      res.status(200).json({ success: true, message: "Upload URL generated", data });
    } catch (error) {
      throw toAppError(error, "Failed to generate upload URL");
    }
  }
);

export const listGroups = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  try {
    const query = typeof req.query.q === "string" ? req.query.q : "";
    const limit = Number.isFinite(Number(req.query.limit)) ? Number(req.query.limit) : 20;
    const data = await CommunityService.listGroups(getOptionalUserId(req), query, limit);

    res.status(200).json({
      success: true,
      message: "Groups fetched",
      data,
    });
  } catch (error) {
    throw toAppError(error, "Failed to fetch groups");
  }
});

export const createGroup = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      name,
      description,
      sport,
      city,
      audience,
      visibility,
      profilePicture,
      profilePictureKey,
    } = req.body as {
      name: string;
      description?: string;
      sport?: string;
      city?: string;
      audience?: "ALL";
      visibility?: GroupVisibilityInput;
      profilePicture?: string;
      profilePictureKey?: string;
    };

    const payload: {
      name: string;
      description?: string;
      sport?: string;
      city?: string;
      audience?: "ALL";
      visibility?: GroupVisibilityInput;
      profilePicture?: string;
      profilePictureKey?: string;
    } = { name };
    if (typeof description === "string") {
      payload.description = description;
    }
    if (typeof sport === "string") {
      payload.sport = sport;
    }
    if (typeof city === "string") {
      payload.city = city;
    }
    if (audience === "ALL") {
      payload.audience = audience;
    }
    if (visibility === "PUBLIC" || visibility === "INVITE_ONLY" || visibility === "PRIVATE") {
      payload.visibility = visibility;
    }
    if (typeof profilePicture === "string") {
      payload.profilePicture = profilePicture;
    }
    if (typeof profilePictureKey === "string") {
      payload.profilePictureKey = profilePictureKey;
    }

    const data = await CommunityService.createGroup(getUserId(req), payload);

    res.status(201).json({
      success: true,
      message: "Group created",
      data,
    });
  } catch (error) {
    throw toAppError(error, "Failed to create group");
  }
});

export const updateGroup = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  try {
    const groupId = String(req.params.groupId || "");
    const {
      name,
      description,
      sport,
      city,
      audience,
      visibility,
      profilePicture,
      profilePictureKey,
    } = req.body as {
      name?: string;
      description?: string;
      sport?: string;
      city?: string;
      audience?: "ALL";
      visibility?: GroupVisibilityInput;
      profilePicture?: string;
      profilePictureKey?: string;
    };

    const payload: {
      name?: string;
      description?: string;
      sport?: string;
      city?: string;
      audience?: "ALL";
      visibility?: GroupVisibilityInput;
      profilePicture?: string;
      profilePictureKey?: string;
    } = {};
    if (typeof name === "string") payload.name = name;
    if (typeof description === "string") payload.description = description;
    if (typeof sport === "string") payload.sport = sport;
    if (typeof city === "string") payload.city = city;
    if (audience) payload.audience = audience;
    if (visibility) payload.visibility = visibility;
    if (typeof profilePicture === "string") payload.profilePicture = profilePicture;
    if (typeof profilePictureKey === "string") payload.profilePictureKey = profilePictureKey;

    const data = await CommunityService.updateGroup(getUserId(req), groupId, payload);

    res.status(200).json({
      success: true,
      message: "Group updated",
      data,
    });
  } catch (error) {
    throw toAppError(error, "Failed to update group");
  }
});

export const joinGroup = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  try {
    const groupId = String(req.params.groupId || "");
    if (!groupId) {
      throw new Error("groupId is required");
    }

    const data = await CommunityService.joinGroup(getUserId(req), groupId);
    res.status(200).json({
      success: true,
      message: "Joined group",
      data,
    });
  } catch (error) {
    throw toAppError(error, "Failed to join group");
  }
});

export const deleteGroup = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  try {
    const groupId = String(req.params.groupId || "");
    if (!groupId) {
      throw new Error("groupId is required");
    }

    const data = await CommunityService.deleteGroup(getUserId(req), groupId);
    res.status(200).json({
      success: true,
      message: "Group deleted successfully",
      data,
    });
  } catch (error) {
    throw toAppError(error, "Failed to delete group");
  }
});

export const leaveGroup = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  try {
    const groupId = String(req.params.groupId || "");
    if (!groupId) {
      throw new Error("groupId is required");
    }

    const data = await CommunityService.leaveGroup(getUserId(req), groupId);
    res.status(200).json({
      success: true,
      message: "Left group",
      data,
    });
  } catch (error) {
    throw toAppError(error, "Failed to leave group");
  }
});

export const addGroupMember = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  try {
    const groupId = String(req.params.groupId || "");
    if (!groupId) {
      throw new Error("groupId is required");
    }

    const { targetUserId } = req.body as { targetUserId: string };
    const data = await CommunityService.addGroupMember(getUserId(req), groupId, targetUserId);

    res.status(200).json({
      success: true,
      message: "Member added to group",
      data,
    });
  } catch (error) {
    throw toAppError(error, "Failed to add group member");
  }
});

export const updateGroupSettings = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    try {
      const groupId = String(req.params.groupId || "");
      if (!groupId) {
        throw new Error("groupId is required");
      }

      const { memberAddPolicy, postPolicy } = req.body as {
        memberAddPolicy?: "ADMIN_ONLY" | "ANY_MEMBER";
        postPolicy?: "ANY_MEMBER" | "ADMIN_ONLY";
      };
      const data = await CommunityService.updateGroupSettings(getUserId(req), groupId, {
        ...(memberAddPolicy ? { memberAddPolicy } : {}),
        ...(postPolicy ? { postPolicy } : {}),
      });

      res.status(200).json({
        success: true,
        message: "Group settings updated",
        data,
      });
    } catch (error) {
      throw toAppError(error, "Failed to update group settings");
    }
  }
);

export const getGroupMembers = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  try {
    const groupId = req.params.groupId as string;
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(500, Math.max(1, Number(req.query.limit) || 200));
    const data = await CommunityService.getGroupMembers(getUserId(req), groupId, page, limit);
    res.status(200).json({
      success: true,
      message: "Group members fetched",
      data: data.items,
      pagination: data.pagination,
    });
  } catch (error) {
    throw toAppError(error, "Failed to fetch group members");
  }
});

export const joinGroupByCode = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  try {
    const inviteCode = req.params.inviteCode as string;
    const data = await CommunityService.joinGroupByCode(getUserId(req), inviteCode);
    res.status(200).json({
      success: true,
      message: "Joined group successfully",
      data,
    });
  } catch (error) {
    throw toAppError(error, "Failed to join group");
  }
});

export const getGroupInviteCode = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    try {
      const groupId = req.params.groupId as string;
      const data = await CommunityService.getGroupInviteCode(getUserId(req), groupId);
      res.status(200).json({
        success: true,
        message: "Invite code fetched",
        data,
      });
    } catch (error) {
      throw toAppError(error, "Failed to fetch invite code");
    }
  }
);
