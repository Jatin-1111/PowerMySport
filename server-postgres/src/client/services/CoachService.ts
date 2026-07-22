import { Prisma } from "@prisma/client";
import type { CoachVerificationStatus } from "@prisma/client";
import prisma from "../../lib/prisma";
import { s3Service } from "../../shared/services/S3Service";
import { ICoach, IOwnVenueDetails, ServiceMode } from "../../types/index";

// The Mongoose "CoachDocument" (whole-coach document) is replaced by a mapped
// legacy shape: the Prisma Coach row with its normalized child tables folded
// back into the embedded fields the API/frontends expect (sportPricing as a
// record, ownVenueDetails/baseLocation as GeoJSON-ish objects, availability
// arrays, verificationDocuments, and a populated `userId`). Kept loose (`any`)
// because the reshape diverges from the raw Prisma type.
type CoachDocument = any;

// Sub-file shape preserved for the verification-submission signature.
interface CoachDocumentFile {
  id?: string;
  type:
    | "CERTIFICATION"
    | "ID_PROOF"
    | "ADDRESS_PROOF"
    | "BACKGROUND_CHECK"
    | "INSURANCE"
    | "OTHER";
  url: string;
  s3Key?: string;
  fileName: string;
  uploadedAt: Date;
}

export type { CoachVerificationStatus };

const COACH_INCLUDE = {
  ownVenue: true,
  sportPricing: true,
  availability: true,
  sportAvailability: true,
  documents: true,
  blockedDates: true,
  payoutMethods: true,
} satisfies Prisma.CoachInclude;

type CoachWithRelations = Prisma.CoachGetPayload<{ include: typeof COACH_INCLUDE }>;

const SCALAR_UPDATE_KEYS = new Set<string>([
  "bio",
  "certifications",
  "sports",
  "hourlyRate",
  "serviceMode",
  "serviceRadiusKm",
  "travelBufferTime",
  "onboardingProgressStep",
  "isVerified",
  "rating",
  "reviewCount",
  "verificationStatus",
  "verificationNotes",
  "verificationSubmittedAt",
  "lastVerificationReminderAt",
  "verifiedAt",
  "verifiedBy",
  "activeSubscriptionId",
  "subscriptionStatus",
  "subscriptionExpiresAt",
]);

const resolveCoachVenueImageUrl = async (key: string): Promise<string> => {
  try {
    return await s3Service.generateDownloadUrl(key, "images", 604800);
  } catch (imageError) {
    try {
      return await s3Service.generateDownloadUrl(key, "verification", 604800);
    } catch (verificationError) {
      console.error(`Failed to refresh coach venue image URL for ${key}:`, {
        imageError,
        verificationError,
      });
      return "";
    }
  }
};

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

/**
 * Fold the normalized Prisma child tables back into the embedded document
 * shape the rest of the app + frontends expect, and (optionally) attach the
 * populated user object as `userId` (mirrors the old .populate("userId")).
 */
const mapCoachRecord = (
  coach: CoachWithRelations | null,
  user?: unknown,
): CoachDocument => {
  if (!coach) return coach;

  const sportPricing: Record<string, number> = {};
  for (const sp of coach.sportPricing ?? []) {
    sportPricing[sp.sport] = sp.price;
  }

  const availabilityBySport: Record<string, any[]> = {};
  for (const sa of coach.sportAvailability ?? []) {
    (availabilityBySport[sa.sport] ??= []).push({
      dayOfWeek: sa.dayOfWeek,
      startTime: sa.startTime,
      endTime: sa.endTime,
    });
  }

  const ownVenueDetails = coach.ownVenue
    ? {
        name: coach.ownVenue.name,
        address: coach.ownVenue.address,
        location: {
          type: "Point" as const,
          coordinates: [coach.ownVenue.lng ?? 0, coach.ownVenue.lat ?? 0] as [
            number,
            number,
          ],
        },
        sports: coach.ownVenue.sports,
        amenities: coach.ownVenue.amenities,
        pricePerHour: coach.ownVenue.pricePerHour,
        description: coach.ownVenue.description,
        images: coach.ownVenue.images,
        imageS3Keys: coach.ownVenue.imageS3Keys,
        openingHours: coach.ownVenue.openingHours,
      }
    : undefined;

  const baseLocation =
    coach.baseLng != null && coach.baseLat != null
      ? {
          type: "Point" as const,
          coordinates: [coach.baseLng, coach.baseLat] as [number, number],
        }
      : undefined;

  return {
    ...coach,
    sportPricing,
    ownVenueDetails,
    baseLocation,
    availability: (coach.availability ?? []).map((a) => ({
      id: a.id,
      dayOfWeek: a.dayOfWeek,
      startTime: a.startTime,
      endTime: a.endTime,
    })),
    availabilityBySport,
    verificationDocuments: (coach.documents ?? []).map((d) => ({
      type: d.type,
      url: d.url,
      s3Key: d.s3Key ?? undefined,
      fileName: d.fileName,
      uploadedAt: d.uploadedAt,
    })),
    userId: user ?? coach.userId,
  };
};

