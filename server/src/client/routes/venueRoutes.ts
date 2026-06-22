import { Router } from "express";
import {
  createNewVenue,
  deleteVenueById,
  discoverNearby,
  getVenueImageUploadUrls,
  getMyVenues,
  getVenue,
  searchVenues,
  updateVenueDetails,
} from "../controllers/venueController";
import { authMiddleware, venueListerMiddleware } from "../../middleware/auth";
import { getVenueEarningsHandler, getVenueAnalyticsHandler } from "../controllers/venueAnalyticsController";
import { cacheResponse } from "../../middleware/cacheMiddleware";
import { venueImageUploadSchema, venueSchema } from "../../middleware/schemas";
import { validateRequest } from "../../middleware/validation";

const router = Router();

router.post(
  "/",
  authMiddleware,
  venueListerMiddleware,
  validateRequest(venueSchema),
  createNewVenue,
);

// Get all venues
router.get("/", cacheResponse(60), searchVenues);

// Discovery endpoint (public) - returns venues AND coaches
router.get("/discover", cacheResponse(60), discoverNearby);

// Legacy search endpoint (public)
router.get("/search", cacheResponse(60), searchVenues);

router.get("/earnings", authMiddleware, venueListerMiddleware, getVenueEarningsHandler);
router.get("/analytics", authMiddleware, venueListerMiddleware, getVenueAnalyticsHandler);
router.get("/my-venues", authMiddleware, venueListerMiddleware, getMyVenues);
router.post(
  "/:venueId/image-upload-urls",
  authMiddleware,
  venueListerMiddleware,
  validateRequest(venueImageUploadSchema),
  getVenueImageUploadUrls,
);
router.get("/:venueId", getVenue);
router.put(
  "/:venueId",
  authMiddleware,
  venueListerMiddleware,
  updateVenueDetails,
);
router.delete(
  "/:venueId",
  authMiddleware,
  venueListerMiddleware,
  deleteVenueById,
);

export default router;
