import mongoose, { Document, Schema } from "mongoose";

export interface AthleteStoryDocument extends Document {
  sportSlug: string;
  level: number;
  name: string;
  location: string;
  achievement: string;
  quote: string;
  parentNote: string;
  tags: string[];
  createdAt: Date;
  updatedAt: Date;
}

const athleteStorySchema = new Schema<AthleteStoryDocument>(
  {
    sportSlug: { type: String, required: true, index: true },
    level: { type: Number, required: true, index: true },
    name: { type: String, required: true },
    location: { type: String, required: true },
    achievement: { type: String, required: true },
    quote: { type: String, required: true },
    parentNote: { type: String, required: true },
    tags: [{ type: String }],
  },
  { timestamps: true }
);

export const AthleteStory = mongoose.model<AthleteStoryDocument>(
  "AthleteStory",
  athleteStorySchema
);
