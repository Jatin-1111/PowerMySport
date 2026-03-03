import mongoose from "mongoose";
import { Booking } from "../models/Booking";
import {
  Coach,
  CoachDocument,
  CoachDocumentFile,
  CoachVerificationStatus,
} from "../models/Coach";
import { s3Service } from "./S3Service";
import { ICoach, IOwnVenueDetails, ServiceMode } from "../types";

const toRadians = (value: number): number => (value * Math.PI) / 180;

const calculateDistanceKm = (
  from: [number, number],
  to: [number, number],
): number => {
  const [fromLng, fromLat] = from;
  const [toLng, toLat] = to;

  const dLat = toRadians(toLat - fromLat);
  const dLng = toRadians(toLng - fromLng);
  const lat1 = toRadians(fromLat);
  const lat2 = toRadians(toLat);

  const haversine =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) * Math.sin(dLng / 2);

  const arc = 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
  const earthRadiusKm = 6371;

  return earthRadiusKm * arc;
};

const clamp01 = (value: number): number => Math.max(0, Math.min(1, value));

const getCoachStartingRate = (coach: any): number => {
  const sportPricing = coach?.sportPricing;
  if (sportPricing && typeof sportPricing === "object") {
    const values = Object.values(sportPricing as Record<string, number>).filter(
      (price) =>
        typeof price === "number" && Number.isFinite(price) && price > 0,
    );
    if (values.length > 0) {
      return Math.min(...values);
    }
  }

  if (
    typeof coach?.hourlyRate === "number" &&
    Number.isFinite(coach.hourlyRate)
  ) {
    return coach.hourlyRate;
  }

  return 0;
};

const getVerificationRecencyScore = (
  verifiedAt?: Date | string | null,
): number => {
  if (!verifiedAt) {
    return 0;
  }

  const verifiedTime = new Date(verifiedAt).getTime();
  if (Number.isNaN(verifiedTime)) {
    return 0;
  }

  const daysSinceVerified = (Date.now() - verifiedTime) / (1000 * 60 * 60 * 24);
  return clamp01(1 - daysSinceVerified / 365);
};

const buildCoachRelevanceScore = (params: {
  coach: any;
  sportFilter?: string | undefined;
  distanceKm?: number | undefined;
  maxDistanceKm?: number | undefined;
}): number => {
  const { coach, sportFilter, distanceKm, maxDistanceKm } = params;

  const ratingScore = clamp01(Number(coach?.rating || 0) / 5);

  const reviewCount = Number(coach?.reviewCount || 0);
  const socialProofScore = clamp01(reviewCount / 50);

  const startingRate = getCoachStartingRate(coach);
  const priceScore = clamp01(1 - Math.min(startingRate, 5000) / 5000);

  const verificationRecencyScore = getVerificationRecencyScore(
    coach?.verifiedAt,
  );

  let distanceScore = 0;
  if (
    typeof distanceKm === "number" &&
    Number.isFinite(distanceKm) &&
    typeof maxDistanceKm === "number" &&
    Number.isFinite(maxDistanceKm) &&
    maxDistanceKm > 0
  ) {
    distanceScore = clamp01(1 - distanceKm / maxDistanceKm);
  }

  const normalizedSportFilter = (sportFilter || "").trim().toLowerCase();
  const sportMatchScore =
    normalizedSportFilter.length === 0
      ? 0
      : coach?.sports?.some(
            (sport: string) =>
              sport.trim().toLowerCase() === normalizedSportFilter,
          )
        ? 1
        : coach?.sports?.some((sport: string) =>
              sport.trim().toLowerCase().includes(normalizedSportFilter),
            )
          ? 0.6
          : 0;

  return (
    ratingScore * 0.35 +
    distanceScore * 0.25 +
    priceScore * 0.15 +
    socialProofScore * 0.1 +
    verificationRecencyScore * 0.1 +
    sportMatchScore * 0.05
  );
};

