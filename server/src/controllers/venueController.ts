import { Request, Response } from "express";
import { User } from "../models/User";
import { findCoachesNearby } from "../services/CoachService";
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

    // Check if user is venue lister and has permission to add more venues
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

    const venues = await getVenuesByOwner(req.user.id);

    res.status(200).json({
      success: true,
      message: "Venues retrieved successfully",
      data: venues,
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

    if (!lat || !lng) {
      res.status(400).json({
        success: false,
        message: "lat and lng are required parameters",
      });
      return;
    }

    const latitude = parseFloat(lat as string);
    const longitude = parseFloat(lng as string);
    const radiusMeters = radius ? parseInt(radius as string, 10) : 5000;
    const sportFilter = sport as string | undefined;

    // Search for venues and coaches in parallel
    const [venues, coaches] = await Promise.all([
      findVenuesNearby(latitude, longitude, radiusMeters, sportFilter),
      findCoachesNearby(latitude, longitude, radiusMeters / 1000, sportFilter), // Convert to km
    ]);

    res.status(200).json({
      success: true,
      message: "Discovery results retrieved successfully",
      data: {
        venues,
        coaches,
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
    const { sports } = req.query;

    const filters: { sports?: string[] } = {};
    if (sports) {
      filters.sports = Array.isArray(sports)
        ? (sports as string[])
        : [sports as string];
    }

    const venues = await getAllVenues(filters);

    res.status(200).json({
      success: true,
      message: "Search results retrieved successfully",
      data: venues,
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
