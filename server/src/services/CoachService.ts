import { Booking } from "../models/Booking";
import { Coach, CoachDocument } from "../models/Coach";
import { ICoach, ServiceMode } from "../types";

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
}

/**
 * Create a new coach profile
 */
export const createCoach = async (
  payload: CreateCoachPayload,
): Promise<CoachDocument> => {
  // Validation is handled by the Coach model's pre-save hook
  const coach = new Coach(payload);
  await coach.save();
  return coach;
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
      // You might want to filter by serviceMode or just return all
      // For now, let's return all coaches
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
  return Coach.findByIdAndUpdate(coachId, updates, {
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
