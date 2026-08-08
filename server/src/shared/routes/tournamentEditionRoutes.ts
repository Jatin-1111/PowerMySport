import { Router } from "express";
import {
  getTournamentEdition,
  listTournamentEditionSlugs,
} from "../controller/tournamentEditionController";

const router = Router();

// GET /api/tournament-editions?limit=2000  (slugs only, for the sitemap)
router.get("/", listTournamentEditionSlugs);

// GET /api/tournament-editions/:slug
router.get("/:slug", getTournamentEdition);

export default router;
