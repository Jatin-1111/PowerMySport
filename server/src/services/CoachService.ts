import mongoose from "mongoose";
import { Booking } from "../models/Booking";
import {
  Coach,
  CoachDocument,
  CoachDocumentFile,
  CoachVerificationStatus,
} from "../models/Coach";
import { Venue } from "../models/Venue";
import { ICoach, IGeoLocation, ServiceMode } from "../types";

export interface CreateCoachPayload {
  userId: string;
  bio: string;
  certifications: string[];
  sports: string[];
  hourlyRate: number;
  serviceMode: ServiceMode;
  venueId?: string;
  serviceRadiusKm?: number;
  travelBufferTime?: number;
  availability: Array<{
    dayOfWeek: number;
    startTime: string;
    endTime: string;
  }>;
  venueDetails?: {
    name: string;
    address: string;
    location: IGeoLocation;
    sports?: string[];
    pricePerHour?: number;
    amenities?: string[];
    description?: string;
    allowExternalCoaches?: boolean;
  };
}

/**
 * Create a new coach profile
 * Supports automatic "Ghost Venue" creation for OWN_VENUE coaches
 */
export const createCoach = async (
  payload: CreateCoachPayload,
): Promise<CoachDocument> => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    let venueId = payload.venueId;

    // Auto-create "Ghost Venue" if coach has OWN_VENUE mode without a venueId
    if (
      payload.serviceMode === "OWN_VENUE" &&
      !venueId &&
      payload.venueDetails
    ) {
      // Create the venue automatically
      const venue = new Venue({
        name: payload.venueDetails.name,
        ownerId: payload.userId,
        location: payload.venueDetails.location,
        address: payload.venueDetails.address,
        sports: payload.venueDetails.sports || payload.sports,
        pricePerHour: payload.venueDetails.pricePerHour || payload.hourlyRate,
        amenities: payload.venueDetails.amenities || [],
        description: payload.venueDetails.description || "",
        allowExternalCoaches: payload.venueDetails.allowExternalCoaches ?? true,
        openingHours: "09:00-17:00", // Default opening hours
        images: [],
        approvalStatus: "PENDING",
      });

      await venue.save({ session });
      venueId = venue._id.toString();
    }

    // Create the coach profile with the venue ID (either provided or auto-created)
    const coach = new Coach({
      ...payload,
      venueId,
    });

    // Validation is handled by the Coach model's pre-save hook
    await coach.save({ session });

    await session.commitTransaction();
    return coach;
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
};

/**
 * Find coaches near a location (for FREELANCE and HYBRID coaches)
 * Uses MongoDB aggregation pipeline for efficient geo-filtering
 */
export const findCoachesNearby = async (
  lat: number,
  lng: number,
  radiusKm: number,
  sport?: string,
): Promise<CoachDocument[]> => {
  try {
    const radiusMeters = radiusKm * 1000;

    // Build aggregation pipeline for efficient geo-filtering
    const pipeline: any[] = [
      // Match by service mode and sport
      {
        $match: {
          isVerified: true,
          verificationStatus: "VERIFIED",
          serviceMode: { $in: ["FREELANCE", "HYBRID"] },
          ...(sport ? { sports: sport } : {}),
        },
      },
      // Lookup venue data for HYBRID coaches
      {
        $lookup: {
          from: "venues",
          localField: "venueId",
          foreignField: "_id",
          as: "venueData",
        },
      },
      // Add computed location field (baseLocation for FREELANCE, venue location for HYBRID)
      {
        $addFields: {
          effectiveLocation: {
            $cond: {
              if: { $eq: ["$serviceMode", "HYBRID"] },
              then: { $arrayElemAt: ["$venueData.location", 0] },
              else: "$baseLocation",
            },
          },
        },
      },
      // Filter out coaches without a location
      {
        $match: {
          effectiveLocation: { $exists: true, $ne: null },
        },
      },
      // Geo-spatial filter: coaches within service radius of the search location
      {
        $match: {
          effectiveLocation: {
            $geoWithin: {
              $centerSphere: [[lng, lat], radiusMeters / 6378100], // Earth radius in meters
            },
          },
        },
      },
      // Populate userId
      {
        $lookup: {
          from: "users",
          localField: "userId",
          foreignField: "_id",
          as: "userInfo",
        },
      },
      // Clean up: remove temporary fields and reshape
      {
        $project: {
          effectiveLocation: 0,
          venueData: 0,
        },
      },
    ];

    const coaches = await Coach.aggregate(pipeline);

    // Populate the final documents (aggregate doesn't return full mongoose documents)
    return Coach.populate(coaches, { path: "userId venueId" }) as Promise<
      CoachDocument[]
    >;
  } catch (error) {
    throw new Error(
      `Failed to find coaches: ${error instanceof Error ? error.message : "Unknown error"}`,
    );
  }
};

/**
 * Get all coaches with optional sport filter
 */
export const getAllCoaches = async (
  sport?: string,
): Promise<CoachDocument[]> => {
  try {
    const query: any = {
      isVerified: true,
      verificationStatus: "VERIFIED",
    };

    if (sport) {
      query.sports = sport;
    }

    return Coach.find(query).populate("userId venueId");
  } catch (error) {
    throw new Error(
      `Failed to fetch coaches: ${error instanceof Error ? error.message : "Unknown error"}`,
    );
  }
};

export interface CoachVerificationSubmission {
  documents: Array<
    Omit<CoachDocumentFile, "uploadedAt" | "id"> & {
      uploadedAt?: Date;
    }
  >;
}

