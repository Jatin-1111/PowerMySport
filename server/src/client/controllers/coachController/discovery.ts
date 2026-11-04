import { Request, Response } from "express";
import { findCoachesNearby, getAllCoaches } from "../../services/CoachService";
import { getPaginationParams } from "../../../utils/pagination";
import { log } from "./shared";
import { asyncHandler } from "../../../middleware/asyncHandler";

interface CoachDiscoveryContext {
  page: number;
  limit: number;
  sportFilter: string | undefined;
  latitude: number | undefined;
  longitude: number | undefined;
  radiusMeters: number;
  hasLocation: boolean;
}

const buildCoachDiscoveryContext = (req: Request): CoachDiscoveryContext => {
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

/**
 * Discovery endpoint: Search for coaches near a location
 * GET /api/coaches/discover?lat=28.6139&lng=77.2090&radius=5000&sport=cricket
 */
export const discoverCoachesNearby = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const requestStartedAt = Date.now();
    const context = buildCoachDiscoveryContext(req);

    const startedAt = Date.now();
    const skip = (context.page - 1) * context.limit;
    const coaches =
      !context.hasLocation || context.latitude === undefined || context.longitude === undefined
        ? await getAllCoaches(context.sportFilter, context.limit, skip)
        : await findCoachesNearby(
            context.latitude,
            context.longitude,
            context.radiusMeters / 1000,
            context.sportFilter,
            context.limit,
            skip
          );
    const coachesFetchMs = Date.now() - startedAt;
    const totalDurationMs = Date.now() - requestStartedAt;

    log.info(
      "[discoverCoachesNearby]",
      JSON.stringify({
        hasLocation: context.hasLocation,
        radiusMeters: context.radiusMeters,
        sportFilter: context.sportFilter || null,
        page: context.page,
        limit: context.limit,
        coachCount: coaches.length,
        coachesFetchMs,
        totalDurationMs,
      })
    );

    res.status(200).json({
      success: true,
      message: "Coach discovery results retrieved successfully",
      data: {
        coaches,
      },
    });
  }
);
