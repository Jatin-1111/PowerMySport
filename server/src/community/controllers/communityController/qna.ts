import { Request, Response } from "express";
import { CommunityService } from "../../services/CommunityService";
import {
  emitCommunityQnaEvent,
  qnaPostRoom,
  QNA_FEED_ROOM,
} from "../../services/CommunityRealtimeService";
import { getOptionalUserId, getUserId, toAppError } from "./shared";
import { asyncHandler } from "../../../middleware/asyncHandler";

export const listCommunityPosts = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    try {
      const page = Math.max(1, Number(req.query.page) || 1);
      const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 20));
      const sortRaw = typeof req.query.sort === "string" ? req.query.sort.toUpperCase() : "NEW";
      const sort =
        sortRaw === "TOP" || sortRaw === "UNANSWERED" || sortRaw === "ANSWERED" ? sortRaw : "NEW";
      const directionRaw =
        typeof req.query.direction === "string" ? req.query.direction.toUpperCase() : "DESC";
      const direction = directionRaw === "ASC" ? "ASC" : "DESC";
      const q = typeof req.query.q === "string" ? req.query.q : "";
      const tag = typeof req.query.tag === "string" ? req.query.tag : "";
      const sport = typeof req.query.sport === "string" ? req.query.sport : "";
      const city = typeof req.query.city === "string" ? req.query.city : "";
      const category = typeof req.query.category === "string" ? req.query.category : "";
      const mine =
        typeof req.query.mine === "string" ? req.query.mine.toLowerCase() === "true" : false;
      const authorId = typeof req.query.authorId === "string" ? req.query.authorId : "";

      const data = await CommunityService.listPosts(getOptionalUserId(req), page, limit, {
        sort,
        direction,
        q,
        tag,
        sport,
        city,
        category,
        mine,
        authorId,
      });

      res.status(200).json({
        success: true,
        message: "Posts fetched",
        data,
      });
    } catch (error) {
      throw toAppError(error, "Failed to fetch posts");
    }
  }
);

export const getCommunityPostDetails = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    try {
      const postId = String(req.params.postId || "");
      if (!postId) {
        throw new Error("postId is required");
      }
      const page = Math.max(1, Number(req.query.page) || 1);
      const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 30));

      const data = await CommunityService.getPostDetails(
        getOptionalUserId(req),
        postId,
        page,
        limit
      );
      res.status(200).json({
        success: true,
        message: "Post details fetched",
        data,
      });
    } catch (error) {
      throw toAppError(error, "Failed to fetch post details");
    }
  }
);

export const createCommunityPost = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { title, body, tags, sport, city, category, isAnonymous } = req.body as {
        title: string;
        body: string;
        tags?: string[];
        sport?: string;
        city?: string;
        category?: string;
        isAnonymous?: boolean;
      };

      const payload: {
        title: string;
        body: string;
        tags?: string[];
        sport?: string;
        city?: string;
        category?: string;
        isAnonymous?: boolean;
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
      if (typeof category === "string") {
        payload.category = category;
      }
      if (isAnonymous === true) {
        payload.isAnonymous = true;
      }

      const data = await CommunityService.createPost(getUserId(req), payload);

      emitCommunityQnaEvent(
        "community:qnaPostCreated",
        { postId: data.id, authorId: getUserId(req) },
        [QNA_FEED_ROOM]
      );

      res.status(201).json({
        success: true,
        message: "Post created",
        data,
      });
    } catch (error) {
      throw toAppError(error, "Failed to create post");
    }
  }
);

export const updateCommunityPost = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
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

      const data = await CommunityService.updatePost(getUserId(req), postId, payload);

      emitCommunityQnaEvent(
        "community:qnaPostUpdated",
        { postId: data.id, authorId: getUserId(req), status: data.status },
        [QNA_FEED_ROOM, qnaPostRoom(data.id)]
      );

      res.status(200).json({
        success: true,
        message: "Post updated",
        data,
      });
    } catch (error) {
      throw toAppError(error, "Failed to update post");
    }
  }
);

export const deleteCommunityPost = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    try {
      const postId = String(req.params.postId || "");
      if (!postId) {
        throw new Error("postId is required");
      }

      const data = await CommunityService.deletePost(getUserId(req), postId);

      emitCommunityQnaEvent("community:qnaPostDeleted", { postId, authorId: getUserId(req) }, [
        QNA_FEED_ROOM,
        qnaPostRoom(postId),
      ]);

      res.status(200).json({
        success: true,
        message: "Post deleted",
        data,
      });
    } catch (error) {
      throw toAppError(error, "Failed to delete post");
    }
  }
);

