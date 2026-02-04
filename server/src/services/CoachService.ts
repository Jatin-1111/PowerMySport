import { Coach, CoachDocument } from "../models/Coach";
import { Venue } from "../models/Venue";
import { Booking } from "../models/Booking";
import { ServiceMode, ICoach } from "../types";

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
 */
export const findCoachesNearby = async (
  lat: number,
  lng: number,
  radiusKm: number,
  sport?: string,
): Promise<CoachDocument[]> => {
  try {
    // Build query
    const query: any = {
      serviceMode: { $in: ["FREELANCE", "HYBRID"] },
    };

    // Filter by sport if provided
    if (sport) {
      query.sports = sport;
    }

    // Get all FREELANCE/HYBRID coaches
    let coaches = await Coach.find(query).populate("userId venueId");

    // Filter by service radius
    // For each coach, check if the requested location is within their service radius
    coaches = coaches.filter((coach) => {
      if (!coach.serviceRadiusKm) return false;

      // If coach has a venue (HYBRID mode), calculate distance from venue
      if (coach.venueId) {
        const venue = coach.venueId as any;
        if (venue.location && venue.location.coordinates) {
          const [venueLng, venueLat] = venue.location.coordinates;
          const distance = calculateDistance(lat, lng, venueLat, venueLng);
          return distance <= coach.serviceRadiusKm;
        }
      }

      // For pure FREELANCE coaches without a fixed venue,
      // we can't determine distance, so include them if within the search radius
      return coach.serviceRadiusKm >= radiusKm;
    });

    return coaches;
  } catch (error) {
    throw new Error(
      `Failed to find coaches: ${error instanceof Error ? error.message : "Unknown error"}`,
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
    const existingBooking = await Booking.findOne({
      coachId,
      date: {
        $gte: new Date(date.getFullYear(), date.getMonth(), date.getDate()),
        $lt: new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1),
      },
      status: { $in: ["PENDING_PAYMENT", "CONFIRMED"] },
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
 * Delete coach profile
 */
export const deleteCoach = async (coachId: string): Promise<boolean> => {
  const result = await Coach.findByIdAndDelete(coachId);
  return !!result;
};

/**
 * Calculate distance between two coordinates using Haversine formula
 * Returns distance in kilometers
 */
const calculateDistance = (
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number => {
  const R = 6371; // Earth's radius in km
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

const toRad = (degrees: number): number => {
  return (degrees * Math.PI) / 180;
};
