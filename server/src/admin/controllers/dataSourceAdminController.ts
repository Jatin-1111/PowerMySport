import { Request, Response } from "express";
import mongoose from "mongoose";
import {
  DataSourceSubmission,
  DataSourceTargetType,
} from "../../shared/models/DataSourceSubmission";
import { Federation } from "../../shared/models/Federation";
import { Tournament } from "../../shared/models/Tournament";
import { TournamentEdition } from "../../shared/models/TournamentEdition";
import {
  extractForSubmission,
  validateFederationPayload,
  validateCuratedTournamentPayload,
  validateEditions,
  ValidEdition,
} from "../services/DataSourceExtractionService";
import { s3Service } from "../../shared/services/S3Service";
import { recordAuditLog } from "../services/AuditLogService";
import { getAdminsWithPermission, resolveAdminAppUrl } from "../services/AdminService";
import { sendDataSourceReadyForReviewEmail } from "../../utils/email";
import { SUPPORTED_SPORTS, isSupportedSport, toSupportedSlug } from "../../shared/constants/supportedSports";

const ALLOWED_PDF_TYPES = ["application/pdf"];

/**
 * Drops keys whose value is empty (undefined/null/""/[]) so a `$set` built
 * from this never blanks out an existing live field — this is what lets two
 * different sources (e.g. a link for "about", a PDF for "eligibility") both
 * contribute to the same federation/tournament record without one approval
 * erasing the other's fields. Shallow only: a present sub-object
 * (eligibilityCriteria, contact) is replaced as a whole, not deep-merged.
 */
function pruneEmpty(obj: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value === undefined || value === null) continue;
    if (typeof value === "string" && value.trim() === "") continue;
    if (Array.isArray(value) && value.length === 0) continue;
    out[key] = value;
  }
  return out;
}

/** Fire-and-forget notification to reviewers once a submission lands in PENDING_REVIEW. */
async function notifyReviewers(submission: {
  _id: mongoose.Types.ObjectId;
  targetType: DataSourceTargetType;
  sportSlug: string;
}): Promise<void> {
  try {
    const reviewers = await getAdminsWithPermission("data-sources:review");
    const reviewUrl = `${resolveAdminAppUrl()}/admin/data-sources/${submission._id.toString()}`;
    await Promise.all(
      reviewers.map((admin) =>
        sendDataSourceReadyForReviewEmail({
          to: admin.email,
          name: admin.name,
          sportSlug: submission.sportSlug,
          targetType: submission.targetType,
          reviewUrl,
        }),
      ),
    );
  } catch (error) {
    console.error("Failed to notify data-source reviewers:", error);
  }
}

// ─── POST /api/admin/data-sources/upload-url ───────────────────────────────────

export const getDataSourceUploadUrl = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { fileName, contentType, sportSlug } = req.body as {
      fileName?: string;
      contentType?: string;
      sportSlug?: string;
    };
    if (!fileName || !contentType || !sportSlug) {
      res.status(400).json({
        success: false,
        message: "fileName, contentType, and sportSlug are required",
      });
      return;
    }
    if (!isSupportedSport(sportSlug)) {
      res.status(400).json({ success: false, message: "Unsupported sportSlug" });
      return;
    }
    if (!ALLOWED_PDF_TYPES.includes(contentType)) {
      res.status(400).json({
        success: false,
        message: `Invalid content type. Allowed: ${ALLOWED_PDF_TYPES.join(", ")}`,
      });
      return;
    }

    const uploadData = await s3Service.generateDataSourceUploadUrl(
      fileName,
      contentType,
      toSupportedSlug(sportSlug),
    );
    res.status(200).json({ success: true, data: uploadData });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error instanceof Error ? error.message : "Failed to generate upload URL",
    });
  }
};

// ─── GET /api/admin/data-sources/targets ───────────────────────────────────────
// Backs the "pick an existing Federation/Tournament, or create new" selector.

