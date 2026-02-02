import { Request, Response } from "express";
import {
  createVenue,
  getVenueById,
  getVenuesByOwner,
  getAllVenues,
  updateVenue,
  deleteVenue,
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

export const searchVenues = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { sports, location } = req.query;

    const filters: { sports?: string[]; location?: string } = {};
    if (sports) {
      filters.sports = Array.isArray(sports)
        ? (sports as string[])
        : [sports as string];
    }
    if (location) {
      filters.location = location as string;
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