const refreshCoachMediaUrls = async <T extends Record<string, any>>(
  coach: T,
): Promise<T> => {
  if (!coach) {
    return coach;
  }

  const mutableCoach = coach as any;

  const user = mutableCoach.userId;
  if (user && typeof user === "object" && user.photoS3Key) {
    try {
      user.photoUrl = await s3Service.generateDownloadUrl(
        user.photoS3Key,
        "images",
        604800,
      );
    } catch (error) {
      console.error("Failed to refresh coach profile photo URL:", error);
    }
  }

  const venueKeys: string[] = Array.isArray(
    mutableCoach.ownVenueDetails?.imageS3Keys,
  )
    ? mutableCoach.ownVenueDetails.imageS3Keys
    : [];

  if (venueKeys.length > 0) {
    const refreshedVenueImages = await Promise.all(
      venueKeys.map(async (key) => {
        try {
          return await s3Service.generateDownloadUrl(key, "images", 604800);
        } catch (error) {
          console.error(
            `Failed to refresh coach venue image URL for ${key}:`,
            error,
          );
          return "";
        }
      }),
    );

    if (!mutableCoach.ownVenueDetails) {
      mutableCoach.ownVenueDetails = {};
    }

    mutableCoach.ownVenueDetails.images = refreshedVenueImages.filter(Boolean);
  }

  return coach;
};

export interface CreateCoachPayload {
  userId: string;
  bio: string;
  certifications: string[];
  sports: string[];
  hourlyRate: number;
  sportPricing?: Record<string, number>;
  serviceMode: ServiceMode;
  ownVenueDetails?: IOwnVenueDetails; // Venue details stored in coach profile (not separate Venue document)
  serviceRadiusKm?: number;
  travelBufferTime?: number;
  availability: Array<{
    dayOfWeek: number;
    startTime: string;
    endTime: string;
  }>;
  availabilityBySport?: Record<
    string,
    Array<{
      dayOfWeek: number;
      startTime: string;
      endTime: string;
    }>
  >;
}

/**
 * Create a new coach profile.
 * For OWN_VENUE coaches, venue details are stored in the coach profile and used for booking context only.
 * These venues do NOT appear in the marketplace. Coaches who want to rent out venues separately
 * must create a venue-lister account with different credentials.
 */
export const createCoach = async (
  payload: CreateCoachPayload,
): Promise<CoachDocument> => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // Create the coach profile with venue details embedded (no separate Venue document)
    const coach = new Coach(payload);

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

    const rankedCoaches = coaches
      .map((coach: any) => {
        const coachCoordinates = coach.baseLocation?.coordinates;
        const serviceRadius =
          typeof coach.serviceRadiusKm === "number" && coach.serviceRadiusKm > 0
            ? coach.serviceRadiusKm
            : 10;

        if (coach.serviceMode === "FREELANCE") {
          if (
            !Array.isArray(coachCoordinates) ||
            coachCoordinates.length !== 2 ||
            !Number.isFinite(Number(coachCoordinates[0])) ||
            !Number.isFinite(Number(coachCoordinates[1]))
          ) {
            return null;
          }

          const normalizedCoachCoordinates: [number, number] = [
            Number(coachCoordinates[0]),
            Number(coachCoordinates[1]),
          ];

          const distanceKm = calculateDistanceKm(normalizedCoachCoordinates, [
            lng,
            lat,
          ]);

          if (distanceKm > serviceRadius) {
            return null;
          }

          const relevanceScore = buildCoachRelevanceScore({
            coach,
            sportFilter: sport,
            distanceKm,
            maxDistanceKm: Math.max(radiusKm, serviceRadius),
          });

          return {
            coach,
            relevanceScore,
          };
        }

        const relevanceScore = buildCoachRelevanceScore({
          coach,
          sportFilter: sport,
          maxDistanceKm: radiusKm,
        });

        return {
          coach,
          relevanceScore,
        };
      })
      .filter(
        (entry): entry is { coach: any; relevanceScore: number } =>
          entry !== null,
      )
      .sort((a, b) => b.relevanceScore - a.relevanceScore);

    const filteredCoaches = rankedCoaches.map((entry) => entry.coach);

    // Populate the final documents (aggregate doesn't return full mongoose documents)
    const populatedCoaches = (await Coach.populate(filteredCoaches, {
      path: "userId",
    })) as CoachDocument[];

    return Promise.all(populatedCoaches.map(refreshCoachMediaUrls));
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

    const coaches = await Coach.find(query).populate("userId");
    coaches.sort((a, b) => {
      const scoreA = buildCoachRelevanceScore({ coach: a, sportFilter: sport });
      const scoreB = buildCoachRelevanceScore({ coach: b, sportFilter: sport });
      return scoreB - scoreA;
    });
    return Promise.all(coaches.map(refreshCoachMediaUrls));
  } catch (error) {
    throw new Error(
      `Failed to fetch coaches: ${error instanceof Error ? error.message : "Unknown error"}`,
    );
  }
};

