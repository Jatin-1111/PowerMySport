import mongoose, { Document, Schema } from "mongoose";

export type NoteType = "GENERAL" | "SESSION" | "INJURY" | "GOAL" | "PROGRESS";

export interface CoachClientNoteDocument extends Document {
  coachId: mongoose.Types.ObjectId;
  clientId: mongoose.Types.ObjectId;
  note: string;
  noteType: NoteType;
  sessionDate?: Date;
  bookingId?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const coachClientNoteSchema = new Schema<CoachClientNoteDocument>(
  {
    coachId: {
      type: Schema.Types.ObjectId,
      ref: "Coach",
      required: true,
      index: true,
    },
    clientId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    note: { type: String, required: true, trim: true, maxlength: 2000 },
    noteType: {
      type: String,
      enum: ["GENERAL", "SESSION", "INJURY", "GOAL", "PROGRESS"],
      default: "GENERAL",
    },
    sessionDate: { type: Date },
    bookingId: { type: Schema.Types.ObjectId, ref: "Booking" },
  },
  { timestamps: true },
);

coachClientNoteSchema.index({ coachId: 1, clientId: 1, createdAt: -1 });

export const CoachClientNote = mongoose.model<CoachClientNoteDocument>(
  "CoachClientNote",
  coachClientNoteSchema,
);
