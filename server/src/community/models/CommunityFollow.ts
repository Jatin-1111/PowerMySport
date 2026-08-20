import mongoose, { Document, Schema } from "mongoose";

export type CommunityFollowKind = "GROUP" | "TOPIC";

export interface CommunityFollowDocument extends Document {
  userId: mongoose.Types.ObjectId;
  kind: CommunityFollowKind;
  /**
   * A group's ObjectId (as a string) or a normalized topic tag. Kept as a
   * string rather than an ObjectId because topics are free text — a follow is
   * identified by the (kind, targetId) pair, not by a foreign key.
   *
   * Deliberately no `label` or `href` here. The old localStorage store cached
   * both, so a renamed group kept its stale name forever and a deleted one left
   * a dead link. Labels are resolved from the source at read time instead.
   */
  targetId: string;
  createdAt: Date;
  updatedAt: Date;
}

const communityFollowSchema = new Schema<CommunityFollowDocument>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    kind: {
      type: String,
      enum: ["GROUP", "TOPIC"],
      required: true,
    },
    targetId: {
      type: String,
      required: true,
      trim: true,
      maxlength: 80,
    },
  },
  { timestamps: true },
);

// Following the same thing twice is a no-op, not a second row. The toggle
// endpoint relies on this to stay idempotent under a double-tap.
communityFollowSchema.index(
  { userId: 1, kind: 1, targetId: 1 },
  { unique: true },
);

// Serves the "what do I follow" list, which is the only read path.
communityFollowSchema.index({ userId: 1, createdAt: -1 });

export const CommunityFollow = mongoose.model<CommunityFollowDocument>(
  "CommunityFollow",
  communityFollowSchema,
);
