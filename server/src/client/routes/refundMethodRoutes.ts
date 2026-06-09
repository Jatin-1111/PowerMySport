import { Router } from "express";
import {
  addRefundMethod,
  deleteRefundMethod,
  listRefundMethods,
  setDefaultRefundMethod,
  updateRefundMethod,
} from "../controllers/refundMethodController";
import { authMiddleware } from "../../middleware/auth";

const router = Router();

router.get("/", authMiddleware, listRefundMethods);
router.post("/", authMiddleware, addRefundMethod);
router.put("/:methodId", authMiddleware, updateRefundMethod);
router.delete("/:methodId", authMiddleware, deleteRefundMethod);
router.patch("/:methodId/set-default", authMiddleware, setDefaultRefundMethod);

export default router;
