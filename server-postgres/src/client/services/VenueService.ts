import type { Venue, VenueApprovalStatus } from "@prisma/client";
import prisma from "../../lib/prisma";
import { IGeoLocation } from "../../types/index";
import { buildSafeSearchRegexSource } from "../../utils/regex";

// Children hydrated alongside a venue (previously embedded sub-documents).
const venueInclude = {
  sportPricing: true,
  sportImages: true,
  openingHours: true,
  venueCoaches: true,
  documents: true,
  payoutMethods: true,
} as const;

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
      : Array.isArray(pricing)
        ? pricing.map((row: any) => row?.price)
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
): Promise<Venue> => {
  // GeoJSON Point { coordinates:[lng,lat] } is gone; store lng/lat columns.
  const lng = payload.location?.coordinates?.[0] ?? null;
  const lat = payload.location?.coordinates?.[1] ?? null;

  const venue = await prisma.venue.create({
    data: {
      name: payload.name,
      ownerId: payload.ownerId,
      // NOTE(prisma): ownerName/ownerEmail/ownerPhone are required columns in
      // the Postgres schema but are not part of CreateVenuePayload (they were
      // optional in the old Mongo model). Defaulted to "" to keep the create
      // contract. // TODO(prisma): source these from the owner User record.
      ownerName: "",
      ownerEmail: "",
      ownerPhone: "",
      sports: payload.sports ?? [],
      pricePerHour: payload.pricePerHour,
      amenities: payload.amenities ?? [],
      description: payload.description ?? "",
      images: payload.images ?? [],
      allowExternalCoaches: payload.allowExternalCoaches ?? true,
      approvalStatus:
        (payload.approvalStatus as VenueApprovalStatus | undefined) ??
        "PENDING",
      lng,
      lat,
      ...(payload.sportPricing
        ? {
            sportPricing: {
              create: Object.entries(payload.sportPricing).map(
                ([sport, price]) => ({ sport, price }),
              ),
            },
          }
        : {}),
    },
    include: venueInclude,
  });

  console.log("Venue saved:", {
    id: venue.id,
    name: venue.name,
    ownerId: venue.ownerId,
    approvalStatus: venue.approvalStatus,
  });

  return venue;
};

export const getVenueById = async (id: string): Promise<Venue | null> => {
  const venue = await prisma.venue.findUnique({
    where: { id },
    include: venueInclude,
  });
  // TODO(prisma): the Mongo document exposed .refreshImageUrls()/.populate("ownerId");
  // model instance methods no longer exist. Re-issue S3 presigned image URLs and
  // resolve the owner User via a standalone helper if the caller needs them.
  return venue;
};

export const getVenuesByOwner = async (
  ownerId: string,
  page: number = 1,
  limit: number = 20,
): Promise<{
  venues: Venue[];
  total: number;
  page: number;
  totalPages: number;
}> => {
  const where = { ownerId };

  const skip = (page - 1) * limit;
  const [total, venues] = await Promise.all([
    prisma.venue.count({ where }),
    prisma.venue.findMany({
      where,
      skip,
      take: limit,
      include: venueInclude,
    }),
  ]);

  // TODO(prisma): refreshAllUrls() was a Mongoose model method (S3 presign);
  // reimplement as a standalone helper if fresh image/doc URLs are required.

  return { venues, total, page, totalPages: Math.ceil(total / limit) };
};

