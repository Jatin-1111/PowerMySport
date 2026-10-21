import mongoose, { Document, Schema } from "mongoose";
import { emitCommunityUserEvent } from "../services/CommunityRealtimeService";

export type CommunityReportTargetType = "MESSAGE" | "GROUP" | "POST" | "ANSWER" | "EXPERIENCE";
export type CommunityReportStatus = "OPEN" | "UNDER_REVIEW" | "RESOLVED" | "REJECTED";

export interface CommunityReportDocument extends Document {
  reporterUserId: mongoose.Types.ObjectId;
  targetType: CommunityReportTargetType;
  targetId: mongoose.Types.ObjectId;
  reason: string;
  details?: string;
  messageAudit?: {
    /** The message text as it was when the report was made (or, if it was
     *  already deleted, the last text it held), so a later edit or delete by
     *  the sender cannot remove what was reported. Moderators only. */
    contentSnapshot?: string;
    messageType?: string;
    conversationId?: mongoose.Types.ObjectId;
    senderId?: mongoose.Types.ObjectId;
    createdAt?: Date;
    updatedAt?: Date;
    editedAt?: Date | null;
    deletedAt?: Date | null;
    wasEdited: boolean;
    wasDeleted: boolean;
  };
  status: CommunityReportStatus;
  reviewedBy?: mongoose.Types.ObjectId;
  reviewedAt?: Date;
  resolutionNote?: string;
  createdAt: Date;
  updatedAt: Date;
}

const communityReportSchema = new Schema<CommunityReportDocument>(
  {
    reporterUserId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    targetType: {
      type: String,
      enum: ["MESSAGE", "GROUP", "POST", "ANSWER", "EXPERIENCE"],
      required: true,
      index: true,
    },
    targetId: { type: Schema.Types.ObjectId, required: true, index: true },
    reason: { type: String, required: true, trim: true, maxlength: 120 },
    details: { type: String, trim: true, maxlength: 1000 },
    messageAudit: {
      contentSnapshot: { type: String, maxlength: 2000 },
      messageType: { type: String, maxlength: 20 },
      conversationId: { type: Schema.Types.ObjectId, ref: "CommunityConversation" },
      senderId: { type: Schema.Types.ObjectId, ref: "User" },
      createdAt: { type: Date },
      updatedAt: { type: Date },
      editedAt: { type: Date, default: null },
      deletedAt: { type: Date, default: null },
      wasEdited: { type: Boolean, default: false },
      wasDeleted: { type: Boolean, default: false },
    },
    status: {
      type: String,
      enum: ["OPEN", "UNDER_REVIEW", "RESOLVED", "REJECTED"],
      default: "OPEN",
      index: true,
    },
    reviewedBy: { type: Schema.Types.ObjectId, ref: "Admin" },
    reviewedAt: { type: Date },
    resolutionNote: { type: String, trim: true, maxlength: 1000 },
  },
  { timestamps: true }
);

communityReportSchema.index({ targetType: 1, targetId: 1, createdAt: -1 });
// Backs admin listCommunityReports — always filters by status (single value
// or the full $in list) and sorts {createdAt:-1}.
communityReportSchema.index({ status: 1, createdAt: -1 });

const notifyReportUpdated = (doc: any) => {
  if (!doc || !doc.reporterUserId) return;
  emitCommunityUserEvent(doc.reporterUserId.toString(), "community:reportUpdated", {
    reportId: doc._id?.toString(),
  });
};

communityReportSchema.post("save", function (doc) {
  notifyReportUpdated(doc);
});

communityReportSchema.post("findOneAndUpdate", function (doc) {
  notifyReportUpdated(doc);
});

export const CommunityReport = mongoose.model<CommunityReportDocument>(
  "CommunityReport",
  communityReportSchema
);
