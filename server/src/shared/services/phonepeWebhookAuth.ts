/**
 * Authentication and classification of PhonePe webhook (S2S callback) requests.
 *
 * PhonePe lets the merchant pick one of two schemes when creating a webhook in
 * the dashboard (Developer Settings -> Webhook):
 *
 *   SHA   `Authorization` header = hex SHA-256 of "username:password", using the
 *         credentials typed into the dashboard. These are PHONEPE_CALLBACK_USERNAME
 *         and PHONEPE_CALLBACK_PASSWORD, the same pair the SDK's validateCallback
 *         uses.
 *   HMAC  `x-phonepe-checksum-signature` (and `x-phonepe-checksum-key-id`) headers,
 *         signed with the secret the dashboard generates. That secret is
 *         PHONEPE_WEBHOOK_SECRET. PhonePe's page does not name the digest, so this
 *         assumes HMAC-SHA256 as hex; prefer SHA until that is confirmed against a
 *         real delivery.
 *
 * Either scheme passes when its credentials are configured and match. The legacy
 * `x-phonepe-signature` / `x-callback-signature` headers are still read as the HMAC
 * signature so existing senders and tests keep working.
 */
import crypto from "crypto";
import type { IncomingHttpHeaders } from "http";

export type PhonePeWebhookAuth =
  | { ok: true; scheme: "SHA" | "HMAC" }
  | { ok: false; reason: "NOT_CONFIGURED" | "MISSING_CREDENTIALS" | "INVALID" };

const safeEqual = (a: string, b: string): boolean => {
  const left = Buffer.from(a, "utf8");
  const right = Buffer.from(b, "utf8");
  return left.length === right.length && crypto.timingSafeEqual(left, right);
};

const headerValue = (headers: IncomingHttpHeaders, ...names: string[]): string => {
  for (const name of names) {
    const value = headers[name];
    const text = Array.isArray(value) ? value[0] : value;
    if (typeof text === "string" && text.trim()) return text.trim();
  }
  return "";
};

export const verifyPhonePeWebhookAuth = (
  headers: IncomingHttpHeaders,
  rawBody: string | Buffer
): PhonePeWebhookAuth => {
  const username = process.env.PHONEPE_CALLBACK_USERNAME || "";
  const password = process.env.PHONEPE_CALLBACK_PASSWORD || "";
  const hmacSecret = process.env.PHONEPE_WEBHOOK_SECRET || "";
  const shaConfigured = Boolean(username && password);

  if (!shaConfigured && !hmacSecret) {
    return { ok: false, reason: "NOT_CONFIGURED" };
  }

  const authorization = headerValue(headers, "authorization");
  const signature = headerValue(
    headers,
    "x-phonepe-checksum-signature",
    "x-phonepe-signature",
    "x-callback-signature"
  );

  if (!authorization && !signature) {
    return { ok: false, reason: "MISSING_CREDENTIALS" };
  }

  if (authorization && shaConfigured) {
    const expected = crypto.createHash("sha256").update(`${username}:${password}`).digest("hex");
    if (safeEqual(expected, authorization.toLowerCase())) return { ok: true, scheme: "SHA" };
  }

  if (signature && hmacSecret) {
    const expected = crypto.createHmac("sha256", hmacSecret).update(rawBody).digest("hex");
    if (safeEqual(expected, signature.toLowerCase())) return { ok: true, scheme: "HMAC" };
  }

  return { ok: false, reason: "INVALID" };
};

const asRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" ? (value as Record<string, unknown>) : {};

/**
 * True for a refund event (`pg.refund.completed`, `pg.refund.failed`, ...).
 *
 * A refund event carries the ORIGINAL order's id and a `state` of COMPLETED or
 * FAILED, exactly like an order event does. Fed to a payment reconciler it reads
 * as "that order's payment completed/failed", so a failed refund would mark a paid
 * booking FAILED. Anything that can tell the two apart must route refunds away
 * from the payment reconcilers.
 *
 * PhonePe documents `event` as the field to switch on and says to ignore `type`.
 * A refund id in the body is accepted as well, for senders that omit the event name.
 */
export const isPhonePeRefundEvent = (rawPayload: unknown): boolean => {
  const body = asRecord(rawPayload);
  const name = typeof body.event === "string" ? body.event : "";
  if (/refund/i.test(name)) return true;

  return [body, asRecord(body.payload), asRecord(body.data)].some(
    (part) => typeof part.refundId === "string" || typeof part.merchantRefundId === "string"
  );
};
