import mongoose, { Document, Schema } from "mongoose";
import {
  IAvailability,
  IOwnVenueDetails,
  ServiceMode,
} from "../../types/index";

export type PayoutMethodType = "BANK_TRANSFER" | "UPI";

export interface IPayoutMethod {
  id?: string; // MongoDB ObjectId string for individual payout method
  type: PayoutMethodType;
  // Bank transfer fields
  accountHolderName?: string;
  accountNumber?: string;
  ifscCode?: string;
  bankName?: string;
  // UPI fields
  upiId?: string;
  /** Whether this is the primary/default method for payouts */
  isDefault?: boolean;
  addedAt: Date;
  updatedAt: Date;
}

export interface IBlockedDate {
  id?: string;
  startDate: Date;
  endDate: Date;
  reason?: string;
  allDay: boolean;
  blockedAt: Date;
}

export interface CoachDocument extends Document {
  id?: string;
  userId: mongoose.Types.ObjectId;
  bio: string;
  certifications: string[];
  sports: string[];
  hourlyRate: number;
  sportPricing?: Record<string, number>;
  serviceMode: ServiceMode;
  ownVenueDetails?: IOwnVenueDetails; // Venue details stored in coach profile for bookings only (not marketplace)
  baseLocation?: {
    // For FREELANCE coaches: their home/office location
    type: "Point";
    coordinates: [number, number]; // [longitude, latitude]
  };
  serviceRadiusKm?: number;
  travelBufferTime?: number;
  availability: IAvailability[];
  availabilityBySport?: Record<string, IAvailability[]>;
  verificationDocuments?: CoachDocumentFile[]; // Certification proofs, ID verification
  verificationStatus?: CoachVerificationStatus;
  verificationNotes?: string;
  onboardingProgressStep?: 1 | 2 | 3;
  activeSubscriptionId?: mongoose.Types.ObjectId | null;
  subscriptionStatus?: "NONE" | "ACTIVE" | "PAST_DUE" | "CANCELLED" | "EXPIRED";
  subscriptionExpiresAt?: Date | null;
  verificationSubmittedAt?: Date;
  lastVerificationReminderAt?: Date | null;
  verifiedAt?: Date | null;
  verifiedBy?: mongoose.Types.ObjectId | null;
  isVerified: boolean;
  /**
   * REQUIREMENT 3: Multiple payout methods support
   * Array of payout methods (bank transfer, UPI)
   * One method can be marked as isDefault=true for automatic payouts
   * MIGRATION NOTE: Changed from single payoutMethod to payoutMethods array
   */
  payoutMethods?: IPayoutMethod[];
  blockedDates?: IBlockedDate[];
  rating: number;
  reviewCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface CoachDocumentFile {
  id?: string;
  type:
    | "CERTIFICATION"
    | "ID_PROOF"
    | "ADDRESS_PROOF"
    | "BACKGROUND_CHECK"
    | "INSURANCE"
    | "OTHER";
  url: string;
  s3Key?: string; // S3 key for document
  fileName: string;
  uploadedAt: Date;
}

export type CoachVerificationStatus =
  | "UNVERIFIED"
  | "PENDING"
  | "REVIEW"
  | "VERIFIED"
  | "REJECTED";

const coachSchema = new Schema<CoachDocument>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: [true, "User ID is required"],
      unique: true,
    },
    bio: {
      type: String,
      default: "",
    },
    certifications: {
      type: [String],
      default: [],
    },
    sports: {
      type: [String],
      required: [true, "At least one sport is required"],
      validate: {
        validator: (v: string[]) => v.length > 0,
        message: "At least one sport must be specified",
      },
    },
    hourlyRate: {
      type: Number,
      required: [true, "Hourly rate is required"],
      min: [0, "Hourly rate must be positive"],
    },
    sportPricing: {
      type: Map,
      of: Number,
      default: {},
    },
    serviceMode: {
      type: String,
      enum: {
        values: ["OWN_VENUE", "FREELANCE", "HYBRID"],
        message: "{VALUE} is not a valid service mode",
      },
      required: [true, "Service mode is required"],
    },
    ownVenueDetails: {
      name: { type: String },
      address: { type: String },
      location: {
        type: {
          type: String,
          enum: ["Point"],
        },
        coordinates: {
          type: [Number],
          validate: {
            validator(v: any) {
              // Allow null/undefined/empty array for optional ownVenueDetails
              if (!v || (Array.isArray(v) && v.length === 0)) return true;
              // Must be an array with exactly 2 numbers
              if (!Array.isArray(v) || v.length !== 2) return false;
              // Both elements must be numbers
              return v.every(
                (coord) => typeof coord === "number" && !isNaN(coord),
              );
            },
            message: "Coordinates must be [longitude, latitude]",
          },
        },
      },
      sports: { type: [String] },
      amenities: { type: [String] },
      pricePerHour: { type: Number },
      description: { type: String },
      images: { type: [String] },
      imageS3Keys: { type: [String] },
      openingHours: { type: String },
    },
    baseLocation: {
      type: {
        type: String,
        enum: ["Point"],
      },
      coordinates: {
        type: [Number],
        validate: {
          validator(v: any) {
            // baseLocation coordinates should always be present and valid
            if (!Array.isArray(v) || v.length !== 2) return false;
            return v.every(
              (coord) => typeof coord === "number" && !isNaN(coord),
            );
          },
          message: "Coordinates must be [longitude, latitude]",
        },
      },
    },
    serviceRadiusKm: {
      type: Number,
      min: [0, "Service radius must be positive"],
    },
    travelBufferTime: {
      type: Number,
      min: [0, "Travel buffer time must be positive"],
    },
    availability: {
      type: [
        {
          dayOfWeek: {
            type: Number,
            min: 0,
            max: 6,
            required: true,
          },
          startTime: {
            type: String,
            required: true,
            match: [
              /^([01]\d|2[0-3]):([0-5]\d)$/,
              "Start time must be in HH:mm format",
            ],
          },
          endTime: {
            type: String,
            required: true,
            match: [
              /^([01]\d|2[0-3]):([0-5]\d)$/,
              "End time must be in HH:mm format",
            ],
          },
        },
      ],
      default: [],
    },
    availabilityBySport: {
      type: Map,
      of: [
        {
          dayOfWeek: {
            type: Number,
            min: 0,
            max: 6,
            required: true,
          },
          startTime: {
            type: String,
            required: true,
            match: [
              /^([01]\d|2[0-3]):([0-5]\d)$/,
              "Start time must be in HH:mm format",
            ],
          },
          endTime: {
            type: String,
            required: true,
            match: [
              /^([01]\d|2[0-3]):([0-5]\d)$/,
              "End time must be in HH:mm format",
            ],
          },
        },
      ],
      default: {},
    },
    rating: {
      type: Number,
      default: 0,
      min: 0,
      max: 5,
    },
    reviewCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    verificationDocuments: [
      {
        type: {
          type: String,
          enum: [
            "CERTIFICATION",
            "ID_PROOF",
            "ADDRESS_PROOF",
            "BACKGROUND_CHECK",
            "INSURANCE",
            "OTHER",
          ],
        },
        url: {
          type: String,
          required: true,
        },
        s3Key: {
          type: String,
        },
        fileName: {
          type: String,
          required: true,
        },
        uploadedAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
    verificationStatus: {
      type: String,
      enum: ["UNVERIFIED", "PENDING", "REVIEW", "VERIFIED", "REJECTED"],
      default: "UNVERIFIED",
    },
    verificationNotes: {
      type: String,
      default: "",
    },
    onboardingProgressStep: {
      type: Number,
      enum: [1, 2, 3],
      default: 1,
    },
    activeSubscriptionId: {
      type: Schema.Types.ObjectId,
      ref: "CoachSubscription",
      default: null,
    },
    subscriptionStatus: {
      type: String,
      enum: ["NONE", "ACTIVE", "PAST_DUE", "CANCELLED", "EXPIRED"],
      default: "NONE",
    },
    subscriptionExpiresAt: {
      type: Date,
      default: null,
    },
    verificationSubmittedAt: {
      type: Date,
    },
    lastVerificationReminderAt: {
      type: Date,
      default: null,
    },
    verifiedAt: {
      type: Date,
      default: null,
    },
    verifiedBy: {
      type: Schema.Types.ObjectId,
      ref: "Admin",
      default: null,
    },
    isVerified: {
      type: Boolean,
      default: false,
    },
    blockedDates: [
      {
        startDate: { type: Date, required: true },
        endDate: { type: Date, required: true },
        reason: { type: String, trim: true },
        allDay: { type: Boolean, default: true },
        blockedAt: { type: Date, default: Date.now },
      },
    ],
    payoutMethods: [
      {
        type: {
          type: String,
          enum: ["BANK_TRANSFER", "UPI"],
        },
        accountHolderName: { type: String, trim: true },
        accountNumber: { type: String, trim: true },
        ifscCode: { type: String, trim: true, uppercase: true },
        bankName: { type: String, trim: true },
        upiId: { type: String, trim: true },
        isDefault: { type: Boolean, default: false },
        addedAt: { type: Date, default: Date.now },
        updatedAt: { type: Date, default: Date.now },
      },
    ],
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform(doc: any, ret: any) {
        ret.id = ret._id?.toString();
        delete ret.__v;
        // Convert Map to plain object for sportPricing
        if (ret.sportPricing instanceof Map) {
          ret.sportPricing = Object.fromEntries(ret.sportPricing);
        }
        if (ret.availabilityBySport instanceof Map) {
          ret.availabilityBySport = Object.fromEntries(ret.availabilityBySport);
        }
        return ret;
      },
    },
    toObject: {
      virtuals: true,
      transform(doc: any, ret: any) {
        ret.id = ret._id?.toString();
        delete ret.__v;
        // Convert Map to plain object for sportPricing
        if (ret.sportPricing instanceof Map) {
          ret.sportPricing = Object.fromEntries(ret.sportPricing);
        }
        if (ret.availabilityBySport instanceof Map) {
          ret.availabilityBySport = Object.fromEntries(ret.availabilityBySport);
        }
        return ret;
      },
    },
  },
);

