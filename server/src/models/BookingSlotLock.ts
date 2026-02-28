import mongoose, { Document, Schema } from "mongoose";

export interface BookingSlotLockDocument extends Document {
  resourceType: "VENUE_DAY" | "COACH_DAY";
  resourceId: mongoose.Types.ObjectId;
  dateKey: string;
  version: number;
  lastLockedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const bookingSlotLockSchema = new Schema<BookingSlotLockDocument>(
  {
    resourceType: {
      type: String,
      enum: ["VENUE_DAY", "COACH_DAY"],
      required: true,
    },
    resourceId: {
      type: Schema.Types.ObjectId,
      required: true,
    },
    dateKey: {
      type: String,
      required: true,
      trim: true,
    },
    version: {
      type: Number,
      default: 0,
      min: 0,
    },
    lastLockedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  },
);

bookingSlotLockSchema.index(
  { resourceType: 1, resourceId: 1, dateKey: 1 },
  { unique: true, name: "unique_booking_slot_lock" },
);

export const BookingSlotLock = mongoose.model<BookingSlotLockDocument>(
  "BookingSlotLock",
  bookingSlotLockSchema,
);
