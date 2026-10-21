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
 *   WHATSAPP_ASSISTANT          "on" answers with the real assistant; anything
 *                               else sends the fixed holding message
 *   WHATSAPP_ALLOWED_NUMBERS    optional, comma-separated fallback list for the
 *                               team. Numbers staff add in the admin panel live in
 *                               the database; either way, anyone not listed gets a
 *                               short "being tested" message (unless the panel is
 *                               set to "everyone")
 */
import crypto from "crypto";
import express from "express";
import { answerWhatsAppMessage } from "../services/whatsappAssistantService";
import { FIRST_CONTACT_NOTICE, PILOT_REPLY, claimInboundMessage } from "../services/whatsappPilot";
import { mayUseAssistant } from "../services/whatsappPilotNumbers";
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

const HOLDING_REPLY =
  "Hi, this is PowerMySport. Our WhatsApp assistant is still being set up, so I can't answer properly yet. You can ask the same question on powermysport.com/ask in the meantime.";

async function handleInboundMessage(message: InboundWhatsAppMessage): Promise<void> {
  // Phone number and message body are personal data about a parent and child,
  // so only the type and a masked number are logged.
  log.info(`inbound ${message.type} from ${maskPhone(message.from)}`);
  if (!whatsappSendingConfigured()) return;

  await markWhatsAppRead(message.id);

  if (process.env.WHATSAPP_ASSISTANT !== "on") {
    await sendWhatsAppText(message.from, HOLDING_REPLY);
    return;
  }
  // A pilot is limited to the numbers staff listed (admin panel or
  // WHATSAPP_ALLOWED_NUMBERS); anyone else is told so and nothing of theirs is stored.
  if (!(await mayUseAssistant(message.from))) {
    await sendWhatsAppText(message.from, PILOT_REPLY);
    return;
  }

  const answer = await answerWhatsAppMessage(message);
  // First time we hear from this number: say what this is and how to stop it,
  // before the answer, as its own message.
  if (answer.firstContact) await sendWhatsAppText(message.from, FIRST_CONTACT_NOTICE);
  await sendWhatsAppText(message.from, answer.reply);
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

  for (const message of extractInboundMessages(req.body)) {
    // Claimed before handling, so a redelivery that arrives while the first copy is
    // still being answered is dropped too.
    claimInboundMessage(message.id)
      .then((first) => (first ? handleInboundMessage(message) : undefined))
      .catch((err) => {
        log.error(`failed to handle message ${message.id}`, err);
      });
  }
});

export default router;
