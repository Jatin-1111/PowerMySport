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
import { searchExperienceSubjects, getExperienceSubjectSummary } from "../controllers/experienceController"; // prettier-ignore
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

/**
 * `/api/community/experiences` — the canonical mount for what used to be the
 * blog. Reuses blogController's handlers as-is: the model, service and wire
 * shape underneath are already Experience (see BlogService.ts, migration 39),
 * so there is nothing to change here beyond the mount path and the two
 * genuinely new endpoints (subject search + summary).
 *
 * `/api/community/blog` (blogRoutes.ts) stays mounted on the same handlers as
 * a deprecated alias for the community app and any cached clients, until
 * phase 5 moves the frontend over and it is removed.
 */

const router = Router();

// ─── Profile (specific paths before /:blogId dynamic segments) ────────────────
router.get("/profile", authMiddleware, getMyBlogProfile);
router.patch(
  "/profile",
  authMiddleware,
  validateRequest(blogProfileUpdateSchema),
  updateBlogProfile
);
router.get("/authors/:identifier", optionalAuthMiddleware, cacheControl(20), getBlogAuthorProfile);

// ─── Subjects (new) ─────────────────────────────────────────────────────────
// Public — the composer's autocomplete and an entity page's summary band are
// both read surfaces open to anonymous visitors, same as the posts feed.
router.get("/subjects/search", optionalAuthMiddleware, cacheControl(30), searchExperienceSubjects);
router.get("/subjects/summary", optionalAuthMiddleware, cacheControl(30), getExperienceSubjectSummary); // prettier-ignore

// ─── Likes ────────────────────────────────────────────────────────────────────
router.post("/likes", authMiddleware, validateRequest(blogLikeSchema), toggleBlogLike);

// ─── Image upload (rate-limited per user) ─────────────────────────────────────
const experienceUploadRateLimit = rateLimit({
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
  experienceUploadRateLimit,
  validateRequest(blogUploadUrlSchema),
  getBlogImageUploadUrl
);

// ─── Comments ─────────────────────────────────────────────────────────────────
router.get("/posts/:blogId/comments", optionalAuthMiddleware, cacheControl(15), listBlogComments);
router.post(
  "/posts/:blogId/comments",
  authMiddleware,
  validateRequest(blogCommentSchema),
  createBlogComment
);
router.delete("/comments/:commentId", authMiddleware, deleteBlogComment);

// ─── Experiences ────────────────────────────────────────────────────────────────
router.get("/posts", optionalAuthMiddleware, cacheControl(20), listBlogs);
router.get("/posts/:blogId", optionalAuthMiddleware, cacheControl(20), getBlog);
router.post("/posts", authMiddleware, validateRequest(blogCreateSchema), createBlog);
router.patch("/posts/:blogId", authMiddleware, validateRequest(blogUpdateSchema), updateBlog);
router.delete("/posts/:blogId", authMiddleware, deleteBlog);

export default router;
