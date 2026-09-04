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
  enrichEditionsWithDetailPages,
  ValidEdition,
} from "../services/DataSourceExtractionService";
import { resolveEditionSlugsBatch, EditionKey } from "../../shared/services/editionSlug";
import { s3Service } from "../../shared/services/S3Service";
import { recordAuditLog } from "../services/AuditLogService";
import { getAdminsWithPermission, resolveAdminAppUrl } from "../services/AdminService";
import { sendDataSourceReadyForReviewEmail } from "../../utils/email";
import {
  SUPPORTED_SPORTS,
  isSupportedSport,
  toSupportedSlug,
} from "../../shared/constants/supportedSports";
import { log as __rootLog } from "../../utils/logger";
import { asyncHandler } from "../../middleware/asyncHandler";
import { AppError } from "../../utils/AppError";
const log = __rootLog.child("dataSourceAdmin");

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
        })
      )
    );
  } catch (error) {
    log.error("Failed to notify data-source reviewers:", error);
  }
}

// ─── POST /api/admin/data-sources/upload-url ───────────────────────────────────

export const getDataSourceUploadUrl = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const { fileName, contentType, sportSlug } = req.body as {
      fileName?: string;
      contentType?: string;
      sportSlug?: string;
    };
    if (!fileName || !contentType || !sportSlug) {
      throw new AppError("fileName, contentType, and sportSlug are required", 400);
    }
    if (!isSupportedSport(sportSlug)) {
      throw new AppError("Unsupported sportSlug", 400);
    }
    if (!ALLOWED_PDF_TYPES.includes(contentType)) {
      throw new AppError(`Invalid content type. Allowed: ${ALLOWED_PDF_TYPES.join(", ")}`, 400);
    }

    const uploadData = await s3Service.generateDataSourceUploadUrl(
      fileName,
      contentType,
      toSupportedSlug(sportSlug)
    );
    res.status(200).json({ success: true, data: uploadData });
  }
);

// ─── GET /api/admin/data-sources/targets ───────────────────────────────────────
// Backs the "pick an existing Federation/Tournament, or create new" selector.

export const listDataSourceTargets = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const targetType = req.query.targetType as DataSourceTargetType | undefined;
    const rawSportSlug = req.query.sportSlug as string | undefined;
    if (!targetType || !rawSportSlug) {
      throw new AppError("targetType and sportSlug are required", 400);
    }
    if (!isSupportedSport(rawSportSlug)) {
      throw new AppError("Unsupported sportSlug", 400);
    }
    const sportSlug = toSupportedSlug(rawSportSlug);

    if (targetType === "FEDERATION") {
      const docs = await Federation.find({ sportSlug }).select("slug name acronym").lean();
      res.status(200).json({
        success: true,
        data: docs.map((d) => ({ slug: d.slug, name: `${d.name} (${d.acronym})` })),
      });
      return;
    }

    if (targetType === "CURATED_TOURNAMENT") {
      const docs = await Tournament.find({ sportSlug, isCurated: true }).select("slug name").lean();
      res
        .status(200)
        .json({ success: true, data: docs.map((d) => ({ slug: d.slug || "", name: d.name })) });
      return;
    }

    // TOURNAMENT_CALENDAR has no "target document" to pick — it's always keyed by sportSlug.
    res.status(200).json({ success: true, data: [] });
  }
);

// ─── GET /api/admin/data-sources/calendar-freshness ────────────────────────────
// One row per supported sport — when was its TournamentEdition data last
// touched by an approved calendar source. Replaces the visibility the old
// every-2-days cron gave for free; nothing here refreshes anything.

export const getCalendarFreshness = asyncHandler(
  async (_req: Request, res: Response): Promise<void> => {
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
      })
    );
    res.status(200).json({ success: true, data: rows });
  }
);

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
    return Tournament.findOne({
      sportSlug: submission.sportSlug,
      slug: submission.tournamentSlug,
    }).lean();
  }
  // TOURNAMENT_CALENDAR — no single target doc; show the nearest upcoming editions as context.
  return TournamentEdition.find({ sportSlug: submission.sportSlug })
    .sort({ startDate: 1 })
    .limit(20)
    .lean();
}

// ─── POST /api/admin/data-sources ──────────────────────────────────────────────

