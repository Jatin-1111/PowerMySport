import { Router } from "express";
import {
  autocompleteLocation,
  geocodeAddress,
  reverseGeocode,
} from "../controllers/geoController";

const router = Router();

router.get("/autocomplete", autocompleteLocation);
router.get("/geocode", geocodeAddress);
router.get("/reverse", reverseGeocode);

export default router;
