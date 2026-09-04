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
  // "Access denied" is the only literal string a couple of call sites throw;
  // the rest of the domain's own-content checks phrase the same denial as
  // "Only the author/sender/person who asked can ..." — without this branch
  // every one of those fell through to the 500 default below instead of 403.
  if (message === "Access denied" || message.startsWith("Only the")) return 403;
  if (message.includes("not found")) return 404;
  if (
    message.includes("Invalid target ID") ||
    message.includes("Cast to ObjectId failed") ||
    message.includes("validation failed")
  ) {
    return 400;
  }
  // Case-insensitive: domain errors phrase this validation-style reason both
  // ways ("Cannot answer a closed post" vs. "You cannot delete this
  // comment") — the plain `.includes("cannot")` below only ever matched the
  // lowercase form, so "Cannot answer a closed post" fell through to 500.
  const lowerMessage = message.toLowerCase();
  if (
    lowerMessage.includes("cannot") ||
    lowerMessage.includes("required") ||
    lowerMessage.includes("privacy") ||
    lowerMessage.includes("accept") ||
    lowerMessage.includes("only for")
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
