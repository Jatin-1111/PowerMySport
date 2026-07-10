import redis from "../../config/redis";

// ─── Daily AI-chat message cap — global per user, shared across every chat ────
// feature (guidance chat, roadmap chat, etc.) so a parent can't multiply their
// quota by opening several conversations. Redis INCR keeps this atomic under
// concurrent requests, and keying by the IST calendar date means it resets
// automatically at day boundary with no manual reset logic needed.

export const DAILY_MESSAGE_CAP = 30;

function getIstDateKey(): string {
  return new Date(Date.now() + 5.5 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

function getDailyLimitKey(userId: string): string {
  return `guidance:chat:daily:${userId}:${getIstDateKey()}`;
}

export async function getDailyMessageCount(userId: string): Promise<number> {
  const val = await redis.get(getDailyLimitKey(userId));
  return val ? parseInt(val, 10) : 0;
}

/** Atomically reserves one message slot for today. Returns the new count. */
export async function incrementDailyMessageCount(
  userId: string,
): Promise<number> {
  const key = getDailyLimitKey(userId);
  const count = await redis.incr(key);
  if (count === 1) {
    await redis.expire(key, 60 * 60 * 48); // safety cleanup; the date in the key already rotates daily
  }
  return count;
}

/** Releases a reserved slot — used when a reserved message ends up not counting (over cap, or the AI call failed). */
export async function decrementDailyMessageCount(
  userId: string,
): Promise<void> {
  await redis.decr(getDailyLimitKey(userId));
}
