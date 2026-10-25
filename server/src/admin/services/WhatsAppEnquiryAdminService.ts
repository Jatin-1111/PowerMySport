import mongoose from "mongoose";
import {
  ASSISTANCE_KINDS,
  ENQUIRY_FEEDBACK,
  FOLLOW_UP_STATUSES,
  WhatsAppEnquiry,
  type FollowUpStatus,
  type WhatsAppEnquiryDocument,
} from "../../client/models/WhatsAppEnquiry";
import { decryptValue } from "../../shared/utils/encryption";
import { AppError } from "../../utils/AppError";
import { escapeRegex } from "../../utils/regex";

/**
 * Reading the pilot's enquiries for the admin screen.
 *
 * Nothing here returns the hashed number or the encrypted one. A row carries `parentRef` (a
 * pseudonym) and whether a contact number exists; the number itself comes out only through
 * `revealContact`, which the controller audit-logs.
 */

export interface EnquiryFilters {
  status?: string;
  sport?: string;
  assistance?: string;
  feedback?: string;
  from?: string;
  to?: string;
  q?: string;
}

export interface EnquiryRow {
  id: string;
  reference: string;
  parentRef: string;
  question: string;
  childAge?: number;
  sport?: string;
  level?: string;
  objective?: string;
  guidance?: string;
  /** Every exchange on the topic. Present on a single enquiry and in the export, not in the list. */
  turns?: Array<{ at: Date; parent: string; assistant: string }>;
  assistance: string[];
  followUpStatus: FollowUpStatus;
  followUpSummary?: string;
  ticketId?: string;
  hasContact: boolean;
  feedback?: string;
  closed: boolean;
  teamNote?: string;
  turnCount: number;
  createdAt: Date;
  lastMessageAt: Date;
}

const MAX_LIMIT = 100;
export const MAX_EXPORT_ROWS = 5000;
const MAX_NOTE = 1000;

const validDate = (value: string | undefined): Date | undefined => {
  if (!value) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
};

/** Only values the model knows are used, so a query string can never inject an operator. */
export function buildFilter(filters: EnquiryFilters): Record<string, unknown> {
  const filter: Record<string, unknown> = {};

  if (filters.status && (FOLLOW_UP_STATUSES as readonly string[]).includes(filters.status)) {
    filter.followUpStatus = filters.status;
  }
  if (filters.assistance && (ASSISTANCE_KINDS as readonly string[]).includes(filters.assistance)) {
    filter.assistance = filters.assistance;
  }
  if (filters.feedback && (ENQUIRY_FEEDBACK as readonly string[]).includes(filters.feedback)) {
    filter.feedback = filters.feedback;
  }
  if (typeof filters.sport === "string" && filters.sport.trim()) {
    filter.sport = new RegExp(`^${escapeRegex(filters.sport.trim().slice(0, 40))}$`, "i");
  }
  if (typeof filters.q === "string" && filters.q.trim()) {
    filter.question = new RegExp(escapeRegex(filters.q.trim().slice(0, 100)), "i");
  }

  const from = validDate(filters.from);
  const to = validDate(filters.to);
  if (from || to) {
    filter.createdAt = {
      ...(from ? { $gte: from } : {}),
      ...(to ? { $lte: to } : {}),
    };
  }
  return filter;
}

const present = (doc: WhatsAppEnquiryDocument, withTurns = false): EnquiryRow => ({
  id: String(doc._id),
  reference: doc.reference,
  parentRef: doc.parentRef,
  question: doc.question,
  ...(doc.childAge !== undefined ? { childAge: doc.childAge } : {}),
  ...(doc.sport ? { sport: doc.sport } : {}),
  ...(doc.level ? { level: doc.level } : {}),
  ...(doc.objective ? { objective: doc.objective } : {}),
  ...(doc.guidance ? { guidance: doc.guidance } : {}),
  ...(withTurns
    ? {
        turns: (doc.turns ?? []).map((t) => ({
          at: t.at,
          parent: t.parent,
          assistant: t.assistant,
        })),
      }
    : {}),
  assistance: doc.assistance,
  followUpStatus: doc.followUpStatus,
  ...(doc.followUpSummary ? { followUpSummary: doc.followUpSummary } : {}),
  ...(doc.ticketId ? { ticketId: doc.ticketId } : {}),
  hasContact: Boolean(doc.contactPhoneEnc),
  ...(doc.feedback ? { feedback: doc.feedback } : {}),
  closed: doc.closed,
  ...(doc.teamNote ? { teamNote: doc.teamNote } : {}),
  turnCount: doc.turnCount,
  createdAt: doc.createdAt,
  lastMessageAt: doc.lastMessageAt,
});

