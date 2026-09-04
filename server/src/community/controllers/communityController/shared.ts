import { Request } from "express";
import { AppError } from "../../../utils/AppError";

export const getUserId = (req: Request): string => {
  if (!req.user?.id) {
    throw new AppError("Unauthorized", 401);
  }

  return req.user.id;
};

// Used on the guest-readable Q&A routes (post list + detail) — a shared
// post link must render for anonymous visitors, so these can't require a user.
export const getOptionalUserId = (req: Request): string | undefined => req.user?.id;

const getStatusCode = (message: string): number => {
  if (message === "Unauthorized") return 401;
  if (message === "Access denied") return 403;
  if (message.includes("not found")) return 404;
  if (
    message.includes("Invalid target ID") ||
    message.includes("Cast to ObjectId failed") ||
    message.includes("validation failed")
  ) {
    return 400;
  }
  if (
    message.includes("cannot") ||
    message.includes("required") ||
    message.includes("privacy") ||
    message.includes("accept") ||
    message.includes("only for")
  ) {
    return 400;
  }

  return 500;
};

/**
 * Classifies a caught error's message into the status code this domain's
 * handlers have always used (see getStatusCode), then wraps it as an
 * AppError so a single `throw toAppError(error, fallback)` in each handler's
 * catch replaces what used to be a manual `res.status(...).json(...)` call —
 * the actual response is now written once, centrally, by the global error
 * middleware.
 */
export const toAppError = (error: unknown, fallback: string): AppError => {
  if (error instanceof AppError) return error;
  const message = error instanceof Error ? error.message : fallback;
  return new AppError(message, getStatusCode(message));
};
