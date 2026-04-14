import { Request, Response } from "express";
import { CommunityService } from "../services/CommunityService";
import { emitCommunityQnaEvent } from "../services/CommunityRealtimeService";

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
      message: "Community users fetched",
      data,
    });
  } catch (error) {
    handleError(res, error, "Failed to search players");
  }
};

export const getPlayerProfile = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const targetUserId = String(req.params.userId || "");
    if (!targetUserId) {
      throw new Error("userId is required");
    }

    const data = await CommunityService.getPlayerProfile(
      getUserId(req),
      targetUserId,
    );

    res.status(200).json({
      success: true,
      message: "Community player profile fetched",
      data,
    });
  } catch (error) {
    handleError(res, error, "Failed to fetch player profile");
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

export const editMessage = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const messageId = String(req.params.messageId || "");
    if (!messageId) {
      throw new Error("messageId is required");
    }

    const { content } = req.body as { content: string };
    const data = await CommunityService.editMessage(
      getUserId(req),
      messageId,
      content,
    );

    res.status(200).json({
      success: true,
      message: "Message updated",
      data,
    });
  } catch (error) {
    handleError(res, error, "Failed to update message");
  }
};

export const deleteMessage = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const messageId = String(req.params.messageId || "");
    if (!messageId) {
      throw new Error("messageId is required");
    }

    const data = await CommunityService.deleteMessage(
      getUserId(req),
      messageId,
    );

    res.status(200).json({
      success: true,
      message: "Message deleted",
      data,
    });
  } catch (error) {
    handleError(res, error, "Failed to delete message");
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
    const { name, description, sport, city, audience } = req.body as {
      name: string;
      description?: string;
      sport?: string;
      city?: string;
      audience?: "ALL" | "PLAYERS_ONLY" | "COACHES_ONLY";
    };

    const payload: {
      name: string;
      description?: string;
      sport?: string;
      city?: string;
      audience?: "ALL" | "PLAYERS_ONLY" | "COACHES_ONLY";
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
    if (
      audience === "ALL" ||
      audience === "PLAYERS_ONLY" ||
      audience === "COACHES_ONLY"
    ) {
      payload.audience = audience;
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

export const getGroupMembers = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const groupId = req.params.groupId as string;
    const data = await CommunityService.getGroupMembers(
      getUserId(req),
      groupId,
    );
    res.status(200).json({
      success: true,
      message: "Group members fetched",
      data,
    });
  } catch (error) {
    handleError(res, error, "Failed to fetch group members");
  }
};

export const joinGroupByCode = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const inviteCode = req.params.inviteCode as string;
    const data = await CommunityService.joinGroupByCode(
      getUserId(req),
      inviteCode,
    );
    res.status(200).json({
      success: true,
      message: "Joined group successfully",
      data,
    });
  } catch (error) {
    handleError(res, error, "Failed to join group");
  }
};

export const getGroupInviteCode = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const groupId = req.params.groupId as string;
    const data = await CommunityService.getGroupInviteCode(
      getUserId(req),
      groupId,
    );
    res.status(200).json({
      success: true,
      message: "Invite code fetched",
      data,
    });
  } catch (error) {
    handleError(res, error, "Failed to fetch invite code");
  }
};

export const getMyCommunityReputation = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const data = await CommunityService.getMyReputation(getUserId(req));
    res.status(200).json({
      success: true,
      message: "Reputation fetched",
      data,
    });
  } catch (error) {
    handleError(res, error, "Failed to fetch reputation");
  }
};

export const listCommunityPosts = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 20));
    const sortRaw =
      typeof req.query.sort === "string" ? req.query.sort.toUpperCase() : "NEW";
    const sort =
      sortRaw === "TOP" || sortRaw === "UNANSWERED" ? sortRaw : "NEW";
    const q = typeof req.query.q === "string" ? req.query.q : "";
    const tag = typeof req.query.tag === "string" ? req.query.tag : "";
    const sport = typeof req.query.sport === "string" ? req.query.sport : "";
    const city = typeof req.query.city === "string" ? req.query.city : "";
    const mine =
      typeof req.query.mine === "string"
        ? req.query.mine.toLowerCase() === "true"
        : false;

    const data = await CommunityService.listPosts(getUserId(req), page, limit, {
      sort,
      q,
      tag,
      sport,
      city,
      mine,
    });

    res.status(200).json({
      success: true,
      message: "Posts fetched",
      data,
    });
  } catch (error) {
    handleError(res, error, "Failed to fetch posts");
  }
};

export const getCommunityPostDetails = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const postId = String(req.params.postId || "");
    if (!postId) {
      throw new Error("postId is required");
    }
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 30));

    const data = await CommunityService.getPostDetails(
      getUserId(req),
      postId,
      page,
      limit,
    );
    res.status(200).json({
      success: true,
      message: "Post details fetched",
      data,
    });
  } catch (error) {
    handleError(res, error, "Failed to fetch post details");
  }
};

