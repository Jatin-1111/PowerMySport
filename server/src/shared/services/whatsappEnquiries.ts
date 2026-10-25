import crypto from "crypto";
import {
  ASSISTANCE_KINDS,
  ENQUIRY_FEEDBACK,
  ENQUIRY_IDLE_MS,
  WhatsAppEnquiry,
  type AssistanceKind,
  type EnquiryFeedback,
  type WhatsAppEnquiryDocument,
} from "../../client/models/WhatsAppEnquiry";
import { encryptValue } from "../utils/encryption";

/**
 * Keeping a record of each parent question for the pilot review.
 *
 * Everything the model passes is untrusted text that the admin screen will later show to staff,
 * so each field is cut down to a plain, short value here, once. Capture is a side effect of
 * answering: callers wrap it so a failure here never costs a parent their reply.
 */

const MAX_QUESTION = 500;
const MAX_GUIDANCE = 2000;

/** Plain words only: no links, markup, line breaks or runs of spaces. */
function plain(value: unknown, max: number): string | undefined {
  if (typeof value !== "string") return undefined;
  const text = value
    .replace(/https?:\/\/\S+/gi, " ")
    .replace(/[<>{}[\]\\`]/g, " ")
    .replace(/[\r\n\t]+/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim()
    .slice(0, max);
  return text || undefined;
}

const cleanAge = (value: unknown): number | undefined => {
  const age = typeof value === "number" ? value : Number(value);
  return Number.isInteger(age) && age >= 3 && age <= 21 ? age : undefined;
};

const cleanAssistance = (value: unknown): AssistanceKind[] => {
  const list = Array.isArray(value) ? value : typeof value === "string" ? [value] : [];
  const kinds = list
    .map((v) => (typeof v === "string" ? v.trim().toLowerCase() : ""))
    .filter((v): v is AssistanceKind => (ASSISTANCE_KINDS as readonly string[]).includes(v));
  return [...new Set(kinds)];
};

/** A short pseudonym of the hashed number, so the admin can tell parents apart without a number. */
export function parentRefFor(phoneHash: string): string {
  return crypto.createHash("sha256").update(`parent-ref:${phoneHash}`).digest("hex").slice(0, 8);
}

// No 0/O or 1/I, so a reference read out over the phone is not misheard.
const REF_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function newReference(): string {
  const bytes = crypto.randomBytes(5);
  let out = "";
  for (const b of bytes) out += REF_ALPHABET[b % REF_ALPHABET.length];
  return `PMS-${out}`;
}

/**
 * The topic this number is on right now: the newest enquiry that is still open and was touched
 * within a day. Otherwise a new one, opened with `question` (the parent's message) as its start.
 */
export async function currentEnquiry(
  phoneHash: string,
  question: string,
  now: Date = new Date(),
  touchedSince?: Date
): Promise<WhatsAppEnquiryDocument> {
  const idleCutoff = new Date(now.getTime() - ENQUIRY_IDLE_MS);
  // `touchedSince` lets the end of a turn find the topic the parent just closed in that same
  // turn, instead of opening a new one for their "thanks".
  const recent = await WhatsAppEnquiry.findOne({
    phoneHash,
    $or: [
      { closed: false, lastMessageAt: { $gte: idleCutoff } },
      ...(touchedSince ? [{ lastMessageAt: { $gte: touchedSince } }] : []),
    ],
  }).sort({ lastMessageAt: -1 });
  if (recent) return recent;

  return WhatsAppEnquiry.create({
    phoneHash,
    parentRef: parentRefFor(phoneHash),
    reference: newReference(),
    question: plain(question, MAX_QUESTION) ?? "(no text)",
    lastMessageAt: now,
  });
}

export interface EnquiryFields {
  childAge?: unknown;
  sport?: unknown;
  level?: unknown;
  objective?: unknown;
  assistance?: unknown;
  feedback?: unknown;
  closed?: unknown;
}

/**
 * Sets what the parent has said on the current topic. A field that is absent or unusable is left
 * as it was, so a later turn that mentions only the level does not wipe the sport.
 */
export async function updateEnquiry(
  phoneHash: string,
  question: string,
  fields: EnquiryFields,
  now: Date = new Date()
): Promise<WhatsAppEnquiryDocument> {
  const enquiry = await currentEnquiry(phoneHash, question, now);

  const age = cleanAge(fields.childAge);
  if (age !== undefined) enquiry.childAge = age;
  const sport = plain(fields.sport, 40);
  if (sport) enquiry.sport = sport;
  const level = plain(fields.level, 60);
  if (level) enquiry.level = level;
  const objective = plain(fields.objective, 240);
  if (objective) enquiry.objective = objective;

  const kinds = cleanAssistance(fields.assistance);
  if (kinds.length > 0) enquiry.assistance = [...new Set([...enquiry.assistance, ...kinds])];

  if (
    typeof fields.feedback === "string" &&
    (ENQUIRY_FEEDBACK as readonly string[]).includes(fields.feedback)
  ) {
    enquiry.feedback = fields.feedback as EnquiryFeedback;
  }
  if (fields.closed === true) enquiry.closed = true;

  enquiry.lastMessageAt = now;
  await enquiry.save();
  return enquiry;
}

/**
 * Called once per turn with what was sent and what was answered. It keeps the latest guidance and
 * the count, and opens the enquiry if the assistant did not need to record anything this turn.
 */
export async function recordTurn(
  phoneHash: string,
  userMessage: string,
  reply: string,
  turnStartedAt: Date,
  now: Date = new Date()
): Promise<void> {
  const enquiry = await currentEnquiry(phoneHash, userMessage, now, turnStartedAt);
  await WhatsAppEnquiry.updateOne(
    { _id: enquiry._id },
    {
      $set: { guidance: reply.slice(0, MAX_GUIDANCE), lastMessageAt: now },
      $inc: { turnCount: 1 },
    }
  );
}

/** The parent asked for a person: mark the topic as needing follow-up and return its reference. */
export async function markFollowUpRequested(
  phoneHash: string,
  question: string,
  details: { summary: unknown; ticketId?: string | undefined }
): Promise<string> {
  const enquiry = await currentEnquiry(phoneHash, question);
  const summary = plain(details.summary, 600);
  enquiry.assistance = [...new Set([...enquiry.assistance, "team" as AssistanceKind])];
  enquiry.followUpStatus = "new";
  if (summary) enquiry.followUpSummary = summary;
  if (details.ticketId) enquiry.ticketId = details.ticketId.slice(0, 40);
  enquiry.lastMessageAt = new Date();
  await enquiry.save();
  return enquiry.reference;
}

export interface FollowUpResult {
  reference: string;
  /** True when this kind of help had already been asked for on this topic, so nothing changed. */
  alreadyRequested: boolean;
}

/**
 * The parent wants the team to get back to them on WhatsApp: a coach or academy, an expert, or
 * just a person. Marks the current topic as waiting for the team. Asking again for the same kind
 * of help on the same topic changes nothing and returns the same reference, so a parent who taps
 * twice is not entered twice. The number itself is kept by `attachContactNumber`, which the
 * webhook layer calls, because only it has the number.
 */
export async function requestFollowUp(
  phoneHash: string,
  question: string,
  details: { kind: AssistanceKind; summary?: unknown }
): Promise<FollowUpResult> {
  const enquiry = await currentEnquiry(phoneHash, question);
  if (enquiry.followUpStatus === "new" && enquiry.assistance.includes(details.kind)) {
    return { reference: enquiry.reference, alreadyRequested: true };
  }

  const summary = plain(details.summary, 600);
  enquiry.assistance = [...new Set([...enquiry.assistance, details.kind])];
  enquiry.followUpStatus = "new";
  if (summary) enquiry.followUpSummary = summary;
  enquiry.lastMessageAt = new Date();
  await enquiry.save();
  return { reference: enquiry.reference, alreadyRequested: false };
}

/**
 * Keeps the number, encrypted, on the topic where the parent asked for a person, so the team can
 * reach them. Called by the webhook layer, which has the number; the model never does. Does
 * nothing for a topic with no follow-up request, so the number is not kept for anyone else.
 */
export async function attachContactNumber(phoneHash: string, phone: string): Promise<void> {
  const filter = {
    phoneHash,
    followUpStatus: "new",
    contactPhoneEnc: { $exists: false },
    lastMessageAt: { $gte: new Date(Date.now() - ENQUIRY_IDLE_MS) },
  };
  // Checked first, so the number is only ever encrypted for a topic that asked for a person.
  const waiting = await WhatsAppEnquiry.findOne(filter).sort({ lastMessageAt: -1 }).select("_id");
  if (!waiting) return;
  await WhatsAppEnquiry.updateOne(
    { _id: waiting._id, contactPhoneEnc: { $exists: false } },
    { $set: { contactPhoneEnc: encryptValue(phone) } }
  );
}

/** Removes every enquiry for this number. Used by STOP, with the chat and the notes. */
export async function forgetAllEnquiries(phoneHash: string): Promise<number> {
  const result = await WhatsAppEnquiry.deleteMany({ phoneHash });
  return result.deletedCount;
}

/**
 * The topic the parent was last on, closed or not, if they were on it within a day. A "thanks"
 * or a tapped feedback button lands here after the topic was closed, so it must not open a new one.
 */
async function latestEnquiry(phoneHash: string, now: Date) {
  return WhatsAppEnquiry.findOne({
    phoneHash,
    lastMessageAt: { $gte: new Date(now.getTime() - ENQUIRY_IDLE_MS) },
  }).sort({ lastMessageAt: -1 });
}

/** The parent tapped "I'm good for now". Returns false when there was no recent topic. */
export async function closeLatestEnquiry(phoneHash: string, now = new Date()): Promise<boolean> {
  const enquiry = await latestEnquiry(phoneHash, now);
  if (!enquiry) return false;
  enquiry.closed = true;
  enquiry.lastMessageAt = now;
  await enquiry.save();
  return true;
}

/** The parent tapped a feedback button after a topic. Returns false when there was none to rate. */
export async function setLatestFeedback(
  phoneHash: string,
  value: EnquiryFeedback,
  now = new Date()
): Promise<boolean> {
  const enquiry = await latestEnquiry(phoneHash, now);
  if (!enquiry) return false;
  enquiry.feedback = value;
  enquiry.closed = true;
  enquiry.lastMessageAt = now;
  await enquiry.save();
  return true;
}
