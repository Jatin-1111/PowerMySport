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
import { authMiddleware, vendorMiddleware } from "../middleware/auth";
import { venueImageUploadSchema, venueSchema } from "../middleware/schemas";
import { validateRequest } from "../middleware/validation";

const router = Router();

router.post(
  "/",
  authMiddleware,
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

router.get("/my-venues", authMiddleware, vendorMiddleware, getMyVenues);
router.post(
  "/:venueId/image-upload-urls",
  authMiddleware,
  vendorMiddleware,
  validateRequest(venueImageUploadSchema),
  getVenueImageUploadUrls,
);
router.get("/:venueId", getVenue);
router.put("/:venueId", authMiddleware, vendorMiddleware, updateVenueDetails);
router.delete("/:venueId", authMiddleware, vendorMiddleware, deleteVenueById);

export default router;
