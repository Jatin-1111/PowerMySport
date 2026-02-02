import { Request, Response, NextFunction } from "express";
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
  if (req.user?.role !== "vendor") {
    res.status(403).json({
      success: false,
      message: "Access denied. Vendor role required.",
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
  if (req.user?.role !== "admin") {
    res.status(403).json({
      success: false,
      message: "Access denied. Admin role required.",
    });
    return;
  }
  next();
};
