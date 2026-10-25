import redis from "../../config/redis";
import { normalizeIndianPhone } from "./WhatsAppNotificationService";

/**
 * Small pieces the WhatsApp webhook needs to run as a pilot: who may talk to the
 * assistant, not answering the same message twice, and the words that mean "stop".
 */

// ─── Who may talk to the assistant ────────────────────────────────────────────

/**
 * The numbers named in `WHATSAPP_ALLOWED_NUMBERS`, a comma-separated list in any
 * common form ("9876543210", "+91 98765 43210"), as Meta's 12-digit form.
 */
export function parseAllowList(raw: string | undefined): Set<string> {
  const numbers = (raw ?? "")
    .split(",")
    .map((entry) => normalizeIndianPhone(entry.trim()))
    .filter((digits) => digits.length >= 10);
  return new Set(numbers);
}

/**
 * Whether `from` (a sender number as Meta gives it) is on the
 * `WHATSAPP_ALLOWED_NUMBERS` list. That list is a fixed fallback for the team; the
 * numbers staff manage from the admin panel live in the database (see
 * `mayUseAssistant`).
 */
export function isOnEnvList(from: string, raw = process.env.WHATSAPP_ALLOWED_NUMBERS): boolean {
  return parseAllowList(raw).has(normalizeIndianPhone(from));
}

// ─── Not answering twice ──────────────────────────────────────────────────────

// Meta redelivers a message it did not see acknowledged in time. A claim in Redis
// is shared by every instance, so a repeat landing on another one is still caught.
// When Redis is unreachable it falls back to a bounded set in this process, which
// only catches repeats that reach the same instance.
const CLAIM_TTL_SECONDS = 60 * 60 * 48;
const LOCAL_LIMIT = 5000;
const localSeen = new Set<string>();

function claimLocally(id: string): boolean {
  if (localSeen.has(id)) return false;
  localSeen.add(id);
  if (localSeen.size > LOCAL_LIMIT) {
    const oldest = localSeen.values().next().value;
    if (oldest !== undefined) localSeen.delete(oldest);
  }
  return true;
}

/** True the first time a message id is seen, false for every repeat. */
export async function claimInboundMessage(id: string): Promise<boolean> {
  try {
    const result = await redis.set(`whatsapp:inbound:${id}`, "1", "EX", CLAIM_TTL_SECONDS, "NX");
    return result === "OK";
  } catch {
    return claimLocally(id);
  }
}

// ─── Stopping ─────────────────────────────────────────────────────────────────

const OPT_OUT_WORDS = new Set([
  "stop",
  "unsubscribe",
  "delete",
  "delete my data",
  "delete my chat",
  "forget me",
]);

/** A message that is, in full, a request to stop and have the chat deleted. */
export function isOptOutMessage(text: string | null | undefined): boolean {
  const cleaned = (text ?? "")
    .toLowerCase()
    .replace(/[^a-z ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return OPT_OUT_WORDS.has(cleaned);
}

/** First message from a number that is not on an account: it also says what is remembered. */
export const FIRST_CONTACT_NOTICE =
  "Hi, I'm PowerMySport's AI assistant. Ask me anything about youth sports: tournaments, pathways, experts or choosing a sport. If you tell me about your child, I'll remember the basics (first name, age, sport, goal) so you don't have to repeat them. I keep this chat for 90 days and these notes for a year. Our team can read your questions and my answers for up to 6 months, so we can improve PowerMySport. Say \"what do you remember\" to see them, \"forget\" to remove them, or STOP to delete everything.";

/** First message from a number on an account: nothing is noted, the account is what is read. */
export const FIRST_CONTACT_NOTICE_MEMBER =
  "Hi, I'm PowerMySport's AI assistant. I can see the children on your PowerMySport account, so ask me about tournaments, your plan, rankings or experts. If you tell me about a child who is not on it yet, I can note the basics and send a link to add them. I keep this chat for 90 days and any notes for a year. Our team can read your questions and my answers for up to 6 months, so we can improve PowerMySport. Send STOP at any time and I will delete everything.";

export const OPT_OUT_REPLY =
  "Done. I have deleted this chat and anything I had noted about your children, and I will not message you again unless you write to us. You can start a new chat any time.";

export const PILOT_REPLY =
  "Hi, this is PowerMySport. Our WhatsApp assistant is being tested with a small group for now. You can ask the same question on https://powermysport.com/ask in the meantime.";