export const createDataSource = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  if (!req.user?.id) {
    throw new AppError("Unauthorized", 401);
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
    throw new AppError("targetType, sportSlug, and sourceKind are required", 400);
  }
  if (!isSupportedSport(body.sportSlug)) {
    throw new AppError("Unsupported sportSlug", 400);
  }
  if (body.targetType === "FEDERATION" && !body.federationSlug) {
    throw new AppError("federationSlug is required for a FEDERATION source", 400);
  }
  if (body.targetType === "CURATED_TOURNAMENT" && (!body.federationSlug || !body.tournamentSlug)) {
    throw new AppError(
      "federationSlug and tournamentSlug are required for a CURATED_TOURNAMENT source",
      400
    );
  }
  if (body.sourceKind === "LINK" && !body.sourceUrl) {
    throw new AppError("sourceUrl is required for a LINK source", 400);
  }
  if (body.sourceKind === "PDF" && !body.s3Key) {
    throw new AppError("s3Key is required for a PDF source (upload it first)", 400);
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
  submission.extractionWarnings = result.extractionWarnings;
  submission.extractionModel = result.extractionModel;
  submission.extractedAt = new Date();
  await submission.save();

  if (result.status === "PENDING_REVIEW") {
    void notifyReviewers(submission);
  }

  res.status(201).json({ success: true, message: "Source submitted", data: submission });
});

// ─── GET /api/admin/data-sources ───────────────────────────────────────────────

export const listDataSources = asyncHandler(async (req: Request, res: Response): Promise<void> => {
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
});

// ─── GET /api/admin/data-sources/:id ────────────────────────────────────────────

export const getDataSourceDetail = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    if (!id || typeof id !== "string" || !mongoose.isValidObjectId(id)) {
      throw new AppError("Invalid data source ID", 400);
    }
    const submission = await DataSourceSubmission.findById(id)
      .populate("submittedBy", "name email")
      .populate("reviewedBy", "name email")
      .lean();
    if (!submission) {
      throw new AppError("Data source not found", 404);
    }

    const currentLiveData = await getCurrentLiveData(submission);
    res.status(200).json({ success: true, data: { ...submission, currentLiveData } });
  }
);

// ─── PATCH /api/admin/data-sources/:id ──────────────────────────────────────────
// Lets an admin edit the extracted payload before approving it.

export const updateDataSource = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  if (!req.user?.id) {
    throw new AppError("Unauthorized", 401);
  }
  const { id } = req.params;
  if (!id || typeof id !== "string" || !mongoose.isValidObjectId(id)) {
    throw new AppError("Invalid data source ID", 400);
  }
  if (req.body.extractedData === undefined) {
    throw new AppError("extractedData is required", 400);
  }

  const submission = await DataSourceSubmission.findByIdAndUpdate(
    id,
    { $set: { extractedData: req.body.extractedData } },
    { new: true }
  );
  if (!submission) {
    throw new AppError("Data source not found", 404);
  }

  void recordAuditLog({
    adminId: req.user.id,
    adminEmail: req.user.email || "",
    action: "data-source.edit",
    targetType: "DataSourceSubmission",
    targetId: id,
  });

  res.status(200).json({ success: true, message: "Data source updated", data: submission });
});

// ─── POST /api/admin/data-sources/:id/re-extract ────────────────────────────────

export const reExtractDataSource = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    if (!id || typeof id !== "string" || !mongoose.isValidObjectId(id)) {
      throw new AppError("Invalid data source ID", 400);
    }
    const submission = await DataSourceSubmission.findById(id);
    if (!submission) {
      throw new AppError("Data source not found", 404);
    }

    submission.status = "PENDING_EXTRACTION";
    await submission.save();

    const result = await extractForSubmission(submission);
    submission.status = result.status;
    submission.extractedData = result.extractedData;
    submission.citations = result.citations;
    submission.extractionError = result.extractionError;
    submission.extractionWarnings = result.extractionWarnings;
    submission.extractionModel = result.extractionModel;
    submission.extractedAt = new Date();
    await submission.save();

    if (result.status === "PENDING_REVIEW") {
      void notifyReviewers(submission);
    }

    res.status(200).json({ success: true, message: "Re-extraction complete", data: submission });
  }
);

// ─── POST /api/admin/data-sources/:id/enrich-details ───────────────────────────
// Follows each extracted entry's per-tournament link and merges in what only
// that page carries — fact sheets, acceptance lists, the host academy, the full
// official title. Separate from extraction because a full calendar is ~150
// pages: doing it inline would run the create/re-extract request past the load
// balancer's timeout, and would spend AI quota on submissions that get rejected.

