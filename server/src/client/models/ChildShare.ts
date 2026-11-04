import { CHILD_HISTORY_LIMITS, CHILD_SHARE_SECTIONS } from "@powermysport/shared-types";
import type { ChildShareSection } from "@powermysport/shared-types";
import mongoose, { Document, Schema, Types } from "mongoose";

/**
 * A link a parent made so one person, usually a university coach, can read a trimmed copy of their
 * child's sporting profile without an account.
 *
 * The link holds a random token. Only its hash is stored, so a copy of the database cannot be used
 * to open anyone's profile. Whether a link works is decided from this document on every request,
 * never from a cache, so revoking takes effect at once and does not depend on Redis.
 *
 * `sections` and `videoIds` are what was ticked when the link was made. A video added later is not
 * shared by an older link. `consentVersion` and `consentAt` record what the parent agreed to when
 * they created it.
 *
 * `purgeAt` is the expiry plus a retention period; a TTL index removes the document then. Until
 * that moment an expired or revoked link answers "no longer active" rather than "not found".
 */
export interface ChildShareDocument extends Document {
  childId: Types.ObjectId;
  userId: Types.ObjectId;
  /** Who it is for, in the parent's words, e.g. "Coach Miller, State University". */
  recipientLabel: string;
  tokenHash: string;
  sections: ChildShareSection[];
  videoIds: Types.ObjectId[];
  expiresAt: Date;
  revokedAt?: Date;
  purgeAt: Date;
  openCount: number;
  lastOpenedAt?: Date;
  consentVersion: string;
  consentAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const childShareSchema = new Schema<ChildShareDocument>(
  {
    childId: { type: Schema.Types.ObjectId, ref: "Player", required: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    recipientLabel: {
      type: String,
      required: true,
      trim: true,
      maxlength: CHILD_HISTORY_LIMITS.shareLabelChars,
    },
    tokenHash: { type: String, required: true },
    sections: { type: [{ type: String, enum: [...CHILD_SHARE_SECTIONS] }], default: [] },
    videoIds: { type: [Schema.Types.ObjectId], ref: "ChildVideo", default: [] },
    expiresAt: { type: Date, required: true },
    revokedAt: { type: Date },
    purgeAt: { type: Date, required: true },
    openCount: { type: Number, default: 0, min: 0 },
    lastOpenedAt: { type: Date },
    consentVersion: { type: String, required: true },
    consentAt: { type: Date, required: true },
  },
  { timestamps: true }
);

// The public lookup, by the hash of the token in the link.
childShareSchema.index({ tokenHash: 1 }, { name: "tokenHash_1", unique: true });
// A parent's list of links for one child, newest first.
childShareSchema.index({ childId: 1, createdAt: -1 }, { name: "childId_1_createdAt_-1" });
// Removes the document once the retention period after expiry has passed.
childShareSchema.index({ purgeAt: 1 }, { name: "purgeAt_1", expireAfterSeconds: 0 });
// Deleting an account removes the links.
childShareSchema.index({ userId: 1 }, { name: "userId_1" });

export const ChildShare = mongoose.model<ChildShareDocument>("ChildShare", childShareSchema);
