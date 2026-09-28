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
