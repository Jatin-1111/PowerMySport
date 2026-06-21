import express from "express";
import { authMiddleware } from "../../middleware/auth";
import {
  getWallet,
  topUpWallet,
  verifyTopUp,
} from "../controllers/walletController";

const router = express.Router();

// Apply auth middleware to all wallet routes
router.use(authMiddleware);

router.get("/", getWallet);
router.post("/topup", topUpWallet);
router.post("/topup/verify", verifyTopUp);

export default router;