const refreshCoachMediaUrls = async <T extends Record<string, any>>(
  coach: T,
  options?: {
    includeVenueImages?: boolean;
  },
): Promise<T> => {
  if (!coach) {
    return coach;
  }

  const mutableCoach = coach as any;
  const includeVenueImages = options?.includeVenueImages ?? true;

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

  const venueKeys: string[] =
    includeVenueImages &&
    Array.isArray(mutableCoach.ownVenueDetails?.imageS3Keys)
      ? mutableCoach.ownVenueDetails.imageS3Keys
      : [];

  if (includeVenueImages && venueKeys.length > 0) {
    const refreshedVenueImages = await Promise.all(
      venueKeys.map(async (key) => await resolveCoachVenueImageUrl(key)),
    );

    if (!mutableCoach.ownVenueDetails) {
      mutableCoach.ownVenueDetails = {};
    }

    mutableCoach.ownVenueDetails.images = refreshedVenueImages.filter(Boolean);
  }

  return coach;
};

/** Attach populated user objects (String-FK ref, no Prisma relation). */
const attachCoachUsers = async (
  coaches: CoachWithRelations[],
  select: Prisma.UserSelect,
): Promise<CoachDocument[]> => {
  const userIds = [...new Set(coaches.map((c) => c.userId))];
  const users = await prisma.user.findMany({
    where: { id: { in: userIds } },
    select,
  });
  const byId = new Map(users.map((u: any) => [u.id, u]));
  return coaches.map((c) => mapCoachRecord(c, byId.get(c.userId) ?? null));
};

const mapOwnVenueColumns = (venueData: any, fallback?: {
  images?: string[];
  imageS3Keys?: string[];
}) => {
  const rawCoords = Array.isArray(venueData.location?.coordinates)
    ? venueData.location.coordinates
    : Array.isArray(venueData.coordinates)
      ? venueData.coordinates
      : null;

  if (!rawCoords || rawCoords.length !== 2) {
    throw new Error(
      "ownVenueDetails.location.coordinates ([longitude, latitude]) is required",
    );
  }

  return {
    name: venueData.name ?? null,
    address: venueData.address ?? null,
    lng: Number(rawCoords[0]),
    lat: Number(rawCoords[1]),
    sports: venueData.sports || [],
    amenities: venueData.amenities || [],
    pricePerHour: venueData.pricePerHour ?? null,
    description: venueData.description ?? null,
    images: venueData.images || fallback?.images || [],
    imageS3Keys: venueData.imageS3Keys || fallback?.imageS3Keys || [],
    openingHours: venueData.openingHours ?? null,
  };
};

const flattenSportAvailability = (
  bySport: Record<string, Array<{ dayOfWeek: number; startTime: string; endTime: string }>>,
) =>
  Object.entries(bySport || {}).flatMap(([sport, slots]) =>
    (slots || []).map((s) => ({
      sport,
      dayOfWeek: s.dayOfWeek,
      startTime: s.startTime,
      endTime: s.endTime,
    })),
  );

export interface CreateCoachPayload {
  userId: string;
  bio: string;
  certifications: string[];
  sports: string[];
  hourlyRate: number;
  sportPricing?: Record<string, number>;
  serviceMode: ServiceMode;
  ownVenueDetails?: IOwnVenueDetails; // Venue details stored in coach profile (not separate Venue document)
  baseLocation?: {
    type: "Point";
    coordinates: [number, number];
  };
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
  // Relocated pre-save hook: default serviceRadiusKm/travelBufferTime for
  // FREELANCE/HYBRID coaches (see PORTING_GUIDE §3).
  const isFreelanceOrHybrid =
    payload.serviceMode === "FREELANCE" || payload.serviceMode === "HYBRID";
  const serviceRadiusKm =
    payload.serviceRadiusKm ?? (isFreelanceOrHybrid ? 10 : undefined);
  const travelBufferTime =
    payload.travelBufferTime ?? (isFreelanceOrHybrid ? 30 : undefined);

