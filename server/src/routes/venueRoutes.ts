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
import { authMiddleware, venueListerMiddleware } from "../middleware/auth";
import { venueImageUploadSchema, venueSchema } from "../middleware/schemas";
import { validateRequest } from "../middleware/validation";

const router = Router();

router.post(
  "/",
  authMiddleware,
  venueListerMiddleware,
  validateRequest(venueSchema),
  createNewVenue,
);

// Get all venues
router.get("/", searchVenues);

// Discovery endpoint (public) - returns venues AND coaches
router.get("/discover", discoverNearby);

// Legacy search endpoint (public)
router.get("/search", searchVenues);

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
