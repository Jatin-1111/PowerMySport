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
import {
  authMiddleware,
  coachVerificationCompletedMiddleware,
  vendorMiddleware,
} from "../middleware/auth";
import { venueImageUploadSchema, venueSchema } from "../middleware/schemas";
import { validateRequest } from "../middleware/validation";

const router = Router();

router.post(
  "/",
  authMiddleware,
  coachVerificationCompletedMiddleware,
  vendorMiddleware,
  validateRequest(venueSchema),
  createNewVenue,
);

// Get all venues
router.get("/", searchVenues);

// Discovery endpoint (public) - returns venues AND coaches
router.get("/discover", discoverNearby);

// Legacy search endpoint (public)
router.get("/search", searchVenues);

router.get(
  "/my-venues",
  authMiddleware,
  coachVerificationCompletedMiddleware,
  vendorMiddleware,
  getMyVenues,
);
router.post(
  "/:venueId/image-upload-urls",
  authMiddleware,
  coachVerificationCompletedMiddleware,
  vendorMiddleware,
  validateRequest(venueImageUploadSchema),
  getVenueImageUploadUrls,
);
router.get("/:venueId", getVenue);
router.put(
  "/:venueId",
  authMiddleware,
  coachVerificationCompletedMiddleware,
  vendorMiddleware,
  updateVenueDetails,
);
router.delete(
  "/:venueId",
  authMiddleware,
  coachVerificationCompletedMiddleware,
  vendorMiddleware,
  deleteVenueById,
);

export default router;
