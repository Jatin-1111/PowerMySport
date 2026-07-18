import mongoose, { Document, Schema } from "mongoose";

export type PlanCheckInSource = "find_sport_trial" | "guidance_short_plan" | "guidance_journey";
export type PlanCheckInStatus =
  | "active" // waiting for the due date
  | "due" // nudge sent, waiting for the parent's response
  | "progressing" // parent confirmed it's working
  | "not_progressing" // parent confirmed it's not working
  | "ambiguous" // parent isn't sure — escalate to a human
  | "abandoned"; // parent said they didn't try it / stopped

export interface PlanCheckInDocument extends Document {
  userId: mongoose.Types.ObjectId;
  dependentId?: mongoose.Types.ObjectId;
  source: PlanCheckInSource;
  // Loose ref — a GuidanceSubmission._id for guidance-sourced check-ins, or
  // absent for a find-sport trial (which has no submission document).
  sourceId?: mongoose.Types.ObjectId;
  sport: string;
  title: string;
  // The 2-4 concrete, observable things the parent was told to watch for —
  // reused verbatim from the plan (shortTermPlan.successCheck, or the
  // find-sport trial's watch-for signals).
  signals: string[];
  checkInDueAt: Date;
  status: PlanCheckInStatus;
  outcomeNote?: string;
  respondedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const planCheckInSchema = new Schema<PlanCheckInDocument>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    dependentId: { type: Schema.Types.ObjectId, ref: "Player" },
    source: {
      type: String,
      enum: ["find_sport_trial", "guidance_short_plan", "guidance_journey"],
      required: true,
    },
    sourceId: { type: Schema.Types.ObjectId },
    sport: { type: String, trim: true, required: true },
    title: { type: String, required: true },
    signals: { type: [String], default: [] },
    checkInDueAt: { type: Date, required: true, index: true },
    status: {
      type: String,
      enum: ["active", "due", "progressing", "not_progressing", "ambiguous", "abandoned"],
      default: "active",
      index: true,
    },
    outcomeNote: { type: String, trim: true, maxlength: 2000 },
    respondedAt: { type: Date },
  },
  { timestamps: true },
);

planCheckInSchema.index({ userId: 1, status: 1, createdAt: -1 });

export const PlanCheckIn = mongoose.model<PlanCheckInDocument>(
  "PlanCheckIn",
  planCheckInSchema,
);
