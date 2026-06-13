import { Router } from "express";
import { submitGuidance, getGuidanceHistory } from "../controllers/guidanceController";
import { authMiddleware } from "../../middleware/auth";

const guidanceRouter = Router();

guidanceRouter.post("/", authMiddleware, submitGuidance);
guidanceRouter.get("/", authMiddleware, getGuidanceHistory);

export default guidanceRouter;
