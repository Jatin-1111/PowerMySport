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
  /** The id of the button or list row the parent tapped, when they tapped one. */
  replyId?: string | null;
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
            button_reply?: { id?: string; title?: string };
            list_reply?: { id?: string; title?: string };
          };
        };
        if (!m.id || !m.from || !m.type) continue;
        const text =
          m.text?.body ??
          m.interactive?.button_reply?.title ??
          m.interactive?.list_reply?.title ??
          null;
        const replyId = m.interactive?.button_reply?.id ?? m.interactive?.list_reply?.id ?? null;
        out.push({ id: m.id, from: m.from, type: m.type, text, replyId });
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

// ─── Interactive messages ─────────────────────────────────────────────────────
//
// Allowed without a template while the parent's last message is under 24 hours old, which is
// always true when we are answering one. Each falls back to plain text if Meta refuses it (an old
// client, a limit exceeded), so a parent never gets silence because a button would not render.

export interface InteractiveRow {
  id: string;
  title: string;
  description?: string;
}

/** Up to three tappable answers under a short message. */
export async function sendWhatsAppButtons(
  to: string,
  body: string,
  buttons: Array<{ id: string; title: string }>
): Promise<boolean> {
  const sent = await graphPost({
    to,
    type: "interactive",
    interactive: {
      type: "button",
      body: { text: body },
      action: {
        buttons: buttons.slice(0, 3).map((b) => ({
          type: "reply",
          reply: { id: b.id, title: b.title.slice(0, 20) },
        })),
      },
    },
  });
  return sent || sendWhatsAppText(to, `${body}\n\n${buttons.map((b) => b.title).join(" / ")}`);
}

/** A list of up to ten rows behind one button, for a menu. */
export async function sendWhatsAppList(
  to: string,
  body: string,
  buttonLabel: string,
  rows: InteractiveRow[]
): Promise<boolean> {
  const sent = await graphPost({
    to,
    type: "interactive",
    interactive: {
      type: "list",
      body: { text: body },
      action: {
        button: buttonLabel.slice(0, 20),
        sections: [
          {
            rows: rows.slice(0, 10).map((r) => ({
              id: r.id,
              title: r.title.slice(0, 24),
              ...(r.description ? { description: r.description.slice(0, 72) } : {}),
            })),
          },
        ],
      },
    },
  });
  return sent || sendWhatsAppText(to, `${body}\n\n${rows.map((r) => `• ${r.title}`).join("\n")}`);
}

/** A message with one button that opens a web page, instead of a long bare link. */
export async function sendWhatsAppLinkButton(
  to: string,
  body: string,
  label: string,
  url: string
): Promise<boolean> {
  const sent = await graphPost({
    to,
    type: "interactive",
    interactive: {
      type: "cta_url",
      body: { text: body },
      action: { name: "cta_url", parameters: { display_text: label.slice(0, 20), url } },
    },
  });
  return sent || sendWhatsAppText(to, `${body}\n${url}`);
}

/**
 * Sends an approved message template. Templates are the only way to message
 * someone first, outside the 24-hour window, and Meta rejects the call if the
 * template name, language or number of body parameters does not match what was
 * approved.
 */
export function sendWhatsAppTemplate(
  to: string,
  name: string,
  bodyParams: string[],
  language = "en"
): Promise<boolean> {
  return graphPost({
    to,
    type: "template",
    template: {
      name,
      language: { code: language },
      components: bodyParams.length
        ? [{ type: "body", parameters: bodyParams.map((text) => ({ type: "text", text })) }]
        : [],
    },
  });
}

/** Shows the blue ticks and a typing cue while the reply is being worked out. */
export function markWhatsAppRead(messageId: string): Promise<boolean> {
  return graphPost({ status: "read", message_id: messageId });
}
