import { Request, Response } from "express";
import { User } from "../models/User";
import { Venue } from "../models/Venue";
import { s3Service } from "../../shared/services/S3Service";
import {
  createVenue,
  deleteVenue,
  findVenuesNearby,
  getAllVenues,
  getVenueById,
  getVenuesByOwner,
  updateVenue,
} from "../services/VenueService";
import { getPaginationParams } from "../../utils/pagination";
import { transformDocument, transformDocuments } from "../../middleware/responseTransform";
import { log as __rootLog } from "../../utils/logger";
import { asyncHandler } from "../../middleware/asyncHandler";
import { AppError } from "../../utils/AppError";
const log = __rootLog.child("venue");

interface DiscoveryContext {
  page: number;
  limit: number;
  sportFilter: string | undefined;
  latitude: number | undefined;
  longitude: number | undefined;
  radiusMeters: number;
  hasLocation: boolean;
}

const buildDiscoveryContext = (req: Request): DiscoveryContext => {
  const lat = (req.query.lat || req.query.latitude) as string | undefined;
  const lng = (req.query.lng || req.query.longitude) as string | undefined;
  const radius = (req.query.radius || req.query.maxDistance) as string | undefined;
  const { sport } = req.query;

  const sportFilter = sport as string | undefined;
  const { page, limit } = getPaginationParams(req.query.page, req.query.limit, 20, 100);

  const hasLocation = Boolean(lat && lng);
  const latitude = hasLocation ? parseFloat(lat as string) : undefined;
  const longitude = hasLocation ? parseFloat(lng as string) : undefined;

  return {
    page,
    limit,
    sportFilter,
    latitude,
    longitude,
    radiusMeters: radius ? parseInt(radius as string, 10) : 5000,
    hasLocation,
  };
};

const fetchDiscoveryVenues = async (ctx: DiscoveryContext) => {
  if (!ctx.hasLocation || ctx.latitude === undefined || ctx.longitude === undefined) {
    const venueFilters = ctx.sportFilter
      ? {
          sports: [ctx.sportFilter],
          approvalStatus: "APPROVED" as const,
        }
      : {
          approvalStatus: "APPROVED" as const,
        };
    return getAllVenues(venueFilters, ctx.page, ctx.limit);
  }

  return findVenuesNearby(
    ctx.latitude,
    ctx.longitude,
    ctx.radiusMeters,
    ctx.sportFilter,
    ctx.page,
    ctx.limit
  );
};

export const createNewVenue = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  log.info("=== Create Venue Request ===");
  log.info("User:", req.user);
  log.info("Request body:", req.body);

  if (!req.user?.id) {
    throw new AppError("Unauthorized", 401);
  }

  // Only venue listers can create venues
  // Coaches store venue details in their profile and cannot create marketplace venues
  const user = await User.findById(req.user.id);

  if (!user) {
    throw new AppError("User not found", 404);
  }

  log.info("Venue Lister user:", {
    id: user._id,
    role: user.role,
  });

  const venue = await createVenue({
    ...req.body,
    ownerId: req.user.id,
    approvalStatus: "PENDING", // Require admin approval for quality control
  });

  const venueData = transformDocument(venue);

  res.status(201).json({
    success: true,
    message: "Venue created successfully and pending admin approval",
    data: venueData,
  });
});

export const getVenue = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const venueId = (req.params as Record<string, unknown>).venueId as string;

  const venue = await getVenueById(venueId);

  if (!venue) {
    throw new AppError("Venue not found", 404);
  }

  const venueData = transformDocument(venue);

  res.status(200).json({
    success: true,
    message: "Venue retrieved successfully",
    data: venueData,
  });
});

export const getMyVenues = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  if (!req.user?.id) {
    throw new AppError("Unauthorized", 401);
  }

  const { page, limit } = getPaginationParams(req.query.page, req.query.limit, 20, 100);

  const result = await getVenuesByOwner(req.user.id, page, limit);

  res.status(200).json({
    success: true,
    message: "Venues retrieved successfully",
    data: result.venues,
    pagination: {
      total: result.total,
      page: result.page,
      totalPages: result.totalPages,
    },
  });
});

/**
 * Discovery endpoint: Search for venues near a location
 * GET /api/search?lat=28.6139&lng=77.2090&radius=5000&sport=cricket
 */