export const enrichDataSourceDetails = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    if (!req.user?.id) {
      throw new AppError("Unauthorized", 401);
    }
    const { id } = req.params;
    if (!id || typeof id !== "string" || !mongoose.isValidObjectId(id)) {
      throw new AppError("Invalid data source ID", 400);
    }

    const submission = await DataSourceSubmission.findById(id);
    if (!submission) {
      throw new AppError("Data source not found", 404);
    }
    if (submission.targetType !== "TOURNAMENT_CALENDAR") {
      throw new AppError("Detail enrichment only applies to tournament calendar sources.", 400);
    }

    // Work from the saved draft, so a reviewer's edits (deleted rows, corrected
    // names) are respected rather than overwritten by a stale extraction.
    const { valid, errors } = validateEditions(submission.extractedData);
    if (valid.length === 0) {
      throw new AppError(`Nothing to enrich: ${errors.join(" ")}`, 400);
    }

    const result = await enrichEditionsWithDetailPages(valid, submission.sportSlug);

    submission.extractedData = result.editions;
    // validateEditions drops and dedupes, so the saved draft can come back
    // shorter than it went in. Carry its notes through alongside the
    // enrichment's own — a reviewer approves what this list shows, so a row
    // disappearing between two clicks must never be silent.
    const warnings = [...errors, ...result.warnings];
    submission.extractionWarnings = warnings.length ? warnings : undefined;
    await submission.save();

    void recordAuditLog({
      adminId: req.user.id,
      adminEmail: req.user.email || "",
      action: "data-source.enrich-details",
      targetType: "DataSourceSubmission",
      targetId: id,
      metadata: { enriched: result.enriched, documentsFound: result.documentsFound },
    });

    res.status(200).json({
      success: true,
      message: `Read ${result.enriched} detail page(s); ${result.documentsFound} entry(s) now have documents.`,
      data: submission,
    });
  }
);

// ─── POST /api/admin/data-sources/:id/reject ────────────────────────────────────

export const rejectDataSource = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  if (!req.user?.id) {
    throw new AppError("Unauthorized", 401);
  }
  const { id } = req.params;
  if (!id || typeof id !== "string" || !mongoose.isValidObjectId(id)) {
    throw new AppError("Invalid data source ID", 400);
  }
  const reason = (req.body?.reason as string | undefined)?.trim();
  if (!reason) {
    throw new AppError("A rejection reason is required", 400);
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
    { new: true }
  );
  if (!submission) {
    throw new AppError("Data source not found", 404);
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
});

// ─── POST /api/admin/data-sources/:id/approve ───────────────────────────────────
// The only place extracted data is ever written into the live Federation /
// Tournament / TournamentEdition collections.

export const approveDataSource = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    if (!req.user?.id) {
      throw new AppError("Unauthorized", 401);
    }
    const { id } = req.params;
    if (!id || typeof id !== "string" || !mongoose.isValidObjectId(id)) {
      throw new AppError("Invalid data source ID", 400);
    }

    const submission = await DataSourceSubmission.findById(id);
    if (!submission) {
      throw new AppError("Data source not found", 404);
    }
    if (submission.status !== "PENDING_REVIEW") {
      throw new AppError(
        `Cannot approve a submission in status ${submission.status} — it must be PENDING_REVIEW`,
        400
      );
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
        throw new AppError(`Cannot approve: ${errors.join(" ")}`, 400);
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
        { upsert: true, new: true, runValidators: true }
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
        throw new AppError(`Cannot approve: ${errors.join(" ")}`, 400);
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
                    type:
                      federation.type === "govt"
                        ? "govt"
                        : federation.type === "hybrid"
                          ? "hybrid"
                          : "private",
                    about: federation.about,
                  },
                }
              : {}),
          }),
          ...(citedSourceUrls.length
            ? { $addToSet: { sourceUrls: { $each: citedSourceUrls } } }
            : {}),
        },
        { upsert: true, runValidators: true }
      );
    } else {
      const { valid, errors } = validateEditions(submission.extractedData);
      if (valid.length === 0) {
        throw new AppError(`Cannot approve: ${errors.join(" ")}`, 400);
      }
      const sourceUrl = citedSourceUrls[0] || "admin-submitted";
      const editionEntries = (valid as ValidEdition[]).map((edition) => {
        const startDate = new Date(`${edition.startDate}T00:00:00.000Z`);
        const key: EditionKey = {
          sportSlug: submission.sportSlug,
          name: edition.name,
          startDate,
        };
        return { edition, startDate, key };
      });

      // Resolves every edition's slug in a handful of round trips instead of
      // 1-51 sequential queries PER edition — a full calendar approval can be
      // ~150 editions, so this keeps the admin request from timing out.
      const slugsById = await resolveEditionSlugsBatch(editionEntries.map((e) => e.key));

      const editionKeyId = (key: EditionKey) =>
        `${key.sportSlug}|${key.name}|${key.startDate.toISOString()}`;

      await TournamentEdition.bulkWrite(
        editionEntries.map(({ edition, startDate, key }) => ({
          updateOne: {
            filter: key,
            update: {
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
                // Detail-page fields. Written with ?? null so re-approving a
                // source that was enriched, then re-extracted without
                // enrichment, doesn't leave stale details attached to the row.
                detailUrl: edition.detailUrl ?? null,
                officialName: edition.officialName ?? null,
                organiser: edition.organiser ?? null,
                state: edition.state ?? null,
                category: edition.category ?? null,
                documents: edition.documents ?? null,
                slug: slugsById.get(editionKeyId(key)),
              },
            },
            upsert: true,
          },
        }))
      );
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

    res
      .status(200)
      .json({ success: true, message: "Data source approved and published", data: submission });
  }
);
