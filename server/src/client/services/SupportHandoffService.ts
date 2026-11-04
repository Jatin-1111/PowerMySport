import mongoose from "mongoose";
import { sendSupportTicketReceivedEmail } from "../../utils/email";
import { log as __rootLog } from "../../utils/logger";
import { SupportTicket } from "../models/SupportTicket";

const log = __rootLog.child("supportHandoff");

/**
 * Passing a parent's question from the assistant to the PowerMySport team as a support ticket.
 *
 * The assistant can look things up and cannot act for a parent, so this is the one way a chat
 * reaches a person. It is deliberately narrow: nothing is created until the parent has given a
 * name and an email and agreed, the email must look like one, and the same email cannot raise a
 * second request within the hour. The team replies by email, which is why an email is required
 * (a WhatsApp number is never handed to a tool, by design).
 *
 * Only what the parent said they want is stored, in their own words. The chat itself is not
 * copied into the ticket.
 */

export const HANDOFF_SUBJECT_PREFIX = "Assistant chat: ";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const ONE_HOUR_MS = 60 * 60 * 1000;
const MAX_NAME = 80;
const MAX_SUMMARY = 600;

export type HandoffRefusal =
  "not_agreed" | "missing_name" | "invalid_email" | "missing_summary" | "already_sent";

export type HandoffResult = { ok: true; ticketId: string } | { ok: false; reason: HandoffRefusal };

export interface HandoffInput {
  name: unknown;
  email: unknown;
  summary: unknown;
  parentAgreed: unknown;
  /** Set when the parent is signed in, so the ticket sits on their account. */
  userId?: string | undefined;
}

export interface HandoffDeps {
  now?: () => Date;
  sendReceipt?: typeof sendSupportTicketReceivedEmail;
}

/** Text from a model or a parent, made safe to store: no control characters, trimmed, capped. */
const clean = (value: unknown, max: number): string =>
  typeof value === "string"
    ? value
        .replace(/[\u0000-\u001f\u007f]+/g, " ")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, max)
    : "";

export async function createHandoffTicket(
  input: HandoffInput,
  deps: HandoffDeps = {}
): Promise<HandoffResult> {
  const now = (deps.now ?? (() => new Date()))();

  // A model decides when to call this, so the agreement is checked here and not trusted to it.
  if (input.parentAgreed !== true) return { ok: false, reason: "not_agreed" };

  const name = clean(input.name, MAX_NAME);
  if (!name) return { ok: false, reason: "missing_name" };

  const email = clean(input.email, 254).toLowerCase();
  if (!EMAIL.test(email)) return { ok: false, reason: "invalid_email" };

  const summary = clean(input.summary, MAX_SUMMARY);
  if (!summary) return { ok: false, reason: "missing_summary" };

  const recent = await SupportTicket.findOne({
    requesterEmail: email,
    subject: { $regex: `^${HANDOFF_SUBJECT_PREFIX}` },
    createdAt: { $gte: new Date(now.getTime() - ONE_HOUR_MS) },
  })
    .select("_id")
    .lean();
  if (recent) return { ok: false, reason: "already_sent" };

  const ticket = await SupportTicket.create({
    ...(input.userId && mongoose.isValidObjectId(input.userId)
      ? { userId: new mongoose.Types.ObjectId(input.userId) }
      : {}),
    requesterName: name,
    requesterEmail: email,
    requesterType: "other",
    subject: `${HANDOFF_SUBJECT_PREFIX}${summary.slice(0, 80)}`,
    description: `${summary}\n\nSent by the parent through the PowerMySport assistant chat. They gave this email in the chat and agreed to be contacted on it.`,
    category: "OTHER",
    priority: "MEDIUM",
    notes: [],
  });

  // Acknowledge by email, as the contact form does. A failure here must not undo the request.
  void (async () => {
    try {
      await (deps.sendReceipt ?? sendSupportTicketReceivedEmail)({
        name,
        email,
        ticketId: String(ticket._id),
        subject: ticket.subject,
        category: ticket.category,
      });
    } catch (error) {
      log.error("could not send the receipt for an assistant hand-off", error);
    }
  })();

  return { ok: true, ticketId: String(ticket._id) };
}
