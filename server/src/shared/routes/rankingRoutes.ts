import { Router } from "express";
import {
  getPlayerRankingHistory,
  getRankingHealth,
  getRankingMeta,
  listRankingDates,
  listRankings,
} from "../controller/rankingController";

const router = Router();

// GET /api/rankings/meta — combos, current dates, states (for filter UIs)
router.get("/meta", getRankingMeta);

// GET /api/rankings/health — freshness of the mirror
router.get("/health", getRankingHealth);

// GET /api/rankings/dates?category=&subcategory= — weeks available for a combo
router.get("/dates", listRankingDates);

// GET /api/rankings/players/:regNo — one player's standing and trajectory
router.get("/players/:regNo", getPlayerRankingHistory);

// GET /api/rankings?category=Boys&subcategory=U-14&state=&search=&date=&page=&limit=
// Declared last so it does not shadow the named routes above.
router.get("/", listRankings);

export default router;
