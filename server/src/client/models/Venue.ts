import mongoose, { Document, Schema } from "mongoose";
import { IGeoLocation } from "../../types/index";
import { IPayoutMethod } from "./Coach";

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
  openingHours: import("../../types/index").OpeningHours;
  description: string;
  images: string[]; // DEPRECATED: Legacy presigned URLs. Use generalImages instead. Migrate with: npm run migrate:venue-images
  imageKeys: string[]; // DEPRECATED: Legacy S3 keys. Use generalImageKeys instead. Migrate with: npm run migrate:venue-images
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
  /**
   * REQUIREMENT 3: Multiple payout methods support (same as Coach)
   * Array of payout methods for venue listers
   * MIGRATION NOTE: Changed from single payoutMethod to payoutMethods array
   */
  payoutMethods?: IPayoutMethod[];
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
          slots: {
            type: [
              {
                startTime: { type: String, required: true },
                endTime: { type: String, required: true },
              },
            ],
            default: [{ startTime: "09:00", endTime: "21:00" }],
          },
        },
        tuesday: {
          isOpen: { type: Boolean, default: true },
          openTime: { type: String, default: "09:00" },
          closeTime: { type: String, default: "21:00" },
          slots: {
            type: [
              {
                startTime: { type: String, required: true },
                endTime: { type: String, required: true },
              },
            ],
            default: [{ startTime: "09:00", endTime: "21:00" }],
          },
        },
        wednesday: {
          isOpen: { type: Boolean, default: true },
          openTime: { type: String, default: "09:00" },
          closeTime: { type: String, default: "21:00" },
          slots: {
            type: [
              {
                startTime: { type: String, required: true },
                endTime: { type: String, required: true },
              },
            ],
            default: [{ startTime: "09:00", endTime: "21:00" }],
          },
        },
        thursday: {
          isOpen: { type: Boolean, default: true },
          openTime: { type: String, default: "09:00" },
          closeTime: { type: String, default: "21:00" },
          slots: {
            type: [
              {
                startTime: { type: String, required: true },
                endTime: { type: String, required: true },
              },
            ],
            default: [{ startTime: "09:00", endTime: "21:00" }],
          },
        },
        friday: {
          isOpen: { type: Boolean, default: true },
          openTime: { type: String, default: "09:00" },
          closeTime: { type: String, default: "21:00" },
          slots: {
            type: [
              {
                startTime: { type: String, required: true },
                endTime: { type: String, required: true },
              },
            ],
            default: [{ startTime: "09:00", endTime: "21:00" }],
          },
        },
        saturday: {
          isOpen: { type: Boolean, default: true },
          openTime: { type: String, default: "09:00" },
          closeTime: { type: String, default: "21:00" },
          slots: {
            type: [
              {
                startTime: { type: String, required: true },
                endTime: { type: String, required: true },
              },
            ],
            default: [{ startTime: "09:00", endTime: "21:00" }],
          },
        },
        sunday: {
          isOpen: { type: Boolean, default: true },
          openTime: { type: String, default: "09:00" },
          closeTime: { type: String, default: "21:00" },
          slots: {
            type: [
              {
                startTime: { type: String, required: true },
                endTime: { type: String, required: true },
              },
            ],
            default: [{ startTime: "09:00", endTime: "21:00" }],
          },
        },
      },
      default: {
        monday: {
          isOpen: true,
          openTime: "09:00",
          closeTime: "21:00",
          slots: [{ startTime: "09:00", endTime: "21:00" }],
        },
        tuesday: {
          isOpen: true,
          openTime: "09:00",
          closeTime: "21:00",
          slots: [{ startTime: "09:00", endTime: "21:00" }],
        },
        wednesday: {
          isOpen: true,
          openTime: "09:00",
          closeTime: "21:00",
          slots: [{ startTime: "09:00", endTime: "21:00" }],
        },
        thursday: {
          isOpen: true,
          openTime: "09:00",
          closeTime: "21:00",
          slots: [{ startTime: "09:00", endTime: "21:00" }],
        },
        friday: {
          isOpen: true,
          openTime: "09:00",
          closeTime: "21:00",
          slots: [{ startTime: "09:00", endTime: "21:00" }],
        },
        saturday: {
          isOpen: true,
          openTime: "09:00",
          closeTime: "21:00",
          slots: [{ startTime: "09:00", endTime: "21:00" }],
        },
        sunday: {
          isOpen: true,
          openTime: "09:00",
          closeTime: "21:00",
          slots: [{ startTime: "09:00", endTime: "21:00" }],
        },
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
  { timestamps: true },
);

// Geo-spatial index for $near queries
venueSchema.index({ location: "2dsphere" });

// Common read paths for owner dashboards and admin review queues
venueSchema.index({ ownerId: 1, createdAt: -1 });
venueSchema.index({ ownerEmail: 1, approvalStatus: 1 });
venueSchema.index({ approvalStatus: 1, createdAt: -1 });
venueSchema.index({ sports: 1, approvalStatus: 1 });

