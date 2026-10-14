import mongoose, { Document, Schema, Types } from "mongoose";

/**
 * A parent asking to hear about one admission or scholarship entry.
 *
 * The follow is the opt-in, and removing it is the off switch: nothing is sent
 * about an entry a parent has not chosen, and nothing is sent about one they
 * have un-followed. That is why there is no separate preference for it.
 *
 * `slug` rather than the entry's `_id`, as everywhere else the public pages
 * identify an entry. If an entry is unpublished or deleted its follows simply
 * stop matching anything.
 *
 * `alerted` is what makes the daily sweep idempotent. Each value is the date the
 * alert was *about* (the window's opening date, its closing date), not the date
 * it was sent, so a new cycle with new dates is a new alert and the same cycle
 * is never told twice.
 */
export interface OpportunityFollowDocument extends Document {
  userId: Types.ObjectId;
  slug: string;
  alerted?: {
    opened?: string;
    closing?: string;
  };
  createdAt: Date;
  updatedAt: Date;
}

/** A parent who follows more than this is collecting, not tracking. Stops a runaway client. */
export const MAX_FOLLOWS_PER_USER = 50;

const opportunityFollowSchema = new Schema<OpportunityFollowDocument>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    slug: { type: String, required: true, lowercase: true, trim: true },
    alerted: {
      _id: false,
      opened: { type: String },
      closing: { type: String },
    },
  },
  { timestamps: true }
);

// One follow per parent per entry; also serves "everything this parent follows".
opportunityFollowSchema.index({ userId: 1, slug: 1 }, { unique: true });
// The sweep reads every follow for the entries that have something to say.
opportunityFollowSchema.index({ slug: 1 });

export const OpportunityFollow = mongoose.model<OpportunityFollowDocument>(
  "OpportunityFollow",
  opportunityFollowSchema
);