export const findVenuesNearby = async (
  lat: number,
  lng: number,
  radiusMeters: number = 5000,
  sport?: string,
  page: number = 1,
  limit: number = 20,
): Promise<{
  venues: Venue[];
  total: number;
  page: number;
  totalPages: number;
}> => {
  try {
    const skip = (page - 1) * limit;

    // TODO(prisma): geo — needs PostGIS/earthdistance $queryRaw. The Mongo
    // $geoNear (spherical radius + distance sort) has no Prisma equivalent.
    // Bounding-box fallback below keeps the endpoint returning results:
    // approximate degrees-per-km, filter lng/lat within the box, and order by
    // rating/reviewCount. Distance-based sort/paging is NOT preserved.
    const radiusKm = radiusMeters / 1000;
    const latDelta = radiusKm / 111; // ~111 km per degree of latitude
    const cosLat = Math.cos(toRadians(lat));
    const lngDelta = radiusKm / (111 * (Math.abs(cosLat) || 1));

    const where = {
      approvalStatus: "APPROVED" as VenueApprovalStatus,
      ...(sport ? { sports: { has: sport } } : {}),
      lat: { gte: lat - latDelta, lte: lat + latDelta },
      lng: { gte: lng - lngDelta, lte: lng + lngDelta },
    };

    const [total, venues] = await Promise.all([
      prisma.venue.count({ where }),
      prisma.venue.findMany({
        where,
        orderBy: [{ rating: "desc" }, { reviewCount: "desc" }, { id: "asc" }],
        skip,
        take: limit,
        include: venueInclude,
      }),
    ]);

    // TODO(prisma): refreshAllUrls() model method removed — see getVenuesByOwner.

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

export const getAllVenues = async (
  filters?: {
    sports?: string[];
    approvalStatus?: "PENDING" | "APPROVED" | "REJECTED" | "REVIEW";
    search?: string;
  },
  page: number = 1,
  limit: number = 20,
): Promise<{
  venues: Venue[];
  total: number;
  page: number;
  totalPages: number;
}> => {
  const where: any = {};

  if (filters?.sports && filters.sports.length > 0) {
    where.sports = { hasSome: filters.sports };
  }

  if (filters?.approvalStatus) {
    where.approvalStatus = filters.approvalStatus;
  }

  if (filters?.search) {
    // Postgres ILIKE via `contains` — strip the regex escaping from the shared
    // helper and keep only its length cap (see SportsService reference port).
    const term = buildSafeSearchRegexSource(filters.search)
      .replace(/\\/g, "")
      .slice(0, 100);
    where.name = { contains: term, mode: "insensitive" };
  }

  const skip = (page - 1) * limit;
  const [total, venues] = await Promise.all([
    prisma.venue.count({ where }),
    prisma.venue.findMany({
      where,
      orderBy: [{ rating: "desc" }, { reviewCount: "desc" }, { id: "asc" }],
      skip,
      take: limit,
      include: venueInclude,
    }),
  ]);

  // TODO(prisma): refreshAllUrls()/populate("ownerId") model helpers removed.

  return {
    venues,
    total,
    page,
    totalPages: Math.ceil(total / limit),
  };
};

// Fields a venue owner must never be able to set via a self-service update —
// these control ownership, verification/approval state, and platform economics.
const VENUE_PROTECTED_FIELDS = [
  "id",
  "_id",
  "ownerId",
  "approvalStatus",
  "isVerified",
  "isActive",
  "commissionRate",
  "rating",
  "reviewCount",
] as const;

export const updateVenue = async (
  id: string,
  ownerId: string,
  payload: Partial<CreateVenuePayload>,
): Promise<Venue | null> => {
  // Strip protected fields so they cannot be mass-assigned, and scope the
  // update to the owner so a lister can only edit their OWN venue (IDOR).
  const sanitized: Record<string, unknown> = { ...payload };
  for (const field of VENUE_PROTECTED_FIELDS) {
    delete sanitized[field];
  }

  // location/sportPricing are not scalar columns — translate/skip them.
  const { location, sportPricing, ...rest } = sanitized as any;
  const data: any = { ...rest };
  if (location?.coordinates) {
    data.lng = location.coordinates[0] ?? null;
    data.lat = location.coordinates[1] ?? null;
  }
  // TODO(prisma): sportPricing update requires delete+recreate of the
  // VenueSportPricing child rows in a $transaction; not handled by this
  // scalar-only update path.

  // Owner-scoped update: updateMany can filter on the non-unique ownerId, then
  // re-read to return the fresh row (Mongo's findOneAndUpdate({new:true})).
  const result = await prisma.venue.updateMany({
    where: { id, ownerId },
    data,
  });
  if (result.count === 0) return null;

  return prisma.venue.findUnique({ where: { id }, include: venueInclude });
};

export const deleteVenue = async (
  id: string,
  ownerId: string,
): Promise<Venue | null> => {
  // Owner-scoped delete — return null if it isn't this owner's venue (IDOR).
  const venue = await prisma.venue.findFirst({
    where: { id, ownerId },
    include: venueInclude,
  });
  if (!venue) return null;

  await prisma.venue.delete({ where: { id } });
  return venue;
};
