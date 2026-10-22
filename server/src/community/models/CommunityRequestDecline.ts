import mongoose, { Document, Schema } from "mongoose";

/** How long a declined sender must wait before asking the same person again. */
export const REQUEST_DECLINE_COOLDOWN_DAYS = 7;

export interface CommunityRequestDeclineDocument extends Document {
  requesterId: mongoose.Types.ObjectId;
  declinedById: mongoose.Types.ObjectId;
  createdAt: Date;
}

/**
 * Declining a request deletes the conversation, so without this record nothing
 * remembered the decline and the sender could ask again at once. One row per
 * (requester, decliner) pair; a repeat decline refreshes it. Mongo expires the
 * row itself once the cooldown is over.
 */
const communityRequestDeclineSchema = new Schema<CommunityRequestDeclineDocument>({
  requesterId: { type: Schema.Types.ObjectId, ref: "User", required: true },
  declinedById: { type: Schema.Types.ObjectId, ref: "User", required: true },
  createdAt: {
    type: Date,
    default: Date.now,
    expires: REQUEST_DECLINE_COOLDOWN_DAYS * 24 * 60 * 60,
  },
});

communityRequestDeclineSchema.index({ requesterId: 1, declinedById: 1 }, { unique: true });

export const CommunityRequestDecline = mongoose.model<CommunityRequestDeclineDocument>(
  "CommunityRequestDecline",
  communityRequestDeclineSchema
);
