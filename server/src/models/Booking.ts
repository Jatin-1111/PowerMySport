import mongoose, { Document, Schema } from "mongoose";
import { BookingStatus } from "../types";

export type BookingType = "INDIVIDUAL" | "GROUP";
export type PaymentType = "SINGLE" | "SPLIT";
export type SplitMethod = "EQUAL" | "CUSTOM";
export type ParticipantStatus = "INVITED" | "ACCEPTED" | "DECLINED";

export interface BookingPayment {
  userId: mongoose.Types.ObjectId;
  userType: "VENUE_LISTER" | "COACH" | "PLAYER";
  amount: number;
  status: "PENDING" | "PAID" | "FAILED";
  paidAt?: Date;
}

export interface BookingParticipant {
  userId: mongoose.Types.ObjectId;
  name: string;
  status: ParticipantStatus;
  invitedAt: Date;
  respondedAt?: Date;
}

export interface BookingDocument extends Document {
  userId: mongoose.Types.ObjectId;
  venueId?: mongoose.Types.ObjectId;
  coachId?: mongoose.Types.ObjectId;
  sport: string;
  date: Date;
  startTime: string;
  endTime: string;
  totalAmount: number;
  serviceFee?: number;
  taxAmount?: number;
  promoCode?: string;
  discountAmount?: number;
  status: BookingStatus;
  expiresAt?: Date; // Optional - only set for PENDING_PAYMENT bookings
  checkInCode?: string;
  participantName: string;
  participantId?: mongoose.Types.ObjectId;
  participantAge?: number;
  paymentConfirmedAt?: Date;
  confirmationEmailSentAt?: Date;
  cancelledAt?: Date;
  cancellationReason?: string;
  refundAmount?: number;
  refundStatus?: "PENDING" | "PROCESSED" | "REJECTED";
  payments: BookingPayment[];
  // Group booking fields
  bookingType: BookingType;
  organizerId: mongoose.Types.ObjectId;
  participants: BookingParticipant[];
  paymentType: PaymentType;
  splitMethod?: SplitMethod;
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
      required: false,
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
    totalAmount: {
      type: Number,
      required: [true, "Total amount is required"],
      min: 0,
    },
    serviceFee: {
      type: Number,
      default: 0,
      min: 0,
    },
    taxAmount: {
      type: Number,
      default: 0,
      min: 0,
    },
    promoCode: {
      type: String,
      trim: true,
      uppercase: true,
    },
    discountAmount: {
      type: Number,
      default: 0,
      min: 0,
    },
    status: {
      type: String,
      enum: [
        "PENDING_INVITES",
        "CONFIRMED",
        "IN_PROGRESS",
        "COMPLETED",
        "CANCELLED",
        "NO_SHOW",
      ],
      default: "CONFIRMED",
    },
    expiresAt: {
      type: Date,
      required: false, // Only required for PENDING_PAYMENT bookings
    },
    checkInCode: {
      type: String,
      select: false,
      uppercase: true,
      trim: true,
      minlength: 8,
      maxlength: 8,
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
    paymentConfirmedAt: {
      type: Date,
    },
    confirmationEmailSentAt: {
      type: Date,
    },
    cancelledAt: {
      type: Date,
    },
    cancellationReason: {
      type: String,
      trim: true,
    },
    refundAmount: {
      type: Number,
      min: 0,
    },
    refundStatus: {
      type: String,
      enum: ["PENDING", "PROCESSED", "REJECTED"],
    },
    payments: [
      {
        userId: {
          type: Schema.Types.ObjectId,
          ref: "User",
          required: true,
        },
        userType: {
          type: String,
          enum: ["VENUE_LISTER", "COACH", "PLAYER"],
          required: true,
        },
        amount: {
          type: Number,
          required: true,
          min: 0,
        },
        status: {
          type: String,
          enum: ["PENDING", "PAID", "FAILED"],
          default: "PENDING",
        },
        paidAt: {
          type: Date,
        },
      },
    ],
    // Group booking fields
    bookingType: {
      type: String,
      enum: ["INDIVIDUAL", "GROUP"],
      default: "INDIVIDUAL",
    },
    organizerId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    participants: [
      {
        userId: {
          type: Schema.Types.ObjectId,
          ref: "User",
          required: true,
        },
        name: {
          type: String,
          required: true,
        },
        status: {
          type: String,
          enum: ["INVITED", "ACCEPTED", "DECLINED"],
          default: "INVITED",
        },
        invitedAt: {
          type: Date,
          required: true,
        },
        respondedAt: {
          type: Date,
        },
      },
    ],
    paymentType: {
      type: String,
      enum: ["SINGLE", "SPLIT"],
      default: "SINGLE",
    },
    splitMethod: {
      type: String,
      enum: ["EQUAL", "CUSTOM"],
    },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform: function (_doc: any, ret: any) {
        ret.id = ret._id.toString();
        delete ret._id;
        delete ret.__v;
        return ret;
      },
    },
  },
);

// Index for faster booking conflict checks (venue)
bookingSchema.index({ venueId: 1, date: 1, startTime: 1, endTime: 1 });

// Index for coach booking conflicts
bookingSchema.index({ coachId: 1, date: 1, startTime: 1, endTime: 1 });

// Index for expiration cleanup job
bookingSchema.index({ expiresAt: 1, status: 1 });

// Index for fast check-in code lookups
bookingSchema.index({ checkInCode: 1 });

// Compound index for admin: user booking history sorted by date
bookingSchema.index({ userId: 1, status: 1, date: -1 });

// Compound index for admin: all bookings by status sorted by creation date
bookingSchema.index({ status: 1, createdAt: -1 });

// Unique index for venue bookings only
bookingSchema.index(
  { userId: 1, venueId: 1, date: 1, startTime: 1 },
  {
    unique: true,
    name: "unique_venue_booking_slot",
    partialFilterExpression: { venueId: { $exists: true } },
  },
);

// Unique index for coach bookings only
bookingSchema.index(
  { userId: 1, coachId: 1, date: 1, startTime: 1 },
  {
    unique: true,
    name: "unique_coach_booking_slot",
    partialFilterExpression: { coachId: { $exists: true } },
  },
);

export const Booking = mongoose.model<BookingDocument>(
  "Booking",
  bookingSchema,
);