export interface CoachVerificationSubmission {
  documents?: Array<
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

  if (coach.serviceMode === "OWN_VENUE") {
    const venueImagesCount = coach.ownVenueDetails?.images?.length || 0;
    if (venueImagesCount < 3) {
      throw new Error(
        "OWN_VENUE coaches must upload at least 3 venue images before verification submission",
      );
    }
  }

  const documents = payload.documents || [];

  coach.verificationDocuments = documents.map((doc) => ({
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
    .populate("userId")
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
    const dayAvailabilities = coach.availability.filter(
      (a) => a.dayOfWeek === dayOfWeek,
    );

    if (dayAvailabilities.length === 0) {
      return false; // Coach doesn't work on this day
    }

    const isWithinAnySlot = dayAvailabilities.some(
      (slot) => startTime >= slot.startTime && endTime <= slot.endTime,
    );

    if (!isWithinAnySlot) {
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
  const coach = await Coach.findById(coachId).populate("userId");
  if (!coach) {
    return null;
  }

  return refreshCoachMediaUrls(coach);
};

/**
 * Get coach by user ID
 */
export const getCoachByUserId = async (
  userId: string,
): Promise<CoachDocument | null> => {
  const coach = await Coach.findOne({ userId }).populate("userId");
  if (!coach) {
    return null;
  }

  return refreshCoachMediaUrls(coach);
};

/**
 * Update coach profile
 * Uses load-then-save to ensure full validation runs on all nested objects
 */
export const updateCoach = async (
  coachId: string,
  updates: Partial<ICoach>,
): Promise<CoachDocument | null> => {
  // Validate coachId is provided
  if (!coachId || coachId === "undefined") {
    throw new Error("Invalid coach ID");
  }

  // Load the full document
  const coach = await Coach.findById(coachId);
  if (!coach) {
    return null;
  }

  // Update each field individually - this allows Mongoose to properly cast nested types
  for (const [key, value] of Object.entries(updates)) {
    if (value !== undefined) {
      // For ownVenueDetails, rebuild it completely to ensure proper type casting
      if (key === "ownVenueDetails" && value) {
        const venueData = value as any;

        // Extract coordinates from either location or flat structure
        const coordinates = Array.isArray(venueData.location?.coordinates)
          ? venueData.location.coordinates
          : Array.isArray(venueData.coordinates)
            ? venueData.coordinates
            : [77.2, 28.7];

        coach.ownVenueDetails = {
          name: venueData.name,
          address: venueData.address,
          location: {
            type: "Point",
            coordinates: [Number(coordinates[0]), Number(coordinates[1])],
          },
          sports: venueData.sports || [],
          amenities: venueData.amenities || [],
          pricePerHour: venueData.pricePerHour,
          description: venueData.description,
          images: venueData.images || coach.ownVenueDetails?.images || [],
          imageS3Keys:
            venueData.imageS3Keys || coach.ownVenueDetails?.imageS3Keys || [],
          openingHours: venueData.openingHours,
        };

        // Mark this nested path as modified so Mongoose re-validates it
        coach.markModified("ownVenueDetails");
      } else {
        (coach as any)[key] = value;
      }
    }
  }

  // Save with validation
  await coach.save();

  return coach;
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