export const listDataSourceTargets = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const targetType = req.query.targetType as DataSourceTargetType | undefined;
    const rawSportSlug = req.query.sportSlug as string | undefined;
    if (!targetType || !rawSportSlug) {
      res.status(400).json({ success: false, message: "targetType and sportSlug are required" });
      return;
    }
    if (!isSupportedSport(rawSportSlug)) {
      res.status(400).json({ success: false, message: "Unsupported sportSlug" });
      return;
    }
    const sportSlug = toSupportedSlug(rawSportSlug);

    if (targetType === "FEDERATION") {
      const docs = await Federation.find({ sportSlug }).select("slug name acronym").lean();
      res.status(200).json({ success: true, data: docs.map((d) => ({ slug: d.slug, name: `${d.name} (${d.acronym})` })) });
      return;
    }

    if (targetType === "CURATED_TOURNAMENT") {
      const docs = await Tournament.find({ sportSlug, isCurated: true }).select("slug name").lean();
      res.status(200).json({ success: true, data: docs.map((d) => ({ slug: d.slug || "", name: d.name })) });
      return;
    }

    // TOURNAMENT_CALENDAR has no "target document" to pick — it's always keyed by sportSlug.
    res.status(200).json({ success: true, data: [] });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : "Failed to fetch targets",
    });
  }
};

// ─── GET /api/admin/data-sources/calendar-freshness ────────────────────────────
// One row per supported sport — when was its TournamentEdition data last
// touched by an approved calendar source. Replaces the visibility the old
// every-2-days cron gave for free; nothing here refreshes anything.

export const getCalendarFreshness = async (
  _req: Request,
  res: Response,
): Promise<void> => {
  try {
    const rows = await Promise.all(
      SUPPORTED_SPORTS.map(async (sport) => {
        const latest = await TournamentEdition.findOne({ sportSlug: sport.slug })
          .sort({ lastCheckedAt: -1 })
          .select("lastCheckedAt")
          .lean();
        return {
          sportSlug: sport.slug,
          sportName: sport.name,
          lastCheckedAt: latest?.lastCheckedAt ?? null,
        };
      }),
    );
    res.status(200).json({ success: true, data: rows });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : "Failed to fetch calendar freshness",
    });
  }
};

// ─── Shared: current live data for a submission's target (diff + rollback snapshot) ──

async function getCurrentLiveData(submission: {
  targetType: DataSourceTargetType;
  sportSlug: string;
  federationSlug?: string;
  tournamentSlug?: string;
}): Promise<unknown> {
  if (submission.targetType === "FEDERATION") {
    if (!submission.federationSlug) return null;
    return Federation.findOne({ slug: submission.federationSlug }).lean();
  }
  if (submission.targetType === "CURATED_TOURNAMENT") {
    if (!submission.tournamentSlug) return null;
    return Tournament.findOne({ sportSlug: submission.sportSlug, slug: submission.tournamentSlug }).lean();
  }
  // TOURNAMENT_CALENDAR — no single target doc; show the nearest upcoming editions as context.
  return TournamentEdition.find({ sportSlug: submission.sportSlug })
    .sort({ startDate: 1 })
    .limit(20)
    .lean();
}

// ─── POST /api/admin/data-sources ──────────────────────────────────────────────

export const createDataSource = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    if (!req.user?.id) {
      res.status(401).json({ success: false, message: "Unauthorized" });
      return;
    }

    const body = req.body as {
      targetType?: DataSourceTargetType;
      sportSlug?: string;
      federationSlug?: string;
      tournamentSlug?: string;
      sourceKind?: "PDF" | "LINK";
      sourceUrl?: string;
      s3Key?: string;
      fileName?: string;
      originUrl?: string;
    };

    if (!body.targetType || !body.sportSlug || !body.sourceKind) {
      res.status(400).json({ success: false, message: "targetType, sportSlug, and sourceKind are required" });
      return;
    }
    if (!isSupportedSport(body.sportSlug)) {
      res.status(400).json({ success: false, message: "Unsupported sportSlug" });
      return;
    }
    if (body.targetType === "FEDERATION" && !body.federationSlug) {
      res.status(400).json({ success: false, message: "federationSlug is required for a FEDERATION source" });
      return;
    }
    if (body.targetType === "CURATED_TOURNAMENT" && (!body.federationSlug || !body.tournamentSlug)) {
      res.status(400).json({ success: false, message: "federationSlug and tournamentSlug are required for a CURATED_TOURNAMENT source" });
      return;
    }
    if (body.sourceKind === "LINK" && !body.sourceUrl) {
      res.status(400).json({ success: false, message: "sourceUrl is required for a LINK source" });
      return;
    }
    if (body.sourceKind === "PDF" && !body.s3Key) {
      res.status(400).json({ success: false, message: "s3Key is required for a PDF source (upload it first)" });
      return;
    }

    const submission = await DataSourceSubmission.create({
      targetType: body.targetType,
      sportSlug: toSupportedSlug(body.sportSlug),
      federationSlug: body.federationSlug?.toLowerCase(),
      tournamentSlug: body.tournamentSlug?.toLowerCase(),
      sourceKind: body.sourceKind,
      sourceUrl: body.sourceUrl,
      s3Key: body.s3Key,
      fileName: body.fileName,
      originUrl: body.originUrl,
      status: "PENDING_EXTRACTION",
      submittedBy: req.user.id,
    });

    const result = await extractForSubmission(submission);
    submission.status = result.status;
    submission.extractedData = result.extractedData;
    submission.citations = result.citations;
    submission.extractionError = result.extractionError;
    submission.extractionModel = result.extractionModel;
    submission.extractedAt = new Date();
    await submission.save();

    if (result.status === "PENDING_REVIEW") {
      void notifyReviewers(submission);
    }

    res.status(201).json({ success: true, message: "Source submitted", data: submission });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error instanceof Error ? error.message : "Failed to create data source",
    });
  }
};

