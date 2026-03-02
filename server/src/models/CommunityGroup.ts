import mongoose, { Document, Schema } from "mongoose";

export type CommunityGroupVisibility = "PUBLIC";

export interface CommunityGroupDocument extends Document {
  name: string;
  description?: string;
  visibility: CommunityGroupVisibility;
  sport?: string;
  city?: string;
  createdBy: mongoose.Types.ObjectId;
  members: mongoose.Types.ObjectId[];
  admins: mongoose.Types.ObjectId[];
  createdAt: Date;
  updatedAt: Date;
}

const communityGroupSchema = new Schema<CommunityGroupDocument>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 60,
    },
    description: {
      type: String,
      trim: true,
      maxlength: 240,
      default: "",
    },
    visibility: {
      type: String,
      enum: ["PUBLIC"],
      default: "PUBLIC",
      index: true,
    },
    sport: {
      type: String,
      trim: true,
      maxlength: 60,
      default: "",
    },
    city: {
      type: String,
      trim: true,
      maxlength: 80,
      default: "",
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    members: [
      {
        type: Schema.Types.ObjectId,
        ref: "User",
        required: true,
      },
    ],
    admins: [
      {
        type: Schema.Types.ObjectId,
        ref: "User",
        required: true,
      },
    ],
  },
  { timestamps: true },
);

communityGroupSchema.index({ visibility: 1, updatedAt: -1 });
communityGroupSchema.index({ members: 1, updatedAt: -1 });

export const CommunityGroup = mongoose.model<CommunityGroupDocument>(
  "CommunityGroup",
  communityGroupSchema,
);
