import { Request, Response } from "express";
import { asyncHandler } from "../../middleware/asyncHandler";
import { AppError } from "../../utils/AppError";
import { PlannerService } from "../services/PlannerService";

/**
 * GET /api/planner/:dependentId
 *
 * The child's planner in one response: where they stand, which events they can
 * and cannot enter, and the plan they have already made. Thin on purpose, the
 * rules and the ownership check live in `PlannerService`.
 */
export const getPlanner = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  if (!req.user) throw new AppError("Unauthorized", 401);
  const overview = await PlannerService.forDependent(
    req.user.id,
    String(req.params.dependentId ?? "")
  );
  res.json({ success: true, data: overview });
});
