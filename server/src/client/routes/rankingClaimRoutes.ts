import { Router } from "express";
import rateLimit, { ipKeyGenerator } from "express-rate-limit";
import {
  createRankingClaim,
  deleteRankingClaim,
  listRankingClaims,
} from "../controllers/rankingClaimController";
import { authMiddleware } from "../../middleware/auth";
import { createRedisRateLimitStore } from "../../middleware/rateLimit";

const rankingClaimRouter = Router();

/**
 * The second of the two limits on the claim endpoint.
 *
 * The first, and the one that actually defends a given child, is the per-
 * registration-number lockout inside `RankingClaimService` — it is keyed on the
 * target rather than the attacker, so more accounts do not buy more guesses.
 * This one is keyed per account and exists for the cheaper problem: one signed-
 * in user hammering the endpoint across many registration numbers, which the
 * per-regNo counter would never see.
 *
 * `skipSuccessfulRequests` so a parent linking four children in a row is never
 * stopped; only failures count against the budget.
 */
const claimLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  skipSuccessfulRequests: true,
  standardHeaders: true,
  legacyHeaders: false,
  // `ipKeyGenerator` rather than `req.ip`: an IPv6 client is normally handed a
  // whole /64, so keying on the raw address would let one attacker rotate
  // through billions of addresses and reset this budget with each one. The
  // library raises ERR_ERL_KEY_GEN_IPV6 for exactly this. Signed-in requests
  // key on the account, which is the case that matters here anyway.
  keyGenerator: (req) => req.user?.id || (req.ip ? ipKeyGenerator(req.ip) : "anon"),
  store: createRedisRateLimitStore("rl:ranking-claim:"),
  message: {
    success: false,
    message: "Too many attempts. Please wait an hour before trying again.",
    code: "CLAIM_LIMIT_REACHED",
  },
});

// A claim is always about a profile this account owns, so there is no guest or
// id-possession path here — auth on every route, no exceptions.
rankingClaimRouter.get("/", authMiddleware, listRankingClaims);
rankingClaimRouter.post("/", authMiddleware, claimLimiter, createRankingClaim);
rankingClaimRouter.delete("/:id", authMiddleware, deleteRankingClaim);

export default rankingClaimRouter;
