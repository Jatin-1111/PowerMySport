import { Request, Response } from "express";

import { asyncHandler } from "../../middleware/asyncHandler";
import { AppError } from "../../utils/AppError";
import { Opportunity } from "../models/Opportunity";
import { MAX_FOLLOWS_PER_USER, OpportunityFollow } from "../models/OpportunityFollow";

// ─── A parent following an entry ────────────────────────────────────────────
//
// Authenticated and scoped to the caller: nobody reads or changes anyone else's
// follows. See opportunityAlerts.ts for what following leads to.

const slugOf = (req: Request): string =>
  typeof req.params.slug === "string" ? req.params.slug.trim().toLowerCase() : "";

/** GET /api/opportunity-follows — the slugs this parent follows. */
export const listFollows = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const follows = await OpportunityFollow.find({ userId: req.user!.id }).select("slug -_id").lean();
  res.json({ success: true, data: { slugs: follows.map((follow) => follow.slug) } });
});

/** PUT /api/opportunity-follows/:slug — follow a published entry. Safe to repeat. */
export const followOpportunity = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const userId = req.user!.id;
    const slug = slugOf(req);
    if (!slug) throw new AppError("Not found.", 404);

    const exists = await Opportunity.exists({ slug, status: "published" });
    if (!exists) throw new AppError("Not found.", 404);

    const already = await OpportunityFollow.exists({ userId, slug });
    if (!already) {
      const count = await OpportunityFollow.countDocuments({ userId });
      if (count >= MAX_FOLLOWS_PER_USER) {
        throw new AppError(
          `You can follow up to ${MAX_FOLLOWS_PER_USER} entries. Un-follow one to add another.`,
          400
        );
      }
      try {
        await OpportunityFollow.create({ userId, slug });
      } catch (error) {
        // Two taps at once: the unique index made the second one a duplicate, which
        // is the outcome the caller wanted anyway.
        if ((error as { code?: number }).code !== 11000) throw error;
      }
    }

    res.json({ success: true, data: { slug, following: true } });
  }
);

/** DELETE /api/opportunity-follows/:slug — stop following. Safe to repeat. */
export const unfollowOpportunity = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const slug = slugOf(req);
    await OpportunityFollow.deleteOne({ userId: req.user!.id, slug });
    res.json({ success: true, data: { slug, following: false } });
  }
);
