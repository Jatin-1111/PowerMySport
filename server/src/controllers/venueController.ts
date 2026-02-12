import { Request, Response } from "express";
import { User } from "../models/User";
import { Venue } from "../models/Venue";
import { s3Service } from "../services/S3Service";
import { findCoachesNearby, getAllCoaches } from "../services/CoachService";
import {
  createVenue,
  deleteVenue,
  findVenuesNearby,
  getAllVenues,
  getVenueById,
  getVenuesByOwner,
  updateVenue,
} from "../services/VenueService";

export const createNewVenue = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    if (!req.user?.id) {
      res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
      return;
    }

    // Check venue creation permissions based on role
    if (req.user.role === "VENUE_LISTER") {
      const user = await User.findById(req.user.id);

      if (!user) {
        res.status(404).json({
          success: false,
          message: "User not found",
        });
        return;
      }

      // Check if user can add more venues (defaults to false for approved venue listers)
      if (!user.venueListerProfile?.canAddMoreVenues) {
        res.status(403).json({
          success: false,
          message:
            "You are only allowed to manage your approved venue. Contact admin to add more venues.",
        });
        return;
      }
    }
    // Coaches can create their single academy venue without restrictions

    const venue = await createVenue({
      ...req.body,
      ownerId: req.user.id,
    });

    res.status(201).json({
      success: true,
      message: "Venue created successfully",
      data: venue,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message:
        error instanceof Error ? error.message : "Failed to create venue",
    });
  }
};

export const getVenue = async (req: Request, res: Response): Promise<void> => {
  try {
    const venueId = (req.params as Record<string, unknown>).venueId as string;

    const venue = await getVenueById(venueId);

    if (!venue) {
      res.status(404).json({
        success: false,
        message: "Venue not found",
      });
      return;
    }

    res.status(200).json({
      success: true,
      message: "Venue retrieved successfully",
      data: venue,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : "Failed to fetch venue",
    });
  }
};

export const getMyVenues = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    if (!req.user?.id) {
      res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
      return;
    }

    const page = parseInt((req.query.page as string) || "1", 10);
    const limit = parseInt((req.query.limit as string) || "20", 10);

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
  } catch (error) {
    res.status(500).json({
      success: false,
      message:
        error instanceof Error ? error.message : "Failed to fetch venues",
    });
  }
};

/**
 * Discovery endpoint: Search for venues AND coaches near a location
 * GET /api/search?lat=28.6139&lng=77.2090&radius=5000&sport=cricket
 */
export const discoverNearby = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { lat, lng, radius, sport } = req.query;
    const sportFilter = sport as string | undefined;

    // If no location provided, return all venues and coaches (Universal Feed)
    // If no location provided, return all venues and coaches (Universal Feed)
    if (!lat || !lng) {
      const page = parseInt((req.query.page as string) || "1", 10);
      const limit = parseInt((req.query.limit as string) || "20", 10);
      const venueFilters = sportFilter ? { sports: [sportFilter] } : {};

      const [venuesResult, coaches] = await Promise.all([
        getAllVenues(venueFilters, page, limit),
        getAllCoaches(sportFilter),
      ]);

      res.status(200).json({
        success: true,
        message: "Discovery feed retrieved successfully",
        data: {
          venues: venuesResult.venues,
          coaches,
        },
        pagination: {
          venues: {
            total: venuesResult.total,
            page: venuesResult.page,
            totalPages: venuesResult.totalPages,
          },
        },
      });
      return;
    }

    const latitude = parseFloat(lat as string);
    const longitude = parseFloat(lng as string);
    const radiusMeters = radius ? parseInt(radius as string, 10) : 5000;

    // Search for venues and coaches in parallel
    const page = parseInt((req.query.page as string) || "1", 10);
    const limit = parseInt((req.query.limit as string) || "20", 10);

    const [venuesResult, coaches] = await Promise.all([
      findVenuesNearby(
        latitude,
        longitude,
        radiusMeters,
        sportFilter,
        page,
        limit,
      ),
      findCoachesNearby(latitude, longitude, radiusMeters / 1000, sportFilter), // Convert to km
    ]);

    res.status(200).json({
      success: true,
      message: "Discovery results retrieved successfully",
      data: {
        venues: venuesResult.venues,
        coaches,
      },
      pagination: {
        venues: {
          total: venuesResult.total,
          page: venuesResult.page,
          totalPages: venuesResult.totalPages,
        },
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : "Discovery failed",
    });
  }
};

/**
 * Legacy search endpoint (for backward compatibility)
 */
export const searchVenues = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { sports, page: queryPage, limit: queryLimit } = req.query;

    const filters: { sports?: string[] } = {};
    if (sports) {
      filters.sports = Array.isArray(sports)
        ? (sports as string[])
        : [sports as string];
    }

    const page = parseInt((queryPage as string) || "1", 10);
    const limit = parseInt((queryLimit as string) || "20", 10);

    const result = await getAllVenues(filters, page, limit);

    res.status(200).json({
      success: true,
      message: "Search results retrieved successfully",
      data: result.venues,
      pagination: {
        total: result.total,
        page: result.page,
        totalPages: result.totalPages,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : "Search failed",
    });
  }
};

export const updateVenueDetails = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const venueId = (req.params as Record<string, unknown>).venueId as string;

    const venue = await updateVenue(venueId, req.body);

    if (!venue) {
      res.status(404).json({
        success: false,
        message: "Venue not found",
      });
      return;
    }

    res.status(200).json({
      success: true,
      message: "Venue updated successfully",
      data: venue,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message:
        error instanceof Error ? error.message : "Failed to update venue",
    });
  }
};

export const deleteVenueById = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const venueId = (req.params as Record<string, unknown>).venueId as string;

    const venue = await deleteVenue(venueId);

    if (!venue) {
      res.status(404).json({
        success: false,
        message: "Venue not found",
      });
      return;
    }

    res.status(200).json({
      success: true,
      message: "Venue deleted successfully",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message:
        error instanceof Error ? error.message : "Failed to delete venue",
    });
  }
};

export const getVenueImageUploadUrls = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    if (!req.user?.id) {
      res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
      return;
    }

    const venueId = (req.params as Record<string, unknown>).venueId as string;
    const { files, coverPhotoIndex } = req.body as {
      files: Array<{ fileName: string; contentType: string }>;
      coverPhotoIndex: number;
    };

    const venue = await Venue.findById(venueId);
    if (!venue) {
      res.status(404).json({
        success: false,
        message: "Venue not found",
      });
      return;
    }

    if (venue.ownerId?.toString() !== req.user.id) {
      res.status(403).json({
        success: false,
        message: "Access denied. You do not own this venue.",
      });
      return;
    }

    if (coverPhotoIndex < 0 || coverPhotoIndex >= files.length) {
      res.status(400).json({
        success: false,
        message: "Invalid cover photo index",
      });
      return;
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
        isCover,
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
  } catch (error) {
    res.status(500).json({
      success: false,
      message:
        error instanceof Error
          ? error.message
          : "Failed to generate image upload URLs",
    });
  }
};
