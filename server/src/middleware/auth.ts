import { Request, Response, NextFunction } from "express";
import { Coach } from "../models/Coach";
import { verifyToken } from "../utils/jwt";
import { IUserPayload } from "../types/index";
import {
  hasPermission,
  hasAnyPermission,
  hasAllPermissions,
} from "../utils/permissions";
import { ADMIN_ROLES } from "../constants/adminPermissions";
import Admin from "../models/Admin";

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

/**
 * Middleware for venue-lister only routes.
 * Coaches and venue-listers are completely separate roles.
 * Coaches who want to list venues for rent must create separate venue-lister credentials.
 */
export const venueListerMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction,
): void => {
  if (req.user?.role !== "VENUE_LISTER") {
    res.status(403).json({
      success: false,
      message:
        "Access denied. Venue Lister role required. Coaches must create separate venue-lister credentials to manage rentable venues.",
    });
    return;
  }
  next();
};

export const playerOnlyMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction,
): void => {
  if (req.user?.role !== "PLAYER") {
    res.status(403).json({
      success: false,
      message: "Booking is available for player accounts only.",
    });
    return;
  }

  next();
};

// Alias for backward compatibility - will be removed in future
export const vendorMiddleware = venueListerMiddleware;

export const adminMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction,
): void => {
  // Check if user has any admin role
  const validAdminRoles = Object.values(ADMIN_ROLES);
  if (!req.user?.role || !validAdminRoles.includes(req.user.role as any)) {
    res.status(403).json({
      success: false,
      message: "Access denied. Admin role required.",
    });
    return;
  }
  next();
};

export const superAdminMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction,
): void => {
  if (req.user?.role !== ADMIN_ROLES.SYSTEM_ADMIN) {
    res.status(403).json({
      success: false,
      message: "Access denied. System Admin role required.",
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
      "bio sports verificationStatus isVerified",
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

    // Only allow VERIFIED coaches to take bookings - prevent unverified coaches from operating
    const isVerified = status === "VERIFIED" && hasBio && hasSports;

    if (!isVerified) {
      res.status(403).json({
        success: false,
        message:
          "Coach verification must be approved by admin before taking bookings.",
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

// ============================================
// PERMISSION-BASED MIDDLEWARE
// ============================================

/**
 * Middleware factory to check if admin has a specific permission
 * Usage: requirePermission('users:view')
 */
export const requirePermission = (requiredPermission: string) => {
  return async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      if (!req.user?.id) {
        res.status(401).json({
          success: false,
          message: "Authentication required",
        });
        return;
      }

      // Fetch admin with permissions
      const admin = await Admin.findById(req.user.id).select(
        "role permissions isActive",
      );

      if (!admin || !admin.isActive) {
        res.status(403).json({
          success: false,
          message: "Admin account not found or inactive",
        });
        return;
      }

      // Check permission
      if (!hasPermission(admin.permissions, admin.role, requiredPermission)) {
        res.status(403).json({
          success: false,
          message: `Access denied. Required permission: ${requiredPermission}`,
        });
        return;
      }

      next();
    } catch (error) {
      res.status(500).json({
        success: false,
        message:
          error instanceof Error ? error.message : "Permission check failed",
      });
    }
  };
};

/**
 * Middleware factory to check if admin has any of the required permissions
 * Usage: requireAnyPermission(['users:view', 'users:manage'])
 */
export const requireAnyPermission = (requiredPermissions: string[]) => {
  return async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      if (!req.user?.id) {
        res.status(401).json({
          success: false,
          message: "Authentication required",
        });
        return;
      }

      const admin = await Admin.findById(req.user.id).select(
        "role permissions isActive",
      );

      if (!admin || !admin.isActive) {
        res.status(403).json({
          success: false,
          message: "Admin account not found or inactive",
        });
        return;
      }

      if (
        !hasAnyPermission(admin.permissions, admin.role, requiredPermissions)
      ) {
        res.status(403).json({
          success: false,
          message: `Access denied. Required any of: ${requiredPermissions.join(", ")}`,
        });
        return;
      }

      next();
    } catch (error) {
      res.status(500).json({
        success: false,
        message:
          error instanceof Error ? error.message : "Permission check failed",
      });
    }
  };
};

/**
 * Middleware factory to check if admin has all of the required permissions
 * Usage: requireAllPermissions(['users:view', 'venues:view'])
 */
export const requireAllPermissions = (requiredPermissions: string[]) => {
  return async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      if (!req.user?.id) {
        res.status(401).json({
          success: false,
          message: "Authentication required",
        });
        return;
      }

      const admin = await Admin.findById(req.user.id).select(
        "role permissions isActive",
      );

      if (!admin || !admin.isActive) {
        res.status(403).json({
          success: false,
          message: "Admin account not found or inactive",
        });
        return;
      }

      if (
        !hasAllPermissions(admin.permissions, admin.role, requiredPermissions)
      ) {
        res.status(403).json({
          success: false,
          message: `Access denied. Required all of: ${requiredPermissions.join(", ")}`,
        });
        return;
      }

      next();
    } catch (error) {
      res.status(500).json({
        success: false,
        message:
          error instanceof Error ? error.message : "Permission check failed",
      });
    }
  };
};
