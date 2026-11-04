import { Router, Request, Response } from "express";
import { asyncHandler } from "../../middleware/asyncHandler";
import { authMiddleware, adminMiddleware } from "../../middleware/auth";
import { OVERDUE_AFTER_DAYS, listReviewQueue } from "../../shared/services/reviewQueue";

/**
 * Everyone waiting on an admin, across all four provider types.
 * Mounted at /api/admin/review-queue. Read-only; decisions are made on the
 * existing approve and reject routes.
 */
const router = Router();

router.get(
  "/",
  authMiddleware,
  adminMiddleware,
  asyncHandler(async (_req: Request, res: Response) => {
    const data = await listReviewQueue();
    res.status(200).json({ success: true, data, overdueAfterDays: OVERDUE_AFTER_DAYS });
  })
);

export default router;