// ─── GET /api/admin/data-sources ───────────────────────────────────────────────

export const listDataSources = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const page = Math.max(1, parseInt((req.query.page as string) || "1", 10));
    const limit = Math.min(100, Math.max(1, parseInt((req.query.limit as string) || "20", 10)));
    const filter: Record<string, unknown> = {};
    if (req.query.status) filter.status = req.query.status;
    if (req.query.targetType) filter.targetType = req.query.targetType;
    if (req.query.sportSlug) filter.sportSlug = (req.query.sportSlug as string).toLowerCase();

    const [docs, total] = await Promise.all([
      DataSourceSubmission.find(filter)
        .populate("submittedBy", "name email")
        .populate("reviewedBy", "name email")
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      DataSourceSubmission.countDocuments(filter),
    ]);

    res.status(200).json({
      success: true,
      data: docs,
      pagination: { total, page, totalPages: Math.max(1, Math.ceil(total / limit)) },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : "Failed to fetch data sources",
    });
  }
};

// ─── GET /api/admin/data-sources/:id ────────────────────────────────────────────

export const getDataSourceDetail = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { id } = req.params;
    if (!id || typeof id !== "string" || !mongoose.isValidObjectId(id)) {
      res.status(400).json({ success: false, message: "Invalid data source ID" });
      return;
    }
    const submission = await DataSourceSubmission.findById(id)
      .populate("submittedBy", "name email")
      .populate("reviewedBy", "name email")
      .lean();
    if (!submission) {
      res.status(404).json({ success: false, message: "Data source not found" });
      return;
    }

    const currentLiveData = await getCurrentLiveData(submission);
    res.status(200).json({ success: true, data: { ...submission, currentLiveData } });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : "Failed to fetch data source",
    });
  }
};

// ─── PATCH /api/admin/data-sources/:id ──────────────────────────────────────────
// Lets an admin edit the extracted payload before approving it.

export const updateDataSource = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    if (!req.user?.id) {
      res.status(401).json({ success: false, message: "Unauthorized" });
      return;
    }
    const { id } = req.params;
    if (!id || typeof id !== "string" || !mongoose.isValidObjectId(id)) {
      res.status(400).json({ success: false, message: "Invalid data source ID" });
      return;
    }
    if (req.body.extractedData === undefined) {
      res.status(400).json({ success: false, message: "extractedData is required" });
      return;
    }

    const submission = await DataSourceSubmission.findByIdAndUpdate(
      id,
      { $set: { extractedData: req.body.extractedData } },
      { new: true },
    );
    if (!submission) {
      res.status(404).json({ success: false, message: "Data source not found" });
      return;
    }

    void recordAuditLog({
      adminId: req.user.id,
      adminEmail: req.user.email || "",
      action: "data-source.edit",
      targetType: "DataSourceSubmission",
      targetId: id,
    });

    res.status(200).json({ success: true, message: "Data source updated", data: submission });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error instanceof Error ? error.message : "Failed to update data source",
    });
  }
};

// ─── POST /api/admin/data-sources/:id/re-extract ────────────────────────────────

