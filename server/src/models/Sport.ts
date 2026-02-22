import mongoose, { Document, Schema } from "mongoose";

export interface SportDocument extends Document {
  id?: string;
  name: string;
  slug: string; // lowercase, hyphenated version for searching
  description?: string;
  category?: string; // e.g., "Ball Sports", "Racquet Sports", "Team Sports", etc.
  isVerified: boolean; // true if added through system verification, false if admin-added
  verifiedAt?: Date;
  addedBy?: mongoose.Types.ObjectId; // Coach who requested this sport
  createdAt: Date;
  updatedAt: Date;
}

const sportSchema = new Schema<SportDocument>(
  {
    name: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    slug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      index: true,
    },
    description: {
      type: String,
      default: "",
    },
    category: {
      type: String,
      enum: [
        "Ball Sports",
        "Racquet Sports",
        "Combat Sports",
        "Winter Sports",
        "Water Sports",
        "Team Sports",
        "Individual Sports",
        "Fitness",
        "Other",
      ],
      default: "Other",
    },
    isVerified: {
      type: Boolean,
      default: false,
    },
    verifiedAt: {
      type: Date,
      default: null,
    },
    addedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
  },
  {
    timestamps: true,
  },
);

export const Sport =
  mongoose.models.Sport || mongoose.model<SportDocument>("Sport", sportSchema);
