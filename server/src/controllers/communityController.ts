import { Request, Response } from "express";
import { CommunityService } from "../services/CommunityService";

const getUserId = (req: Request): string => {
  if (!req.user?.id) {
    throw new Error("Unauthorized");
  }

  return req.user.id;
};

const getConversationId = (req: Request): string => {
  const conversationId = req.params.conversationId;
  if (typeof conversationId !== "string" || !conversationId) {
    throw new Error("conversationId is required");
  }

  return conversationId;
};

const getStatusCode = (message: string): number => {
  if (message === "Unauthorized") return 401;
  if (message === "Access denied") return 403;
  if (message.includes("not found")) return 404;
  if (
    message.includes("cannot") ||
    message.includes("required") ||
    message.includes("privacy") ||
    message.includes("accept")
  ) {
    return 400;
  }

  return 500;
};

const handleError = (res: Response, error: unknown, fallback: string) => {
  const message = error instanceof Error ? error.message : fallback;
  res.status(getStatusCode(message)).json({
    success: false,
    message,
  });
};

export const getCommunityProfile = async (
  req: Request,
  res: Response,
): Promise<void> => {
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

export const searchPlayers = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const rawQuery = req.query.q;
    const query = typeof rawQuery === "string" ? rawQuery : "";
    const rawLimit = req.query.limit;
    const parsedLimit =
      typeof rawLimit === "string" ? Number(rawLimit) : Number.NaN;
    const limit = Number.isFinite(parsedLimit) ? parsedLimit : 10;

    const data = await CommunityService.searchPlayers(
      getUserId(req),
      query,
      limit,
    );

    res.status(200).json({
      success: true,
      message: "Players fetched",
      data,
    });
  } catch (error) {
    handleError(res, error, "Failed to search players");
  }
};

export const updateCommunityProfile = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const data = await CommunityService.updateMyProfile(
      getUserId(req),
      req.body,
    );
    res.status(200).json({
      success: true,
      message: "Community privacy settings updated",
      data,
    });
  } catch (error) {
    handleError(res, error, "Failed to update community profile");
  }
};

export const getBlockedUsers = async (
  req: Request,
  res: Response,
): Promise<void> => {
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

export const unblockUser = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { targetUserId } = req.body as { targetUserId: string };
    const data = await CommunityService.unblockUser(
      getUserId(req),
      targetUserId,
    );
    res.status(200).json({
      success: true,
      message: "User unblocked successfully",
      data,
    });
  } catch (error) {
    handleError(res, error, "Failed to unblock user");
  }
};

export const startConversation = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { targetUserId } = req.body as { targetUserId: string };
    const data = await CommunityService.startConversation(
      getUserId(req),
      targetUserId,
    );
    res.status(200).json({
      success: true,
      message: "Conversation ready",
      data,
    });
  } catch (error) {
    handleError(res, error, "Failed to start conversation");
  }
};

export const acceptConversationRequest = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const data = await CommunityService.acceptConversationRequest(
      getUserId(req),
      getConversationId(req),
    );
    res.status(200).json({
      success: true,
      message: "Conversation request accepted",
      data,
    });
  } catch (error) {
    handleError(res, error, "Failed to accept request");
  }
};

export const rejectConversationRequest = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const data = await CommunityService.rejectConversationRequest(
      getUserId(req),
      getConversationId(req),
    );
    res.status(200).json({
      success: true,
      message: "Conversation request rejected",
      data,
    });
  } catch (error) {
    handleError(res, error, "Failed to reject request");
  }
};

export const listConversations = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 25));
    const mode =
      typeof req.query.mode === "string" ? req.query.mode.toUpperCase() : "ALL";
    const type =
      typeof req.query.type === "string" ? req.query.type.toUpperCase() : "ALL";
    const search = typeof req.query.q === "string" ? req.query.q : "";
    const data = await CommunityService.listConversations(
      getUserId(req),
      page,
      limit,
      {
        mode: mode === "UNREAD" || mode === "REQUESTS" ? mode : "ALL",
        type: type === "CONTACTS" || type === "GROUPS" ? type : "ALL",
        search,
      },
    );
    res.status(200).json({
      success: true,
      message: "Conversations fetched",
      data,
    });
  } catch (error) {
    handleError(res, error, "Failed to fetch conversations");
  }
};

