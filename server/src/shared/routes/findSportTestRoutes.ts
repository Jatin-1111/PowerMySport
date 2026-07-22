// ─── Find-Sport Scoring — Testing Only ─────────────────────────────────────
// Not used by the live wizard (WizardShell runs its own client-side
// scoreSports()). Public, matching the real find-sport wizard's guest-usable
// nature — no auth needed to test it either.

import { Router } from "express";
import { scoreSport } from "../controller/findSportTestController";

const router = Router();

router.post("/score", scoreSport);

export default router;
