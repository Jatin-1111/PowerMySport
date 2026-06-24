import { Router } from "express";
import { submitGuidance, getGuidanceHistory, deleteGuidance } from "../controllers/guidanceController";
import { authMiddleware } from "../../middleware/auth";

const guidanceRouter = Router();

guidanceRouter.post("/", authMiddleware, submitGuidance);
guidanceRouter.get("/", authMiddleware, getGuidanceHistory);
guidanceRouter.delete("/:id", authMiddleware, deleteGuidance);

export default guidanceRouter;
