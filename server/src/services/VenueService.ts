import { Venue, VenueDocument } from "../models/Venue";
import { IGeoLocation } from "../types";

export interface CreateVenuePayload {
  name: string;
  ownerId: string;
  location: IGeoLocation;
  sports: string[];
  pricePerHour: number;
  amenities?: string[];
  description?: string;
  images?: string[];
  allowExternalCoaches?: boolean;
}

export const createVenue = async (
  payload: CreateVenuePayload,
): Promise<VenueDocument> => {
  const venue = new Venue(payload);
  await venue.save();
  return venue;
};

export const getVenueById = async (
  id: string,
): Promise<VenueDocument | null> => {
  return Venue.findById(id).populate("ownerId");
};

export const getVenuesByOwner = async (
  ownerId: string,
  page: number = 1,
  limit: number = 20
): Promise<{ venues: VenueDocument[]; total: number; page: number; totalPages: number }> => {
  const query = { ownerId };
  const skip = (page - 1) * limit;
  const total = await Venue.countDocuments(query);
  const venues = await Venue.find(query).skip(skip).limit(limit);
  return { venues, total, page, totalPages: Math.ceil(total / limit) };
};

/**
 * Find venues near a location using geo-spatial query
 */
/**
 * Find venues near a location using geo-spatial query
 */
export const findVenuesNearby = async (
  lat: number,
  lng: number,
  radiusMeters: number = 5000,
  sport?: string,
  page: number = 1,
  limit: number = 20
): Promise<{ venues: VenueDocument[]; total: number; page: number; totalPages: number }> => {
  try {
    const query: any = {
      location: {
        $near: {
          $geometry: {
            type: "Point",
            coordinates: [lng, lat], // [longitude, latitude]
          },
          $maxDistance: radiusMeters,
        },
      },
    };

    // Filter by sport if provided
    if (sport) {
      query.sports = sport;
    }

    const skip = (page - 1) * limit;
    
    // Note: $near does not support countDocuments correctly in all cases with other filters, 
    // but works for basic cases. However, separate count might be needed if complex.
    // For $near, countDocuments matches the query.
    const total = await Venue.countDocuments(query);
    const venues = await Venue.find(query)
      .populate("ownerId")
      .skip(skip)
      .limit(limit);

    return {
      venues,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
  } catch (error) {
    throw new Error(
      `Failed to find venues: ${error instanceof Error ? error.message : "Unknown error"}`,
    );
  }
};

/**
 * Get all venues with optional filters (legacy method)
 */
export const getAllVenues = async (
  filters?: { sports?: string[] },
  page: number = 1,
  limit: number = 20
): Promise<{ venues: VenueDocument[]; total: number; page: number; totalPages: number }> => {
  const query: any = {};

  if (filters?.sports && filters.sports.length > 0) {
    query.sports = { $in: filters.sports };
  }

  const skip = (page - 1) * limit;
  const total = await Venue.countDocuments(query);
  const venues = await Venue.find(query)
    .populate("ownerId")
    .skip(skip)
    .limit(limit);

  return {
    venues,
    total,
    page,
    totalPages: Math.ceil(total / limit),
  };
};

export const updateVenue = async (
  id: string,
  payload: Partial<CreateVenuePayload>,
): Promise<VenueDocument | null> => {
  return Venue.findByIdAndUpdate(id, payload, { new: true });
};

export const deleteVenue = async (
  id: string,
): Promise<VenueDocument | null> => {
  return Venue.findByIdAndDelete(id);
};
