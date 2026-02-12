import mongoose, { Schema, Document } from "mongoose";
import { IPayment, BookingStatus } from "../types";

export interface BookingDocument extends Document {
  userId: mongoose.Types.ObjectId;
  venueId: mongoose.Types.ObjectId;
  coachId?: mongoose.Types.ObjectId;
  sport: string;
  date: Date;
  startTime: string;
  endTime: string;
  payments: IPayment[];
  totalAmount: number;
  status: BookingStatus;
  expiresAt: Date;
  verificationToken?: string;
  qrCode?: string;
  participantName: string;
  participantId?: mongoose.Types.ObjectId;
  participantAge?: number;
  createdAt: Date;
  updatedAt: Date;
}

const bookingSchema = new Schema<BookingDocument>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: [true, "User ID is required"],
    },
    venueId: {
      type: Schema.Types.ObjectId,
      ref: "Venue",
      required: [true, "Venue ID is required"],
    },
    coachId: {
      type: Schema.Types.ObjectId,
      ref: "Coach",
    },
    sport: {
      type: String,
      required: [true, "Sport is required"],
      trim: true,
    },
    date: {
      type: Date,
      required: [true, "Booking date is required"],
    },
    startTime: {
      type: String,
      required: [true, "Start time is required"],
      match: [
        /^([01]\d|2[0-3]):([0-5]\d)$/,
        "Start time must be in HH:mm format",
      ],
    },
    endTime: {
      type: String,
      required: [true, "End time is required"],
      match: [
        /^([01]\d|2[0-3]):([0-5]\d)$/,
        "End time must be in HH:mm format",
      ],
    },
    payments: {
      type: [
        {
          userId: {
            type: Schema.Types.ObjectId,
            ref: "User",
            required: true,
          },
          userType: {
            type: String,
            enum: ["VENUE_LISTER", "COACH"],
            required: true,
          },
          amount: {
            type: Number,
            required: true,
            min: 0,
          },
          status: {
            type: String,
            enum: ["PENDING", "PAID"],
            default: "PENDING",
          },
          paymentLink: String,
          paidAt: Date,
        },
      ],
      default: [],
    },
    totalAmount: {
      type: Number,
      required: [true, "Total amount is required"],
      min: 0,
    },
    status: {
      type: String,
      enum: ["PENDING_PAYMENT", "CONFIRMED", "CANCELLED", "EXPIRED"],
      default: "PENDING_PAYMENT",
    },
    expiresAt: {
      type: Date,
      required: [true, "Expiration time is required"],
    },
    verificationToken: {
      type: String,
      select: false, // Hidden by default for security
    },
    qrCode: {
      type: String,
    },
    participantName: {
      type: String,
      required: [true, "Participant name is required"],
    },
    participantId: {
      type: Schema.Types.ObjectId,
    },
    participantAge: {
      type: Number,
    },
  },
  { timestamps: true },
);

// Index for faster booking conflict checks (venue)
bookingSchema.index({ venueId: 1, date: 1, startTime: 1, endTime: 1 });

// Index for coach booking conflicts
bookingSchema.index({ coachId: 1, date: 1, startTime: 1, endTime: 1 });

// Index for expiration cleanup job
bookingSchema.index({ expiresAt: 1, status: 1 });

// Index for verification token lookup
bookingSchema.index({ verificationToken: 1 }, { unique: true, sparse: true });

export const Booking = mongoose.model<BookingDocument>(
  "Booking",
  bookingSchema,
);
