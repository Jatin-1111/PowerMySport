import mongoose, { Document, Schema } from "mongoose";

export interface IVenueInquiry extends Document {
  venueName: string;
  ownerName: string;
  phone: string;
  address: string;
  sports: string;
  message?: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  reviewedBy?: mongoose.Types.ObjectId;
  reviewedAt?: Date;
  reviewNotes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const VenueInquirySchema: Schema = new Schema(
  {
    venueName: {
      type: String,
      required: true,
      trim: true,
    },
    ownerName: {
      type: String,
      required: true,
      trim: true,
    },
    phone: {
      type: String,
      required: true,
      trim: true,
    },
    address: {
      type: String,
      required: true,
      trim: true,
    },
    sports: {
      type: String,
      required: true,
      trim: true,
    },
    message: {
      type: String,
      trim: true,
    },
    status: {
      type: String,
      enum: ["PENDING", "APPROVED", "REJECTED"],
      default: "PENDING",
    },
    reviewedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
    reviewedAt: {
      type: Date,
    },
    reviewNotes: {
      type: String,
      trim: true,
    },
  },
  {
    timestamps: true,
  },
);

// Index for faster queries
VenueInquirySchema.index({ phone: 1 });
VenueInquirySchema.index({ status: 1 });
VenueInquirySchema.index({ createdAt: -1 });

export default mongoose.model<IVenueInquiry>(
  "VenueInquiry",
  VenueInquirySchema,
);
