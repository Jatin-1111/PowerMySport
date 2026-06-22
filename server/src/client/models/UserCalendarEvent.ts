import mongoose, { Document, Schema } from "mongoose";

export type CalendarEventType =
  | "IMPORTANT"
  | "COMPETITION"
  | "TRAINING"
  | "REMINDER"
  | "OTHER";

export interface UserCalendarEventDocument extends Document {
  userId: mongoose.Types.ObjectId;
  title: string;
  date: Date;
  color: string;
  type: CalendarEventType;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const userCalendarEventSchema = new Schema<UserCalendarEventDocument>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    title: {
      type: String,
      required: [true, "Title is required"],
      trim: true,
      maxlength: 120,
    },
    date: {
      type: Date,
      required: [true, "Date is required"],
    },
    color: {
      type: String,
      default: "#f97316",
    },
    type: {
      type: String,
      enum: ["IMPORTANT", "COMPETITION", "TRAINING", "REMINDER", "OTHER"],
      default: "IMPORTANT",
    },
    notes: {
      type: String,
      trim: true,
      maxlength: 500,
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

userCalendarEventSchema.index({ userId: 1, date: 1 });

export const UserCalendarEvent = mongoose.model<UserCalendarEventDocument>(
  "UserCalendarEvent",
  userCalendarEventSchema,
);