// Virtual for easy access to id as a string
coachSchema.virtual("id").get(function (this: CoachDocument) {
  return this._id.toString();
});

// Validation: Service mode conditional fields
coachSchema.pre<CoachDocument>("save", function () {
  // Only enforce venueId requirement if the coach is actually USING the venue
  // (i.e., has bookings, listings, etc). For now, allow creation/update without venueId
  // Coaches can select OWN_VENUE mode and create/link venue later

  if (this.serviceMode === "FREELANCE" || this.serviceMode === "HYBRID") {
    // Provide defaults for FREELANCE/HYBRID coaches if values are missing
    if (!this.serviceRadiusKm) {
      this.serviceRadiusKm = 10; // Default 10 km radius
    }
    if (!this.travelBufferTime) {
      this.travelBufferTime = 30; // Default 30 minutes buffer
    }
  }
});

// Index for geo-spatial queries on baseLocation (for FREELANCE coaches)
coachSchema.index({ baseLocation: "2dsphere" });
coachSchema.index({ sports: 1 });
coachSchema.index({ serviceMode: 1 });
coachSchema.index({ isVerified: 1 });
coachSchema.index({ verificationStatus: 1 });
coachSchema.index({ subscriptionStatus: 1 });

export const Coach = mongoose.model<CoachDocument>("Coach", coachSchema);
