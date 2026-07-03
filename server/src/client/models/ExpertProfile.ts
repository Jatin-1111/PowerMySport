import mongoose, { Document, Schema } from "mongoose";

/**
 * Expert = an admin-vetted expert player who offers paid 1:1 sessions.
 * Profiles are created ONLY via the admin panel (experts cannot self-register).
 * The linked User (role EXPERT) logs into the client app with emailed credentials.
 * (File is named ExpertProfile.ts; the Mongoose model name is "Expert".)
 */
export interface ExpertPayoutMethod {
  id?: string;
  type: "BANK_TRANSFER" | "UPI";
  accountHolderName?: string;
  accountNumber?: string;
  ifscCode?: string;
  bankName?: string;
  upiId?: string;
  isDefault?: boolean;
  addedAt?: Date;
}

export interface ExpertDocument extends Document {
  userId: mongoose.Types.ObjectId;
  bio: string;
  sports: string[];
  expertise: string[];
  achievements?: string;
  sessionFee: number;
  sessionMode: "ONLINE" | "IN_PERSON" | "BOTH";
  city?: string;
  languages?: string[];
  photoUrl?: string;
  photoKey?: string;
  isActive: boolean;
  rating: number;
  reviewCount: number;
  payoutMethods: ExpertPayoutMethod[];
  createdBy?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const expertSchema = new Schema<ExpertDocument>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, unique: true, index: true },
    bio: { type: String, default: "", trim: true, maxlength: 4000 },
    sports: { type: [String], default: [] },
    expertise: { type: [String], default: [] },
    achievements: { type: String, trim: true },
    sessionFee: { type: Number, required: true, min: 0 },
    sessionMode: { type: String, enum: ["ONLINE", "IN_PERSON", "BOTH"], default: "ONLINE" },
    city: { type: String, trim: true, index: true },
    languages: { type: [String], default: [] },
    photoUrl: { type: String },
    photoKey: { type: String },
    isActive: { type: Boolean, default: true, index: true },
    rating: { type: Number, default: 0, min: 0, max: 5 },
    reviewCount: { type: Number, default: 0, min: 0 },
    payoutMethods: {
      type: [
        {
          id: String,
          type: { type: String, enum: ["BANK_TRANSFER", "UPI"] },
          accountHolderName: String,
          accountNumber: String,
          ifscCode: String,
          bankName: String,
          upiId: String,
          isDefault: Boolean,
          addedAt: Date,
        },
      ],
      default: [],
    },
    createdBy: { type: Schema.Types.ObjectId, ref: "Admin" },
  },
  { timestamps: true },
);

expertSchema.index({ isActive: 1, rating: -1 });

export const Expert =
  mongoose.models.Expert ||
  mongoose.model<ExpertDocument>("Expert", expertSchema);
