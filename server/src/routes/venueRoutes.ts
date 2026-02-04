import { Router } from "express";
import {
  createNewVenue,
  getVenue,
  getMyVenues,
  searchVenues,
  discoverNearby,
  updateVenueDetails,
  deleteVenueById,
} from "../controllers/venueController";
import { authMiddleware, vendorMiddleware } from "../middleware/auth";
import { validateRequest } from "../middleware/validation";
import { venueSchema } from "../middleware/schemas";

const router = Router();

router.post(
  "/",
  authMiddleware,
  vendorMiddleware,
  validateRequest(venueSchema),
  createNewVenue,
);

// Discovery endpoint (public) - returns venues AND coaches
router.get("/discover", discoverNearby);

// Legacy search endpoint (public)
router.get("/search", searchVenues);

router.get("/my-venues", authMiddleware, vendorMiddleware, getMyVenues);
router.get("/:venueId", getVenue);
router.put("/:venueId", authMiddleware, vendorMiddleware, updateVenueDetails);
router.delete("/:venueId", authMiddleware, vendorMiddleware, deleteVenueById);

export default router;
