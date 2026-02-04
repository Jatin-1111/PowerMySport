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
): Promise<VenueDocument[]> => {
  return Venue.find({ ownerId });
};

/**
 * Find venues near a location using geo-spatial query
 */
export const findVenuesNearby = async (
  lat: number,
  lng: number,
  radiusMeters: number = 5000,
  sport?: string,
): Promise<VenueDocument[]> => {
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

    return Venue.find(query).populate("ownerId");
  } catch (error) {
    throw new Error(
      `Failed to find venues: ${error instanceof Error ? error.message : "Unknown error"}`,
    );
  }
};

/**
 * Get all venues with optional filters (legacy method)
 */
export const getAllVenues = async (filters?: {
  sports?: string[];
}): Promise<VenueDocument[]> => {
  const query: any = {};

  if (filters?.sports && filters.sports.length > 0) {
    query.sports = { $in: filters.sports };
  }

  return Venue.find(query).populate("ownerId");
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
