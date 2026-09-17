import { Request, Response } from "express";
import { asyncHandler } from "../../middleware/asyncHandler";
import { AppError } from "../../utils/AppError";
import { SeasonPlanService } from "../services/SeasonPlanService";

/**
 * A child's tournament plan.
 *
 * Thin by design: ownership, validation and the rule that an entry's name and
 * date come from the calendar rather than the request all live in
 * `SeasonPlanService`, where they can be read together and tested without HTTP.
 */

const requireUser = (req: Request): string => {
  if (!req.user) throw new AppError("Unauthorized", 401);
  return req.user.id;
};

const asOptionalString = (value: unknown): string | undefined =>
  typeof value === "string" ? value : undefined;

/** GET /api/season-plans/:dependentId */
export const getSeasonPlan = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const plan = await SeasonPlanService.get(requireUser(req), String(req.params.dependentId ?? ""));
  res.json({ success: true, data: plan });
});

/** POST /api/season-plans/:dependentId/entries  { editionSlug, note? } */
export const addSeasonPlanEntry = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const plan = await SeasonPlanService.addEntry({
      userId: requireUser(req),
      dependentId: String(req.params.dependentId ?? ""),
      editionSlug: String(req.body?.editionSlug ?? ""),
      note: asOptionalString(req.body?.note),
    });
    res.status(201).json({ success: true, data: plan });
  }
);

/** PATCH /api/season-plans/:dependentId/entries/:editionSlug  { status?, note? } */
export const updateSeasonPlanEntry = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const plan = await SeasonPlanService.updateEntry({
      userId: requireUser(req),
      dependentId: String(req.params.dependentId ?? ""),
      editionSlug: String(req.params.editionSlug ?? ""),
      status: asOptionalString(req.body?.status),
      note: asOptionalString(req.body?.note),
    });
    res.json({ success: true, data: plan });
  }
);

/** DELETE /api/season-plans/:dependentId/entries/:editionSlug */
export const removeSeasonPlanEntry = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const plan = await SeasonPlanService.removeEntry(
      requireUser(req),
      String(req.params.dependentId ?? ""),
      String(req.params.editionSlug ?? "")
    );
    res.json({ success: true, data: plan });
  }
);
