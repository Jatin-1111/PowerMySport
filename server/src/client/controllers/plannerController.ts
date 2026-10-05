import { Request, Response } from "express";
import { asyncHandler } from "../../middleware/asyncHandler";
import { AppError } from "../../utils/AppError";
import { PlannerService } from "../services/PlannerService";
import { RecommendationService } from "../services/plannerRecommendations/RecommendationService";

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

/**
 * GET /api/planner/:dependentId/recommendations
 *
 * The saved suggestions and whether they still match the child's situation.
 * Never calls the model and never spends the daily allowance.
 */
export const getRecommendations = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    if (!req.user) throw new AppError("Unauthorized", 401);
    const data = await RecommendationService.get(req.user.id, String(req.params.dependentId ?? ""));
    res.json({ success: true, data });
  }
);

/**
 * POST /api/planner/:dependentId/recommendations  { force?: boolean }
 *
 * Make suggestions, or reuse the saved ones when nothing has changed. `force`
 * asks for a fresh answer and spends one of the day's allowance.
 */
export const createRecommendations = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    if (!req.user) throw new AppError("Unauthorized", 401);
    const data = await RecommendationService.generate(
      req.user.id,
      String(req.params.dependentId ?? ""),
      { force: req.body?.force === true }
    );
    res.json({ success: true, data });
  }
);
