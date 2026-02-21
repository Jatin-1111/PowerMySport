import { Request, Response, NextFunction } from "express";
import { Coach } from "../models/Coach";
import { verifyToken } from "../utils/jwt";
import { IUserPayload } from "../types/index";

declare global {
  namespace Express {
    interface Request {
      user?: IUserPayload;
    }
  }
}

export const authMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction,
): void => {
  try {
    const token = req.cookies.token || req.headers.authorization?.split(" ")[1];

    if (!token) {
      res.status(401).json({
        success: false,
        message: "No token provided. Please login first.",
      });
      return;
    }

    const decoded = verifyToken(token);
    req.user = decoded;
    next();
  } catch (error) {
    res.status(401).json({
      success: false,
      message: error instanceof Error ? error.message : "Authentication failed",
    });
  }
};

export const vendorMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction,
): void => {
  if (req.user?.role !== "VENUE_LISTER" && req.user?.role !== "COACH") {
    res.status(403).json({
      success: false,
      message: "Access denied. Venue Lister or Coach role required.",
    });
    return;
  }
  next();
};

export const adminMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction,
): void => {
  if (req.user?.role !== "ADMIN") {
    res.status(403).json({
      success: false,
      message: "Access denied. Admin role required.",
    });
    return;
  }
  next();
};

export const coachVerificationCompletedMiddleware = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    if (req.user?.role !== "COACH" || !req.user.id) {
      next();
      return;
    }

    const coach = await Coach.findOne({ userId: req.user.id }).select(
      "bio sports verificationDocuments verificationStatus isVerified",
    );

    if (!coach) {
      res.status(403).json({
        success: false,
        message: "Complete coach verification to access this feature.",
      });
      return;
    }

    const status =
      coach.verificationStatus ||
      (coach.isVerified ? "VERIFIED" : "UNVERIFIED");
    const hasBio = Boolean(coach.bio?.trim());
    const hasSports = Array.isArray(coach.sports) && coach.sports.length > 0;
    const hasDocuments =
      Array.isArray(coach.verificationDocuments) &&
      coach.verificationDocuments.length > 0;

    const isCompleted =
      ["PENDING", "REVIEW", "VERIFIED"].includes(status) &&
      hasBio &&
      hasSports &&
      hasDocuments;

    if (!isCompleted) {
      res.status(403).json({
        success: false,
        message: "Complete coach verification to access this feature.",
      });
      return;
    }

    next();
  } catch (error) {
    res.status(500).json({
      success: false,
      message:
        error instanceof Error
          ? error.message
          : "Failed to verify coach status",
    });
  }
};

export const coachVerifiedMiddleware = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    if (req.user?.role !== "COACH" || !req.user.id) {
      next();
      return;
    }

    const coach = await Coach.findOne({ userId: req.user.id }).select(
      "verificationStatus isVerified",
    );

    if (!coach) {
      res.status(403).json({
        success: false,
        message: "Only verified coaches can manage venues.",
      });
      return;
    }

    const status =
      coach.verificationStatus ||
      (coach.isVerified ? "VERIFIED" : "UNVERIFIED");

    if (status !== "VERIFIED") {
      res.status(403).json({
        success: false,
        message: "Only verified coaches can manage venues.",
      });
      return;
    }

    next();
  } catch (error) {
    res.status(500).json({
      success: false,
      message:
        error instanceof Error
          ? error.message
          : "Failed to verify coach status",
    });
  }
};
