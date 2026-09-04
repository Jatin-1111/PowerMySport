import { Request, Response } from "express";
import mongoose from "mongoose";
import { UserPathwayProfile } from "../../shared/models/UserPathwayProfile";
import { asyncHandler } from "../../middleware/asyncHandler";
import { AppError } from "../../utils/AppError";

// Accepts a dependentId from the query/body only if it's a real ObjectId —
// anything else (missing, empty string, garbage) falls back to the null
// "no specific child" bucket rather than erroring.
const parseDependentId = (raw: unknown): string | null =>
  typeof raw === "string" && mongoose.isValidObjectId(raw) ? raw : null;

export const getRoadmapProfile = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    if (!req.user) {
      throw new AppError("Unauthorized", 401);
    }

    const dependentId = parseDependentId(req.query.dependentId);

    let profile = await UserPathwayProfile.findOne({
      userId: req.user.id,
      dependentId,
    }).lean();

    if (!profile) {
      profile = await UserPathwayProfile.create({
        userId: req.user.id,
        dependentId,
      });
    }

    res.status(200).json({
      success: true,
      data: profile,
    });
  }
);

export const updateRoadmapProfile = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    if (!req.user) {
      throw new AppError("Unauthorized", 401);
    }

    const dependentId = parseDependentId(req.body.dependentId);
    const { progress, savedItems, applications, reminders } = req.body;

    const updateData: any = {};
    if (progress !== undefined) updateData.progress = progress;
    if (savedItems !== undefined) updateData.savedItems = savedItems;
    if (applications !== undefined) updateData.applications = applications;
    if (reminders !== undefined) updateData.reminders = reminders;

    const profile = await UserPathwayProfile.findOneAndUpdate(
      { userId: req.user.id, dependentId },
      { $set: updateData },
      { new: true, upsert: true }
    ).lean();

    res.status(200).json({
      success: true,
      data: profile,
    });
  }
);