/**
 * Instance method to regenerate presigned URLs for documents
 * Valid for 24 hours
 */
venueSchema.methods.refreshDocumentUrls = async function () {
  // S3Service is imported at the top of the module
  const { s3Service } = await import("../../shared/services/S3Service");

  if (Array.isArray(this.documents) && this.documents.length > 0) {
    await Promise.all(
      this.documents.map(async (doc: any) => {
        if (!doc.s3Key) return;

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
      }),
    );
  }

  return this;
};

/**
 * Instance method to regenerate presigned URLs for images
 * Valid for 7 days
 */
venueSchema.methods.refreshImageUrls = async function () {
  // S3Service is imported at the top of the module
  const { s3Service } = await import("../../shared/services/S3Service");

  const extractKeyFromUrl = (url?: string): string | null => {
    if (!url || typeof url !== "string") return null;

    try {
      const parsed = new URL(url);
      const rawPath = parsed.pathname.startsWith("/")
        ? parsed.pathname.slice(1)
        : parsed.pathname;
      const key = decodeURIComponent(rawPath);
      return key.length > 0 ? key : null;
    } catch {
      return null;
    }
  };

  const refreshFromKeys = async (keys: string[]): Promise<string[]> => {
    const freshImages = await Promise.all(
      keys.map(async (key: string) => {
        try {
          return await s3Service.generateDownloadUrl(key, "images", 604800); // 7 days
        } catch (error) {
          console.error(`Failed to refresh URL for image ${key}:`, error);
          return "";
        }
      }),
    );

    return freshImages.filter((url) => Boolean(url));
  };

  const imageKeysToUse: string[] =
    Array.isArray(this.imageKeys) && this.imageKeys.length > 0
      ? this.imageKeys
      : Array.isArray(this.images)
        ? this.images
            .map((url: string) => extractKeyFromUrl(url))
            .filter((key: string | null): key is string => Boolean(key))
        : [];

  // Refresh gallery images (legacy)
  if (imageKeysToUse.length > 0) {
    this.images = await refreshFromKeys(imageKeysToUse);
  }

  // Refresh generalImages
  const generalKeysToUse: string[] =
    Array.isArray(this.generalImageKeys) && this.generalImageKeys.length > 0
      ? this.generalImageKeys
      : Array.isArray(this.generalImages)
        ? this.generalImages
            .map((url: string) => extractKeyFromUrl(url))
            .filter((key: string | null): key is string => Boolean(key))
        : [];

  if (generalKeysToUse.length > 0) {
    this.generalImages = await refreshFromKeys(generalKeysToUse);
  }

  // Refresh sportImages
  if (this.sportImageKeys || this.sportImages) {
    const newSportImages = new Map<string, string[]>();
    
    // First, collect all sports from either sportImageKeys or sportImages
    const sportsSet = new Set<string>();
    if (this.sportImageKeys && this.sportImageKeys instanceof Map) {
      for (const key of Array.from(this.sportImageKeys.keys())) {
        sportsSet.add(key);
      }
    } else if (this.sportImageKeys && typeof this.sportImageKeys === "object") {
      for (const key of Object.keys(this.sportImageKeys)) {
        sportsSet.add(key);
      }
    }
    
    if (this.sportImages && this.sportImages instanceof Map) {
      for (const key of Array.from(this.sportImages.keys())) {
        sportsSet.add(key);
      }
    } else if (this.sportImages && typeof this.sportImages === "object") {
      for (const key of Object.keys(this.sportImages)) {
        sportsSet.add(key);
      }
    }

    for (const sport of Array.from(sportsSet)) {
      let keysToUse: string[] = [];
      
      const sportKeys = this.sportImageKeys instanceof Map 
        ? this.sportImageKeys.get(sport) 
        : (this.sportImageKeys as any)?.[sport];
        
      const sportUrls = this.sportImages instanceof Map 
        ? this.sportImages.get(sport) 
        : (this.sportImages as any)?.[sport];

      if (Array.isArray(sportKeys) && sportKeys.length > 0) {
        keysToUse = sportKeys;
      } else if (Array.isArray(sportUrls)) {
        keysToUse = sportUrls
          .map((url: string) => extractKeyFromUrl(url))
          .filter((key: string | null): key is string => Boolean(key));
      }

      if (keysToUse.length > 0) {
        const refreshed = await refreshFromKeys(keysToUse);
        if (refreshed.length > 0) {
          newSportImages.set(sport, refreshed);
        }
      }
    }
    
    if (newSportImages.size > 0) {
      this.sportImages = newSportImages as any;
    }
  }

  // Refresh cover photo
  const coverKey =
    this.coverPhotoKey ||
    extractKeyFromUrl(this.coverPhotoUrl) ||
    imageKeysToUse[0] ||
    "";

  if (coverKey) {
    try {
      this.coverPhotoUrl = await s3Service.generateDownloadUrl(
        coverKey,
        "images",
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