export const getConversationMessages = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 30));
    const data = await CommunityService.getMessages(
      getUserId(req),
      getConversationId(req),
      page,
      limit,
    );

    res.status(200).json({
      success: true,
      message: "Messages fetched",
      data,
    });
  } catch (error) {
    handleError(res, error, "Failed to fetch messages");
  }
};

export const sendMessage = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { conversationId, content } = req.body as {
      conversationId: string;
      content: string;
    };

    const data = await CommunityService.sendMessage(
      getUserId(req),
      conversationId,
      content,
    );

    res.status(201).json({
      success: true,
      message: "Message sent",
      data,
    });
  } catch (error) {
    handleError(res, error, "Failed to send message");
  }
};

export const listGroups = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const query = typeof req.query.q === "string" ? req.query.q : "";
    const limit = Number.isFinite(Number(req.query.limit))
      ? Number(req.query.limit)
      : 20;
    const data = await CommunityService.listGroups(
      getUserId(req),
      query,
      limit,
    );

    res.status(200).json({
      success: true,
      message: "Groups fetched",
      data,
    });
  } catch (error) {
    handleError(res, error, "Failed to fetch groups");
  }
};

export const createGroup = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { name, description, sport, city } = req.body as {
      name: string;
      description?: string;
      sport?: string;
      city?: string;
    };

    const payload: {
      name: string;
      description?: string;
      sport?: string;
      city?: string;
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

    const data = await CommunityService.createGroup(getUserId(req), payload);

    res.status(201).json({
      success: true,
      message: "Group created",
      data,
    });
  } catch (error) {
    handleError(res, error, "Failed to create group");
  }
};

export const joinGroup = async (req: Request, res: Response): Promise<void> => {
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
    handleError(res, error, "Failed to join group");
  }
};

export const leaveGroup = async (
  req: Request,
  res: Response,
): Promise<void> => {
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
    handleError(res, error, "Failed to leave group");
  }
};

export const addGroupMember = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const groupId = String(req.params.groupId || "");
    if (!groupId) {
      throw new Error("groupId is required");
    }

    const { targetUserId } = req.body as { targetUserId: string };
    const data = await CommunityService.addGroupMember(
      getUserId(req),
      groupId,
      targetUserId,
    );

    res.status(200).json({
      success: true,
      message: "Member added to group",
      data,
    });
  } catch (error) {
    handleError(res, error, "Failed to add group member");
  }
};

export const updateGroupSettings = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const groupId = String(req.params.groupId || "");
    if (!groupId) {
      throw new Error("groupId is required");
    }

    const { memberAddPolicy } = req.body as {
      memberAddPolicy: "ADMIN_ONLY" | "ANY_MEMBER";
    };
    const data = await CommunityService.updateGroupSettings(
      getUserId(req),
      groupId,
      {
        memberAddPolicy,
      },
    );

    res.status(200).json({
      success: true,
      message: "Group settings updated",
      data,
    });
  } catch (error) {
    handleError(res, error, "Failed to update group settings");
  }
};

export const reportCommunityContent = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { targetType, targetId, reason, details } = req.body as {
      targetType: "MESSAGE" | "GROUP";
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
    handleError(res, error, "Failed to submit report");
  }
};

export const listMyCommunityReports = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));
    const data = await CommunityService.listMyReports(
      getUserId(req),
      page,
      limit,
    );

    res.status(200).json({
      success: true,
      message: "Reports fetched",
      data: data.items,
      pagination: data.pagination,
    });
  } catch (error) {
    handleError(res, error, "Failed to fetch reports");
  }
};
