import { Request, Response } from "express";
import prisma from "../../lib/prisma";

// Accepts a dependentId from the query/body only if it's a real, non-empty
// string — anything else (missing, empty string, wrong type) falls back to the
// null "no specific child" bucket rather than erroring.
//
// NOTE: the Mongo original validated this with `mongoose.isValidObjectId`.
// server-postgres ids are cuid strings (no ObjectId shape to validate), so we
// only guard against empty/garbage input here. See TODO(prisma) in report.
const parseDependentId = (raw: unknown): string | null =>
  typeof raw === "string" && raw.trim() !== "" ? raw.trim() : null;

export const getRoadmapProfile = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: "Unauthorized" });
      return;
    }

    const dependentId = parseDependentId(req.query.dependentId);

    // findFirst (not findUnique) so the `dependentId: null` bucket resolves via
    // SQL `IS NULL` — the compound unique cannot be used as a lookup key when
    // dependentId is null (Postgres treats NULLs as distinct).
    let profile = await prisma.userPathwayProfile.findFirst({
      where: { userId: req.user.id, dependentId },
    });

    if (!profile) {
      profile = await prisma.userPathwayProfile.create({
        data: { userId: req.user.id, dependentId },
      });
    }

    res.status(200).json({
      success: true,
      data: profile,
    });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: "Failed to fetch roadmap profile" });
  }
};

export const updateRoadmapProfile = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: "Unauthorized" });
      return;
    }

    const dependentId = parseDependentId(req.body.dependentId);
    const { progress, savedItems, applications, reminders } = req.body;

    const updateData: any = {};
    if (progress !== undefined) updateData.progress = progress;
    if (savedItems !== undefined) updateData.savedItems = savedItems;
    if (applications !== undefined) updateData.applications = applications;
    if (reminders !== undefined) updateData.reminders = reminders;

    const profile = await prisma.userPathwayProfile.upsert({
      where: {
        userId_dependentId: { userId: req.user.id, dependentId },
      },
      create: { userId: req.user.id, dependentId, ...updateData },
      update: updateData,
    });

    res.status(200).json({
      success: true,
      data: profile,
    });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: "Failed to update roadmap profile" });
  }
};
