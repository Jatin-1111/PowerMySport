import mongoose, { Schema, Document } from "mongoose";

export interface IVenueInquiry extends Document {
  venueName: string;
  ownerName: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  sports: string;
  facilities?: string;
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
    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
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
    city: {
      type: String,
      required: true,
      trim: true,
    },
    sports: {
      type: String,
      required: true,
      trim: true,
    },
    facilities: {
      type: String,
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
VenueInquirySchema.index({ email: 1 });
VenueInquirySchema.index({ status: 1 });
VenueInquirySchema.index({ createdAt: -1 });

export default mongoose.model<IVenueInquiry>(
  "VenueInquiry",
  VenueInquirySchema,
);
