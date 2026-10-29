import { CHILD_HISTORY_LIMITS, CONTACT_REQUEST_RETENTION_DAYS } from "@powermysport/shared-types";
import mongoose, { Document, Schema, Types } from "mongoose";

/**
 * A coach asking, through a shared profile, to be put in touch with the family.
 *
 * The parent's own email and phone are never shown to the coach; the request is passed to the
 * parent, who decides whether to reply. The coach's name and email are kept only long enough for
 * the parent to act on them, then removed by a TTL index. The sender is not verified.
 */
export const CONTACT_REQUEST_RETENTION_SECONDS = 60 * 60 * 24 * CONTACT_REQUEST_RETENTION_DAYS;

export interface ContactRequestDocument extends Document {
  shareId: Types.ObjectId;
  childId: Types.ObjectId;
  userId: Types.ObjectId;
  name: string;
  email: string;
  message?: string;
  createdAt: Date;
}

const contactRequestSchema = new Schema<ContactRequestDocument>(
  {
    shareId: { type: Schema.Types.ObjectId, ref: "ChildShare", required: true },
    childId: { type: Schema.Types.ObjectId, ref: "Player", required: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: CHILD_HISTORY_LIMITS.contactNameChars,
    },
    email: { type: String, required: true, trim: true, lowercase: true, maxlength: 254 },
    message: { type: String, trim: true, maxlength: CHILD_HISTORY_LIMITS.contactMessageChars },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

// How many requests one link has had, newest first: the cap that stops a link being used for spam.
contactRequestSchema.index({ shareId: 1, createdAt: -1 }, { name: "shareId_1_createdAt_-1" });
// Deleting a child or an account removes the requests.
contactRequestSchema.index({ childId: 1 }, { name: "childId_1" });
contactRequestSchema.index({ userId: 1 }, { name: "userId_1" });
// The retention promise made on the share page.
contactRequestSchema.index(
  { createdAt: 1 },
  { name: "createdAt_1", expireAfterSeconds: CONTACT_REQUEST_RETENTION_SECONDS }
);

export const ContactRequest = mongoose.model<ContactRequestDocument>(
  "ContactRequest",
  contactRequestSchema
);
