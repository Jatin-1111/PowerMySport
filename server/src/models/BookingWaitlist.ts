import mongoose, { Document, Schema } from "mongoose";

export interface BookingWaitlistDocument extends Document {
  userId: mongoose.Types.ObjectId;
  venueId?: mongoose.Types.ObjectId;
  coachId?: mongoose.Types.ObjectId;
  sport: string;
  date: Date;
  startTime: string;
  endTime: string;
  alternateSlots: string[];
  status: "ACTIVE" | "NOTIFIED" | "CANCELLED";
  notifiedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const bookingWaitlistSchema = new Schema<BookingWaitlistDocument>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    venueId: { type: Schema.Types.ObjectId, ref: "Venue", index: true },
    coachId: { type: Schema.Types.ObjectId, ref: "Coach", index: true },
    sport: { type: String, required: true, trim: true },
    date: { type: Date, required: true, index: true },
    startTime: { type: String, required: true },
    endTime: { type: String, required: true },
    alternateSlots: { type: [String], default: [] },
    status: {
      type: String,
      enum: ["ACTIVE", "NOTIFIED", "CANCELLED"],
      default: "ACTIVE",
      index: true,
    },
    notifiedAt: { type: Date },
  },
  { timestamps: true },
);

bookingWaitlistSchema.index(
  { userId: 1, venueId: 1, coachId: 1, date: 1, startTime: 1 },
  { unique: true, partialFilterExpression: { status: "ACTIVE" } },
);

export const BookingWaitlist = mongoose.model<BookingWaitlistDocument>(
  "BookingWaitlist",
  bookingWaitlistSchema,
);