export const submitCoachVerification = async (
  userId: string,
  payload: CoachVerificationSubmission,
): Promise<CoachDocument> => {
  const coach = await Coach.findOne({ userId });
  if (!coach) {
    throw new Error("Coach profile not found");
  }

  if (!payload.documents || payload.documents.length === 0) {
    throw new Error("At least one verification document is required");
  }

  coach.verificationDocuments = payload.documents.map((doc) => ({
    ...doc,
    uploadedAt: doc.uploadedAt || new Date(),
  }));
  coach.verificationStatus = "PENDING";
  coach.isVerified = false;
  coach.verificationNotes = "";
  coach.verificationSubmittedAt = new Date();
  coach.verifiedAt = null;
  coach.verifiedBy = null;

  return coach.save();
};

export const listCoachVerificationRequests = async (
  status: CoachVerificationStatus | undefined,
  page: number = 1,
  limit: number = 20,
): Promise<{
  coaches: CoachDocument[];
  total: number;
  page: number;
  totalPages: number;
}> => {
  const query: Record<string, unknown> = {};
  if (status) {
    query.verificationStatus = status;
  }

  const skip = (page - 1) * limit;
  const total = await Coach.countDocuments(query);
  const coaches = await Coach.find(query)
    .populate("userId venueId")
    .sort({ updatedAt: -1 })
    .skip(skip)
    .limit(limit);

  return {
    coaches,
    total,
    page,
    totalPages: Math.ceil(total / limit),
  };
};

export const updateCoachVerificationStatus = async (
  coachId: string,
  status: CoachVerificationStatus,
  adminId: string,
  notes?: string,
): Promise<CoachDocument> => {
  const coach = await Coach.findById(coachId);
  if (!coach) {
    throw new Error("Coach not found");
  }

  coach.verificationStatus = status;
  coach.verificationNotes = notes || "";

  if (status === "VERIFIED") {
    coach.isVerified = true;
    coach.verifiedAt = new Date();
    coach.verifiedBy = new mongoose.Types.ObjectId(adminId);
  } else {
    coach.isVerified = false;
    coach.verifiedAt = null;
    coach.verifiedBy = null;
  }

  return coach.save();
};

/**
 * Check if a coach is available for a specific time slot
 */
export const checkCoachAvailability = async (
  coachId: string,
  date: Date,
  startTime: string,
  endTime: string,
): Promise<boolean> => {
  try {
    const coach = await Coach.findById(coachId);
    if (!coach) {
      throw new Error("Coach not found");
    }

    // Check if coach has availability on this day of week
    const dayOfWeek = date.getDay();
    const dayAvailability = coach.availability.find(
      (a) => a.dayOfWeek === dayOfWeek,
    );

    if (!dayAvailability) {
      return false; // Coach doesn't work on this day
    }

    // Check if requested time is within coach's working hours
    if (
      startTime < dayAvailability.startTime ||
      endTime > dayAvailability.endTime
    ) {
      return false;
    }

    // Check for existing bookings
    // Only active bookings block slots: PENDING_PAYMENT, CONFIRMED, IN_PROGRESS
    const existingBooking = await Booking.findOne({
      coachId,
      date: {
        $gte: new Date(date.getFullYear(), date.getMonth(), date.getDate()),
        $lt: new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1),
      },
      status: { $in: ["PENDING_PAYMENT", "CONFIRMED", "IN_PROGRESS"] },
      $or: [
        // Requested slot starts during existing booking
        { startTime: { $lte: startTime }, endTime: { $gt: startTime } },
        // Requested slot ends during existing booking
        { startTime: { $lt: endTime }, endTime: { $gte: endTime } },
        // Requested slot completely contains existing booking
        { startTime: { $gte: startTime }, endTime: { $lte: endTime } },
      ],
    });

    return !existingBooking;
  } catch (error) {
    throw new Error(
      `Failed to check coach availability: ${error instanceof Error ? error.message : "Unknown error"}`,
    );
  }
};

/**
 * Get coach by ID
 */
export const getCoachById = async (
  coachId: string,
): Promise<CoachDocument | null> => {
  // Validate coachId
  if (!coachId || coachId === "undefined") {
    return null;
  }
  return Coach.findById(coachId).populate("userId venueId");
};

/**
 * Get coach by user ID
 */
export const getCoachByUserId = async (
  userId: string,
): Promise<CoachDocument | null> => {
  return Coach.findOne({ userId }).populate("userId venueId");
};

/**
 * Update coach profile
 */
export const updateCoach = async (
  coachId: string,
  updates: Partial<ICoach>,
): Promise<CoachDocument | null> => {
  // Validate coachId is provided
  if (!coachId || coachId === "undefined") {
    throw new Error("Invalid coach ID");
  }

  // Filter out undefined values to prevent MongoDB casting issues
  const cleanedUpdates = Object.fromEntries(
    Object.entries(updates).filter(([, value]) => value !== undefined),
  );

  return Coach.findByIdAndUpdate(coachId, cleanedUpdates, {
    new: true,
    runValidators: true,
  });
};

/**
 * Delete coach profile (with cascade: delete all associated bookings)
 */
export const deleteCoach = async (coachId: string): Promise<boolean> => {
  try {
    // First, delete all bookings associated with this coach
    await Booking.deleteMany({ coachId });

    // Then delete the coach
    const result = await Coach.findByIdAndDelete(coachId);
    return !!result;
  } catch (error) {
    throw new Error(
      `Failed to delete coach: ${error instanceof Error ? error.message : "Unknown error"}`,
    );
  }
};
