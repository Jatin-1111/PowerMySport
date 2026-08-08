import { Router } from "express";
import rateLimit from "express-rate-limit";
import {
  getDataSourceUploadUrl,
  listDataSourceTargets,
  getCalendarFreshness,
  createDataSource,
  listDataSources,
  getDataSourceDetail,
  updateDataSource,
  reExtractDataSource,
  enrichDataSourceDetails,
  approveDataSource,
  rejectDataSource,
} from "../controllers/dataSourceAdminController";
import {
  authMiddleware,
  adminMiddleware,
  requirePermission,
} from "../../middleware/auth";
import { createRedisRateLimitStore } from "../../middleware/rateLimit";

const dataSourceAdminRouter = Router();

// Extraction (create/re-extract) burns Gemini quota per call — cap accidental
// double-clicks/rapid retries per admin (hardening #5).
const extractionRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  store: createRedisRateLimitStore("rl:admin:data-source-extract:"),
  message: {
    success: false,
    message: "Too many extraction requests. Please wait a moment before trying again.",
  },
});

dataSourceAdminRouter.post(
  "/upload-url",
  authMiddleware,
  adminMiddleware,
  requirePermission("data-sources:manage"),
  getDataSourceUploadUrl,
);

dataSourceAdminRouter.get(
  "/targets",
  authMiddleware,
  adminMiddleware,
  requirePermission("data-sources:view"),
  listDataSourceTargets,
);

dataSourceAdminRouter.get(
  "/calendar-freshness",
  authMiddleware,
  adminMiddleware,
  requirePermission("data-sources:view"),
  getCalendarFreshness,
);

dataSourceAdminRouter.get(
  "/",
  authMiddleware,
  adminMiddleware,
  requirePermission("data-sources:view"),
  listDataSources,
);

dataSourceAdminRouter.post(
  "/",
  authMiddleware,
  adminMiddleware,
  requirePermission("data-sources:manage"),
  extractionRateLimiter,
  createDataSource,
);

dataSourceAdminRouter.get(
  "/:id",
  authMiddleware,
  adminMiddleware,
  requirePermission("data-sources:view"),
  getDataSourceDetail,
);

dataSourceAdminRouter.patch(
  "/:id",
  authMiddleware,
  adminMiddleware,
  requirePermission("data-sources:review"),
  updateDataSource,
);

dataSourceAdminRouter.post(
  "/:id/re-extract",
  authMiddleware,
  adminMiddleware,
  requirePermission("data-sources:manage"),
  extractionRateLimiter,
  reExtractDataSource,
);

// Fans out to as many as 150 page fetches plus batched AI reads, so it shares
// the extraction limiter rather than running unthrottled.
dataSourceAdminRouter.post(
  "/:id/enrich-details",
  authMiddleware,
  adminMiddleware,
  requirePermission("data-sources:manage"),
  extractionRateLimiter,
  enrichDataSourceDetails,
);

dataSourceAdminRouter.post(
  "/:id/approve",
  authMiddleware,
  adminMiddleware,
  requirePermission("data-sources:review"),
  approveDataSource,
);

dataSourceAdminRouter.post(
  "/:id/reject",
  authMiddleware,
  adminMiddleware,
  requirePermission("data-sources:review"),
  rejectDataSource,
);

export default dataSourceAdminRouter;
