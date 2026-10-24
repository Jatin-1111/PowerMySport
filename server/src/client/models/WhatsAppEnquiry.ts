import mongoose, { Document, Schema } from "mongoose";

/**
 * One parent question on WhatsApp, and how it ended, so the team can review the pilot.
 *
 * The chat keeps only the latest turns and expires in 90 days. This is the part worth reviewing
 * afterwards: what the parent asked, who the child is (age, sport, level), what they wanted,
 * what we told them, whether they needed a person, and how it went. One record covers one topic:
 * a new one starts after the parent closes the last or after a day of silence, so a parent who
 * returns weeks later with a new question is a second enquiry, not an edit of the first.
 *
 * The number itself is not stored in the clear. `phoneHash` is the same keyed hash the chat uses,
 * so STOP deletes the chat, the notes and these together. `parentRef` is a short pseudonym of it
 * for the admin screen. Only when the parent asks for a person is the number kept at all, encrypted,
 * on that enquiry alone (`contactPhoneEnc`), because a team that cannot reach the parent cannot
 * honour "we will get back to you".
 *
 * Every free-text field is cut down and capped by the service before it gets here.
 */

export const ENQUIRY_RETENTION_SECONDS = 60 * 60 * 24 * 180;
/** A parent who writes again within this long of the last message is still on the same topic. */
export const ENQUIRY_IDLE_MS = 24 * 60 * 60 * 1000;

export const ASSISTANCE_KINDS = ["coach", "tournaments", "expert", "team", "other"] as const;
export type AssistanceKind = (typeof ASSISTANCE_KINDS)[number];

export const FOLLOW_UP_STATUSES = ["none", "new", "contacted", "done"] as const;
export type FollowUpStatus = (typeof FOLLOW_UP_STATUSES)[number];

export const ENQUIRY_FEEDBACK = ["helpful", "not_helpful"] as const;
export type EnquiryFeedback = (typeof ENQUIRY_FEEDBACK)[number];

export interface WhatsAppEnquiryDocument extends Document {
  phoneHash: string;
  /** Short pseudonym of the number, for the admin screen. Not reversible. */
  parentRef: string;
  /** What the parent can quote to the team, e.g. "PMS-4F2K9". */
  reference: string;
  /** The parent's first message on this topic. */
  question: string;
  childAge?: number;
  sport?: string;
  level?: string;
  objective?: string;
  /** The assistant's latest answer on this topic, so the team sees what was advised. */
  guidance?: string;
  assistance: AssistanceKind[];
  followUpStatus: FollowUpStatus;
  followUpSummary?: string;
  /** The support ticket the hand-off created, when there was one. */
  ticketId?: string;
  /** Encrypted number, kept only when the parent asked for a person. */
  contactPhoneEnc?: string;
  feedback?: EnquiryFeedback;
  /** True once the parent said they were done, or the conversation moved on. */
  closed: boolean;
  /** Written by the team in the admin screen. */
  teamNote?: string;
  turnCount: number;
  lastMessageAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const whatsAppEnquirySchema = new Schema<WhatsAppEnquiryDocument>(
  {
    phoneHash: { type: String, required: true },
    parentRef: { type: String, required: true },
    reference: { type: String, required: true, unique: true },
    question: { type: String, required: true, maxlength: 500 },
    childAge: { type: Number, min: 3, max: 21 },
    sport: { type: String, maxlength: 40 },
    level: { type: String, maxlength: 60 },
    objective: { type: String, maxlength: 240 },
    guidance: { type: String, maxlength: 2000 },
    assistance: { type: [{ type: String, enum: ASSISTANCE_KINDS }], default: [] },
    followUpStatus: { type: String, enum: FOLLOW_UP_STATUSES, default: "none" },
    followUpSummary: { type: String, maxlength: 600 },
    ticketId: { type: String, maxlength: 40 },
    contactPhoneEnc: { type: String, maxlength: 400 },
    feedback: { type: String, enum: ENQUIRY_FEEDBACK },
    closed: { type: Boolean, default: false },
    teamNote: { type: String, maxlength: 1000 },
    turnCount: { type: Number, default: 0 },
    lastMessageAt: { type: Date, required: true },
  },
  { timestamps: true }
);

// Finding this number's open topic, newest first.
whatsAppEnquirySchema.index({ phoneHash: 1, lastMessageAt: -1 });
// The admin list, newest first, and its "needs follow-up" filter.
whatsAppEnquirySchema.index({ followUpStatus: 1, lastMessageAt: -1 });
whatsAppEnquirySchema.index({ createdAt: -1 });
// A child's details and a parent's question are in here, so enquiries are not kept indefinitely.
whatsAppEnquirySchema.index(
  { lastMessageAt: 1 },
  { expireAfterSeconds: ENQUIRY_RETENTION_SECONDS }
);

export const WhatsAppEnquiry = mongoose.model<WhatsAppEnquiryDocument>(
  "WhatsAppEnquiry",
  whatsAppEnquirySchema
);
