import { Router } from "express";
import {
  listFederations,
  getFederation,
  getFederationTournaments,
  getFederationEditions,
} from "../controller/federationController";

const router = Router();

// GET /api/federations?sport=tennis
router.get("/", listFederations);

// GET /api/federations/:slug
router.get("/:slug", getFederation);

// GET /api/federations/:slug/tournaments?level=national&ageGroup=U-14&page=1
router.get("/:slug/tournaments", getFederationTournaments);

// GET /api/federations/:slug/editions?limit=50
router.get("/:slug/editions", getFederationEditions);

export default router;
