import mongoose, { Document, Schema } from "mongoose";
import { IGeoLocation, OpeningHours } from "../../types/index";

export interface AcademyOwnedVenue {
  name: string;
  address: string;
  city: string;
  state: string;
  pincode: string;
  placeId?: string;
  location: IGeoLocation;
  sports: string[];
  pricePerHour: number;
  sportPricing?: Record<string, number>;
  amenities: string[];
  description?: string;
  openingHours: OpeningHours;
  allowExternalCoaches: boolean;
  generalImages: string[];
  generalImageKeys: string[];
  sportImages: Record<string, string[]>;
  sportImageKeys: Record<string, string[]>;
  coverPhotoUrl: string;
  coverPhotoKey?: string;
}

export interface AcademyCoachOwnVenue {
  name: string;
  address: string;
  description?: string;
  openingHours?: string;
  amenities?: string[];
  images: string[];
  imageS3Keys?: string[];
  location?: IGeoLocation;
}

export interface AcademyOwnedCoach {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  bio: string;
  profilePhotoUrl?: string;
  profilePhotoKey?: string;
  sports: string[];
  hourlyRate: number;
  sportPricing?: Record<string, number>;
  serviceMode: "OWN_VENUE" | "FREELANCE" | "HYBRID";
  baseLocation?: IGeoLocation;
  serviceRadiusKm?: number;
  travelBufferTime?: number;
  ownVenueDetails?: AcademyCoachOwnVenue;
  certifications?: string[];
}

export interface AcademyDocument extends Document {
  // Identity
  name: string;
  legalName: string;
  slug: string; // Unique, used in URLs: /academies/[slug]
  description: string;
  establishedYear?: number;
  logoUrl?: string;
  logoKey?: string;
  coverPhotoUrl?: string;
  coverPhotoKey?: string; // S3 key for regenerating presigned URL
  photos: string[]; // Gallery image URLs (presigned)
  photoKeys: string[]; // S3 keys for gallery images

  // Sport & Demographics
  sports: string[];
  ageGroups: ("kids" | "teens" | "adults" | "all")[]; // kids: 5-12, teens: 13-17, adults: 18+

  // Location (using same structure as Coach/Venue)
  location: IGeoLocation;
  // Note: Extracted for convenience, but can be queried from location.coordinates
  address?: string;
  city?: string;
  state?: string;
  pincode?: string;
  placeId?: string;

  // Legal & Compliance
  gstNumber?: string;
  panNumber: string;
  panDocumentUrl: string;
  panDocumentKey?: string; // S3 key
  businessType: "sole_proprietorship" | "partnership" | "pvt_ltd" | "ngo_trust";
  gstDocumentUrl?: string;
  gstDocumentKey?: string; // S3 key
  msmeRegistration?: string;
  sportsAuthorityAffiliation?: string;
  aadhaarLast4: string; // Store only last 4 digits for privacy

  // Operational
  operatingHours: OpeningHours;
  languagesSpoken: string[];
  whatsappNumber: string; // +91XXXXXXXXXX
  contactEmail: string;
  contactPhone: string; // +91XXXXXXXXXX
  contactPersonName: string;
  allowsExternalCoaches: boolean; // If true, owned venues appear in /venues listing
  maxBatchSize: number; // Students per session
  batchTimings: ("morning" | "evening" | "both")[]; // morning: 6am-12pm, evening: 4pm-9pm
  academyVenues: AcademyOwnedVenue[];
  academyCoaches: AcademyOwnedCoach[];

  // Relationships
  ownerId?: mongoose.Types.ObjectId; // Optional FK -> User if an account already exists
  venueIds: mongoose.Types.ObjectId[]; // FK -> Venue (owned venues)
  coachIds: mongoose.Types.ObjectId[]; // FK -> Coach (in-house coaches)

