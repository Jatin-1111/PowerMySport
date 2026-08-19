/**
 * Anonymous guest-activity tracking.
 *
 * Privacy by design:
 *  - We generate a RANDOM pseudonymous id (`pms-guest-id`) — it is not derived
 *    from anything about the device or person (no fingerprinting), and carries
 *    no name, email, or contact info.
 *  - We only run for NOT-signed-in visitors. Signed-in users are covered by the
 *    authenticated funnel and are skipped here.
 *  - Events are batched and sent best-effort; failures are swallowed.
 */

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api";
const ENDPOINT = `${API_BASE}/stats/guest/event`;
const GUEST_ID_KEY = "pms-guest-id";
const FLUSH_INTERVAL_MS = 8000;
const MAX_BATCH = 20;

export interface GuestEvent {
  eventName: string;
  entityType?: string;
  entityId?: string;
  metadata?: Record<string, unknown>;
}

const isBrowser = (): boolean => typeof window !== "undefined";

let cachedGuestId: string | null = null;
let queue: GuestEvent[] = [];
let flushScheduled = false;

const randomId = (): string => {
  try {
    if (typeof crypto !== "undefined" && crypto.randomUUID) {
      return crypto.randomUUID();
    }
  } catch {
    /* ignore */
  }
  return `g_${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
};

/** True when there is no signed-in user (i.e. an anonymous guest). */
export const isGuest = (): boolean => {
  if (!isBrowser()) return false;
  try {
    return !localStorage.getItem("token");
  } catch {
    return true;
  }
};

/** Stable random id for this visitor; created once and reused. */
export const getGuestId = (): string => {
  if (cachedGuestId) return cachedGuestId;
  try {
    const existing = localStorage.getItem(GUEST_ID_KEY);
    if (existing) {
      cachedGuestId = existing;
      return existing;
    }
    const generated = randomId();
    localStorage.setItem(GUEST_ID_KEY, generated);
    cachedGuestId = generated;
    return generated;
  } catch {
    // Storage blocked (private mode) — fall back to a volatile in-memory id.
    cachedGuestId = cachedGuestId ?? randomId();
    return cachedGuestId;
  }
};

const sendBatch = (events: GuestEvent[], useBeacon: boolean): void => {
  if (!isBrowser() || events.length === 0) return;
  const payload = JSON.stringify({ guestId: getGuestId(), events });

  if (useBeacon) {
    try {
      if (navigator.sendBeacon) {
        const blob = new Blob([payload], { type: "application/json" });
        navigator.sendBeacon(ENDPOINT, blob);
        return;
      }
    } catch {
      /* fall through to fetch */
    }
  }

  void fetch(ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: payload,
    keepalive: true,
  }).catch(() => {
    /* best-effort: drop on failure */
  });
};

const flush = (useBeacon = false): void => {
  if (queue.length === 0) return;
  const events = queue;
  queue = [];
  sendBatch(events, useBeacon);
};

const scheduleFlush = (): void => {
  if (flushScheduled) return;
  flushScheduled = true;
  window.setTimeout(() => {
    flushScheduled = false;
    flush();
  }, FLUSH_INTERVAL_MS);
};

/** Queue an anonymous event (no-op for signed-in users / SSR). */
export const trackGuest = (event: GuestEvent): void => {
  if (!isBrowser() || !isGuest()) return;
  queue.push(event);
  if (queue.length >= MAX_BATCH) {
    flush();
  } else {
    scheduleFlush();
  }
};

/** Send anything queued immediately (use beacon when the page is unloading). */
export const flushGuestEvents = (useBeacon = false): void => {
  flush(useBeacon);
};
