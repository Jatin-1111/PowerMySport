import { Request, Response } from "express";

export const getUserId = (req: Request): string => {
  if (!req.user?.id) {
    throw new Error("Unauthorized");
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

export const handleError = (res: Response, error: unknown, fallback: string) => {
  const message = error instanceof Error ? error.message : fallback;
  res.status(getStatusCode(message)).json({
    success: false,
    message,
  });
};