export const reExtractDataSource = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { id } = req.params;
    if (!id || typeof id !== "string" || !mongoose.isValidObjectId(id)) {
      res.status(400).json({ success: false, message: "Invalid data source ID" });
      return;
    }
    const submission = await DataSourceSubmission.findById(id);
    if (!submission) {
      res.status(404).json({ success: false, message: "Data source not found" });
      return;
    }

    submission.status = "PENDING_EXTRACTION";
    await submission.save();

    const result = await extractForSubmission(submission);
    submission.status = result.status;
    submission.extractedData = result.extractedData;
    submission.citations = result.citations;
    submission.extractionError = result.extractionError;
    submission.extractionModel = result.extractionModel;
    submission.extractedAt = new Date();
    await submission.save();

    if (result.status === "PENDING_REVIEW") {
      void notifyReviewers(submission);
    }

    res.status(200).json({ success: true, message: "Re-extraction complete", data: submission });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error instanceof Error ? error.message : "Failed to re-extract",
    });
  }
};

// ─── POST /api/admin/data-sources/:id/reject ────────────────────────────────────

export const rejectDataSource = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    if (!req.user?.id) {
      res.status(401).json({ success: false, message: "Unauthorized" });
      return;
    }
    const { id } = req.params;
    if (!id || typeof id !== "string" || !mongoose.isValidObjectId(id)) {
      res.status(400).json({ success: false, message: "Invalid data source ID" });
      return;
    }
    const reason = (req.body?.reason as string | undefined)?.trim();
    if (!reason) {
      res.status(400).json({ success: false, message: "A rejection reason is required" });
      return;
    }

    const submission = await DataSourceSubmission.findByIdAndUpdate(
      id,
      {
        $set: {
          status: "REJECTED",
          reviewNotes: reason,
          reviewedBy: req.user.id,
          reviewedAt: new Date(),
        },
      },
      { new: true },
    );
    if (!submission) {
      res.status(404).json({ success: false, message: "Data source not found" });
      return;
    }

    void recordAuditLog({
      adminId: req.user.id,
      adminEmail: req.user.email || "",
      action: "data-source.reject",
      targetType: "DataSourceSubmission",
      targetId: id,
      metadata: { reason },
    });

    res.status(200).json({ success: true, message: "Data source rejected", data: submission });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error instanceof Error ? error.message : "Failed to reject data source",
    });
  }
};

// ─── POST /api/admin/data-sources/:id/approve ───────────────────────────────────
// The only place extracted data is ever written into the live Federation /
// Tournament / TournamentEdition collections.

