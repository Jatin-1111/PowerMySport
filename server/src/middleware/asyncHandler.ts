import { NextFunction, Request, RequestHandler, Response } from "express";

/**
 * Wraps an async Express handler so a rejected promise (or a throw from
 * `await`ed code) is forwarded to `next(err)` instead of crashing the process
 * or requiring a manual try/catch in every handler. The global `errorHandler`
 * middleware turns the error into the standard `{ success: false, message }`
 * response, using `err.statusCode` when present (see `AppError`) or 500
 * otherwise.
 */
export const asyncHandler =
  (fn: (req: Request, res: Response, next: NextFunction) => Promise<void>): RequestHandler =>
  (req, res, next) => {
    // Returned (not fire-and-forget) so direct/unit-test invocations that
    // `await handler(req, res)` still wait for the body to finish before
    // asserting on `res` — Express itself ignores a handler's return value.
    return Promise.resolve(fn(req, res, next)).catch(next);
  };
