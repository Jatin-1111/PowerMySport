import { Router } from "express";
import {
  autocompleteLocation,
  geocodeAddress,
  lookupPincode,
  reverseGeocode,
} from "../controller/geoController";

const router = Router();

router.get("/autocomplete", autocompleteLocation);
router.get("/geocode", geocodeAddress);
router.get("/reverse", reverseGeocode);
router.get("/pincode/:pincode", lookupPincode);

export default router;
