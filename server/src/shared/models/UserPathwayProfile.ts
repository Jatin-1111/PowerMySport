import mongoose, { Document, Schema } from "mongoose";

export interface UserPathwayProfileDocument extends Document {
  userId: mongoose.Types.ObjectId;
  progress: any; // Flexible progress state
  savedItems: any[];
  applications: any[];
  reminders: any[];
  createdAt: Date;
  updatedAt: Date;
}

const userPathwayProfileSchema = new Schema<UserPathwayProfileDocument>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, unique: true },
    progress: { type: Schema.Types.Mixed, default: { currentLevel: 0, completedSteps: {} } },
    savedItems: { type: Schema.Types.Mixed, default: [] },
    applications: { type: Schema.Types.Mixed, default: [] },
    reminders: { type: Schema.Types.Mixed, default: [] },
  },
  { timestamps: true }
);

export const UserPathwayProfile = mongoose.model<UserPathwayProfileDocument>(
  "UserPathwayProfile",
  userPathwayProfileSchema
);
