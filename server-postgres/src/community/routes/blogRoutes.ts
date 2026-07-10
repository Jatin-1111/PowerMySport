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
import { authMiddleware } from "../../middleware/auth";
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

router.use(authMiddleware);

// ─── Profile (specific paths before /:blogId dynamic segments) ────────────────
router.get("/profile", getMyBlogProfile);
router.patch(
  "/profile",
  validateRequest(blogProfileUpdateSchema),
  updateBlogProfile,
);
router.get("/authors/:identifier", getBlogAuthorProfile);

// ─── Likes ────────────────────────────────────────────────────────────────────
router.post("/likes", validateRequest(blogLikeSchema), toggleBlogLike);

// ─── Image upload (rate-limited per user) ─────────────────────────────────────
const blogUploadRateLimit = rateLimit({
  windowMs: 60 * 1000,
  max: 15,
  keyGenerator: (req: Request) => req.user?.id || "anonymous",
  handler: (_req: Request, res: Response, _next: NextFunction) => {
    res.status(429).json({
      success: false,
      message:
        "Too many upload requests. Please wait a moment before uploading another image.",
    });
  },
  standardHeaders: true,
  legacyHeaders: false,
});

router.post(
  "/upload-url",
  blogUploadRateLimit,
  validateRequest(blogUploadUrlSchema),
  getBlogImageUploadUrl,
);

// ─── Comments ─────────────────────────────────────────────────────────────────
router.get("/posts/:blogId/comments", listBlogComments);
router.post(
  "/posts/:blogId/comments",
  validateRequest(blogCommentSchema),
  createBlogComment,
);
router.delete("/comments/:commentId", deleteBlogComment);

// ─── Blogs ────────────────────────────────────────────────────────────────────
router.get("/posts", listBlogs);
router.get("/posts/:blogId", getBlog);
router.post("/posts", validateRequest(blogCreateSchema), createBlog);
router.patch("/posts/:blogId", validateRequest(blogUpdateSchema), updateBlog);
router.delete("/posts/:blogId", deleteBlog);

export default router;
