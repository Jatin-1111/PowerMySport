import mongoose, { Document, Schema } from "mongoose";
import { IGeoLocation } from "../types";

export interface VenueCoach {
  name: string;
  sport: string;
  hourlyRate: number;
  bio?: string;
}

export interface VenueDocument extends Document {
  // Venue Lister Contact Info
  ownerName: string;
  ownerEmail: string;
  ownerPhone: string;
  emailVerified: boolean;

  // Venue Details
  name: string;
  ownerId?: mongoose.Types.ObjectId;
  location: IGeoLocation;
  sports: string[];
  pricePerHour: number;
  sportPricing?: Record<string, number>;
  amenities: string[];
  address: string;
  openingHours: import("../types").OpeningHours;
  description: string;
  images: string[]; // Presigned URLs (regenerated on-demand) - LEGACY: for backward compatibility
  imageKeys: string[]; // S3 keys for images - LEGACY: for backward compatibility
  generalImages?: string[]; // General venue images (3 required for new venues)
  generalImageKeys?: string[]; // S3 keys for general images
  sportImages?: Record<string, string[]>; // Sport-specific images (5 per sport)
  sportImageKeys?: Record<string, string[]>; // S3 keys for sport-specific images
  coverPhotoUrl?: string; // Presigned URL (regenerated on-demand)
  coverPhotoKey?: string; // S3 key for cover photo
  allowExternalCoaches: boolean;
  approvalStatus: "PENDING" | "APPROVED" | "REJECTED" | "REVIEW";
  documents: VenueDocumentFile[];
  rejectionReason?: string;
  reviewNotes?: string;
  rating: number;
  reviewCount: number;
  hasCoaches: boolean;
  venueCoaches: VenueCoach[];
  createdAt: Date;
  updatedAt: Date;

  // Instance methods
  refreshDocumentUrls(): Promise<VenueDocument>;
  refreshImageUrls(): Promise<VenueDocument>;
  refreshAllUrls(): Promise<VenueDocument>;
}

export interface VenueDocumentFile {
  id?: string;
  type:
    | "OWNERSHIP_PROOF"
    | "BUSINESS_REGISTRATION"
    | "TAX_DOCUMENT"
    | "INSURANCE"
    | "CERTIFICATE";
  url: string; // For backward compatibility
  s3Key: string; // S3 object key for regenerating URLs
  fileName: string;
  uploadedAt: Date;
}

