import redis from "../../config/redis";

// ─── Daily AI-chat message cap — global per user, shared across every chat ────
// feature (guidance chat, roadmap chat, etc.) so a parent can't multiply their
// quota by opening several conversations. Redis INCR keeps this atomic under
// concurrent requests, and keying by the IST calendar date means it resets
// automatically at day boundary with no manual reset logic needed.

export const DAILY_MESSAGE_CAP = 30;

// ─── Lifetime cap — per chat session (guidance chat, roadmap chat, etc.) ──────

export const LIFETIME_MESSAGE_CAP = 150;

function getIstDateKey(): string {
  return new Date(Date.now() + 5.5 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

function getDailyLimitKey(userId: string): string {
  return `guidance:chat:daily:${userId}:${getIstDateKey()}`;
}

export async function getDailyMessageCount(userId: string): Promise<number> {
  try {
    const val = await redis.get(getDailyLimitKey(userId));
    return val ? parseInt(val, 10) : 0;
  } catch {
    return 0; // fail open — Redis being down shouldn't block a cap-status read
  }
}

/** Atomically reserves one message slot for today. Returns the new count. */
export async function incrementDailyMessageCount(
  userId: string,
): Promise<number> {
  try {
    const key = getDailyLimitKey(userId);
    const count = await redis.incr(key);
    if (count === 1) {
      await redis.expire(key, 60 * 60 * 48); // safety cleanup; the date in the key already rotates daily
    }
    return count;
  } catch {
    return 1; // fail open — Redis being down shouldn't block AI chat
  }
}

/** Releases a reserved slot — used when a reserved message ends up not counting (over cap, or the AI call failed). */
export async function decrementDailyMessageCount(
  userId: string,
): Promise<void> {
  try {
    await redis.decr(getDailyLimitKey(userId));
  } catch {
    // fail open
  }
}

// ─── Shared daily + lifetime cap check ────────────────────────────────────────
// Used by every AI chat feature (guidance chat, roadmap chat, ...) right before
// streaming a response, so the two caps are enforced identically everywhere.

export interface ChatRateLimitResult {
  ok: boolean;
  status: number;
  message: string;
  code?: "DAILY_LIMIT_REACHED" | "LIFETIME_LIMIT_REACHED";
}

/**
 * Reserves today's message slot and checks it against both caps. On rejection,
 * releases the slot it just reserved. Callers must not increment the daily
 * count themselves — this is the single place that happens.
 */
export async function checkChatRateLimit(
  userId: string,
  currentLifetimeCount: number,
  copy: { dailyReached: string; lifetimeReached: string },
): Promise<ChatRateLimitResult> {
  const dailyCount = await incrementDailyMessageCount(userId);
  if (dailyCount > DAILY_MESSAGE_CAP) {
    await decrementDailyMessageCount(userId);
    return {
      ok: false,
      status: 429,
      message: copy.dailyReached,
      code: "DAILY_LIMIT_REACHED",
    };
  }

  if (currentLifetimeCount >= LIFETIME_MESSAGE_CAP) {
    await decrementDailyMessageCount(userId);
    return {
      ok: false,
      status: 429,
      message: copy.lifetimeReached,
      code: "LIFETIME_LIMIT_REACHED",
    };
  }

  return { ok: true, status: 200, message: "" };
}
