import crypto from "crypto";
import { log as __rootLog } from "../../utils/logger";

const log = __rootLog.child("whatsapp");

const GRAPH_VERSION = "v25.0";

import type { InboundMedia } from "./whatsappMedia";

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
  /** A voice note or photo the parent sent. Read into text by the assistant before answering. */
  media?: InboundMedia;
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

/** What Meta reports about a message we sent: sent, delivered, read, or failed with a reason. */
export interface DeliveryStatus {
  /** Meta's id for the message, the same one the send logged when Meta accepted it. */
  id: string;
  status: string;
  /** The recipient's number, as Meta gives it. Mask it before logging. */
  recipient: string;
  /** Present only when status is "failed". */
  error?: {
    code?: number | undefined;
    title?: string | undefined;
    detail?: string | undefined;
  };
}

/**
 * Pulls the delivery results out of a webhook payload. Meta accepts a message
 * and only later says whether it arrived, so a send that Meta took without
 * complaint can still fail here (the recipient is not on WhatsApp, the account
 * has no payment method, a frequency cap was hit), and this is the only place
 * that is reported.
 */
export function extractDeliveryStatuses(payload: unknown): DeliveryStatus[] {
  const out: DeliveryStatus[] = [];
  const entries = (payload as { entry?: unknown[] } | null)?.entry;
  if (!Array.isArray(entries)) return out;

  for (const entry of entries) {
    const changes = (entry as { changes?: unknown[] })?.changes;
    if (!Array.isArray(changes)) continue;
    for (const change of changes) {
      const statuses = (change as { value?: { statuses?: unknown[] } })?.value?.statuses;
      if (!Array.isArray(statuses)) continue;
      for (const raw of statuses) {
        const s = raw as {
          id?: string;
          status?: string;
          recipient_id?: string;
          errors?: Array<{
            code?: number;
            title?: string;
            message?: string;
            error_data?: { details?: string };
          }>;
        };
        if (!s.id || !s.status) continue;
        const first = s.errors?.[0];
        out.push({
          id: s.id,
          status: s.status,
          recipient: s.recipient_id ?? "",
          ...(first
            ? {
                error: {
                  code: first.code,
                  title: first.title,
                  detail: first.error_data?.details ?? first.message,
                },
              }
            : {}),
        });
      }
    }
  }
  return out;
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
          audio?: { id?: string; mime_type?: string };
          image?: { id?: string; mime_type?: string; caption?: string };
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
          // A photo's caption is the parent's own words; the photo itself is in `media`.
          m.image?.caption ??
          null;
        const replyId = m.interactive?.button_reply?.id ?? m.interactive?.list_reply?.id ?? null;
        const media: InboundMedia | undefined =
          m.type === "audio" && m.audio?.id
            ? { kind: "audio", id: m.audio.id, mimeType: m.audio.mime_type }
            : m.type === "image" && m.image?.id
              ? {
                  kind: "image",
                  id: m.image.id,
                  mimeType: m.image.mime_type,
                  caption: m.image.caption ?? null,
                }
              : undefined;
        out.push({
          id: m.id,
          from: m.from,
          type: m.type,
          text,
          replyId,
          ...(media ? { media } : {}),
        });
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
  // Meta's id for the message: the delivery result in the webhook carries the same
  // one, so this is what ties "accepted" to "delivered" or "failed" in the logs.
  let id: string | undefined;
  try {
    id = ((await res.json()) as { messages?: Array<{ id?: string }> } | null)?.messages?.[0]?.id;
  } catch {
    // The message is sent either way; the id is only for the log.
  }
  if (id) {
    const template = (body.template as { name?: string } | undefined)?.name;
    log.info("Graph API accepted a message", {
      id,
      type: body.type,
      ...(template ? { template } : {}),
      ...(typeof body.to === "string" ? { to: maskPhone(body.to) } : {}),
    });
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
