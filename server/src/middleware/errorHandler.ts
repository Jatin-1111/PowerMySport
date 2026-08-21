import { Request, Response, NextFunction } from "express";
import { log as __rootLog } from "../utils/logger";
const log = __rootLog.child("errorHandler");

export const errorHandler = (
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction,
): void => {
  log.error("Error:", err);

  const statusCode = (err as any).statusCode || 500;
  const message = err.message || "Internal server error";

  res.status(statusCode).json({
    success: false,
    message,
  });
};
