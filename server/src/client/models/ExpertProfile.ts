import mongoose, { Document, Schema } from "mongoose";
import { IPayoutMethod } from "./Coach";
import {
  isEncryptedValue,
  encryptValue,
  decryptValue,
} from "../../shared/utils/encryption";

/**
 * Expert = an elite/ex-professional player who offers paid 1:1 sessions.
 * Profiles can be created by the admin panel OR by self-registration.
 * Self-registered experts start with verificationStatus "UNVERIFIED" and isActive
 * false; they complete an onboarding wizard, submit for review (PENDING), and go
 * live only after an admin approves (APPROVED → isActive true).
 * Admin-created experts are provisioned with verificationStatus "APPROVED" directly.
 */

/**
 * A recurring weekly availability window. `dayOfWeek` is 0 (Sunday) – 6 (Saturday).
 * `start`/`end` are local "HH:mm" 24h times interpreted in the expert's `timezone`.
 */
export interface ExpertAvailabilityWindow {
  dayOfWeek: number; // 0-6
  start: string; // "HH:mm"
  end: string; // "HH:mm"
}

export interface ExpertDocument extends Document {
  userId: mongoose.Types.ObjectId;
  bio: string;
  sports: string[];
  expertise: string[];
  achievements?: string;
  sessionFee: number;
  sessionMode: "ONLINE" | "IN_PERSON" | "BOTH";
  sessionDurationMinutes: number;
  timezone: string;
  weeklyAvailability: ExpertAvailabilityWindow[];
  blackoutDates: string[]; // "YYYY-MM-DD" the expert is unavailable
  city?: string;
  languages?: string[];
  photoUrl?: string;
  photoKey?: string;
  /** Where an IN_PERSON/BOTH-mode session actually happens. Only ever shown
   *  to a client with an active booking — never on the public discovery listing. */
  inPersonAddress?: string;
  isActive: boolean;
  verificationStatus: "UNVERIFIED" | "PENDING" | "APPROVED" | "REJECTED";
  rejectionReason?: string;
  /** Snapshot of `sports` taken the moment an admin approves this expert —
   *  pathway-verification eligibility checks against this, not the live
   *  `sports` array, so adding a new sport post-approval can't grant instant
   *  "verified expert" credit for it without going through review again. */
  approvedSports?: string[];
  rating: number;
  reviewCount: number;
  payoutMethods: IPayoutMethod[];
  /** PAN — stored encrypted at rest. Required to submit for review. */
  panNumber?: string;
  /** GST number — optional; not every individual expert is GST-registered. */
  gstNumber?: string;
  createdBy?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const availabilityWindowSchema = new Schema<ExpertAvailabilityWindow>(
  {
    dayOfWeek: { type: Number, required: true, min: 0, max: 6 },
    start: { type: String, required: true }, // "HH:mm"
    end: { type: String, required: true }, // "HH:mm"
  },
  { _id: false },
);

const expertSchema = new Schema<ExpertDocument>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
      index: true,
    },
    bio: { type: String, default: "", trim: true, maxlength: 4000 },
    sports: { type: [String], default: [] },
    expertise: { type: [String], default: [] },
    achievements: { type: String, trim: true },
    sessionFee: { type: Number, required: true, min: 0 },
    sessionMode: {
      type: String,
      enum: ["ONLINE", "IN_PERSON", "BOTH"],
      default: "ONLINE",
    },
    sessionDurationMinutes: { type: Number, default: 60, min: 15, max: 480 },
    timezone: { type: String, default: "Asia/Kolkata" },
    weeklyAvailability: { type: [availabilityWindowSchema], default: [] },
    blackoutDates: { type: [String], default: [] },
    city: { type: String, trim: true, index: true },
    languages: { type: [String], default: [] },
    photoUrl: { type: String },
    photoKey: { type: String },
    inPersonAddress: { type: String, trim: true, maxlength: 500 },
    isActive: { type: Boolean, default: false, index: true },
    verificationStatus: {
      type: String,
      enum: ["UNVERIFIED", "PENDING", "APPROVED", "REJECTED"],
      default: "UNVERIFIED",
      index: true,
    },
    rejectionReason: { type: String, trim: true },
    approvedSports: { type: [String] },
    rating: { type: Number, default: 0, min: 0, max: 5 },
    reviewCount: { type: Number, default: 0, min: 0 },
    payoutMethods: {
      type: [
        {
          id: String,
          type: { type: String, enum: ["BANK_TRANSFER", "UPI"] },
          accountHolderName: String,
          accountNumber: { type: String, get: (v: string) => decryptValue(v) },
          ifscCode: { type: String, get: (v: string) => decryptValue(v) },
          bankName: String,
          upiId: { type: String, get: (v: string) => decryptValue(v) },
          isDefault: Boolean,
          addedAt: { type: Date, default: Date.now },
          updatedAt: { type: Date, default: Date.now },
        },
      ],
      default: [],
    },
    // PAN — encrypted at rest (see pre("save") hook below).
    panNumber: { type: String, trim: true, get: (v: string) => decryptValue(v) },
    // GST — not encrypted: a business-registration number, semi-public by
    // nature, unlike PAN or bank details. Matches Academy's own precedent.
    gstNumber: { type: String, trim: true, uppercase: true },
    createdBy: { type: Schema.Types.ObjectId, ref: "Admin" },
  },
  { timestamps: true },
);

expertSchema.set("toJSON", { getters: true });
expertSchema.set("toObject", { getters: true });

// Backstop for any direct .save()/.create() path (e.g. Expert.create in
// createExpertByAdmin). The onboarding/admin-edit path (sanitizeProfilePatch
// in ExpertsService.ts) writes via findOneAndUpdate, which never runs this
// hook, so panNumber is encrypted explicitly there too — not just here.
expertSchema.pre("save", function () {
  if (this.isModified("panNumber") && this.panNumber && !isEncryptedValue(this.panNumber)) {
    this.panNumber = encryptValue(this.panNumber);
  }
  if (this.isModified("payoutMethods") && Array.isArray(this.payoutMethods)) {
    this.payoutMethods.forEach((method) => {
      if (method.accountNumber && !isEncryptedValue(method.accountNumber)) {
        method.accountNumber = encryptValue(method.accountNumber);
      }
      if (method.ifscCode && !isEncryptedValue(method.ifscCode)) {
        method.ifscCode = encryptValue(method.ifscCode);
      }
      if (method.upiId && !isEncryptedValue(method.upiId)) {
        method.upiId = encryptValue(method.upiId);
      }
    });
  }
});

expertSchema.index({ isActive: 1, rating: -1 });
// Text index to support server-side search across name-adjacent fields.
expertSchema.index({
  bio: "text",
  expertise: "text",
  sports: "text",
  city: "text",
});

export const Expert =
  mongoose.models.Expert ||
  mongoose.model<ExpertDocument>("Expert", expertSchema);
