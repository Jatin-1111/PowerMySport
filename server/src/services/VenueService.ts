import mongoose from "mongoose";
import { Venue, VenueDocument } from "../models/Venue";
import { IGeoLocation } from "../types";

export interface CreateVenuePayload {
  name: string;
  ownerId: string;
  location: IGeoLocation;
  sports: string[];
  pricePerHour: number;
  sportPricing?: Record<string, number>;
  amenities?: string[];
  description?: string;
  images?: string[];
  allowExternalCoaches?: boolean;
  approvalStatus?: string;
}

export const createVenue = async (
  payload: CreateVenuePayload,
): Promise<VenueDocument> => {
  // Ensure ownerId is properly converted to ObjectId
  const venueData: any = {
    ...payload,
    ownerId: payload.ownerId
      ? new mongoose.Types.ObjectId(payload.ownerId)
      : undefined,
  };

  console.log("Creating venue with data:", {
    name: venueData.name,
    ownerId: venueData.ownerId,
    ownerIdType: typeof venueData.ownerId,
    sports: venueData.sports,
    approvalStatus: venueData.approvalStatus,
  });

  const venue = new Venue(venueData);
  await venue.save();

  console.log("Venue saved:", {
    id: venue._id,
    name: venue.name,
    ownerId: venue.ownerId,
    approvalStatus: venue.approvalStatus,
  });

  return venue;
};

export const getVenueById = async (
  id: string,
): Promise<VenueDocument | null> => {
  const venue = await Venue.findById(id).populate("ownerId");
  if (venue) {
    // Refresh all presigned URLs before returning
    await venue.refreshAllUrls();
  }
  return venue;
};

export const getVenuesByOwner = async (
  ownerId: string,
  page: number = 1,
  limit: number = 20,
): Promise<{
  venues: VenueDocument[];
  total: number;
  page: number;
  totalPages: number;
}> => {
  // Convert string to ObjectId for proper comparison
  const ownerObjectId = new mongoose.Types.ObjectId(ownerId);
  const query = {
    $or: [{ ownerId: ownerObjectId }, { ownerId }],
  };

  const skip = (page - 1) * limit;
  const total = await Venue.countDocuments(query);
  const venues = await Venue.find(query).skip(skip).limit(limit);

  // Refresh URLs for all venues
  await Promise.all(venues.map((v) => v.refreshAllUrls()));

  return { venues, total, page, totalPages: Math.ceil(total / limit) };
};

/**
 * Find venues near a location using geo-spatial query with aggregation pipeline
 * Fixes pagination issues with $near by using aggregation instead of find()
 */
export const findVenuesNearby = async (
  lat: number,
  lng: number,
  radiusMeters: number = 5000,
  sport?: string,
  page: number = 1,
  limit: number = 20,
): Promise<{
  venues: VenueDocument[];
  total: number;
  page: number;
  totalPages: number;
}> => {
  try {
    const skip = (page - 1) * limit;

    // Build match stage
    const matchStage: any = {
      location: {
        $geoWithin: {
          $centerSphere: [[lng, lat], radiusMeters / 6378100], // Earth radius in meters
        },
      },
    };

    // Filter by sport if provided
    if (sport) {
      matchStage.sports = sport;
    }

    // Use aggregation pipeline for proper pagination with geo-queries
    const pipeline = [
      { $match: matchStage },
      { $sort: { _id: 1 as const } }, // Add sort for consistent pagination
    ];

    // Get total count
    const countPipeline = [...pipeline, { $count: "total" as const }];
    const countResult = await Venue.aggregate(countPipeline);
    const total = countResult.length > 0 ? countResult[0].total : 0;

    // Get paginated results
    const dataPipeline = [
      ...pipeline,
      { $skip: skip },
      { $limit: limit },
      {
        $lookup: {
          from: "users" as const,
          localField: "ownerId" as const,
          foreignField: "_id" as const,
          as: "ownerInfo" as const,
        },
      },
    ];

    const venues = await Venue.aggregate(dataPipeline);

    // Convert aggregation results to Mongoose documents and refresh URLs
    const venueDocuments = await Promise.all(
      venues.map(async (v) => {
        const doc = await Venue.findById(v._id);
        if (doc) {
          await doc.refreshAllUrls();
        }
        return doc;
      }),
    );

    return {
      venues: venueDocuments.filter(Boolean) as VenueDocument[],
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
  limit: number = 20,
): Promise<{
  venues: VenueDocument[];
  total: number;
  page: number;
  totalPages: number;
}> => {
  const query: any = {};

  if (filters?.sports && filters.sports.length > 0) {
    query.sports = { $in: filters.sports };
  }

  console.log("[getAllVenues] Query:", JSON.stringify(query));
  console.log("[getAllVenues] Page:", page, "Limit:", limit);

  const skip = (page - 1) * limit;
  const total = await Venue.countDocuments(query);
  const venues = await Venue.find(query)
    .populate("ownerId")
    .skip(skip)
    .limit(limit);

  console.log(`[getAllVenues] Found ${venues.length} venues (total: ${total})`);
  console.log(
    "[getAllVenues] Venue IDs:",
    venues.map((v) => v._id.toString()),
  );

  // Refresh URLs for all venues
  await Promise.all(venues.map((v) => v.refreshAllUrls()));
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
