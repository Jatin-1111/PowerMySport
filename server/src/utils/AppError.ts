/**
 * An error carrying the HTTP status code it should produce. Thrown from
 * anywhere inside an asyncHandler-wrapped route (or from a service it calls),
 * caught by asyncHandler, and formatted by the global errorHandler middleware
 * as `{ success: false, message }` with this statusCode.
 */
export class AppError extends Error {
  statusCode: number;

  constructor(message: string, statusCode: number) {
    super(message);
    this.name = "AppError";
    this.statusCode = statusCode;
    Error.captureStackTrace?.(this, AppError);
  }
}