export const discoverNearby = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const requestStartedAt = Date.now();
  const context = buildDiscoveryContext(req);

  const startedAt = Date.now();
  const venuesResult = await fetchDiscoveryVenues(context);
  const venuesFetchMs = Date.now() - startedAt;

  const totalDurationMs = Date.now() - requestStartedAt;
  const venueCount = venuesResult?.venues?.length ?? 0;

  log.info(
    "[discoverNearby]",
    JSON.stringify({
      hasLocation: context.hasLocation,
      radiusMeters: context.radiusMeters,
      sportFilter: context.sportFilter || null,
      page: context.page,
      limit: context.limit,
      venueCount,
      venuesFetchMs,
      totalDurationMs,
    })
  );

  res.status(200).json({
    success: true,
    message: "Discovery results retrieved successfully",
    data: {
      venues: transformDocuments(venuesResult.venues),
    },
    pagination: {
      venues: {
        total: venuesResult.total,
        page: venuesResult.page,
        totalPages: venuesResult.totalPages,
      },
    },
  });
});

/**
 * Legacy search endpoint (for backward compatibility)
 */
export const searchVenues = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { sports, page: queryPage, limit: queryLimit } = req.query;

  const filters: { sports?: string[] } = {};
  if (sports) {
    filters.sports = Array.isArray(sports) ? (sports as string[]) : [sports as string];
  }

  const { page, limit } = getPaginationParams(queryPage, queryLimit, 20, 100);

  const result = await getAllVenues({ ...filters, approvalStatus: "APPROVED" }, page, limit);

  res.status(200).json({
    success: true,
    message: "Search results retrieved successfully",
    data: transformDocuments(result.venues),
    pagination: {
      total: result.total,
      page: result.page,
      totalPages: result.totalPages,
    },
  });
});

export const updateVenueDetails = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const venueId = (req.params as Record<string, unknown>).venueId as string;

    const ownerId = req.user?.id;
    if (!ownerId) {
      throw new AppError("Authentication required", 401);
    }

    const venue = await updateVenue(venueId, ownerId, req.body);

    if (!venue) {
      throw new AppError("Venue not found", 404);
    }

    const venueData = transformDocument(venue);

    res.status(200).json({
      success: true,
      message: "Venue updated successfully",
      data: venueData,
    });
  }
);

export const deleteVenueById = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const venueId = (req.params as Record<string, unknown>).venueId as string;

  const ownerId = req.user?.id;
  if (!ownerId) {
    throw new AppError("Authentication required", 401);
  }

  const venue = await deleteVenue(venueId, ownerId);

  if (!venue) {
    throw new AppError("Venue not found", 404);
  }

  res.status(200).json({
    success: true,
    message: "Venue deleted successfully",
  });
});

export const getVenueImageUploadUrls = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    if (!req.user?.id) {
      throw new AppError("Unauthorized", 401);
    }

    const venueId = (req.params as Record<string, unknown>).venueId as string;
    const { files, coverPhotoIndex } = req.body as {
      files: Array<{ fileName: string; contentType: string }>;
      coverPhotoIndex: number;
    };

    const venue = await Venue.findById(venueId);
    if (!venue) {
      throw new AppError("Venue not found", 404);
    }

    if (venue.ownerId?.toString() !== req.user.id) {
      throw new AppError("Access denied. You do not own this venue.", 403);
    }

    if (coverPhotoIndex < 0 || coverPhotoIndex >= files.length) {
      throw new AppError("Invalid cover photo index", 400);
    }

    const uploadUrls = [] as Array<{
      field: string;
      uploadUrl: string;
      downloadUrl: string;
      fileName: string;
      contentType: string;
      maxSizeBytes: number;
    }>;

    for (let i = 0; i < files.length; i += 1) {
      const file = files[i];

      // Type guard to ensure file exists
      if (!file) {
        continue;
      }

      const field = `image_${i}`;
      const isCover = i === coverPhotoIndex;
      const uploadResponse = await s3Service.generateImageUploadUrl(
        file.fileName,
        file.contentType,
        venueId,
        isCover
      );

      uploadUrls.push({
        field,
        uploadUrl: uploadResponse.uploadUrl,
        downloadUrl: uploadResponse.downloadUrl,
        fileName: uploadResponse.fileName,
        contentType: file.contentType,
        maxSizeBytes: 5 * 1024 * 1024,
      });
    }

    res.status(200).json({
      success: true,
      message: "Image upload URLs generated",
      data: {
        uploadUrls,
      },
    });
  }
);
