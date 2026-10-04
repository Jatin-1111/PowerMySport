import crypto from "crypto";
import { log as __rootLog } from "../../utils/logger";

const log = __rootLog.child("whatsapp");

const GRAPH_VERSION = "v25.0";

export interface InboundWhatsAppMessage {
  /** Meta's id for the message (wamid...), the key for de-duplicating redeliveries. */
  id: string;
  /** Sender's number in international format without "+", e.g. "919876543210". */
  from: string;
  type: string;
  /** Present for text messages, and for the title of a tapped button or list row. */
  text: string | null;
}

/**
 * Checks Meta's `X-Hub-Signature-256` header (`sha256=<hex>`) against the raw
 * request body, keyed with the app secret. Anyone can POST to a public webhook
 * URL, so this is the only thing that proves a request came from Meta.
 */
export function isValidMetaSignature(
  rawBody: string,
  header: string | undefined,
  appSecret: string
): boolean {
  if (!header || !header.startsWith("sha256=")) return false;
  const expected = crypto.createHmac("sha256", appSecret).update(rawBody, "utf8").digest("hex");
  const given = header.slice("sha256=".length).trim();
  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(given, "utf8");
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

/**
 * Pulls the user messages out of a webhook payload. Status updates (sent,
 * delivered, read) share the same envelope but carry no `messages`, so they
 * yield nothing here.
 */
export function extractInboundMessages(payload: unknown): InboundWhatsAppMessage[] {
  const out: InboundWhatsAppMessage[] = [];
  const entries = (payload as { entry?: unknown[] } | null)?.entry;
  if (!Array.isArray(entries)) return out;

  for (const entry of entries) {
    const changes = (entry as { changes?: unknown[] })?.changes;
    if (!Array.isArray(changes)) continue;
    for (const change of changes) {
      const value = (change as { value?: { messages?: unknown[] } })?.value;
      if (!Array.isArray(value?.messages)) continue;
      for (const raw of value.messages) {
        const m = raw as {
          id?: string;
          from?: string;
          type?: string;
          text?: { body?: string };
          interactive?: {
            button_reply?: { title?: string };
            list_reply?: { title?: string };
          };
        };
        if (!m.id || !m.from || !m.type) continue;
        const text =
          m.text?.body ??
          m.interactive?.button_reply?.title ??
          m.interactive?.list_reply?.title ??
          null;
        out.push({ id: m.id, from: m.from, type: m.type, text });
      }
    }
  }
  return out;
}

/** "919876543210" -> "91*******10", so a phone number never lands in the logs whole. */
export function maskPhone(phone: string): string {
  if (phone.length <= 4) return "****";
  return `${phone.slice(0, 2)}${"*".repeat(phone.length - 4)}${phone.slice(-2)}`;
}

/** Replies are sent only when the token and phone-number id are both configured. */
export function whatsappSendingConfigured(): boolean {
  return Boolean(process.env.WHATSAPP_ACCESS_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID);
}

async function graphPost(body: Record<string, unknown>): Promise<boolean> {
  const token = process.env.WHATSAPP_ACCESS_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  if (!token || !phoneNumberId) return false;

  const res = await fetch(`https://graph.facebook.com/${GRAPH_VERSION}/${phoneNumberId}/messages`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ messaging_product: "whatsapp", ...body }),
  });
  if (!res.ok) {
    // Meta's error body names the problem (expired token, number not on the
    // test recipient list, outside the 24h window) and carries no user data.
    log.error(`Graph API ${res.status}: ${(await res.text()).slice(0, 300)}`);
    return false;
  }
  return true;
}

export function sendWhatsAppText(to: string, body: string): Promise<boolean> {
  return graphPost({ to, type: "text", text: { body } });
}

/** Shows the blue ticks and a typing cue while the reply is being worked out. */
export function markWhatsAppRead(messageId: string): Promise<boolean> {
  return graphPost({ status: "read", message_id: messageId });
}
