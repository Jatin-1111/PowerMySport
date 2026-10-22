import { AppError } from "../../../utils/AppError";

/**
 * Per-user cap on sent messages, shared by the HTTP route and the socket
 * handler because it lives in the service they both call. The socket's own
 * limit is per connection, so more tabs, or plain HTTP, got around it.
 * In-memory, so it is per server process: enough to stop a loop or a script,
 * not a global quota.
 */
export const SEND_LIMIT = 30;
export const SEND_WINDOW_MS = 10_000;

const windows = new Map<string, { start: number; count: number }>();

export const consumeSendAllowance = (userId: string, now = Date.now()): void => {
  const current = windows.get(userId);
  if (!current || now - current.start > SEND_WINDOW_MS) {
    windows.set(userId, { start: now, count: 1 });
    // Drop idle entries so the map does not grow with every user ever seen.
    if (windows.size > 5000) {
      for (const [key, value] of windows) {
        if (now - value.start > SEND_WINDOW_MS) windows.delete(key);
      }
    }
    return;
  }

  if (current.count >= SEND_LIMIT) {
    throw new AppError(
      "You are sending messages too quickly. Wait a few seconds and try again.",
      429
    );
  }
  current.count += 1;
};

/** Test hook: start from a clean slate. */
export const resetSendAllowance = (): void => windows.clear();
