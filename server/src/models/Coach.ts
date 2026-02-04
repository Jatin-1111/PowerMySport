import mongoose, { Schema, Document } from "mongoose";
import { ServiceMode, IAvailability } from "../types";

export interface CoachDocument extends Document {
  userId: mongoose.Types.ObjectId;
  bio: string;
  certifications: string[];
  sports: string[];
  hourlyRate: number;
  serviceMode: ServiceMode;
  venueId?: mongoose.Types.ObjectId;
  serviceRadiusKm?: number;
  travelBufferTime?: number;
  availability: IAvailability[];
  rating: number;
  reviewCount: number;
  createdAt: Date;
  updatedAt: Date;
}

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
    serviceMode: {
      type: String,
      enum: {
        values: ["OWN_VENUE", "FREELANCE", "HYBRID"],
        message: "{VALUE} is not a valid service mode",
      },
      required: [true, "Service mode is required"],
    },
    venueId: {
      type: Schema.Types.ObjectId,
      ref: "Venue",
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

// Validation: Service mode conditional fields
coachSchema.pre<CoachDocument>("save", function () {
  if (this.serviceMode === "OWN_VENUE") {
    if (!this.venueId) {
      throw new Error("venueId is required when serviceMode is OWN_VENUE");
    }
  }

  if (this.serviceMode === "FREELANCE" || this.serviceMode === "HYBRID") {
    if (!this.serviceRadiusKm) {
      throw new Error(
        "serviceRadiusKm is required when serviceMode is FREELANCE or HYBRID",
      );
    }
    if (!this.travelBufferTime) {
      throw new Error(
        "travelBufferTime is required when serviceMode is FREELANCE or HYBRID",
      );
    }
  }
});

// Index for geo-spatial queries (will be used with venue location)
coachSchema.index({ userId: 1 });
coachSchema.index({ sports: 1 });
coachSchema.index({ serviceMode: 1 });

export const Coach = mongoose.model<CoachDocument>("Coach", coachSchema);
