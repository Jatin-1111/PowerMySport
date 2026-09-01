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
import {
  getVenueEarningsHandler,
  getVenueAnalyticsHandler,
} from "../controllers/venueAnalyticsController";
import { cacheResponse } from "../../middleware/cacheMiddleware";
import { cacheControl } from "../../middleware/cacheControl";
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

// Get all venues. public: response never reads req.user or embeds any
// per-viewer field.
router.get("/", cacheControl(60, "public"), cacheResponse(60), searchVenues);

// Discovery endpoint (public) - returns venues AND coaches
router.get(
  "/discover",
  cacheControl(60, "public"),
  cacheResponse(60),
  discoverNearby,
);

// Legacy search endpoint (public)
router.get(
  "/search",
  cacheControl(60, "public"),
  cacheResponse(60),
  searchVenues,
);

router.get(
  "/earnings",
  authMiddleware,
  venueListerMiddleware,
  getVenueEarningsHandler,
);
router.get(
  "/analytics",
  authMiddleware,
  venueListerMiddleware,
  getVenueAnalyticsHandler,
);
router.get("/my-venues", authMiddleware, venueListerMiddleware, getMyVenues);
router.post(
  "/:venueId/image-upload-urls",
  authMiddleware,
  venueListerMiddleware,
  validateRequest(venueImageUploadSchema),
  getVenueImageUploadUrls,
);
// Public venue detail — same 60s Redis cache already used for search/discover,
// applied here too since this is the highest-traffic read (every venue page
// view) and previously had no caching at all. public: never reads req.user.
router.get("/:venueId", cacheControl(60, "public"), cacheResponse(60), getVenue);
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
