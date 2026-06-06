import mongoose, { Schema, Document, Model } from "mongoose";

export type BookingInvitationStatus =
  | "PENDING"
  | "ACCEPTED"
  | "DECLINED"
  | "EXPIRED"
  | "CANCELLED";

export interface IBookingInvitation extends Document {
  bookingId: mongoose.Types.ObjectId;
  inviterId: mongoose.Types.ObjectId;
  inviteeId: mongoose.Types.ObjectId;
  venueId: mongoose.Types.ObjectId;
  coachId?: mongoose.Types.ObjectId;
  sport: string;
  date: Date;
  startTime: string;
  endTime: string;
  estimatedAmount: number;
  status: BookingInvitationStatus;
  respondedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const bookingInvitationSchema = new Schema<IBookingInvitation>(
  {
    bookingId: {
      type: Schema.Types.ObjectId,
      ref: "Booking",
      required: true,
    },
    inviterId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    inviteeId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    venueId: {
      type: Schema.Types.ObjectId,
      ref: "Venue",
      required: true,
    },
    coachId: {
      type: Schema.Types.ObjectId,
      ref: "Coach",
    },
    sport: {
      type: String,
      required: true,
    },
    date: {
      type: Date,
      required: true,
    },
    startTime: {
      type: String,
      required: true,
    },
    endTime: {
      type: String,
      required: true,
    },
    estimatedAmount: {
      type: Number,
      required: true,
    },
    status: {
      type: String,
      enum: ["PENDING", "ACCEPTED", "DECLINED", "EXPIRED", "CANCELLED"],
      default: "PENDING",
      required: true,
    },
    respondedAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
  },
);

// Indexes for efficient queries
bookingInvitationSchema.index({ inviteeId: 1, status: 1 });
bookingInvitationSchema.index({ bookingId: 1 });

// TTL index - auto-delete declined/expired invitations after 30 days
bookingInvitationSchema.index(
  { updatedAt: 1 },
  {
    expireAfterSeconds: 30 * 24 * 60 * 60, // 30 days
    partialFilterExpression: { status: { $in: ["DECLINED", "EXPIRED"] } },
  },
);

const BookingInvitation: Model<IBookingInvitation> =
  mongoose.model<IBookingInvitation>(
    "BookingInvitation",
    bookingInvitationSchema,
  );

export default BookingInvitation;
