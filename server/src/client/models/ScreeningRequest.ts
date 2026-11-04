import mongoose, { Document, Schema } from "mongoose";

export type ScreeningStatus = "requested" | "scheduled" | "completed" | "cancelled";

export interface ScreeningRequestDocument extends Document {
  parentId?: mongoose.Types.ObjectId;
  /** The specific child (Player, type DEPENDENT) this request is for, when known — lets the journey UI check for a real booking against a specific profile rather than just a name string. */
  dependentId?: mongoose.Types.ObjectId;
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
    parentId: { type: Schema.Types.ObjectId, ref: "User", index: true },
    dependentId: { type: Schema.Types.ObjectId, ref: "Player", index: true },
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

// Backs getMyScreeningRequests' {parentId} + sort {createdAt:-1}.
ScreeningRequestSchema.index({ parentId: 1, createdAt: -1 });
// Backs getScreeningRequests' admin list — {status?} + sort {createdAt:-1}.
// Two variants since `status` is an optional filter there: an unconstrained
// middle field blocks a compound index from serving the sort, so "all
// statuses" needs its own index rather than a prefix of the filtered one.
// Production has autoIndex off, so these also need migration 35.
ScreeningRequestSchema.index({ createdAt: -1 });
ScreeningRequestSchema.index({ status: 1, createdAt: -1 });

export const ScreeningRequest = mongoose.model<ScreeningRequestDocument>(
  "ScreeningRequest",
  ScreeningRequestSchema
);
