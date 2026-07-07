import { Request, Response, NextFunction } from "express";
import { Coach } from "../client/models/Coach";
import { User } from "../client/models/User";
import { isTokenRevoked, verifyToken } from "../utils/jwt";
import { IUserPayload } from "../types";
import {
  hasPermission,
  hasAnyPermission,
  hasAllPermissions,
  isSystemAdminRole,
} from "../utils/permissions";
import { ADMIN_ROLES } from "../constants/adminPermissions";
import Admin from "../admin/models/Admin";
import redis from "../config/redis";

declare global {
  namespace Express {
    interface Request {
      user?: IUserPayload;
    }
  }
}

const AUTH_ACTIVITY_WRITE_THROTTLE_MS = 60 * 1000;
const touchAuthActivity = (userId: string): void => {
  const redisKey = `user:activity:throttle:${userId}`;

  redis
    .set(redisKey, "1", "PX", AUTH_ACTIVITY_WRITE_THROTTLE_MS, "NX")
    .then((result) => {
      if (result) {
        User.updateOne(
          { _id: userId },
          { $set: { lastActiveAt: new Date() } },
        ).catch((error: unknown) => {
          console.error("Failed to persist auth activity:", error);
        });
      }
    })
    .catch((error) => {
      console.error("Redis error during touchAuthActivity:", error);
    });
};

export const authMiddleware = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    const bearerToken =
      typeof authHeader === "string" && authHeader.startsWith("Bearer ")
        ? authHeader.slice(7).trim()
        : "";
    const cookieToken = req.cookies.token;
    const token = bearerToken || cookieToken;

    if (!token) {
      res.status(401).json({
        success: false,
        message: "No token provided. Please login first.",
      });
      return;
    }

    const decoded = verifyToken(token);
    if (await isTokenRevoked(decoded.jti)) {
      res.status(401).json({
        success: false,
        message: "Token revoked",
      });
      return;
    }

    const userRolesNeedingStatusCheck: Array<IUserPayload["role"]> = [
      "Player",
      "Coach",
      "VenueLister",
      "Academy",
      "EXPERT",
      "Admin",
    ];

    if (userRolesNeedingStatusCheck.includes(decoded.role)) {
      const userRecord = await User.findById(decoded.id)
        .select("isActive suspensionReason")
        .lean();

      if (!userRecord) {
        res.status(401).json({
          success: false,
          message: "User not found",
        });
        return;
      }

      if (userRecord.isActive === false) {
        res.status(403).json({
          success: false,
          message: userRecord.suspensionReason || "Account is suspended",
        });
        return;
      }
    }

    req.user = decoded;
    if (decoded.id) {
      touchAuthActivity(decoded.id);
    }
    next();
  } catch (error) {
    res.status(401).json({
      success: false,
      message: error instanceof Error ? error.message : "Authentication failed",
    });
  }
};

/**
 * Optional auth middleware — decodes the JWT if present and populates req.user,
 * but always calls next() even when no token is provided.
 * Used on routes that serve both authenticated and guest users (e.g. POST /guidance).
 */
export const optionalAuthMiddleware = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    const bearerToken =
      typeof authHeader === "string" && authHeader.startsWith("Bearer ")
        ? authHeader.slice(7).trim()
        : "";
    const cookieToken = req.cookies?.token;
    const token = bearerToken || cookieToken;

    if (!token) {
      next();
      return;
    }

    try {
      const decoded = verifyToken(token);
      if (await isTokenRevoked(decoded.jti)) {
        next();
        return;
      }
      req.user = decoded;
      if (decoded.id) {
        touchAuthActivity(decoded.id);
      }
    } catch {
      // Invalid token — treat as guest, don't block
    }

    next();
  } catch (error) {
    // Fail open — this is optional auth
    next();
  }
};

export const onboardingAuthMiddleware = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    const bearerToken =
      typeof authHeader === "string" && authHeader.startsWith("Bearer ")
        ? authHeader.slice(7).trim()
        : "";
    const cookieToken = req.cookies?.token;
    const token = bearerToken || cookieToken;

    if (!token) {
      res.status(401).json({
        success: false,
        message: "No token provided. Please start onboarding from Step 1.",
      });
      return;
    }

    const decoded = verifyToken(token);
    if (await isTokenRevoked(decoded.jti)) {
      res.status(401).json({
        success: false,
        message: "Token revoked",
      });
      return;
    }

    if (
      decoded.role !== "VENUE_ONBOARDING" &&
      !isSystemAdminRole(decoded.role)
    ) {
      res.status(403).json({
        success: false,
        message: "Invalid token for venue onboarding.",
      });
      return;
    }

    // Enforce strict ownership verification
    const requestedVenueId = req.body?.venueId || req.params?.venueId;
    if (
      requestedVenueId &&
      requestedVenueId !== decoded.id &&
      !isSystemAdminRole(decoded.role)
    ) {
      res.status(403).json({
        success: false,
        message: "Unauthorized access to this venue.",
      });
      return;
    }

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
  if (req.user?.role !== "VenueLister") {
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
  if (req.user?.role !== "Player" && req.user?.role !== "Parent") {
    res.status(403).json({
      success: false,
      message: "Booking is available for player and parent accounts.",
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
  if (
    !isSystemAdminRole(req.user?.role) &&
    !Object.values(ADMIN_ROLES).includes(req.user?.role as any)
  ) {
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
  if (!isSystemAdminRole(req.user?.role)) {
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
    if (req.user?.role !== "Coach" || !req.user.id) {
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
    if (req.user?.role !== "Coach" || !req.user.id) {
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