// Fields the admin never needs, kept out of every read.
const HIDDEN = "-phoneHash";
// The list is many rows, and each enquiry can hold a long conversation, so the list leaves it out.
const HIDDEN_IN_LIST = "-phoneHash -turns";

export async function listEnquiries(
  filters: EnquiryFilters,
  page: number,
  limit: number
): Promise<{ rows: EnquiryRow[]; total: number; page: number; totalPages: number }> {
  const take = Math.min(Math.max(Math.floor(limit) || 25, 1), MAX_LIMIT);
  const current = Math.max(Math.floor(page) || 1, 1);
  const filter = buildFilter(filters);

  const [docs, total] = await Promise.all([
    WhatsAppEnquiry.find(filter)
      .select(HIDDEN_IN_LIST)
      .sort({ lastMessageAt: -1 })
      .skip((current - 1) * take)
      .limit(take),
    WhatsAppEnquiry.countDocuments(filter),
  ]);
  return {
    rows: docs.map((doc) => present(doc)),
    total,
    page: current,
    totalPages: Math.max(Math.ceil(total / take), 1),
  };
}

export async function getEnquiry(id: string): Promise<EnquiryRow> {
  if (!mongoose.isValidObjectId(id)) throw new AppError("That enquiry does not exist.", 404);
  const doc = await WhatsAppEnquiry.findById(id).select(HIDDEN);
  if (!doc) throw new AppError("That enquiry does not exist.", 404);
  return present(doc, true);
}

export async function updateEnquiryByTeam(
  id: string,
  changes: { followUpStatus?: unknown; teamNote?: unknown }
): Promise<EnquiryRow> {
  if (!mongoose.isValidObjectId(id)) throw new AppError("That enquiry does not exist.", 404);
  const set: Record<string, unknown> = {};

  if (changes.followUpStatus !== undefined) {
    if (
      typeof changes.followUpStatus !== "string" ||
      !(FOLLOW_UP_STATUSES as readonly string[]).includes(changes.followUpStatus)
    ) {
      throw new AppError("That follow-up status is not valid.", 400);
    }
    set.followUpStatus = changes.followUpStatus;
  }
  if (changes.teamNote !== undefined) {
    if (typeof changes.teamNote !== "string") throw new AppError("The note must be text.", 400);
    set.teamNote = changes.teamNote.trim().slice(0, MAX_NOTE);
  }
  if (Object.keys(set).length === 0) throw new AppError("Nothing to change.", 400);

  const doc = await WhatsAppEnquiry.findByIdAndUpdate(id, { $set: set }, { new: true }).select(
    HIDDEN_IN_LIST
  );
  if (!doc) throw new AppError("That enquiry does not exist.", 404);
  return present(doc);
}

/** The parent's number, only when they asked for a person. The caller audit-logs every call. */
export async function revealContact(id: string): Promise<string> {
  if (!mongoose.isValidObjectId(id)) throw new AppError("That enquiry does not exist.", 404);
  const doc = await WhatsAppEnquiry.findById(id).select("contactPhoneEnc followUpStatus");
  if (!doc) throw new AppError("That enquiry does not exist.", 404);
  if (!doc.contactPhoneEnc) {
    throw new AppError(
      "No number is kept for this enquiry: the parent did not ask for a person.",
      404
    );
  }
  const phone = decryptValue(doc.contactPhoneEnc);
  // decryptValue hands back the input when it cannot decrypt; never show that as a number.
  if (!/^\d{10,15}$/.test(phone)) {
    throw new AppError("The number could not be read.", 500);
  }
  return phone;
}

