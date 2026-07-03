import { reconcileBookingPaymentFromWebhookPayload } from "../../client/services/BookingService";
import { reconcileCoachSubscriptionPaymentFromWebhookPayload } from "../../client/services/CoachSubscriptionPaymentService";
import { reconcileExpertSessionPaymentFromWebhookPayload } from "../../client/services/ExpertsService";
import { NotificationService } from "../../client/services/NotificationService";
import { reconcileEcommerceOrderFromWebhookPayload } from "../../shop/services/EcommerceService";
import { sendEmail } from "../../utils/email";
import OutboxMessage from "../models/OutboxMessage";
import PaymentWebhookEvent from "../models/PaymentWebhookEvent";

const POLL_INTERVAL_MS = 3000;
const MAX_ATTEMPTS = 6;

const jitter = (ms: number) => {
  const variance = Math.floor(ms * 0.2);
  const delta = Math.floor(Math.random() * (variance * 2 + 1)) - variance;
  return Math.max(1000, ms + delta);
};

export const startOutboxWorker = () => {
  const tick = async () => {
    try {
      const now = new Date();
      const item = await OutboxMessage.findOneAndUpdate(
        { status: "PENDING", nextAttemptAt: { $lte: now } },
        { $set: { status: "PROCESSING" } },
        { sort: { nextAttemptAt: 1 } },
      );

      if (!item) return;

      try {
        if (item.type === "deliver_message") {
          const payload = item.payload || {};
          const participantIds: string[] = payload.participantIds || [];

          // Send a Notification per participant (respecting preferences inside NotificationService)
          for (const userId of participantIds) {
            try {
              await NotificationService.send(
                {
                  userId,
                  type: "MESSAGE_RECEIVED",
                  title:
                    payload.conversationType === "GROUP"
                      ? "New group message"
                      : "New message",
                  message: payload.summary || "You have a new message",
                  data: {
                    event: "COMMUNITY_MESSAGE_RECEIVED",
                    conversationId: payload.conversationId,
                    messageId: payload.messageId,
                    actorUserId: payload.actorUserId,
                    conversationType: payload.conversationType || "DM",
                  },
                },
                { persistToDb: true, sendSocket: true, sendPush: true },
              );
            } catch (err) {
              console.error(
                "[outbox][deliver_message] Failed to send notification",
                {
                  userId,
                  error:
                    (err as any)?.stack || (err as any)?.message || String(err),
                },
              );
            }
          }
        } else if (item.type === "process_payment_webhook") {
          const payload = item.payload || {};
          const eventId: string = payload.eventId;
          if (!eventId) {
            throw new Error("Missing eventId for payment webhook processing");
          }

          const event = await PaymentWebhookEvent.findOne({ eventId });
          if (!event) {
            throw new Error(`PaymentWebhookEvent not found: ${eventId}`);
          }

          if (event.status === "DONE") {
            // already processed
          } else {
            // Mark processing
            event.status = "PROCESSING";
            await event.save();

            try {
              await reconcileCoachSubscriptionPaymentFromWebhookPayload(
                event.payload,
              );

              // Also try booking payment reconciliation — the webhook may be
              // for a booking rather than a coach subscription.
              await reconcileBookingPaymentFromWebhookPayload(event.payload);

              // Also try e-commerce order reconciliation — the webhook may be
              // for a shop order (merchantOrderId prefix "O_").
              await reconcileEcommerceOrderFromWebhookPayload(event.payload);

              // Also try expert session reconciliation — the webhook may be
              // for an expert session (merchantOrderId prefix "EXP_").
              await reconcileExpertSessionPaymentFromWebhookPayload(event.payload);

              event.status = "DONE";
              event.processedAt = new Date();
              event.lastError = null;
              await event.save();
              console.info("[outbox][payment] processed", { eventId });
            } catch (procErr) {
              event.status = "FAILED";
              event.lastError =
                (procErr as any)?.stack ||
                (procErr as any)?.message ||
                String(procErr);
              await event.save().catch(() => undefined);

              console.error("[outbox][payment] processing failed", {
                eventId,
                error: (procErr as any)?.stack || String(procErr),
              });
              throw procErr;
            }
          }
        } else if (item.type === "send_email") {
          const payload = item.payload || {};
          const { to, subject, html, text } = payload;

          if (!to || !subject || !html) {
            throw new Error("Missing required email fields: to, subject, html");
          }

          await sendEmail({ to, subject, html, text });
          console.info("[outbox][email] sent", { to, subject });
        }

        item.status = "DONE";
        item.lastError = null;
        await item.save();
        console.info("[outbox] item done", { id: item._id, type: item.type });
      } catch (procErr) {
        const attempts = (item.attempts || 0) + 1;
        const baseBackoff = Math.min(
          60 * 60 * 1000,
          Math.pow(2, attempts) * 1000,
        );
        const backoffMs = jitter(baseBackoff);
        item.attempts = attempts;
        item.nextAttemptAt = new Date(Date.now() + backoffMs);
        item.lastError =
          (procErr as any)?.stack ||
          (procErr as any)?.message ||
          String(procErr);
        item.status = attempts >= MAX_ATTEMPTS ? "FAILED" : "PENDING";
        await item.save();
        console.warn("[outbox] item failed, scheduled retry", {
          id: item._id,
          attempts: item.attempts,
          nextAttemptAt: item.nextAttemptAt,
          error: item.lastError,
        });
      }
    } catch (error) {
      // Top-level worker error — log and continue
      console.error("Outbox worker error:", error);
    }
  };

  const interval = setInterval(tick, POLL_INTERVAL_MS);

  // Return a shutdown function
  return () => clearInterval(interval);
};

export default startOutboxWorker;
