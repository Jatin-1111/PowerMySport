import crypto from "crypto";
import { log as __rootLog } from "../../utils/logger";

const log = __rootLog.child("whatsappNotification");

// ─── Configuration ────────────────────────────────────────────────────────────

// Read at call time, not import time: a value that dotenv loads after this
// module is imported (or that a test sets) is still picked up.
const n8nBookingWebhook = () => process.env.N8N_BOOKING_WEBHOOK_URL;
const n8nOtpWebhook = () => process.env.N8N_OTP_WEBHOOK_URL;
const n8nSecret = () => process.env.PMS_SERVER_WEBHOOK_SECRET;

/** n8n answers 200 straight away; anything slower than this means it is down. */
const N8N_TIMEOUT_MS = 5000;

// ─── Types ────────────────────────────────────────────────────────────────────

export type BookingWhatsAppEvent =
  "BOOKING_CONFIRMED" | "BOOKING_CANCELLED" | "BOOKING_RESCHEDULED";

export interface BookingWhatsAppPayload {
  event: BookingWhatsAppEvent;
  /** Player's phone in international format without "+", e.g. "919876543210" */
  playerPhone: string;
  playerName: string;
  coachName?: string | undefined;
  sport: string;
  /** ISO 8601 combined date-time string */
  dateTime: string;
  venue?: string | undefined;
  /** Only for BOOKING_RESCHEDULED — the new slot in ISO 8601 */
  newDateTime?: string | undefined;
  /** Refund amount in INR, only for BOOKING_CANCELLED */
  refundAmount?: number | undefined;
}

export interface OtpWhatsAppPayload {
  /** Recipient's phone in international format without "+", e.g. "919876543210" */
  phone: string;
  otp: string;
  name?: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Normalise an Indian phone number to the international format required by
 * the Meta Cloud API: 12 digits starting with "91", no "+".
 *
 * Handles:
 *   "9876543210"    → "919876543210"
 *   "+919876543210" → "919876543210"
 *   "919876543210"  → "919876543210"
 *   "09876543210"   → "919876543210"
 */
export function normalizeIndianPhone(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (digits.startsWith("91") && digits.length === 12) return digits;
  if (digits.startsWith("0") && digits.length === 11) return "91" + digits.slice(1);
  if (digits.length === 10) return "91" + digits;
  return digits; // already includes country code or is unknown format — pass through
}

/**
 * Whether `normalized` (the 12-digit form from `normalizeIndianPhone`) is an
 * Indian mobile number: 91, then a number starting 6-9. Anything else is not
 * worth a call to Meta.
 */
export function isIndianMobile(normalized: string): boolean {
  return /^91[6-9]\d{9}$/.test(normalized);
}

function hmacSign(body: string): string {
  const secret = n8nSecret();
  if (!secret) throw new Error("PMS_SERVER_WEBHOOK_SECRET is not set");
  return crypto.createHmac("sha256", secret).update(body).digest("hex");
}

async function postToN8n(url: string, payload: unknown): Promise<void> {
  const body = JSON.stringify(payload);
  const sig = hmacSign(body);

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-PMS-Signature": sig,
    },
    body,
    signal: AbortSignal.timeout(N8N_TIMEOUT_MS),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "(no body)");
    throw new Error(`n8n returned ${res.status}: ${text.slice(0, 200)}`);
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Fire a booking lifecycle event to n8n which will send a WhatsApp message to
 * the player. This is fire-and-forget — it never throws and never blocks the
 * caller.
 */
export function notifyBookingWhatsApp(payload: BookingWhatsAppPayload): void {
  const url = n8nBookingWebhook();
  if (!url || !n8nSecret()) {
    log.debug(
      "notifyBookingWhatsApp: N8N_BOOKING_WEBHOOK_URL or PMS_SERVER_WEBHOOK_SECRET not set, skipping"
    );
    return;
  }

  postToN8n(url, payload).catch((err) => {
    log.warn("notifyBookingWhatsApp: failed to POST to n8n", {
      event: payload.event,
      error: (err as Error).message,
    });
  });
}

/**
 * Request n8n to send a WhatsApp OTP message. Falls back gracefully when the
 * required env vars are absent (email OTP continues to work regardless).
 */
export function sendWhatsAppOtp(payload: OtpWhatsAppPayload): void {
  const url = n8nOtpWebhook();
  if (!url || !n8nSecret()) {
    log.debug(
      "sendWhatsAppOtp: N8N_OTP_WEBHOOK_URL or PMS_SERVER_WEBHOOK_SECRET not set, skipping"
    );
    return;
  }

  postToN8n(url, payload).catch((err) => {
    log.warn("sendWhatsAppOtp: failed to POST to n8n", {
      error: (err as Error).message,
    });
  });
}
