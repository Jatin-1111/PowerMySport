import mongoose, { Document, Schema } from "mongoose";

export type CommunityReportTargetType = "MESSAGE" | "GROUP" | "POST" | "ANSWER";
export type CommunityReportStatus =
  | "OPEN"
  | "UNDER_REVIEW"
  | "RESOLVED"
  | "REJECTED";

export interface CommunityReportDocument extends Document {
  reporterUserId: mongoose.Types.ObjectId;
  targetType: CommunityReportTargetType;
  targetId: mongoose.Types.ObjectId;
  reason: string;
  details?: string;
  messageAudit?: {
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
      enum: ["MESSAGE", "GROUP", "POST", "ANSWER"],
      required: true,
      index: true,
    },
    targetId: { type: Schema.Types.ObjectId, required: true, index: true },
    reason: { type: String, required: true, trim: true, maxlength: 120 },
    details: { type: String, trim: true, maxlength: 1000 },
    messageAudit: {
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
  { timestamps: true },
);

communityReportSchema.index({ targetType: 1, targetId: 1, createdAt: -1 });

export const CommunityReport = mongoose.model<CommunityReportDocument>(
  "CommunityReport",
  communityReportSchema,
);
