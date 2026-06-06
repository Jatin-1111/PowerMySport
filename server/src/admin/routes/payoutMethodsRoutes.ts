import { Router } from "express";
import {
  addCoachPayoutMethod,
  addVenuePayoutMethod,
  deleteCoachPayoutMethod,
  deleteVenuePayoutMethod,
  listCoachPayoutMethods,
  listVenuePayoutMethods,
  setDefaultCoachPayoutMethod,
  setDefaultVenuePayoutMethod,
  updateCoachPayoutMethod,
  updateVenuePayoutMethod,
} from "../controllers/payoutMethodsController";
import { authMiddleware, venueListerMiddleware } from "../../middleware/auth";

const router = Router();

router.get("/coach", authMiddleware, listCoachPayoutMethods);
router.post("/coach", authMiddleware, addCoachPayoutMethod);
router.put("/coach/:methodId", authMiddleware, updateCoachPayoutMethod);
router.delete("/coach/:methodId", authMiddleware, deleteCoachPayoutMethod);
router.patch(
  "/coach/:methodId/set-default",
  authMiddleware,
  setDefaultCoachPayoutMethod,
);

router.get(
  "/venue",
  authMiddleware,
  venueListerMiddleware,
  listVenuePayoutMethods,
);
router.post(
  "/venue",
  authMiddleware,
  venueListerMiddleware,
  addVenuePayoutMethod,
);
router.put(
  "/venue/:methodId",
  authMiddleware,
  venueListerMiddleware,
  updateVenuePayoutMethod,
);
router.delete(
  "/venue/:methodId",
  authMiddleware,
  venueListerMiddleware,
  deleteVenuePayoutMethod,
);
router.patch(
  "/venue/:methodId/set-default",
  authMiddleware,
  venueListerMiddleware,
  setDefaultVenuePayoutMethod,
);

export default router;
