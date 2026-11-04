import { Router, Request, Response, NextFunction } from "express";
import rateLimit from "express-rate-limit";
import {
  createBlog,
  createBlogComment,
  deleteBlog,
  deleteBlogComment,
  getBlog,
  getBlogAuthorProfile,
  getBlogImageUploadUrl,
  getMyBlogProfile,
  listBlogComments,
  listBlogs,
  toggleBlogLike,
  updateBlog,
  updateBlogProfile,
} from "../controllers/blogController";
import { authMiddleware, optionalAuthMiddleware } from "../../middleware/auth";
import { cacheControl } from "../../middleware/cacheControl";
import {
  blogCommentSchema,
  blogCreateSchema,
  blogLikeSchema,
  blogProfileUpdateSchema,
  blogUpdateSchema,
  blogUploadUrlSchema,
} from "../../middleware/schemas";
import { validateRequest } from "../../middleware/validation";

const router = Router();

// ─── Profile (specific paths before /:blogId dynamic segments) ────────────────
router.get("/profile", authMiddleware, getMyBlogProfile);
router.patch(
  "/profile",
  authMiddleware,
  validateRequest(blogProfileUpdateSchema),
  updateBlogProfile
);
// Public — writer profile pages are shareable like the posts themselves.
// private: isMe varies per viewer.
router.get("/authors/:identifier", optionalAuthMiddleware, cacheControl(20), getBlogAuthorProfile);

// ─── Likes ────────────────────────────────────────────────────────────────────
router.post("/likes", authMiddleware, validateRequest(blogLikeSchema), toggleBlogLike);

// ─── Image upload (rate-limited per user) ─────────────────────────────────────
const blogUploadRateLimit = rateLimit({
  windowMs: 60 * 1000,
  max: 15,
  keyGenerator: (req: Request) => req.user?.id || "anonymous",
  handler: (_req: Request, res: Response, _next: NextFunction) => {
    res.status(429).json({
      success: false,
      message: "Too many upload requests. Please wait a moment before uploading another image.",
    });
  },
  standardHeaders: true,
  legacyHeaders: false,
});

router.post(
  "/upload-url",
  authMiddleware,
  blogUploadRateLimit,
  validateRequest(blogUploadUrlSchema),
  getBlogImageUploadUrl
);

// ─── Comments ─────────────────────────────────────────────────────────────────
// Reading comments is public (same as the post itself, for shared links);
// posting/deleting still requires auth. private: likedByMe/isMine vary per
// viewer.
router.get("/posts/:blogId/comments", optionalAuthMiddleware, cacheControl(15), listBlogComments);
router.post(
  "/posts/:blogId/comments",
  authMiddleware,
  validateRequest(blogCommentSchema),
  createBlogComment
);
router.delete("/comments/:commentId", authMiddleware, deleteBlogComment);

// ─── Blogs ────────────────────────────────────────────────────────────────────
// Public — feeds the blog landing page and the sitemap generator. private:
// likedByMe varies per viewer.
router.get("/posts", optionalAuthMiddleware, cacheControl(20), listBlogs);
// Public — this is the shareable link a reader can open without logging in.
// private: likedByMe/isMine vary per viewer.
router.get("/posts/:blogId", optionalAuthMiddleware, cacheControl(20), getBlog);
router.post("/posts", authMiddleware, validateRequest(blogCreateSchema), createBlog);
router.patch("/posts/:blogId", authMiddleware, validateRequest(blogUpdateSchema), updateBlog);
router.delete("/posts/:blogId", authMiddleware, deleteBlog);

export default router;
