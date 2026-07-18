import mongoose, { Document, Schema } from "mongoose";

export type ScreeningStatus = "requested" | "scheduled" | "completed" | "cancelled";

export interface ScreeningRequestDocument extends Document {
  parentId?: mongoose.Types.ObjectId;
  dependentName: string;
  sport?: string;
  phone: string;
  preferredTime?: string;
  city?: string;
  status: ScreeningStatus;
  adminNotes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const ScreeningRequestSchema = new Schema<ScreeningRequestDocument>(
  {
    parentId: { type: Schema.Types.ObjectId, ref: "Player", index: true },
    dependentName: { type: String, required: true, trim: true },
    sport: { type: String, trim: true },
    phone: { type: String, required: true, trim: true },
    preferredTime: { type: String, trim: true },
    city: { type: String, trim: true },
    status: {
      type: String,
      enum: ["requested", "scheduled", "completed", "cancelled"],
      default: "requested",
    },
    adminNotes: { type: String, trim: true },
  },
  { timestamps: true }
);

export const ScreeningRequest = mongoose.model<ScreeningRequestDocument>(
  "ScreeningRequest",
  ScreeningRequestSchema
);