  // Pricing
  sessionRatePerHour: number; // In paise (multiply user-facing ₹ by 100)
  trialsessionOffered: boolean;
  trialSessionPrice?: number; // In paise
  subscriptionPlans: mongoose.Types.ObjectId[]; // FK -> SubscriptionPlan
  sessionPackages: mongoose.Types.ObjectId[]; // FK -> SessionPackage

  // Payouts
  bankAccountNumber: string; // Encrypted
  bankIfsc: string;
  bankAccountName: string;
  upiId: string;
  payoutFrequency: "weekly" | "biweekly" | "monthly";
  cancellationPolicy: string;
  refundPolicy: string;

  // KYC & Status
  kycVerified: boolean;
  isActive: boolean; // Can go live only if approved AND kycVerified
  isApproved: boolean;
  rejectionReason?: string; // If rejected, store reason
  onboardingStep: 1 | 2 | 3 | 4 | 5 | 6 | 7;
  onboardingCompleted: boolean;

  // Ratings & Engagement
  rating: number;
  reviewCount: number;

  // Timestamps
  createdAt: Date;
  updatedAt: Date;
}

const academySchema = new Schema<AcademyDocument>(
  {
    // Identity
    name: {
      type: String,
      required: [true, "Academy name is required"],
      trim: true,
    },
    legalName: {
      type: String,
      required: [true, "Legal/registered name is required"],
      trim: true,
    },
    slug: {
      type: String,
      required: [true, "Slug is required"],
      unique: true,
      lowercase: true,
      trim: true,
      match: [
        /^[a-z0-9\-]+$/,
        "Slug must contain only lowercase letters, numbers, and hyphens",
      ],
    },
    description: {
      type: String,
      default: "",
      maxlength: [300, "Description cannot exceed 300 characters"],
    },
    establishedYear: {
      type: Number,
      min: [1900, "Year must be 1900 or later"],
      max: [new Date().getFullYear(), "Year cannot be in the future"],
    },
    logoUrl: {
      type: String,
      optional: true,
    },
    logoKey: {
      type: String,
      optional: true,
    },
    coverPhotoUrl: {
      type: String,
      optional: true,
    },
    coverPhotoKey: {
      type: String,
      optional: true,
    },
    photos: {
      type: [String],
      default: [],
    },
    photoKeys: {
      type: [String],
      default: [],
    },

    // Sport & Demographics
    sports: {
      type: [String],
      required: [true, "At least one sport is required"],
      validate: {
        validator: (v: string[]) => v.length > 0,
        message: "At least one sport must be specified",
      },
    },
    ageGroups: {
      type: [String],
      enum: ["kids", "teens", "adults", "all"],
      required: [true, "At least one age group is required"],
    },

    // Location (GeoJSON Point - same as Coach/Venue)
    location: {
      type: {
        type: String,
        enum: ["Point"],
        required: true,
      },
      coordinates: {
        type: [Number],
        required: true,
        validate: {
          validator(v: any) {
            if (!Array.isArray(v) || v.length !== 2) return false;
            return v.every(
              (coord) => typeof coord === "number" && !isNaN(coord),
            );
          },
          message: "Coordinates must be [longitude, latitude]",
        },
      },
    },
    address: {
      type: String,
      optional: true,
    },
    city: {
      type: String,
      optional: true,
    },
    state: {
      type: String,
      optional: true,
    },
    pincode: {
      type: String,
      optional: true,
      validate: {
        validator(v: any) {
          if (!v) return true; // Optional field
          return /^[0-9]{6}$/.test(v);
        },
        message: "Pincode must be 6 digits",
      },
    },
    placeId: {
      type: String,
      optional: true,
    },

    // Legal & Compliance
    panNumber: {
      type: String,
      default: "",
      validate: {
        validator(v: string) {
          if (!v) return true; // Optional field
          return /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(v);
        },
        message: "Invalid PAN number format",
      },
    },
    panDocumentUrl: {
      type: String,
      default: "",
    },
    panDocumentKey: {
      type: String,
      optional: true,
    },
    businessType: {
      type: String,
      enum: ["sole_proprietorship", "partnership", "pvt_ltd", "ngo_trust"],
      default: "sole_proprietorship",
    },
    gstNumber: {
      type: String,
      optional: true,
      validate: {
        validator(v: any) {
          if (!v) return true; // Optional field
          // GST format: 2 digits + 5 letters + 4 digits + 1 letter + 3 alphanumeric
          return /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[A-Z0-9]{3}$/.test(v);
        },
        message: "Invalid GST number format",
      },
    },
    gstDocumentUrl: {
      type: String,
      optional: true,
    },
    gstDocumentKey: {
      type: String,
      optional: true,
    },
    msmeRegistration: {
      type: String,
      optional: true,
    },
    sportsAuthorityAffiliation: {
      type: String,
      optional: true,
    },
    aadhaarLast4: {
      type: String,
      default: "",
      validate: {
        validator(v: string) {
          if (!v) return true; // Optional field
          return /^[0-9]{4}$/.test(v);
        },
        message: "Aadhaar must be 4 digits",
      },
    },

    // Operational
    operatingHours: {
      type: {
        monday: {
          isOpen: { type: Boolean, default: true },
          openTime: { type: String, default: "06:00" },
          closeTime: { type: String, default: "21:00" },
        },
        tuesday: {
          isOpen: { type: Boolean, default: true },
          openTime: { type: String, default: "06:00" },
          closeTime: { type: String, default: "21:00" },
        },
        wednesday: {
          isOpen: { type: Boolean, default: true },
          openTime: { type: String, default: "06:00" },
          closeTime: { type: String, default: "21:00" },
        },
        thursday: {
          isOpen: { type: Boolean, default: true },
          openTime: { type: String, default: "06:00" },
          closeTime: { type: String, default: "21:00" },
        },
        friday: {
          isOpen: { type: Boolean, default: true },
          openTime: { type: String, default: "06:00" },
          closeTime: { type: String, default: "21:00" },
        },
        saturday: {
          isOpen: { type: Boolean, default: true },
          openTime: { type: String, default: "06:00" },
          closeTime: { type: String, default: "21:00" },
        },
        sunday: {
          isOpen: { type: Boolean, default: true },
          openTime: { type: String, default: "09:00" },
          closeTime: { type: String, default: "18:00" },
        },
      },
      default: {
        monday: { isOpen: true, openTime: "06:00", closeTime: "21:00" },
        tuesday: { isOpen: true, openTime: "06:00", closeTime: "21:00" },
        wednesday: { isOpen: true, openTime: "06:00", closeTime: "21:00" },
        thursday: { isOpen: true, openTime: "06:00", closeTime: "21:00" },
        friday: { isOpen: true, openTime: "06:00", closeTime: "21:00" },
        saturday: { isOpen: true, openTime: "06:00", closeTime: "21:00" },
        sunday: { isOpen: true, openTime: "09:00", closeTime: "18:00" },
      },
    },
    languagesSpoken: {
      type: [String],
      required: [true, "At least one language is required"],
    },
    whatsappNumber: {
      type: String,
      required: [true, "WhatsApp number is required"],
      validate: {
        validator(v: string) {
          return /^\+91[0-9]{10}$/.test(v);
        },
        message: "WhatsApp number must be in format +91XXXXXXXXXX",
      },
    },
    contactEmail: {
      type: String,
      required: [true, "Contact email is required"],
      lowercase: true,
      match: [
        /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/,
        "Please provide a valid email",
      ],
    },
    contactPhone: {
      type: String,
      required: [true, "Contact phone is required"],
      validate: {
        validator(v: string) {
          return /^\+91[0-9]{10}$/.test(v);
        },
        message: "Phone number must be in format +91XXXXXXXXXX",
      },
    },
    contactPersonName: {
      type: String,
      required: [true, "Contact person name is required"],
      trim: true,
    },
    allowsExternalCoaches: {
      type: Boolean,
      default: false,
    },
    maxBatchSize: {
      type: Number,
      required: [true, "Max batch size is required"],
      min: [1, "Batch size must be at least 1"],
    },
    batchTimings: {
      type: [String],
      enum: ["morning", "evening", "both"],
      required: [true, "At least one batch timing is required"],
    },
    academyVenues: {
      type: [Schema.Types.Mixed] as unknown as any,
      default: [],
    },
    academyCoaches: {
      type: [Schema.Types.Mixed] as unknown as any,
      default: [],
    },

    // Relationships
    ownerId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: false,
    },
    venueIds: {
      type: [Schema.Types.ObjectId],
      ref: "Venue",
      default: [],
    },
    coachIds: {
      type: [Schema.Types.ObjectId],
      ref: "Coach",
      default: [],
    },

    // Pricing (stored in paise)
    sessionRatePerHour: {
      type: Number,
      default: 0,
      min: [0, "Rate must be non-negative"],
    },
    trialsessionOffered: {
      type: Boolean,
      default: false,
    },
    trialSessionPrice: {
      type: Number,
      optional: true,
      min: [0, "Price must be non-negative"],
    },
    subscriptionPlans: {
      type: [Schema.Types.ObjectId],
      ref: "SubscriptionPlan",
      default: [],
    },
    sessionPackages: {
      type: [Schema.Types.ObjectId],
      ref: "SessionPackage",
      default: [],
    },

    // Payouts
    bankAccountNumber: {
      type: String,
      default: "",
      // Note: Should be encrypted at rest using application logic
    },
    bankIfsc: {
      type: String,
      default: "",
      validate: {
        validator(v: string) {
          if (!v) return true; // Optional field
          return /^[A-Z]{4}0[A-Z0-9]{6}$/.test(v);
        },
        message: "Invalid IFSC code format",
      },
    },
    bankAccountName: {
      type: String,
      default: "",
      trim: true,
    },
    upiId: {
      type: String,
      default: "",
      validate: {
        validator(v: string) {
          if (!v) return true; // Optional field
          // Basic UPI ID format: username@bankname
          return /^[a-zA-Z0-9._-]+@[a-zA-Z]{3,}$/.test(v);
        },
        message: "Invalid UPI ID format",
      },
    },
    payoutFrequency: {
      type: String,
      enum: ["weekly", "biweekly", "monthly"],
      default: "weekly",
    },
    cancellationPolicy: {
      type: String,
      default: "",
    },
    refundPolicy: {
      type: String,
      default: "",
    },

    // KYC & Status
    kycVerified: {
      type: Boolean,
      default: false,
    },
    isActive: {
      type: Boolean,
      default: false,
      // Academy goes live only when isApproved=true AND kycVerified=true
    },
    isApproved: {
      type: Boolean,
      default: false,
    },
    rejectionReason: {
      type: String,
      optional: true,
    },
    onboardingStep: {
      type: Number,
      enum: [1, 2, 3, 4, 5, 6, 7],
      default: 1,
    },
    onboardingCompleted: {
      type: Boolean,
      default: false,
    },

    // Ratings & Engagement
    rating: {
      type: Number,
      default: 0,
      min: [0, "Rating cannot be negative"],
      max: [5, "Rating cannot exceed 5"],
    },
    reviewCount: {
      type: Number,
      default: 0,
      min: [0, "Review count cannot be negative"],
    },
  },
  { timestamps: true },
);

// Create index for slug (used in /academies/[slug] route)
academySchema.index({ slug: 1 });

// Create geospatial index for location-based queries
academySchema.index({ location: "2dsphere" });

// Create index for owner queries
academySchema.index({ ownerId: 1 });

// Create index for approved academies (used in listings)
academySchema.index({ isApproved: 1, kycVerified: 1 });

// Create compound index for filtering
academySchema.index({ isApproved: 1, isActive: 1, sports: 1 });

const Academy =
  mongoose.models.Academy ||
  mongoose.model<AcademyDocument>("Academy", academySchema);

export default Academy;