export const createCommunityPost = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { title, body, tags, sport, city } = req.body as {
      title: string;
      body: string;
      tags?: string[];
      sport?: string;
      city?: string;
    };

    const payload: {
      title: string;
      body: string;
      tags?: string[];
      sport?: string;
      city?: string;
    } = {
      title,
      body,
    };
    if (Array.isArray(tags)) {
      payload.tags = tags;
    }
    if (typeof sport === "string") {
      payload.sport = sport;
    }
    if (typeof city === "string") {
      payload.city = city;
    }

    const data = await CommunityService.createPost(getUserId(req), payload);

    emitCommunityQnaEvent("community:qnaPostCreated", {
      postId: data.id,
      authorId: getUserId(req),
    });

    res.status(201).json({
      success: true,
      message: "Post created",
      data,
    });
  } catch (error) {
    handleError(res, error, "Failed to create post");
  }
};

export const updateCommunityPost = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const postId = String(req.params.postId || "");
    if (!postId) {
      throw new Error("postId is required");
    }

    const { title, body, tags, status, sport, city } = req.body as {
      title?: string;
      body?: string;
      tags?: string[];
      status?: "OPEN" | "CLOSED";
      sport?: string;
      city?: string;
    };

    const payload: {
      title?: string;
      body?: string;
      tags?: string[];
      status?: "OPEN" | "CLOSED";
      sport?: string;
      city?: string;
    } = {};

    if (typeof title === "string") {
      payload.title = title;
    }
    if (typeof body === "string") {
      payload.body = body;
    }
    if (Array.isArray(tags)) {
      payload.tags = tags;
    }
    if (status === "OPEN" || status === "CLOSED") {
      payload.status = status;
    }
    if (typeof sport === "string") {
      payload.sport = sport;
    }
    if (typeof city === "string") {
      payload.city = city;
    }

    const data = await CommunityService.updatePost(
      getUserId(req),
      postId,
      payload,
    );

    emitCommunityQnaEvent("community:qnaPostUpdated", {
      postId: data.id,
      authorId: getUserId(req),
      status: data.status,
    });

    res.status(200).json({
      success: true,
      message: "Post updated",
      data,
    });
  } catch (error) {
    handleError(res, error, "Failed to update post");
  }
};

export const deleteCommunityPost = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const postId = String(req.params.postId || "");
    if (!postId) {
      throw new Error("postId is required");
    }

    const data = await CommunityService.deletePost(getUserId(req), postId);

    emitCommunityQnaEvent("community:qnaPostDeleted", {
      postId,
      authorId: getUserId(req),
    });

    res.status(200).json({
      success: true,
      message: "Post deleted",
      data,
    });
  } catch (error) {
    handleError(res, error, "Failed to delete post");
  }
};

export const createCommunityAnswer = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const postId = String(req.params.postId || "");
    if (!postId) {
      throw new Error("postId is required");
    }

    const { content } = req.body as { content: string };
    const data = await CommunityService.createAnswer(
      getUserId(req),
      postId,
      content,
    );

    emitCommunityQnaEvent("community:qnaAnswerCreated", {
      postId: data.postId,
      answerId: data.id,
      authorId: getUserId(req),
    });

    res.status(201).json({
      success: true,
      message: "Answer created",
      data,
    });
  } catch (error) {
    handleError(res, error, "Failed to create answer");
  }
};

export const updateCommunityAnswer = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const answerId = String(req.params.answerId || "");
    if (!answerId) {
      throw new Error("answerId is required");
    }

    const { content } = req.body as { content: string };
    const data = await CommunityService.updateAnswer(
      getUserId(req),
      answerId,
      content,
    );

    emitCommunityQnaEvent("community:qnaAnswerUpdated", {
      postId: data.postId,
      answerId: data.id,
      authorId: getUserId(req),
    });

    res.status(200).json({
      success: true,
      message: "Answer updated",
      data,
    });
  } catch (error) {
    handleError(res, error, "Failed to update answer");
  }
};

export const deleteCommunityAnswer = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const answerId = String(req.params.answerId || "");
    if (!answerId) {
      throw new Error("answerId is required");
    }

    const data = await CommunityService.deleteAnswer(getUserId(req), answerId);

    emitCommunityQnaEvent("community:qnaAnswerDeleted", {
      postId: data.postId,
      answerId,
      authorId: getUserId(req),
    });

    res.status(200).json({
      success: true,
      message: "Answer deleted",
      data,
    });
  } catch (error) {
    handleError(res, error, "Failed to delete answer");
  }
};

export const voteCommunityTarget = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { targetType, targetId, value } = req.body as {
      targetType: "POST" | "ANSWER";
      targetId: string;
      value: 1 | -1;
    };

    const data = await CommunityService.vote(getUserId(req), {
      targetType,
      targetId,
      value,
    });

    emitCommunityQnaEvent("community:qnaVoteUpdated", {
      targetType: data.targetType,
      targetId: data.targetId,
      postId: data.postId || null,
      voteScore: data.voteScore,
      upvoteCount: data.upvoteCount,
      downvoteCount: data.downvoteCount,
    });

    res.status(200).json({
      success: true,
      message: "Vote updated",
      data,
    });
  } catch (error) {
    handleError(res, error, "Failed to update vote");
  }
};