  const coach = await prisma.coach.create({
    data: {
      userId: payload.userId,
      bio: payload.bio,
      certifications: payload.certifications,
      sports: payload.sports,
      hourlyRate: payload.hourlyRate,
      serviceMode: payload.serviceMode as any,
      ...(serviceRadiusKm !== undefined ? { serviceRadiusKm } : {}),
      ...(travelBufferTime !== undefined ? { travelBufferTime } : {}),
      ...(payload.baseLocation
        ? {
            baseLng: payload.baseLocation.coordinates[0],
            baseLat: payload.baseLocation.coordinates[1],
          }
        : {}),
      ...(payload.sportPricing
        ? {
            sportPricing: {
              create: Object.entries(payload.sportPricing).map(
                ([sport, price]) => ({ sport, price }),
              ),
            },
          }
        : {}),
      ...(payload.availability?.length
        ? {
            availability: {
              create: payload.availability.map((a) => ({
                dayOfWeek: a.dayOfWeek,
                startTime: a.startTime,
                endTime: a.endTime,
              })),
            },
          }
        : {}),
      ...(payload.availabilityBySport
        ? {
            sportAvailability: {
              create: flattenSportAvailability(payload.availabilityBySport),
            },
          }
        : {}),
      ...(payload.ownVenueDetails
        ? { ownVenue: { create: mapOwnVenueColumns(payload.ownVenueDetails) } }
        : {}),
    },
    include: COACH_INCLUDE,
  });

  return mapCoachRecord(coach);
};

/**
 * Find coaches near a location (for FREELANCE and HYBRID coaches).
 *
 * TODO(prisma): geo — MongoDB's $geoNear aggregation has NO Prisma equivalent.
 * A true radius query needs PostGIS or the earthdistance/cube extension via
 * prisma.$queryRaw (ST_DWithin / earth_box). Interim implementation: a
 * bounding-box prefilter on baseLng/baseLat, then a haversine refine + sort in
 * code. Swap this for a $queryRaw geo query when the extension is provisioned.
 */
export const findCoachesNearby = async (
  lat: number,
  lng: number,
  radiusKm: number,
  sport?: string,
  limit: number = 50,
  skip: number = 0,
): Promise<CoachDocument[]> => {
  try {
    // ~111.32 km per degree of latitude; longitude scaled by cos(lat).
    const latDelta = radiusKm / 111.32;
    const lngDelta = radiusKm / (111.32 * Math.cos(toRadians(lat)) || 1);

    const candidates = await prisma.coach.findMany({
      where: {
        isVerified: true,
        verificationStatus: "VERIFIED",
        serviceMode: { in: ["FREELANCE", "HYBRID"] as any },
        ...(sport ? { sports: { has: sport } } : {}),
        baseLat: { gte: lat - latDelta, lte: lat + latDelta },
        baseLng: { gte: lng - lngDelta, lte: lng + lngDelta },
      },
      include: COACH_INCLUDE,
    });

    const withDistance = candidates
      .filter((c) => c.baseLng != null && c.baseLat != null)
      .map((c) => ({
        coach: c,
        distanceKm: calculateDistanceKm(
          [lng, lat],
          [c.baseLng as number, c.baseLat as number],
        ),
      }))
      .filter((x) => x.distanceKm <= radiusKm)
      .sort(
        (a, b) =>
          b.coach.rating - a.coach.rating ||
          b.coach.reviewCount - a.coach.reviewCount ||
          a.distanceKm - b.distanceKm ||
          a.coach.id.localeCompare(b.coach.id),
      )
      .slice(skip, skip + limit);

    const userIds = [...new Set(withDistance.map((x) => x.coach.userId))];
    const users = await prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, name: true, photoUrl: true, photoS3Key: true },
    });
    const byId = new Map(users.map((u) => [u.id, u]));

    const mapped = withDistance.map((x) =>
      mapCoachRecord(x.coach, byId.get(x.coach.userId) ?? null),
    );

    return Promise.all(
      mapped.map((coach) =>
        refreshCoachMediaUrls(coach, { includeVenueImages: false }),
      ),
    );
  } catch (error) {
    throw new Error(
      `Failed to find coaches: ${error instanceof Error ? error.message : "Unknown error"}`,
    );
  }
};

