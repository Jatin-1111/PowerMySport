import mongoose, { Document, Schema } from "mongoose";

export interface UserPathwayProfileDocument extends Document {
  userId: mongoose.Types.ObjectId;
  // Which child this saved-items/progress/applications bucket belongs to.
  // Null means "no specific child" — kept only so a profile predating this
  // field, or a parent who hasn't picked a dependent yet, has somewhere to go.
  dependentId: mongoose.Types.ObjectId | null;
  progress: any; // Flexible progress state
  savedItems: any[];
  applications: any[];
  reminders: any[];
  createdAt: Date;
  updatedAt: Date;
}

const userPathwayProfileSchema = new Schema<UserPathwayProfileDocument>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    dependentId: {
      type: Schema.Types.ObjectId,
      ref: "Player",
      default: null,
    },
    progress: {
      type: Schema.Types.Mixed,
      default: { currentLevel: 0, completedSteps: {} },
    },
    savedItems: { type: Schema.Types.Mixed, default: [] },
    applications: { type: Schema.Types.Mixed, default: [] },
    reminders: { type: Schema.Types.Mixed, default: [] },
  },
  { timestamps: true },
);

// One profile per (user, dependent) pair — dependentId: null is its own slot,
// so a parent with no dependent selected still gets exactly one such profile.
userPathwayProfileSchema.index({ userId: 1, dependentId: 1 }, { unique: true });

export const UserPathwayProfile = mongoose.model<UserPathwayProfileDocument>(
  "UserPathwayProfile",
  userPathwayProfileSchema,
);
