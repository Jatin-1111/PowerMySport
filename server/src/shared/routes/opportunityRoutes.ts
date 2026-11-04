import { Router } from "express";

import { getOpportunity, listOpportunities } from "../controller/opportunityController";

// Public and read-only: the admissions and scholarships pages.
const router = Router();

router.get("/", listOpportunities);
router.get("/:slug", getOpportunity);

export default router;
