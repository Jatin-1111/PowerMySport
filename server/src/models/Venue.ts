import mongoose, { Document, Schema } from "mongoose";
import { IGeoLocation } from "../types";

export interface VenueDocument extends Document {
  name: string;
  ownerId: mongoose.Types.ObjectId;
  location: IGeoLocation;
  sports: string[];
  pricePerHour: number;
  amenities: string[];
  address: string;
  openingHours: string;
  description: string;
  images: string[];
  allowExternalCoaches: boolean;
  requiresLocationUpdate?: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const venueSchema = new Schema<VenueDocument>(
  {
    name: {
      type: String,
      required: [true, "Venue name is required"],
      trim: true,
    },
    ownerId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Owner ID is required"],
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
    allowExternalCoaches: {
      type: Boolean,
      default: true,
    },
    requiresLocationUpdate: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true },
);

// Geo-spatial index for $near queries
venueSchema.index({ location: "2dsphere" });

export const Venue = mongoose.model<VenueDocument>("Venue", venueSchema);
