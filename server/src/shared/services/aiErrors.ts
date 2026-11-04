/**
 * What a parent sees when the AI provider fails, and how to tell the failures apart.
 *
 * Every AI feature shares one Gemini key, so a quota error is the most likely
 * failure and it takes all of them down at once. Two rules follow from that:
 * a quota or overload error on one model is worth trying on the next model
 * (each model has its own quota), and the provider's own error text must never
 * reach a parent: it can be a long JSON blob naming the project and the quota
 * metric. The real error stays in the server log.
 */

export const AI_BUSY_MESSAGE =
  "Our assistant is very busy right now. Please try again in a few minutes.";

export const AI_FAILED_MESSAGE = "Something went wrong on our side. Please try again.";

/** Thrown when every model was out of quota or overloaded. The error handler turns it into a 503. */
export class AiBusyError extends Error {
  readonly statusCode = 503;

  constructor(cause?: unknown) {
    super(AI_BUSY_MESSAGE);
    this.name = "AiBusyError";
    if (cause !== undefined) (this as { cause?: unknown }).cause = cause;
  }
}

const textOf = (error: unknown): string =>
  (error instanceof Error ? error.message : String(error ?? "")).toLowerCase();

const statusOf = (error: unknown): number | undefined => {
  const status = (error as { status?: unknown } | null)?.status;
  return typeof status === "number" ? status : undefined;
};

/** The model name is unknown or retired: another model may still answer. */
export const isModelMissingError = (error: unknown): boolean => {
  const text = textOf(error);
  return statusOf(error) === 404 || text.includes("404") || text.includes("not found");
};

/** Out of quota or rate limited. */
export const isQuotaError = (error: unknown): boolean => {
  const text = textOf(error);
  return (
    statusOf(error) === 429 ||
    text.includes("429") ||
    text.includes("quota") ||
    text.includes("resource_exhausted") ||
    text.includes("rate limit") ||
    text.includes("too many requests")
  );
};

/** The provider is overloaded or briefly down. */
export const isOverloadedError = (error: unknown): boolean => {
  const text = textOf(error);
  return (
    statusOf(error) === 503 ||
    text.includes("503") ||
    text.includes("unavailable") ||
    text.includes("overloaded")
  );
};

/** Worth trying the next model in the list. */
export const canTryNextModel = (error: unknown): boolean =>
  isModelMissingError(error) || isQuotaError(error) || isOverloadedError(error);

/** A "busy, try again later" failure rather than a bug. */
export const isBusyError = (error: unknown): boolean =>
  error instanceof AiBusyError || isQuotaError(error) || isOverloadedError(error);

/** The only text about an AI failure that may be shown to a parent. */
export const parentSafeAiMessage = (error: unknown): string =>
  isBusyError(error) ? AI_BUSY_MESSAGE : AI_FAILED_MESSAGE;
