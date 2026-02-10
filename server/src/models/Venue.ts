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
  amenities: string[];
  address: string;
  openingHours: string;
  description: string;
  images: string[];
  coverPhotoUrl?: string;
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
}

export interface VenueDocumentFile {
  id?: string;
  type:
    | "OWNERSHIP_PROOF"
    | "BUSINESS_REGISTRATION"
    | "TAX_DOCUMENT"
    | "INSURANCE"
    | "CERTIFICATE";
  url: string;
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
    coverPhotoUrl: {
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

export const Venue = mongoose.model<VenueDocument>(
  "Venue",
  venueSchema,
  "venues",
);
