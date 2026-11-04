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
 * Refund events (pg.refund.*) go to reconcileRefundFromWebhookPayload() instead.
 *
 * Authentication follows the scheme chosen on the PhonePe dashboard (SHA
 * `Authorization` header or HMAC checksum headers); see phonepeWebhookAuth.ts.
 *
 * Mounted at: /api/payments/phonepe/webhook (see app.ts)
 *
 * The shop's /api/v1/webhooks/phonepe URL (WebhookController) hands its requests
 * to the same receiver, so a webhook registered at either URL is authenticated and
 * processed identically; shop orders are reconciled by the outbox worker.
 */
import express from "express";
import crypto from "crypto";
import PaymentWebhookEvent from "../models/PaymentWebhookEvent";
import OutboxMessage from "../models/OutboxMessage";
import { verifyPhonePeWebhookAuth } from "../services/phonepeWebhookAuth";
import { log as __rootLog } from "../../utils/logger";
const log = __rootLog.child("phonepeWebhook");

const router = express.Router();

export const receivePhonePeWebhook = async (req: express.Request, res: express.Response) => {
  // Use the rawBody set by express.json verify middleware in app.ts
  const rawBody = (req as any).rawBody as string | undefined;
  if (!rawBody) {
    log.warn("No rawBody available for signature verification");
    return res.status(400).send("raw body required");
  }

  const auth = verifyPhonePeWebhookAuth(req.headers, Buffer.from(rawBody, "utf8"));
  if (!auth.ok) {
    if (auth.reason === "NOT_CONFIGURED") {
      log.error(
        "No PhonePe webhook credentials configured (PHONEPE_CALLBACK_USERNAME/PASSWORD or PHONEPE_WEBHOOK_SECRET)"
      );
      return res.status(500).send("server misconfigured");
    }
    log.warn(`PhonePe webhook rejected: ${auth.reason}`);
    return res.status(401).send("invalid signature");
  }

  let payload: any;
  try {
    payload = JSON.parse(rawBody);
  } catch (err) {
    log.error("invalid json payload", err);
    return res.status(400).send("invalid json");
  }

  // An id the gateway gave us is the identity of the event. Without one, the
  // identity is a hash of the exact body: a redelivery is byte-identical and so
  // dedupes, while a state change for the same order (PENDING then COMPLETED)
  // is a different body and is kept. The old fallback keyed on the transaction
  // id, or the first 200 characters, so the COMPLETED event could be discarded
  // as a "duplicate" of the PENDING one that came before it.
  const explicitId = payload?.eventId || payload?.id;
  const eventId =
    typeof explicitId === "string" && explicitId.length > 0
      ? explicitId
      : `sha256:${crypto.createHash("sha256").update(rawBody, "utf8").digest("hex")}`;

  const enqueue = () =>
    OutboxMessage.create({
      type: "process_payment_webhook",
      payload: { eventId },
      status: "PENDING",
      attempts: 0,
    });

  try {
    // The unique index on eventId is the dedupe, so two deliveries arriving
    // together cannot both pass a check-then-insert and one of them 500.
    await PaymentWebhookEvent.create({
      eventId,
      eventType: payload?.event || payload?.type || null,
      payload,
      status: "PENDING",
    });
    await enqueue();
  } catch (err) {
    if ((err as { code?: number })?.code === 11000) {
      log.info("duplicate webhook received, eventId=", eventId);
      // The first delivery may have stored the event and died before enqueuing
      // it; a retry must not leave it unprocessed forever.
      try {
        const queued = await OutboxMessage.exists({
          type: "process_payment_webhook",
          "payload.eventId": eventId,
        });
        if (!queued) await enqueue();
      } catch (enqueueErr) {
        log.error("failed to re-enqueue webhook event", enqueueErr);
        return res.status(500).send("db error");
      }
      return res.status(200).send("ok");
    }
    log.error("failed to persist webhook event", err);
    return res.status(500).send("db error");
  }

  return res.status(200).send("ok");
};

router.post("/webhook", receivePhonePeWebhook);

export default router;
