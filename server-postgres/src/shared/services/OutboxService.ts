import { reconcileBookingPaymentFromWebhookPayload } from "../../client/services/BookingService";
import { reconcileCoachSubscriptionPaymentFromWebhookPayload } from "../../client/services/CoachSubscriptionPaymentService";
import { reconcileExpertSessionPaymentFromWebhookPayload } from "../../client/services/ExpertsService";
import { NotificationService } from "../../client/services/NotificationService";
import { reconcileEcommerceOrderFromWebhookPayload } from "../../shop/services/EcommerceService";
import { sendEmail } from "../../utils/email";
import prisma from "../../lib/prisma";

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

      // Atomically claim the next due PENDING message (PENDING -> PROCESSING).
      // Mongo used findOneAndUpdate with sort; Prisma has no atomic
      // find-and-update, so we do it inside a transaction: read the oldest due
      // item, then conditionally flip its status. updateMany's count tells us
      // whether we won the race (important once multiple workers run).
      const item = await prisma.$transaction(async (tx) => {
        const candidate = await tx.outboxMessage.findFirst({
          where: { status: "PENDING", nextAttemptAt: { lte: now } },
          orderBy: { nextAttemptAt: "asc" },
        });
        if (!candidate) return null;

        const claimed = await tx.outboxMessage.updateMany({
          where: { id: candidate.id, status: "PENDING" },
          data: { status: "PROCESSING" },
        });
        if (claimed.count === 0) return null; // lost the race
        return { ...candidate, status: "PROCESSING" as const };
      });

      if (!item) return;

      try {
        if (item.type === "deliver_message") {
          const payload = (item.payload as any) || {};
          const participantIds: string[] = payload.participantIds || [];

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
          const payload = (item.payload as any) || {};
          const eventId: string = payload.eventId;
          if (!eventId) {
            throw new Error("Missing eventId for payment webhook processing");
          }

          const event = await prisma.paymentWebhookEvent.findUnique({
            where: { eventId },
          });
          if (!event) {
            throw new Error(`PaymentWebhookEvent not found: ${eventId}`);
          }

          if (event.status === "DONE") {
            // already processed
          } else {
            await prisma.paymentWebhookEvent.update({
              where: { eventId },
              data: { status: "PROCESSING" },
            });

            try {
              await reconcileCoachSubscriptionPaymentFromWebhookPayload(
                event.payload,
              );
              await reconcileBookingPaymentFromWebhookPayload(event.payload);
              await reconcileEcommerceOrderFromWebhookPayload(event.payload);
              await reconcileExpertSessionPaymentFromWebhookPayload(
                event.payload,
              );

              await prisma.paymentWebhookEvent.update({
                where: { eventId },
                data: {
                  status: "DONE",
                  processedAt: new Date(),
                  lastError: null,
                },
              });
              console.info("[outbox][payment] processed", { eventId });
            } catch (procErr) {
              await prisma.paymentWebhookEvent
                .update({
                  where: { eventId },
                  data: {
                    status: "FAILED",
                    lastError:
                      (procErr as any)?.stack ||
                      (procErr as any)?.message ||
                      String(procErr),
                  },
                })
                .catch(() => undefined);

              console.error("[outbox][payment] processing failed", {
                eventId,
                error: (procErr as any)?.stack || String(procErr),
              });
              throw procErr;
            }
          }
        } else if (item.type === "send_email") {
          const payload = (item.payload as any) || {};
          const { to, subject, html, text } = payload;

          if (!to || !subject || !html) {
            throw new Error("Missing required email fields: to, subject, html");
          }

          await sendEmail({ to, subject, html, text });
          console.info("[outbox][email] sent", { to, subject });
        }

        await prisma.outboxMessage.update({
          where: { id: item.id },
          data: { status: "DONE", lastError: null },
        });
        console.info("[outbox] item done", { id: item.id, type: item.type });
      } catch (procErr) {
        const attempts = (item.attempts || 0) + 1;
        const baseBackoff = Math.min(
          60 * 60 * 1000,
          Math.pow(2, attempts) * 1000,
        );
        const backoffMs = jitter(baseBackoff);
        const nextAttemptAt = new Date(Date.now() + backoffMs);
        const lastError =
          (procErr as any)?.stack ||
          (procErr as any)?.message ||
          String(procErr);
        await prisma.outboxMessage.update({
          where: { id: item.id },
          data: {
            attempts,
            nextAttemptAt,
            lastError,
            status: attempts >= MAX_ATTEMPTS ? "FAILED" : "PENDING",
          },
        });
        console.warn("[outbox] item failed, scheduled retry", {
          id: item.id,
          attempts,
          nextAttemptAt,
          error: lastError,
        });
      }
    } catch (error) {
      console.error("Outbox worker error:", error);
    }
  };

  const interval = setInterval(tick, POLL_INTERVAL_MS);

  return () => clearInterval(interval);
};

export default startOutboxWorker;
