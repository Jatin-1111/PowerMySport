import mongoose from "mongoose";
import { Venue, VenueDocument } from "../models/Venue";
import { IGeoLocation } from "../types";

const clamp01 = (value: number): number => Math.min(1, Math.max(0, value));

const toRadians = (value: number): number => (value * Math.PI) / 180;

const calculateDistanceKm = (
  from: [number, number],
  to: [number, number],
): number => {
  const [fromLng, fromLat] = from;
  const [toLng, toLat] = to;

  const dLat = toRadians(toLat - fromLat);
  const dLng = toRadians(toLng - fromLng);

  const haversine =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(fromLat)) *
      Math.cos(toRadians(toLat)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);

  const arc = 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
  return 6371 * arc;
};

const getVenueDisplayPrice = (venue: any): number => {
  const fallback =
    typeof venue?.pricePerHour === "number" &&
    Number.isFinite(venue.pricePerHour)
      ? venue.pricePerHour
      : 0;

  const pricing = venue?.sportPricing;
  if (!pricing) return fallback;

  const values =
    pricing instanceof Map
      ? Array.from(pricing.values())
      : Object.values(pricing as Record<string, unknown>);

  const validValues = values.filter(
    (value): value is number =>
      typeof value === "number" && Number.isFinite(value) && value >= 0,
  );

  if (validValues.length === 0) return fallback;
  return Math.min(...validValues);
};

const buildVenueRelevanceScore = (params: {
  venue: any;
  sportFilter?: string | undefined;
  distanceKm?: number | undefined;
  maxDistanceKm?: number | undefined;
}): number => {
  const { venue, sportFilter, distanceKm, maxDistanceKm } = params;

  const ratingScore = clamp01(Number(venue?.rating || 0) / 5);
  const socialProofScore = clamp01(Number(venue?.reviewCount || 0) / 50);

  const displayPrice = getVenueDisplayPrice(venue);
  const priceScore = clamp01(1 - Math.min(displayPrice, 5000) / 5000);

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

  const approvalStatus = String(venue?.approvalStatus || "").toUpperCase();
  const approvalScore =
    approvalStatus === "APPROVED"
      ? 1
      : approvalStatus === "REVIEW"
        ? 0.6
        : approvalStatus === "PENDING"
          ? 0.3
          : 0;

  const normalizedSportFilter = String(sportFilter || "")
    .trim()
    .toLowerCase();
  const sports = Array.isArray(venue?.sports)
    ? venue.sports.map((value: unknown) => String(value || "").toLowerCase())
    : [];

  const sportMatchScore = normalizedSportFilter
    ? sports.includes(normalizedSportFilter)
      ? 1
      : sports.some((sport: string) => sport.includes(normalizedSportFilter))
        ? 0.6
        : 0
    : 0;

  return (
    ratingScore * 0.35 +
    distanceScore * 0.25 +
    priceScore * 0.15 +
    socialProofScore * 0.1 +
    sportMatchScore * 0.1 +
    approvalScore * 0.05
  );
};

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
    // For venue detail reads, only image URLs are needed.
    // Avoid refreshing document URLs here because it adds expensive S3 calls.
    await venue.refreshImageUrls();
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

    // Use aggregation pipeline for geo-filtering, then rank in-memory before pagination.
    const pipeline = [
      { $match: matchStage },
      {
        $lookup: {
          from: "users" as const,
          localField: "ownerId" as const,
          foreignField: "_id" as const,
          as: "ownerInfo" as const,
        },
      },
    ];

    const venues = await Venue.aggregate(pipeline);

    const rankedVenues = venues
      .map((venue: any) => {
        const coordinates = venue?.location?.coordinates;

        if (
          !Array.isArray(coordinates) ||
          coordinates.length !== 2 ||
          !Number.isFinite(Number(coordinates[0])) ||
          !Number.isFinite(Number(coordinates[1]))
        ) {
          return {
            venue,
            relevanceScore: buildVenueRelevanceScore({
              venue,
              sportFilter: sport,
              maxDistanceKm: radiusMeters / 1000,
            }),
          };
        }

        const normalizedCoordinates: [number, number] = [
          Number(coordinates[0]),
          Number(coordinates[1]),
        ];
        const distanceKm = calculateDistanceKm(normalizedCoordinates, [
          lng,
          lat,
        ]);
        const relevanceScore = buildVenueRelevanceScore({
          venue,
          sportFilter: sport,
          distanceKm,
          maxDistanceKm: radiusMeters / 1000,
        });

        return {
          venue,
          relevanceScore,
        };
      })
      .sort((a, b) => {
        if (b.relevanceScore !== a.relevanceScore) {
          return b.relevanceScore - a.relevanceScore;
        }

        return String(a.venue?._id || "").localeCompare(
          String(b.venue?._id || ""),
        );
      });

    const total = rankedVenues.length;
    const paginatedVenues = rankedVenues
      .slice(skip, skip + limit)
      .map((entry) => entry.venue);

    // Convert aggregation results to hydrated Mongoose documents and refresh URLs
    // This avoids an additional findById per venue (N+1 query pattern)
    const venueDocuments = await Promise.all(
      paginatedVenues.map(async (v) => {
        const doc = Venue.hydrate(v);
        await doc.refreshAllUrls();
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
  const allVenues = await Venue.find(query).populate("ownerId");

  const primarySportFilter =
    filters?.sports && filters.sports.length > 0
      ? filters.sports[0]
      : undefined;

  const rankedVenues = [...allVenues].sort((a, b) => {
    const scoreA = buildVenueRelevanceScore({
      venue: a,
      sportFilter: primarySportFilter,
    });
    const scoreB = buildVenueRelevanceScore({
      venue: b,
      sportFilter: primarySportFilter,
    });

    if (scoreB !== scoreA) {
      return scoreB - scoreA;
    }

    return String(a._id).localeCompare(String(b._id));
  });

  const total = rankedVenues.length;
  const venues = rankedVenues.slice(skip, skip + limit);

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