export const approveDataSource = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    if (!req.user?.id) {
      res.status(401).json({ success: false, message: "Unauthorized" });
      return;
    }
    const { id } = req.params;
    if (!id || typeof id !== "string" || !mongoose.isValidObjectId(id)) {
      res.status(400).json({ success: false, message: "Invalid data source ID" });
      return;
    }

    const submission = await DataSourceSubmission.findById(id);
    if (!submission) {
      res.status(404).json({ success: false, message: "Data source not found" });
      return;
    }
    if (submission.status !== "PENDING_REVIEW") {
      res.status(400).json({
        success: false,
        message: `Cannot approve a submission in status ${submission.status} — it must be PENDING_REVIEW`,
      });
      return;
    }

    // Re-validate (defense in depth — the admin may have hand-edited extractedData via PATCH).
    const citedSourceUrls = submission.originUrl
      ? [submission.originUrl]
      : submission.sourceUrl
        ? [submission.sourceUrl]
        : [];

    const previousValue = await getCurrentLiveData(submission);

    if (submission.targetType === "FEDERATION") {
      const { valid, errors } = validateFederationPayload(submission.extractedData);
      if (!valid) {
        res.status(400).json({ success: false, message: `Cannot approve: ${errors.join(" ")}` });
        return;
      }
      // Old acronym (pre-update) — tournaments approved before federationSlug
      // existed on Tournament are only findable via this denormalized match.
      const previousAcronym = (previousValue as { acronym?: string } | null)?.acronym;

      const updatedFederation = await Federation.findOneAndUpdate(
        { slug: submission.federationSlug },
        {
          // pruneEmpty means fields this source left blank never overwrite
          // fields a previously-approved source already filled in — this is
          // what lets a federation profile be assembled from multiple
          // partial sources over time.
          $set: pruneEmpty({
            ...valid,
            slug: submission.federationSlug,
            sportSlug: submission.sportSlug,
            dataVerifiedAt: new Date(),
            isActive: true,
          }),
          ...(citedSourceUrls.length
            ? { $addToSet: { sourceUrls: { $each: citedSourceUrls } } }
            : {}),
        },
        { upsert: true, new: true, runValidators: true },
      );

      // Resync the denormalized `federation` snapshot on every curated
      // tournament that points at this federation — otherwise a tournament
      // approved before this re-approval keeps stale name/website/about
      // forever. Matches by the hard `federationSlug` reference (new
      // tournaments) OR by the federation's previous acronym (legacy
      // tournaments approved before that field existed), then backfills
      // federationSlug on whatever it finds so future resyncs are exact.
      if (updatedFederation) {
        const tournamentMatch: Record<string, unknown> = previousAcronym
          ? {
              sportSlug: submission.sportSlug,
              $or: [
                { federationSlug: submission.federationSlug },
                { "federation.acronym": previousAcronym },
              ],
            }
          : { sportSlug: submission.sportSlug, federationSlug: submission.federationSlug };

        await Tournament.updateMany(tournamentMatch, {
          $set: {
            federationSlug: submission.federationSlug,
            "federation.name": updatedFederation.name,
            "federation.acronym": updatedFederation.acronym,
            "federation.website": updatedFederation.website,
            "federation.type":
              updatedFederation.type === "govt"
                ? "govt"
                : updatedFederation.type === "hybrid"
                  ? "hybrid"
                  : "private",
            "federation.about": updatedFederation.about,
          },
        });
      }
    } else if (submission.targetType === "CURATED_TOURNAMENT") {
      const { valid, errors } = validateCuratedTournamentPayload(submission.extractedData);
      if (!valid) {
        res.status(400).json({ success: false, message: `Cannot approve: ${errors.join(" ")}` });
        return;
      }
      const federation = submission.federationSlug
        ? await Federation.findOne({ slug: submission.federationSlug }).lean()
        : null;
      await Tournament.findOneAndUpdate(
        { sportSlug: submission.sportSlug, slug: submission.tournamentSlug },
        {
          $set: pruneEmpty({
            ...valid,
            sportSlug: submission.sportSlug,
            slug: submission.tournamentSlug,
            isCurated: true,
            isVerified: true,
            lastScrapedAt: new Date(),
            ...(federation
              ? {
                  federationSlug: submission.federationSlug,
                  federation: {
                    name: federation.name,
                    acronym: federation.acronym,
                    website: federation.website,
                    type: federation.type === "govt" ? "govt" : federation.type === "hybrid" ? "hybrid" : "private",
                    about: federation.about,
                  },
                }
              : {}),
          }),
          ...(citedSourceUrls.length
            ? { $addToSet: { sourceUrls: { $each: citedSourceUrls } } }
            : {}),
        },
        { upsert: true, runValidators: true },
      );
    } else {
      const { valid, errors } = validateEditions(submission.extractedData);
      if (valid.length === 0) {
        res.status(400).json({ success: false, message: `Cannot approve: ${errors.join(" ")}` });
        return;
      }
      const sourceUrl = citedSourceUrls[0] || "admin-submitted";
      for (const edition of valid as ValidEdition[]) {
        const startDate = new Date(`${edition.startDate}T00:00:00.000Z`);
        await TournamentEdition.findOneAndUpdate(
          { sportSlug: submission.sportSlug, name: edition.name, startDate },
          {
            $set: {
              editionYear: startDate.getUTCFullYear(),
              endDate: edition.endDate ? new Date(`${edition.endDate}T00:00:00.000Z`) : null,
              registrationDeadlineDate: edition.registrationDeadlineDate
                ? new Date(`${edition.registrationDeadlineDate}T00:00:00.000Z`)
                : null,
              venue: edition.venue ?? null,
              city: edition.city ?? null,
              level: edition.level ?? null,
              ageGroups: edition.ageGroups,
              sourceUrl,
              lastCheckedAt: new Date(),
            },
          },
          { upsert: true, runValidators: true },
        );
      }
    }

    submission.status = "APPROVED";
    submission.reviewedBy = req.user.id as unknown as mongoose.Types.ObjectId;
    submission.reviewedAt = new Date();
    await submission.save();

    void recordAuditLog({
      adminId: req.user.id,
      adminEmail: req.user.email || "",
      action: "data-source.approve",
      targetType: "DataSourceSubmission",
      targetId: id,
      metadata: { previousValue, newValue: submission.extractedData },
    });

    res.status(200).json({ success: true, message: "Data source approved and published", data: submission });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error instanceof Error ? error.message : "Failed to approve data source",
    });
  }
};
