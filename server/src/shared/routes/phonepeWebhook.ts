/**
 * PhonePe Webhook Route — Coach Subscriptions & Booking Payments
 *
 * SCOPE: This route receives PhonePe webhook callbacks for:
 *   - Coach subscription payments (CoachSubscriptionPaymentTransaction)
 *   - Booking payments (BookingPaymentTransaction, merchantOrderId starting with "bk_")
 *
 * It persists the raw event into PaymentWebhookEvent, enqueues an outbox message,
 * and the OutboxService worker processes reconciliation asynchronously via:
 *   - reconcileCoachSubscriptionPaymentFromWebhookPayload()
 *   - reconcileBookingPaymentFromWebhookPayload()
 *
 * Mounted at: /api/payments/phonepe/webhook (see app.ts)
 *
 * E-COMMERCE order webhooks are handled separately by WebhookController
 * in shared/controllers/WebhookController.ts (mounted at /api/v1/webhooks/phonepe).
 */
import express from "express";
import crypto from "crypto";
import PaymentWebhookEvent from "../models/PaymentWebhookEvent";
import OutboxMessage from "../models/OutboxMessage";

const router = express.Router();

const getSignatureHeader = (req: express.Request) =>
  (req.headers["x-phonepe-signature"] ||
    req.headers["x-callback-signature"] ||
    "") as string;

router.post("/webhook", async (req, res) => {
  const secret = process.env.PHONEPE_WEBHOOK_SECRET;
  if (!secret) {
    console.error("PHONEPE_WEBHOOK_SECRET not configured");
    return res.status(500).send("server misconfigured");
  }

  // Use the rawBody set by express.json verify middleware in app.ts
  const rawBody = (req as any).rawBody as string | undefined;
  if (!rawBody) {
    console.warn("No rawBody available for signature verification");
    return res.status(400).send("raw body required");
  }

  const signature = (getSignatureHeader(req) || "").trim();
  const expected = crypto
    .createHmac("sha256", secret)
    .update(Buffer.from(rawBody, "utf8"))
    .digest("hex");

  try {
    const a = Buffer.from(expected, "utf8");
    const b = Buffer.from(signature, "utf8");
    if (!signature || a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
      console.warn("PhonePe webhook signature mismatch");
      return res.status(401).send("invalid signature");
    }
  } catch (err) {
    console.error("signature verify error", err);
    return res.status(401).send("invalid signature");
  }

  let payload: any;
  try {
    payload = JSON.parse(rawBody);
  } catch (err) {
    console.error("invalid json payload", err);
    return res.status(400).send("invalid json");
  }

  const eventId =
    payload?.eventId ||
    payload?.id ||
    payload?.data?.transactionId ||
    JSON.stringify(payload).slice(0, 200);

  try {
    const existing = await PaymentWebhookEvent.findOne({ eventId }).lean();
    if (!existing) {
      await PaymentWebhookEvent.create({
        eventId,
        eventType: payload?.event || payload?.type || null,
        payload,
        status: "PENDING",
      });

      // enqueue processing via outbox
      await OutboxMessage.create({
        type: "process_payment_webhook",
        payload: { eventId },
        status: "PENDING",
        attempts: 0,
      });
    } else {
      console.info("duplicate webhook received, eventId=", eventId);
    }
  } catch (err) {
    console.error("failed to persist webhook event", err);
    return res.status(500).send("db error");
  }

  return res.status(200).send("ok");
});

export default router;
