/**
 * WhatsApp Cloud API webhook.
 *
 * Mounted at /api/whatsapp/webhook (see app.ts).
 *
 *   GET  - Meta's one-time handshake when the callback URL is saved in the
 *          dashboard: echo `hub.challenge` if `hub.verify_token` matches ours.
 *   POST - every inbound message and delivery status. The signature is checked
 *          against the raw body, the request is acknowledged straight away
 *          (Meta retries anything slower than a few seconds), and the messages
 *          are handled after the response.
 *
 * Every env var below is optional: with none set the route answers 503 and the
 * rest of the API is unaffected.
 *
 *   WHATSAPP_VERIFY_TOKEN       any string; paste the same one into the dashboard
 *   META_APP_SECRET             App settings > Basic > App secret
 *   WHATSAPP_ACCESS_TOKEN       system-user token, needed to send replies
 *   WHATSAPP_PHONE_NUMBER_ID    the sending number's id, needed to send replies
 */
import crypto from "crypto";
import express from "express";
import {
  extractInboundMessages,
  isValidMetaSignature,
  markWhatsAppRead,
  maskPhone,
  sendWhatsAppText,
  whatsappSendingConfigured,
  type InboundWhatsAppMessage,
} from "../services/whatsappService";
import { log as __rootLog } from "../../utils/logger";

const log = __rootLog.child("whatsappWebhook");

const router = express.Router();

// Meta redelivers a message it didn't see acknowledged in time. A bounded
// in-memory set drops the immediate repeats on this instance; it is not shared
// across instances, so a repeat landing on another one can still get through.
const SEEN_LIMIT = 5000;
const seenMessageIds = new Set<string>();

function alreadySeen(id: string): boolean {
  if (seenMessageIds.has(id)) return true;
  seenMessageIds.add(id);
  if (seenMessageIds.size > SEEN_LIMIT) {
    const oldest = seenMessageIds.values().next().value;
    if (oldest !== undefined) seenMessageIds.delete(oldest);
  }
  return false;
}

const HOLDING_REPLY =
  "Hi, this is PowerMySport. Our WhatsApp assistant is still being set up, so I can't answer properly yet. You can ask the same question on powermysport.com/ask in the meantime.";

async function handleInboundMessage(message: InboundWhatsAppMessage): Promise<void> {
  // Phone number and message body are personal data about a parent and child,
  // so only the type and a masked number are logged.
  log.info(`inbound ${message.type} from ${maskPhone(message.from)}`);
  if (!whatsappSendingConfigured()) return;

  await markWhatsAppRead(message.id);
  await sendWhatsAppText(message.from, HOLDING_REPLY);
}

router.get("/webhook", (req, res) => {
  const expected = process.env.WHATSAPP_VERIFY_TOKEN;
  if (!expected) {
    log.error("WHATSAPP_VERIFY_TOKEN not configured");
    return res.status(503).send("not configured");
  }

  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  const a = Buffer.from(String(token ?? ""), "utf8");
  const b = Buffer.from(expected, "utf8");
  const tokenOk = a.length === b.length && crypto.timingSafeEqual(a, b);

  if (mode === "subscribe" && tokenOk && typeof challenge === "string") {
    return res.status(200).type("text/plain").send(challenge);
  }
  log.warn("webhook verification rejected");
  return res.sendStatus(403);
});

router.post("/webhook", (req, res) => {
  const secret = process.env.META_APP_SECRET;
  if (!secret) {
    log.error("META_APP_SECRET not configured");
    return res.status(503).send("not configured");
  }

  // Set by the express.json `verify` hook in app.ts.
  const rawBody = (req as unknown as { rawBody?: string }).rawBody;
  if (!rawBody) return res.status(400).send("raw body required");

  const signature = req.headers["x-hub-signature-256"] as string | undefined;
  if (!isValidMetaSignature(rawBody, signature, secret)) {
    log.warn("webhook signature mismatch");
    return res.status(401).send("invalid signature");
  }

  res.sendStatus(200);

  const messages = extractInboundMessages(req.body).filter((m) => !alreadySeen(m.id));
  for (const message of messages) {
    handleInboundMessage(message).catch((err) => {
      log.error(`failed to handle message ${message.id}`, err);
    });
  }
});

export default router;
