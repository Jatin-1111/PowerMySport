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

  // Venue Details
  name: string;
  ownerId?: mongoose.Types.ObjectId;
  location: IGeoLocation;
  sports: string[];
  pricePerHour: number;
  sportPricing?: Record<string, number>;
  amenities: string[];
  address: string;
  openingHours: string;
  description: string;
  images: string[]; // Presigned URLs (regenerated on-demand)
  imageKeys: string[]; // S3 keys for images
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

    // Venue Details
    name: {
      type: String,
      required: [true, "Venue name is required"],
      trim: true,
    },
    ownerId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      optional: true,
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
          validator: (v: number[]) => v.length === 2,
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
      type: String,
      default: "9:00 AM - 9:00 PM",
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