export const getAllCoaches = async (
  sport?: string,
  limit: number = 50,
  skip: number = 0,
): Promise<CoachDocument[]> => {
  try {
    const coaches = await prisma.coach.findMany({
      where: {
        isVerified: true,
        verificationStatus: "VERIFIED",
        ...(sport ? { sports: { has: sport } } : {}),
      },
      orderBy: [{ rating: "desc" }, { reviewCount: "desc" }, { id: "asc" }],
      skip,
      take: limit,
      include: COACH_INCLUDE,
    });

    const mapped = await attachCoachUsers(coaches, {
      id: true,
      name: true,
      photoUrl: true,
      photoS3Key: true,
    });

    return Promise.all(
      mapped.map((coach) =>
        refreshCoachMediaUrls(coach, { includeVenueImages: false }),
      ),
    );
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
  const coach = await prisma.coach.findFirst({
    where: { userId },
    include: COACH_INCLUDE,
  });
  if (!coach) {
    throw new Error("Coach profile not found");
  }

  if (coach.serviceMode === "OWN_VENUE") {
    const venueImagesCount = coach.ownVenue?.images?.length || 0;
    if (venueImagesCount < 3) {
      throw new Error(
        "OWN_VENUE coaches must upload at least 3 venue images before verification submission",
      );
    }
  }

  const documents = payload.documents || [];

  const updated = await prisma.$transaction(async (tx) => {
    // verificationDocuments was an embedded array; replace the child rows.
    await tx.coachDocument.deleteMany({ where: { coachId: coach.id } });
    return tx.coach.update({
      where: { id: coach.id },
      data: {
        verificationStatus: "PENDING",
        isVerified: false,
        verificationNotes: "",
        onboardingProgressStep: 3,
        verificationSubmittedAt: new Date(),
        verifiedAt: null,
        verifiedBy: null,
        documents: {
          create: documents.map((doc) => ({
            type: doc.type as any,
            url: doc.url,
            s3Key: doc.s3Key ?? null,
            fileName: doc.fileName,
            uploadedAt: doc.uploadedAt || new Date(),
          })),
        },
      },
      include: COACH_INCLUDE,
    });
  });

  return mapCoachRecord(updated);
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
  const where: Prisma.CoachWhereInput = {};
  if (status) {
    where.verificationStatus = status;
  }

  const skip = (page - 1) * limit;
  const [total, coaches] = await Promise.all([
    prisma.coach.count({ where }),
    prisma.coach.findMany({
      where,
      orderBy: { updatedAt: "desc" },
      skip,
      take: limit,
      include: COACH_INCLUDE,
    }),
  ]);

  // .populate("userId") with no projection -> full user objects.
  const mapped = await attachCoachUsers(coaches, undefined as any);

  return {
    coaches: mapped,
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
  const coach = await prisma.coach.findUnique({ where: { id: coachId } });
  if (!coach) {
    throw new Error("Coach not found");
  }

  const onboardingProgressStep = Math.max(
    Number(coach.onboardingProgressStep || 1),
    3,
  );

  const data: Prisma.CoachUpdateInput = {
    verificationStatus: status,
    verificationNotes: notes || "",
    onboardingProgressStep,
  };

  if (status === "VERIFIED") {
    data.isVerified = true;
    data.verifiedAt = new Date();
    data.verifiedBy = adminId;
  } else {
    data.isVerified = false;
    data.verifiedAt = null;
    data.verifiedBy = null;
  }

  const updated = await prisma.coach.update({
    where: { id: coachId },
    data,
    include: COACH_INCLUDE,
  });

  return mapCoachRecord(updated);
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
    const coach = await prisma.coach.findUnique({
      where: { id: coachId },
      include: { availability: true },
    });
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
    // Only active bookings block slots: PENDING_CONFIRMATION, PENDING_INVITES, CONFIRMED, IN_PROGRESS
    const startOfDay = new Date(
      date.getFullYear(),
      date.getMonth(),
      date.getDate(),
    );
    const endOfDay = new Date(
      date.getFullYear(),
      date.getMonth(),
      date.getDate() + 1,
    );

    const existingBooking = await prisma.booking.findFirst({
      where: {
        coachId,
        date: { gte: startOfDay, lt: endOfDay },
        status: {
          in: [
            "PENDING_CONFIRMATION",
            "PENDING_INVITES",
            "CONFIRMED",
            "IN_PROGRESS",
          ],
        },
        OR: [
          // Requested slot starts during existing booking
          { startTime: { lte: startTime }, endTime: { gt: startTime } },
          // Requested slot ends during existing booking
          { startTime: { lt: endTime }, endTime: { gte: endTime } },
          // Requested slot completely contains existing booking
          { startTime: { gte: startTime }, endTime: { lte: endTime } },
        ],
      },
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
  const coach = await prisma.coach.findUnique({
    where: { id: coachId },
    include: COACH_INCLUDE,
  });
  if (!coach) {
    return null;
  }

  const user = await prisma.user.findUnique({ where: { id: coach.userId } });
  return refreshCoachMediaUrls(mapCoachRecord(coach, user));
};

/**
 * Get coach by user ID
 */
export const getCoachByUserId = async (
  userId: string,
): Promise<CoachDocument | null> => {
  const coach = await prisma.coach.findUnique({
    where: { userId },
    include: COACH_INCLUDE,
  });
  if (!coach) {
    return null;
  }

  const user = await prisma.user.findUnique({ where: { id: coach.userId } });
  return refreshCoachMediaUrls(mapCoachRecord(coach, user));
};

/**
 * Update coach profile.
 * Scalars go straight onto the coach row; the previously-embedded fields
 * (ownVenueDetails, baseLocation, sportPricing, availability,
 * availabilityBySport, verificationDocuments) are written to their child
 * tables inside one transaction.
 */
export const updateCoach = async (
  coachId: string,
  updates: Partial<ICoach>,
): Promise<CoachDocument | null> => {
  // Validate coachId is provided
  if (!coachId || coachId === "undefined") {
    throw new Error("Invalid coach ID");
  }

  const coach = await prisma.coach.findUnique({
    where: { id: coachId },
    include: { ownVenue: true },
  });
  if (!coach) {
    return null;
  }

  const coachData: Record<string, unknown> = {};
  const childOps: Array<(tx: Prisma.TransactionClient) => Promise<unknown>> = [];

  for (const [key, value] of Object.entries(updates)) {
    if (value === undefined) {
      continue;
    }

    if (key === "ownVenueDetails" && value) {
      const columns = mapOwnVenueColumns(value as any, {
        ...(coach.ownVenue?.images ? { images: coach.ownVenue.images } : {}),
        ...(coach.ownVenue?.imageS3Keys
          ? { imageS3Keys: coach.ownVenue.imageS3Keys }
          : {}),
      });
      childOps.push((tx) =>
        tx.coachOwnVenue.upsert({
          where: { coachId: coach.id },
          create: { coachId: coach.id, ...columns },
          update: columns,
        }),
      );
    } else if (key === "baseLocation" && value) {
      const coords = (value as any).coordinates || [];
      coachData.baseLng = coords[0] != null ? Number(coords[0]) : null;
      coachData.baseLat = coords[1] != null ? Number(coords[1]) : null;
    } else if (key === "sportPricing" && value) {
      const rec = value as Record<string, number>;
      childOps.push(async (tx) => {
        await tx.coachSportPricing.deleteMany({ where: { coachId: coach.id } });
        await tx.coachSportPricing.createMany({
          data: Object.entries(rec).map(([sport, price]) => ({
            coachId: coach.id,
            sport,
            price,
          })),
        });
      });
    } else if (key === "availability" && Array.isArray(value)) {
      childOps.push(async (tx) => {
        await tx.coachAvailability.deleteMany({ where: { coachId: coach.id } });
        await tx.coachAvailability.createMany({
          data: (value as any[]).map((a) => ({
            coachId: coach.id,
            dayOfWeek: a.dayOfWeek,
            startTime: a.startTime,
            endTime: a.endTime,
          })),
        });
      });
    } else if (key === "availabilityBySport" && value) {
      const rows = flattenSportAvailability(value as any);
      childOps.push(async (tx) => {
        await tx.coachSportAvailability.deleteMany({
          where: { coachId: coach.id },
        });
        await tx.coachSportAvailability.createMany({
          data: rows.map((r) => ({ coachId: coach.id, ...r })),
        });
      });
    } else if (key === "verificationDocuments" && Array.isArray(value)) {
      childOps.push(async (tx) => {
        await tx.coachDocument.deleteMany({ where: { coachId: coach.id } });
        await tx.coachDocument.createMany({
          data: (value as any[]).map((d) => ({
            coachId: coach.id,
            type: d.type,
            url: d.url,
            s3Key: d.s3Key ?? null,
            fileName: d.fileName,
            uploadedAt: d.uploadedAt || new Date(),
          })),
        });
      });
    } else if (SCALAR_UPDATE_KEYS.has(key)) {
      coachData[key] = value;
    }
    // TODO(prisma): any Coach field outside SCALAR_UPDATE_KEYS / the child
    // handlers above is intentionally ignored — extend the set if a new
    // updatable field is added to the model.
  }

  const updated = await prisma.$transaction(async (tx) => {
    for (const op of childOps) {
      await op(tx);
    }
    return tx.coach.update({
      where: { id: coach.id },
      data: coachData,
      include: COACH_INCLUDE,
    });
  });

  return mapCoachRecord(updated);
};

/**
 * Delete coach profile (with cascade: delete all associated bookings)
 */
export const deleteCoach = async (coachId: string): Promise<boolean> => {
  try {
    return await prisma.$transaction(async (tx) => {
      await tx.booking.deleteMany({ where: { coachId } });
      const existing = await tx.coach.findUnique({ where: { id: coachId } });
      if (!existing) {
        return false;
      }
      // Child tables (sportPricing, availability, documents, ...) cascade via
      // onDelete: Cascade in the schema.
      await tx.coach.delete({ where: { id: coachId } });
      return true;
    });
  } catch (error) {
    throw new Error(
      `Failed to delete coach: ${error instanceof Error ? error.message : "Unknown error"}`,
    );
  }
};

/**
 * Get coach calendar data for a date range.
 * Returns bookings + blocked dates.
 */
export const getCoachCalendar = async (
  coachUserId: string,
  startDate: Date,
  endDate: Date,
): Promise<{
  bookings: any[];
  blockedDates: any[];
  availability: any[];
  availabilityBySport: Record<string, any[]>;
  travelBufferTime: number;
}> => {
  const coach = await prisma.coach.findUnique({
    where: { userId: coachUserId },
    select: {
      id: true,
      travelBufferTime: true,
      blockedDates: true,
      availability: true,
      sportAvailability: true,
    },
  });
  if (!coach) throw new Error("Coach profile not found");

  const bookings = await prisma.booking.findMany({
    where: {
      coachId: coach.id,
      date: { gte: startDate, lte: endDate },
      status: { not: "CANCELLED" },
    },
    orderBy: [{ date: "asc" }, { startTime: "asc" }],
  });

  // Populate booking users (name/photoUrl/email) into `userId` (was .populate).
  const userIds = [...new Set(bookings.map((b) => b.userId))];
  const users = await prisma.user.findMany({
    where: { id: { in: userIds } },
    select: { id: true, name: true, photoUrl: true, email: true },
  });
  const byId = new Map(users.map((u) => [u.id, u]));
  const bookingsWithUser = bookings.map((b) => ({
    ...b,
    userId: byId.get(b.userId) ?? b.userId,
  }));

  const availabilityBySport: Record<string, any[]> = {};
  for (const sa of coach.sportAvailability) {
    (availabilityBySport[sa.sport] ??= []).push({
      dayOfWeek: sa.dayOfWeek,
      startTime: sa.startTime,
      endTime: sa.endTime,
    });
  }

  return {
    bookings: bookingsWithUser,
    blockedDates: coach.blockedDates ?? [],
    availability: coach.availability ?? [],
    availabilityBySport,
    travelBufferTime: coach.travelBufferTime ?? 0,
  };
};

/**
 * Block a date range for a coach.
 */
export const blockCoachDates = async (
  coachUserId: string,
  payload: {
    startDate: Date;
    endDate: Date;
    reason?: string;
    allDay?: boolean;
  },
): Promise<any> => {
  const coach = await prisma.coach.findFirst({
    where: { userId: coachUserId },
    select: { id: true },
  });
  if (!coach) throw new Error("Coach profile not found");

  const created = await prisma.coachBlockedDate.create({
    data: {
      coachId: coach.id,
      startDate: payload.startDate,
      endDate: payload.endDate,
      reason: payload.reason?.trim() || null,
      allDay: payload.allDay ?? true,
      blockedAt: new Date(),
    },
  });

  return created;
};

/**
 * Remove a blocked date entry by its id.
 */
export const unblockCoachDate = async (
  coachUserId: string,
  blockId: string,
): Promise<void> => {
  const coach = await prisma.coach.findFirst({
    where: { userId: coachUserId },
    select: { id: true },
  });
  if (!coach) throw new Error("Coach profile not found");

  const result = await prisma.coachBlockedDate.deleteMany({
    where: { id: blockId, coachId: coach.id },
  });
  if (result.count === 0) throw new Error("Blocked date entry not found");
};

// Retained for parity with the original module (non-DB scoring helper).
void buildCoachRelevanceScore;
