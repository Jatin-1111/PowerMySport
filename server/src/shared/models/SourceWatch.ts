import mongoose, { Document, Schema } from "mongoose";

/**
 * One public URL we check weekly because an admission or scholarship entry
 * depends on it: a source it cites, or a page where next year's circular will
 * appear (Opportunity.watchUrls). Written only by opportunityWatch.ts.
 *
 * Holds fingerprints, never the page. The cluster is on a 512MB free tier,
 * and a hash is all that "has this changed since last week?" needs.
 */
export type SourceWatchStatus =
  /** Read normally. */
  | "ok"
  /** Refused (401/403/429/503) or answered with a stub: a bot check, or a page built in the browser. */
  | "blocked"
  /** A link to a file now leads to a page instead: the file has moved. */
  | "moved"
  /** 404 or 410. */
  | "gone"
  /** robots.txt asks crawlers not to fetch it, so we don't. */
  | "disallowed"
  /** Timed out, refused to resolve, or failed some other way. */
  | "error";

export interface SourceWatchDocument extends Document {
  url: string;
  status: SourceWatchStatus;
  httpStatus?: number;
  finalUrl?: string;
  contentType?: string;
  /** Plain words for the admin screen: why it is blocked, where it moved. */
  note?: string;
  /** Hash of the page's readable text, or of the file's bytes. */
  fingerprint?: string;
  /** Hash of the list of documents the page links to. New circulars show up here first. */
  linkFingerprint?: string;
  documentLinkCount?: number;
  /** "documents" | "text" | "file": what changed last time something did. */
  changeKind?: string;
  firstCheckedAt: Date;
  lastCheckedAt: Date;
  /** When the current status began, so a problem acknowledged once stays quiet until it changes. */
  statusSince: Date;
  lastOkAt?: Date;
  lastChangedAt?: Date;
  /** Set when a person has looked at the latest change or problem. */
  acknowledgedAt?: Date;
  /** A person opened this source themselves, because our server cannot read it. The latest only; the audit log keeps each. */
  lastManualCheckAt?: Date;
  lastManualCheckBy?: mongoose.Types.ObjectId;
  lastManualCheckNote?: string;
  createdAt: Date;
  updatedAt: Date;
}

const sourceWatchSchema = new Schema<SourceWatchDocument>(
  {
    url: { type: String, required: true, unique: true, trim: true },
    status: {
      type: String,
      enum: ["ok", "blocked", "moved", "gone", "disallowed", "error"],
      required: true,
    },
    httpStatus: { type: Number },
    finalUrl: { type: String },
    contentType: { type: String },
    note: { type: String },
    fingerprint: { type: String },
    linkFingerprint: { type: String },
    documentLinkCount: { type: Number },
    changeKind: { type: String },
    firstCheckedAt: { type: Date, required: true },
    lastCheckedAt: { type: Date, required: true },
    statusSince: { type: Date, required: true },
    lastOkAt: { type: Date },
    lastChangedAt: { type: Date },
    acknowledgedAt: { type: Date },
    lastManualCheckAt: { type: Date },
    lastManualCheckBy: { type: Schema.Types.ObjectId, ref: "Admin" },
    lastManualCheckNote: { type: String, trim: true, maxlength: 300 },
  },
  { timestamps: true }
);

export const SourceWatch = mongoose.model<SourceWatchDocument>("SourceWatch", sourceWatchSchema);

/**
 * Whether a person needs to look at this URL: it changed since someone last
 * acknowledged it, or it cannot currently be read.
 */
export function needsAttention(watch: {
  status: SourceWatchStatus;
  statusSince: Date;
  lastChangedAt?: Date | null;
  acknowledgedAt?: Date | null;
}): boolean {
  const acknowledged = watch.acknowledgedAt?.getTime() ?? 0;
  if (watch.status !== "ok") return watch.statusSince.getTime() > acknowledged;
  return Boolean(watch.lastChangedAt && watch.lastChangedAt.getTime() > acknowledged);
}

// ─── Sources our server cannot read ─────────────────────────────────────────
//
// Half the government sites we cite turn automated visitors away, so for them
// the weekly check can say nothing about whether the page changed. The only
// honest answer is a person opening it. These record that a person did, and say
// when it is due again, so "we cannot read it" never quietly becomes "nobody has
// looked at it for a year".

/** How long after anyone last looked at an unreadable source it is due a look again. */
export const MANUAL_CHECK_EVERY_DAYS = 30;

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * The last time a person is known to have looked at this source: a hand check, or
 * anything that acknowledges it (dismissing it, approving or rejecting a reading
 * of it).
 */
export function lastLookedAt(watch: {
  acknowledgedAt?: Date | null;
  lastManualCheckAt?: Date | null;
}): Date | null {
  const times = [watch.acknowledgedAt, watch.lastManualCheckAt]
    .filter((t): t is Date => Boolean(t))
    .map((t) => t.getTime());
  return times.length ? new Date(Math.max(...times)) : null;
}

/**
 * Whether an unreadable source is due a look from a person: nobody has looked,
 * or its problem is newer than the last look, or the last look is more than
 * MANUAL_CHECK_EVERY_DAYS ago. A source that can be read is never due this way;
 * a change to it is flagged by `needsAttention`.
 */
export function manualCheckDue(
  watch: {
    status: SourceWatchStatus;
    statusSince: Date;
    acknowledgedAt?: Date | null;
    lastManualCheckAt?: Date | null;
  },
  now: Date = new Date()
): boolean {
  if (watch.status === "ok") return false;
  const looked = lastLookedAt(watch);
  if (!looked) return true;
  if (watch.statusSince.getTime() > looked.getTime()) return true;
  return now.getTime() - looked.getTime() > MANUAL_CHECK_EVERY_DAYS * DAY_MS;
}

/** What puts a source in front of a person: a change if it can be read, a hand check if it cannot. */
export function watchNeedsAttention(
  watch: Parameters<typeof manualCheckDue>[0] & Parameters<typeof needsAttention>[0],
  now: Date = new Date()
): boolean {
  return watch.status === "ok" ? needsAttention(watch) : manualCheckDue(watch, now);
}