const venueSchema = new Schema<VenueDocument>(
  {
    // Venue Lister Contact Info
    ownerName: {
      type: String,
      required: [true, "Owner name is required"],
      trim: true,
    },
    ownerEmail: {
      type: String,
      required: [true, "Owner email is required"],
      trim: true,
      lowercase: true,
    },
    ownerPhone: {
      type: String,
      required: [true, "Owner phone is required"],
      trim: true,
    },
    emailVerified: {
      type: Boolean,
      default: false,
    },

    // Venue Details
    name: {
      type: String,
      required: [true, "Venue name is required"],
      trim: true,
    },
    ownerId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: false,
    },
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
    sports: {
      type: [String],
      required: [true, "Sports list is required"],
      default: [],
    },
    pricePerHour: {
      type: Number,
      required: [true, "Price per hour is required"],
      min: 0,
    },
    sportPricing: {
      type: Map,
      of: Number,
      default: {},
    },
    amenities: {
      type: [String],
      default: [],
    },
    address: {
      type: String,
      default: "",
    },
    openingHours: {
      type: {
        monday: {
          isOpen: { type: Boolean, default: true },
          openTime: { type: String, default: "09:00" },
          closeTime: { type: String, default: "21:00" },
        },
        tuesday: {
          isOpen: { type: Boolean, default: true },
          openTime: { type: String, default: "09:00" },
          closeTime: { type: String, default: "21:00" },
        },
        wednesday: {
          isOpen: { type: Boolean, default: true },
          openTime: { type: String, default: "09:00" },
          closeTime: { type: String, default: "21:00" },
        },
        thursday: {
          isOpen: { type: Boolean, default: true },
          openTime: { type: String, default: "09:00" },
          closeTime: { type: String, default: "21:00" },
        },
        friday: {
          isOpen: { type: Boolean, default: true },
          openTime: { type: String, default: "09:00" },
          closeTime: { type: String, default: "21:00" },
        },
        saturday: {
          isOpen: { type: Boolean, default: true },
          openTime: { type: String, default: "09:00" },
          closeTime: { type: String, default: "21:00" },
        },
        sunday: {
          isOpen: { type: Boolean, default: true },
          openTime: { type: String, default: "09:00" },
          closeTime: { type: String, default: "21:00" },
        },
      },
      default: {
        monday: { isOpen: true, openTime: "09:00", closeTime: "21:00" },
        tuesday: { isOpen: true, openTime: "09:00", closeTime: "21:00" },
        wednesday: { isOpen: true, openTime: "09:00", closeTime: "21:00" },
        thursday: { isOpen: true, openTime: "09:00", closeTime: "21:00" },
        friday: { isOpen: true, openTime: "09:00", closeTime: "21:00" },
        saturday: { isOpen: true, openTime: "09:00", closeTime: "21:00" },
        sunday: { isOpen: true, openTime: "09:00", closeTime: "21:00" },
      },
    },
    description: {
      type: String,
      default: "",
    },
    images: {
      type: [String],
      default: [],
    },
    imageKeys: {
      type: [String],
      default: [],
    },
    generalImages: {
      type: [String],
      optional: true,
    },
    generalImageKeys: {
      type: [String],
      optional: true,
    },
    sportImages: {
      type: Map,
      of: [String],
      optional: true,
    },
    sportImageKeys: {
      type: Map,
      of: [String],
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
    allowExternalCoaches: {
      type: Boolean,
      default: true,
    },
    approvalStatus: {
      type: String,
      enum: ["PENDING", "APPROVED", "REJECTED", "REVIEW"],
      default: "PENDING",
    },
    hasCoaches: {
      type: Boolean,
      default: false,
    },
    venueCoaches: [
      {
        name: {
          type: String,
          required: true,
        },
        sport: {
          type: String,
          required: true,
        },
        hourlyRate: {
          type: Number,
          required: true,
          min: 0,
        },
        bio: {
          type: String,
          optional: true,
        },
      },
    ],
    documents: [
      {
        type: {
          type: String,
          enum: [
            "OWNERSHIP_PROOF",
            "BUSINESS_REGISTRATION",
            "TAX_DOCUMENT",
            "INSURANCE",
            "CERTIFICATE",
          ],
          required: true,
        },
        url: {
          type: String,
          required: true,
        },
        s3Key: {
          type: String,
          required: false, // Optional for backward compatibility
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
    rejectionReason: {
      type: String,
      optional: true,
    },
    reviewNotes: {
      type: String,
      optional: true,
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
  },
  { timestamps: true },
);

// Geo-spatial index for $near queries
venueSchema.index({ location: "2dsphere" });

/**
 * Instance method to regenerate presigned URLs for documents
 * Valid for 24 hours
 */
venueSchema.methods.refreshDocumentUrls = async function () {
  const { s3Service } = require("../services/S3Service");

  for (const doc of this.documents) {
    if (doc.s3Key) {
      try {
        doc.url = await s3Service.generateDownloadUrl(
          doc.s3Key,
          "verification",
          86400,
        );
      } catch (error) {
        console.error(
          `Failed to refresh URL for document ${doc.fileName}:`,
          error,
        );
      }
    }
  }

  return this;
};

/**
 * Instance method to regenerate presigned URLs for images
 * Valid for 7 days
 */
venueSchema.methods.refreshImageUrls = async function () {
  const { s3Service } = require("../services/S3Service");

  // Refresh gallery images
  if (this.imageKeys && this.imageKeys.length > 0) {
    const freshImages: string[] = [];
    for (const key of this.imageKeys) {
      try {
        const url = await s3Service.generateDownloadUrl(
          key,
          "verification",
          604800,
        ); // 7 days
        freshImages.push(url);
      } catch (error) {
        console.error(`Failed to refresh URL for image ${key}:`, error);
        freshImages.push(""); // Placeholder for failed image
      }
    }
    this.images = freshImages;
  }

  // Refresh cover photo
  if (this.coverPhotoKey) {
    try {
      this.coverPhotoUrl = await s3Service.generateDownloadUrl(
        this.coverPhotoKey,
        "verification",
        604800, // 7 days
      );
    } catch (error) {
      console.error(`Failed to refresh cover photo URL:`, error);
    }
  }

  return this;
};

/**
 * Instance method to regenerate ALL presigned URLs (images + documents)
 * Call this before sending venue data to frontend
 */
venueSchema.methods.refreshAllUrls = async function () {
  await this.refreshImageUrls();
  await this.refreshDocumentUrls();
  return this;
};

export const Venue = mongoose.model<VenueDocument>(
  "Venue",
  venueSchema,
  "venues",
);