export async function enquirySummary(): Promise<{
  enquiries: number;
  parents: number;
  needsFollowUp: number;
  asksForTeam: number;
  feedback: { helpful: number; notHelpful: number };
  byFollowUp: Record<string, number>;
  byAssistance: Record<string, number>;
  bySport: Array<{ sport: string; count: number }>;
}> {
  const [totals, byFollowUp, byAssistance, bySport, byFeedback] = await Promise.all([
    WhatsAppEnquiry.aggregate([
      { $group: { _id: null, enquiries: { $sum: 1 }, parents: { $addToSet: "$parentRef" } } },
      { $project: { enquiries: 1, parents: { $size: "$parents" } } },
    ]),
    WhatsAppEnquiry.aggregate([{ $group: { _id: "$followUpStatus", count: { $sum: 1 } } }]),
    WhatsAppEnquiry.aggregate([
      { $unwind: "$assistance" },
      { $group: { _id: "$assistance", count: { $sum: 1 } } },
    ]),
    WhatsAppEnquiry.aggregate([
      { $match: { sport: { $exists: true } } },
      { $group: { _id: { $toLower: "$sport" }, count: { $sum: 1 } } },
      { $sort: { count: -1, _id: 1 } },
      { $limit: 15 },
    ]),
    WhatsAppEnquiry.aggregate([
      { $match: { feedback: { $exists: true } } },
      { $group: { _id: "$feedback", count: { $sum: 1 } } },
    ]),
  ]);

  const toMap = (rows: Array<{ _id: string; count: number }>) =>
    Object.fromEntries(rows.map((r) => [r._id, r.count]));
  const followUp = toMap(byFollowUp);
  const feedback = toMap(byFeedback);
  const assistance = toMap(byAssistance);

  return {
    enquiries: totals[0]?.enquiries ?? 0,
    parents: totals[0]?.parents ?? 0,
    needsFollowUp: followUp.new ?? 0,
    asksForTeam: assistance.team ?? 0,
    feedback: { helpful: feedback.helpful ?? 0, notHelpful: feedback.not_helpful ?? 0 },
    byFollowUp: followUp,
    byAssistance: assistance,
    bySport: bySport.map((r) => ({ sport: r._id as string, count: r.count })),
  };
}

// ─── CSV ─────────────────────────────────────────────────────────────────────

/**
 * One cell, safe to open in a spreadsheet. A parent's own words can start with "=", "+", "-" or
 * "@", which Excel and Sheets run as a formula, so those get a leading apostrophe.
 */
export function csvCell(value: unknown): string {
  let text = value === null || value === undefined ? "" : String(value);
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

const CSV_COLUMNS: Array<[string, (r: EnquiryRow) => unknown]> = [
  ["Reference", (r) => r.reference],
  ["Date", (r) => r.createdAt.toISOString()],
  ["Parent", (r) => r.parentRef],
  ["Question", (r) => r.question],
  ["Child age", (r) => r.childAge],
  ["Sport", (r) => r.sport],
  ["Level", (r) => r.level],
  ["Objective", (r) => r.objective],
  [
    "Guidance provided",
    // Every answer given on the topic, oldest first. A spreadsheet cell holds about 32,000 characters.
    (r) =>
      r.turns?.length
        ? r.turns
            .map((t) => t.assistant)
            .join("\n---\n")
            .slice(0, 20000)
        : r.guidance,
  ],
  ["Assistance required", (r) => r.assistance.join("; ")],
  ["Follow-up status", (r) => r.followUpStatus],
  ["Parent feedback", (r) => r.feedback],
  ["Closed", (r) => (r.closed ? "yes" : "no")],
  ["Messages", (r) => r.turnCount],
  ["Team note", (r) => r.teamNote],
];

export async function exportEnquiriesCsv(
  filters: EnquiryFilters
): Promise<{ csv: string; count: number }> {
  const docs = await WhatsAppEnquiry.find(buildFilter(filters))
    .select(HIDDEN)
    .sort({ createdAt: -1 })
    .limit(MAX_EXPORT_ROWS);
  const rows = docs.map((doc) => present(doc, true));
  const lines = [
    CSV_COLUMNS.map(([header]) => csvCell(header)).join(","),
    ...rows.map((row) => CSV_COLUMNS.map(([, value]) => csvCell(value(row))).join(",")),
  ];
  return { csv: lines.join("\r\n"), count: rows.length };
}
