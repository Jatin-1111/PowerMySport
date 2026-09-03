import { Request, Response } from "express";
import { CommunityService } from "../../services/CommunityService";
import { emitCommunityGroupEvent } from "../../services/CommunityRealtimeService";
import { s3Service } from "../../../shared/services/S3Service";
import { getUserId, handleError } from "./shared";

const getConversationId = (req: Request): string => {
  const conversationId = req.params.conversationId;
  if (typeof conversationId !== "string" || !conversationId) {
    throw new Error("conversationId is required");
  }

  return conversationId;
};

export const startConversation = async (req: Request, res: Response): Promise<void> => {
  try {
    const { targetUserId } = req.body as { targetUserId: string };
    const data = await CommunityService.startConversation(getUserId(req), targetUserId);
    res.status(200).json({
      success: true,
      message: "Conversation ready",
      data,
    });
  } catch (error) {
    handleError(res, error, "Failed to start conversation");
  }
};

export const acceptConversationRequest = async (req: Request, res: Response): Promise<void> => {
  try {
    const data = await CommunityService.acceptConversationRequest(
      getUserId(req),
      getConversationId(req)
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

export const rejectConversationRequest = async (req: Request, res: Response): Promise<void> => {
  try {
    const data = await CommunityService.rejectConversationRequest(
      getUserId(req),
      getConversationId(req)
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

export const listConversations = async (req: Request, res: Response): Promise<void> => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 25));
    const mode = typeof req.query.mode === "string" ? req.query.mode.toUpperCase() : "ALL";
    const type = typeof req.query.type === "string" ? req.query.type.toUpperCase() : "ALL";
    const search = typeof req.query.q === "string" ? req.query.q : "";
    const data = await CommunityService.listConversations(getUserId(req), page, limit, {
      mode: mode === "UNREAD" || mode === "REQUESTS" ? mode : "ALL",
      type: type === "CONTACTS" || type === "GROUPS" ? type : "ALL",
      search,
    });
    res.status(200).json({
      success: true,
      message: "Conversations fetched",
      data,
    });
  } catch (error) {
    handleError(res, error, "Failed to fetch conversations");
  }
};

export const getUnreadConversationCount = async (req: Request, res: Response): Promise<void> => {
  try {
    const count = await CommunityService.getUnreadConversationCount(getUserId(req));
    res.status(200).json({
      success: true,
      message: "Unread conversation count fetched",
      data: { count },
    });
  } catch (error) {
    handleError(res, error, "Failed to fetch unread conversation count");
  }
};

export const getConversationMessages = async (req: Request, res: Response): Promise<void> => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 30));
    const data = await CommunityService.getMessages(
      getUserId(req),
      getConversationId(req),
      page,
      limit
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

export const sendMessage = async (req: Request, res: Response): Promise<void> => {
  try {
    const { conversationId, content, replyToId, type, metadata } = req.body as {
      conversationId: string;
      content: string;
      replyToId?: string;
      type?: "TEXT" | "IMAGE" | "FILE" | "VOICE";
      metadata?: Record<string, unknown>;
    };

    const data = await CommunityService.sendMessage(getUserId(req), conversationId, content, {
      ...(type ? { type } : {}),
      ...(metadata ? { metadata } : {}),
      ...(replyToId ? { replyToId } : {}),
    });

    res.status(201).json({
      success: true,
      message: "Message sent",
      data,
    });
  } catch (error) {
    handleError(res, error, "Failed to send message");
  }
};

export const editMessage = async (req: Request, res: Response): Promise<void> => {
  try {
    const messageId = String(req.params.messageId || "");
    if (!messageId) {
      throw new Error("messageId is required");
    }

    const { content } = req.body as { content: string };
    const data = await CommunityService.editMessage(getUserId(req), messageId, content);

    res.status(200).json({
      success: true,
      message: "Message updated",
      data,
    });
  } catch (error) {
    handleError(res, error, "Failed to update message");
  }
};

export const deleteMessage = async (req: Request, res: Response): Promise<void> => {
  try {
    const messageId = String(req.params.messageId || "");
    if (!messageId) {
      throw new Error("messageId is required");
    }

    const data = await CommunityService.deleteMessage(getUserId(req), messageId);

    res.status(200).json({
      success: true,
      message: "Message deleted",
      data,
    });
  } catch (error) {
    handleError(res, error, "Failed to delete message");
  }
};

export const pinGroupMessage = async (req: Request, res: Response): Promise<void> => {
  try {
    const messageId = String(req.params.messageId || "");
    const data = await CommunityService.pinGroupMessage(getUserId(req), messageId);

    emitCommunityGroupEvent(data.groupId, "community:groupMembersUpdated", {
      groupId: data.groupId,
      pinnedMessageId: data.pinnedMessageId,
    });

    res.status(200).json({
      success: true,
      message: data.pinned ? "Message pinned" : "Message unpinned",
      data,
    });
  } catch (error) {
    handleError(res, error, "Failed to pin message");
  }
};

/**
 * POST /community/chat/attachment-url
 * Presigned S3 POST for a document or a voice note.
 *
 * The allowlist and the size ceiling are enforced in the S3 policy itself, so
 * a client that posts straight at the bucket is still bound by them; the
 * participant check here is what stops someone uploading into a conversation
 * they are not part of.
 */
export const getChatAttachmentUploadUrl = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = getUserId(req);
    const { conversationId, contentType, kind } = req.body as {
      conversationId: string;
      contentType: string;
      kind: "FILE" | "VOICE";
    };

    await CommunityService.assertConversationAccess(userId, conversationId);

    const { url, fields, key } = await s3Service.generateChatAttachmentPresignedPost(
      conversationId,
      contentType,
      kind
    );

    res.status(200).json({
      success: true,
      message: "Presigned upload URL generated",
      data: { url, fields, key },
    });
  } catch (error) {
    handleError(res, error, "Failed to generate upload URL");
  }
};

/**
 * POST /community/chat/upload-url
 * Returns a presigned S3 POST URL for uploading a chat image.
 * Security:
 *  - Caller must be a participant in the target conversation
 *  - Content-type whitelisted server-side (jpeg/png/webp only)
 *  - 5MB limit enforced in S3 policy (via createPresignedPost conditions)
 *  - Rate-limited at the route level (5 requests / 60 s)
 */
export const getChatImageUploadUrl = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = getUserId(req);
    const { conversationId, contentType } = req.body as {
      conversationId: string;
      contentType: "image/jpeg" | "image/png" | "image/webp";
    };

    // Verify the caller is a participant in the conversation
    await CommunityService.assertConversationAccess(userId, conversationId);

    const { url, fields, key } = await s3Service.generateChatImagePresignedPost(
      conversationId,
      contentType
    );

    res.status(200).json({
      success: true,
      message: "Presigned upload URL generated",
      data: { url, fields, key },
    });
  } catch (error) {
    handleError(res, error, "Failed to generate upload URL");
  }
};
