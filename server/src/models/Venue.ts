import mongoose, { Schema, Document } from "mongoose";

export interface VenueDocument extends Document {
  name: string;
  ownerId: mongoose.Types.ObjectId;
  location: string;
  sports: string[];
  pricePerHour: number;
  amenities: string[];
  description: string;
  images: string[];
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
      type: String,
      required: [true, "Location is required"],
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
    description: {
      type: String,
      default: "",
    },
    images: {
      type: [String],
      default: [],
    },
  },
  { timestamps: true },
);

export const Venue = mongoose.model<VenueDocument>("Venue", venueSchema);
