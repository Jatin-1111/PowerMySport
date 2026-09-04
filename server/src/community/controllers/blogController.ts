import { Request, Response } from "express";
import { BlogService } from "../services/BlogService";
import {
  emitCommunityBlogEvent,
  blogRoom,
  BLOG_FEED_ROOM,
} from "../services/CommunityRealtimeService";
import { asyncHandler } from "../../middleware/asyncHandler";
import { AppError } from "../../utils/AppError";

const getUserId = (req: Request): string => {
  if (!req.user?.id) {
    throw new AppError("Unauthorized", 401);
  }
  return req.user.id;
};

// Used on the guest-readable routes (single post + its comments) — a shared
// blog link must render for anonymous visitors, so these can't require a user.
const getOptionalUserId = (req: Request): string | undefined => req.user?.id;

const getStatusCode = (message: string): number => {
  if (message === "Unauthorized") return 401;
  if (message === "Access denied") return 403;
  if (message.includes("not found")) return 404;
  if (message.includes("already taken")) return 409;
  if (
    message.includes("Invalid") ||
    message.includes("Cast to ObjectId failed") ||
    message.includes("validation failed")
  ) {
    return 400;
  }
  if (message.includes("cannot") || message.includes("required") || message.includes("only for")) {
    return 400;
  }
  return 500;
};

/**
 * Classifies a caught error's message into the status code this domain's
 * handlers have always used (see getStatusCode), then wraps it as an
 * AppError so a single `throw toAppError(error, fallback)` in each handler's
 * catch replaces what used to be a manual `res.status(...).json(...)` call.
 */
const toAppError = (error: unknown, fallback: string): AppError => {
  if (error instanceof AppError) return error;
  const message = error instanceof Error ? error.message : fallback;
  return new AppError(message, getStatusCode(message));
};

// ─── Blogs ──────────────────────────────────────────────────────────────────
export const listBlogs = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  try {
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 12;
    const data = await BlogService.listBlogs(getOptionalUserId(req), page, limit, {
      topic: typeof req.query.topic === "string" ? req.query.topic : undefined,
      q: typeof req.query.q === "string" ? req.query.q : undefined,
      mine: req.query.mine === "true" || req.query.mine === "1",
      authorId: typeof req.query.authorId === "string" ? req.query.authorId : undefined,
    });
    res.status(200).json({ success: true, message: "Blogs fetched", data });
  } catch (error) {
    throw toAppError(error, "Failed to fetch blogs");
  }
});

export const getBlog = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  try {
    const data = await BlogService.getBlog(getOptionalUserId(req), String(req.params.blogId || ""));
    res.status(200).json({ success: true, message: "Blog fetched", data });
  } catch (error) {
    throw toAppError(error, "Failed to fetch blog");
  }
});

export const createBlog = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = getUserId(req);
    const data = await BlogService.createBlog(userId, req.body);
    emitCommunityBlogEvent("community:blogCreated", { blogId: data.id, authorId: userId }, [
      BLOG_FEED_ROOM,
    ]);
    res.status(201).json({ success: true, message: "Blog published", data });
  } catch (error) {
    throw toAppError(error, "Failed to publish blog");
  }
});

export const updateBlog = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = getUserId(req);
    const data = await BlogService.updateBlog(userId, String(req.params.blogId || ""), req.body);
    emitCommunityBlogEvent("community:blogUpdated", { blogId: data.id }, [
      BLOG_FEED_ROOM,
      blogRoom(data.id),
    ]);
    res.status(200).json({ success: true, message: "Blog updated", data });
  } catch (error) {
    throw toAppError(error, "Failed to update blog");
  }
});

export const deleteBlog = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = getUserId(req);
    const data = await BlogService.deleteBlog(userId, String(req.params.blogId || ""));
    emitCommunityBlogEvent("community:blogDeleted", { blogId: data.id }, [
      BLOG_FEED_ROOM,
      blogRoom(data.id),
    ]);
    res.status(200).json({ success: true, message: "Blog deleted", data });
  } catch (error) {
    throw toAppError(error, "Failed to delete blog");
  }
});

// ─── Likes ──────────────────────────────────────────────────────────────────
export const toggleBlogLike = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  try {
    const { targetType, targetId } = req.body as {
      targetType: "BLOG" | "COMMENT";
      targetId: string;
    };
    const data = await BlogService.toggleLike(getUserId(req), targetType, targetId);
    emitCommunityBlogEvent(
      "community:blogLiked",
      { targetType, targetId, blogId: data.blogId, likeCount: data.likeCount },
      data.blogId ? [blogRoom(data.blogId)] : []
    );
    res.status(200).json({ success: true, message: "Reaction updated", data });
  } catch (error) {
    throw toAppError(error, "Failed to update reaction");
  }
});

// ─── Comments ───────────────────────────────────────────────────────────────
export const listBlogComments = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  try {
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 30;
    const data = await BlogService.listComments(
      getOptionalUserId(req),
      String(req.params.blogId || ""),
      page,
      limit
    );
    res.status(200).json({ success: true, message: "Comments fetched", data });
  } catch (error) {
    throw toAppError(error, "Failed to fetch comments");
  }
});

export const createBlogComment = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    try {
      const blogId = String(req.params.blogId || "");
      const { content, parentId } = req.body as {
        content: string;
        parentId?: string;
      };
      const data = await BlogService.createComment(getUserId(req), blogId, content, parentId);
      emitCommunityBlogEvent("community:blogCommented", { blogId }, [blogRoom(blogId)]);
      res.status(201).json({ success: true, message: "Comment posted", data });
    } catch (error) {
      throw toAppError(error, "Failed to post comment");
    }
  }
);

export const deleteBlogComment = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    try {
      const data = await BlogService.deleteComment(
        getUserId(req),
        String(req.params.commentId || "")
      );
      res.status(200).json({ success: true, message: "Comment deleted", data });
    } catch (error) {
      throw toAppError(error, "Failed to delete comment");
    }
  }
);

// ─── Profiles ───────────────────────────────────────────────────────────────
export const getMyBlogProfile = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  try {
    const data = await BlogService.getMyBlogProfile(getUserId(req));
    res.status(200).json({ success: true, message: "Profile fetched", data });
  } catch (error) {
    throw toAppError(error, "Failed to fetch profile");
  }
});

export const getBlogAuthorProfile = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    try {
      const data = await BlogService.getBlogAuthorProfile(
        getOptionalUserId(req),
        String(req.params.identifier || "")
      );
      res.status(200).json({ success: true, message: "Profile fetched", data });
    } catch (error) {
      throw toAppError(error, "Failed to fetch profile");
    }
  }
);

export const updateBlogProfile = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    try {
      const data = await BlogService.updateBlogProfile(getUserId(req), req.body);
      res.status(200).json({ success: true, message: "Profile updated", data });
    } catch (error) {
      throw toAppError(error, "Failed to update profile");
    }
  }
);

// ─── Image upload ─────────────────────────────────────────────────────────
export const getBlogImageUploadUrl = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { contentType } = req.body as {
        contentType: "image/jpeg" | "image/png" | "image/webp";
      };
      const data = await BlogService.generateImageUploadUrl(getUserId(req), contentType);
      res.status(200).json({ success: true, message: "Upload URL generated", data });
    } catch (error) {
      throw toAppError(error, "Failed to generate upload URL");
    }
  }
);
