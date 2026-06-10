import { Router } from "express";
import { submitGuidance } from "../controllers/guidanceController";

const guidanceRouter = Router();

guidanceRouter.post("/", submitGuidance);

export default guidanceRouter;