export const createCommunityAnswer = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    try {
      const postId = String(req.params.postId || "");
      if (!postId) {
        throw new Error("postId is required");
      }

      const { content, isAnonymous } = req.body as {
        content: string;
        isAnonymous?: boolean;
      };
      const data = await CommunityService.createAnswer(
        getUserId(req),
        postId,
        content,
        isAnonymous === true
      );

      emitCommunityQnaEvent(
        "community:qnaAnswerCreated",
        { postId: data.postId, answerId: data.id, authorId: getUserId(req) },
        [QNA_FEED_ROOM, qnaPostRoom(data.postId)]
      );

      res.status(201).json({
        success: true,
        message: "Answer created",
        data,
      });
    } catch (error) {
      throw toAppError(error, "Failed to create answer");
    }
  }
);

export const updateCommunityAnswer = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    try {
      const answerId = String(req.params.answerId || "");
      if (!answerId) {
        throw new Error("answerId is required");
      }

      const { content } = req.body as { content: string };
      const data = await CommunityService.updateAnswer(getUserId(req), answerId, content);

      emitCommunityQnaEvent(
        "community:qnaAnswerUpdated",
        { postId: data.postId, answerId: data.id, authorId: getUserId(req) },
        [qnaPostRoom(data.postId)]
      );

      res.status(200).json({
        success: true,
        message: "Answer updated",
        data,
      });
    } catch (error) {
      throw toAppError(error, "Failed to update answer");
    }
  }
);

export const deleteCommunityAnswer = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    try {
      const answerId = String(req.params.answerId || "");
      if (!answerId) {
        throw new Error("answerId is required");
      }

      const data = await CommunityService.deleteAnswer(getUserId(req), answerId);

      emitCommunityQnaEvent(
        "community:qnaAnswerDeleted",
        { postId: data.postId, answerId, authorId: getUserId(req) },
        [QNA_FEED_ROOM, qnaPostRoom(data.postId)]
      );

      res.status(200).json({
        success: true,
        message: "Answer deleted",
        data,
      });
    } catch (error) {
      throw toAppError(error, "Failed to delete answer");
    }
  }
);

export const createCommunityAnswerComment = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    try {
      const answerId = String(req.params.answerId || "");
      const { content, isAnonymous } = req.body as {
        content: string;
        isAnonymous?: boolean;
      };

      const data = await CommunityService.createAnswerComment(
        getUserId(req),
        answerId,
        content,
        Boolean(isAnonymous)
      );

      // Comment volume is only rendered inside an open thread, so this stays out
      // of the feed room.
      emitCommunityQnaEvent(
        "community:qnaCommentCreated",
        { postId: data.postId, answerId: data.answerId, commentId: data.id },
        [qnaPostRoom(data.postId)]
      );

      res.status(201).json({
        success: true,
        message: "Comment posted",
        data,
      });
    } catch (error) {
      throw toAppError(error, "Failed to post comment");
    }
  }
);

export const deleteCommunityAnswerComment = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    try {
      const commentId = String(req.params.commentId || "");
      const data = await CommunityService.deleteAnswerComment(getUserId(req), commentId);

      emitCommunityQnaEvent(
        "community:qnaCommentDeleted",
        { postId: data.postId, answerId: data.answerId, commentId: data.id },
        [qnaPostRoom(data.postId)]
      );

      res.status(200).json({
        success: true,
        message: "Comment deleted",
        data,
      });
    } catch (error) {
      throw toAppError(error, "Failed to delete comment");
    }
  }
);

export const acceptCommunityAnswer = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    try {
      const postId = String(req.params.postId || "");
      const answerId = String(req.params.answerId || "");

      const data = await CommunityService.acceptAnswer(getUserId(req), postId, answerId);

      emitCommunityQnaEvent(
        "community:qnaAnswerAccepted",
        {
          postId: data.postId,
          answerId: data.answerId,
          acceptedAnswerId: data.acceptedAnswerId,
        },
        [QNA_FEED_ROOM, qnaPostRoom(data.postId)]
      );

      res.status(200).json({
        success: true,
        message: data.accepted ? "Answer accepted" : "Answer unaccepted",
        data,
      });
    } catch (error) {
      throw toAppError(error, "Failed to accept answer");
    }
  }
);

export const voteCommunityTarget = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
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

      emitCommunityQnaEvent(
        "community:qnaVoteUpdated",
        {
          targetType: data.targetType,
          targetId: data.targetId,
          postId: data.postId || null,
          voteScore: data.voteScore,
          upvoteCount: data.upvoteCount,
          downvoteCount: data.downvoteCount,
        },
        data.postId ? [QNA_FEED_ROOM, qnaPostRoom(data.postId)] : [QNA_FEED_ROOM]
      );

      res.status(200).json({
        success: true,
        message: "Vote updated",
        data,
      });
    } catch (error) {
      throw toAppError(error, "Failed to update vote");
    }
  }
);

export const getCommunityPulseStats = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    try {
      const count = await CommunityService.getCommunityPulseStats();
      res.status(200).json({ success: true, count });
    } catch (error) {
      throw toAppError(error, "Failed to get community pulse stats");
    }
  }
);
