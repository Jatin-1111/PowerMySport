import { Request, Response } from "express";
import prisma from "../../lib/prisma";

export const getPathwayProfile = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: "Unauthorized" });
      return;
    }

    let profile = await prisma.userPathwayProfile.findUnique({
      where: { userId: req.user.id },
    });

    if (!profile) {
      profile = await prisma.userPathwayProfile.create({
        data: { userId: req.user.id },
      });
    }

    res.status(200).json({
      success: true,
      data: profile,
    });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: "Failed to fetch pathway profile" });
  }
};

export const updatePathwayProfile = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: "Unauthorized" });
      return;
    }

    const { progress, savedItems, applications, reminders } = req.body;

    const updateData: any = {};
    if (progress !== undefined) updateData.progress = progress;
    if (savedItems !== undefined) updateData.savedItems = savedItems;
    if (applications !== undefined) updateData.applications = applications;
    if (reminders !== undefined) updateData.reminders = reminders;

    const profile = await prisma.userPathwayProfile.upsert({
      where: { userId: req.user.id },
      create: { userId: req.user.id, ...updateData },
      update: updateData,
    });

    res.status(200).json({
      success: true,
      data: profile,
    });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: "Failed to update pathway profile" });
  }
};
