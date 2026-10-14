import { Request, Response } from "express";
import mongoose from "mongoose";

import { DataSourceSubmission } from "../../shared/models/DataSourceSubmission";
import { Opportunity } from "../../shared/models/Opportunity";
import { OpportunityLead } from "../../shared/models/OpportunityLead";
import { isSupportedSport, toSupportedSlug } from "../../shared/constants/supportedSports";
import {
  OPPORTUNITY_TRACKS,
  parseOpportunity,
  parseOpportunityDraft,
  todayInIndia,
  type OpportunityTrack,
} from "../../shared/validation/opportunityFormat";
import { s3Service } from "../../shared/services/S3Service";
import { cleanOpportunityExtraction } from "../services/dataSourceExtraction/opportunity";
import { sourcesToCite, type DocumentRecord } from "../services/dataSourceExtraction/multiDocument";
import type { CitationChecks } from "../services/dataSourceExtraction/quoteCheck";
import {
  runOpportunityExtraction,
  startOpportunityExtraction,
} from "../services/opportunitySourceSubmission";
import {
  applyChanges,
  proposedChanges,
  withSource,
  type MultiDocumentInfo,
} from "../services/opportunitySourceMerge";
import { recordAuditLog } from "../services/AuditLogService";
import { uniqueSlug } from "../services/opportunitySlug";
import { revalidateOpportunities } from "../services/ClientCacheRevalidationService";
import { acknowledgeWatchUrls } from "../services/opportunityWatch";
import { asyncHandler } from "../../middleware/asyncHandler";
import { AppError } from "../../utils/AppError";

// ─── Admissions & scholarships from a link or PDF ───────────────────────────
//
// Reuses the data-source submission record and its extraction plumbing, with
// its own review routes, because what "approve" means is different here: it
// writes only the changes the reviewer kept, into one Opportunity, and it
// counts as verifying that entry (an explicit product decision: the reviewer
// has checked each kept field against a quote from the source).
//
// Approving is also allowed with nothing kept. That is the reviewer saying "I
// read this year's document and nothing changed", which is worth recording as
// a verification as much as a change is.
//
// Gated by the opportunities permissions, not the data-source ones: the people
// who curate these entries are the ones who approve changes to them.

const TARGET = "OPPORTUNITY" as const;
const DEFAULT_SPORT = "tennis";

const requireId = (req: Request): string => {
  const { id } = req.params;
  if (!id || typeof id !== "string" || !mongoose.isValidObjectId(id)) {
    throw new AppError("Invalid source id.", 400);
  }
  return id;
};

async function loadSubmission(id: string) {
  const submission = await DataSourceSubmission.findOne({ _id: id, targetType: TARGET });
  if (!submission) throw new AppError("Source not found.", 404);
  return submission;
}

/** The entry a submission updates, as a plain object, or null for a new one. */
async function liveEntry(submission: { opportunitySlug?: string }) {
  if (!submission.opportunitySlug) return null;
  const doc = await Opportunity.findOne({ slug: submission.opportunitySlug });
  if (!doc) throw new AppError("The entry this source was for no longer exists.", 404);
  return doc;
}

const plain = (value: unknown): Record<string, unknown> =>
  JSON.parse(JSON.stringify(value ?? {})) as Record<string, unknown>;

// ─── POST /api/admin/opportunity-sources/upload-url ─────────────────────────
export const getOpportunitySourceUploadUrl = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const { fileName, contentType } = req.body as { fileName?: string; contentType?: string };
    if (!fileName || contentType !== "application/pdf") {
      throw new AppError("Upload a PDF (fileName and contentType application/pdf).", 400);
    }
    const data = await s3Service.generateDataSourceUploadUrl(
      fileName,
      contentType,
      "opportunities"
    );
    res.json({ success: true, data });
  }
);

// ─── POST /api/admin/opportunity-sources ────────────────────────────────────
export const createOpportunitySource = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    if (!req.user?.id) throw new AppError("Unauthorized", 401);
    const body = req.body as {
      opportunitySlug?: string;
      track?: string;
      sportSlug?: string;
      sourceKind?: "LINK" | "PDF";
      sourceUrl?: string;
      s3Key?: string;
      fileName?: string;
      originUrl?: string;
      sourceLabel?: string;
      /** A lead from the monthly search being read; marked read once submitted. */
      leadId?: string;
      /** For a link to a page: also read the PDFs it links to (up to three). */
      followDocuments?: boolean;
    };

    const entry = body.opportunitySlug
      ? await Opportunity.findOne({ slug: body.opportunitySlug.toLowerCase() })
          .select("slug track sports")
          .lean()
      : null;
    if (body.opportunitySlug && !entry) throw new AppError("No entry with that slug.", 404);

    const track = (entry?.track ?? body.track) as OpportunityTrack | undefined;
    if (!track || !(OPPORTUNITY_TRACKS as readonly string[]).includes(track)) {
      throw new AppError("Say whether this is an admission or a scholarship.", 400);
    }

    const sportSlug = body.sportSlug || entry?.sports?.[0] || DEFAULT_SPORT;
    if (!isSupportedSport(sportSlug)) throw new AppError("Unsupported sport.", 400);

    const sourceLabel = body.sourceLabel?.trim();
    if (!sourceLabel) {
      throw new AppError(
        'Name the document (e.g. "DU admissions bulletin 2026-27"). It is shown to parents as the source.',
        400
      );
    }

    if (body.sourceKind === "LINK") {
      if (!body.sourceUrl || !/^https?:\/\//i.test(body.sourceUrl.trim())) {
        throw new AppError("Give the link, starting with http:// or https://.", 400);
      }
    } else if (body.sourceKind === "PDF") {
      if (!body.s3Key) throw new AppError("Upload the PDF first.", 400);
      // Parents are shown a link to the source, and an uploaded file has none
      // of its own: the storage URL must never be exposed.
      if (!body.originUrl || !/^https?:\/\//i.test(body.originUrl.trim())) {
        throw new AppError(
          "Give the official page this PDF came from; parents are linked to it as the source.",
          400
        );
      }
    } else {
      throw new AppError("sourceKind must be LINK or PDF.", 400);
    }

    const submission = await DataSourceSubmission.create({
      targetType: TARGET,
      sportSlug: toSupportedSlug(sportSlug),
      ...(entry ? { opportunitySlug: entry.slug } : {}),
      opportunityTrack: track,
      sourceLabel,
      sourceKind: body.sourceKind,
      ...(body.sourceKind === "LINK"
        ? {
            sourceUrl: body.sourceUrl!.trim(),
            ...(body.followDocuments === true ? { followDocuments: true } : {}),
          }
        : { s3Key: body.s3Key, fileName: body.fileName, originUrl: body.originUrl!.trim() }),
      status: "PENDING_EXTRACTION",
      submittedBy: req.user.id,
    });

    if (body.leadId && mongoose.isValidObjectId(body.leadId)) {
      await OpportunityLead.updateOne(
        { _id: body.leadId },
        { $set: { status: "read", submissionId: submission._id } }
      );
    }

    // Following a page's documents takes minutes, so it is read in the background
    // and the reviewer is sent to a page that waits for it.
    if (submission.followDocuments) {
      startOpportunityExtraction(submission);
      res.status(201).json({
        success: true,
        message:
          "Reading the page and its documents. It will be under Sources to review when done.",
        data: submission.toObject(),
      });
      return;
    }
    await runOpportunityExtraction(submission);
    res.status(201).json({ success: true, message: "Source read.", data: submission.toObject() });
  }
);

// ─── GET /api/admin/opportunity-sources ─────────────────────────────────────
export const listOpportunitySources = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const filter: Record<string, unknown> = { targetType: TARGET };
    // One status, or several comma-separated ("PENDING_REVIEW,EXTRACTION_FAILED").
    if (typeof req.query.status === "string") {
      const statuses = req.query.status.split(",").filter(Boolean);
      if (statuses.length > 1) filter.status = { $in: statuses };
      else if (statuses.length === 1) filter.status = statuses[0];
    }
    if (typeof req.query.opportunitySlug === "string") {
      filter.opportunitySlug = req.query.opportunitySlug.toLowerCase();
    }
    const docs = await DataSourceSubmission.find(filter)
      .select(
        "status opportunitySlug opportunityTrack sourceLabel sourceKind sourceUrl originUrl " +
          "extractionError createdAt reviewedAt autoDetected detectedChange"
      )
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();
    res.json({ success: true, data: docs });
  }
);

// ─── GET /api/admin/opportunity-sources/:id ─────────────────────────────────
// The submission, the entry it would change, and the change list itself.
export const getOpportunitySource = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const submission = await loadSubmission(requireId(req));
    // An entry drafted automatically is not "the entry this would change": the draft
    // already holds everything read. Its review page shows what was read, with each
    // quote, as the evidence for an editor checking the draft, so the comparison is
    // against nothing.
    const drafted = Boolean(submission.autoDraft && submission.draftedSlug);
    const entry = submission.opportunitySlug
      ? await Opportunity.findOne({ slug: submission.opportunitySlug }).lean()
      : drafted
        ? await Opportunity.findOne({ slug: submission.draftedSlug }).lean()
        : null;
    const changes = proposedChanges(
      entry && !drafted ? plain(entry) : null,
      plain(submission.extractedData),
      (submission.citations ?? {}) as Record<string, string>,
      submission.citationChecks as Partial<CitationChecks> | undefined,
      {
        fieldSources: submission.fieldSources as Record<string, string> | undefined,
        conflicts: submission.conflicts as MultiDocumentInfo["conflicts"],
        documents: submission.documents as MultiDocumentInfo["documents"],
      }
    );
    res.json({
      success: true,
      data: {
        submission: submission.toObject(),
        entry,
        entryMissing: Boolean(submission.opportunitySlug && !entry),
        drafted,
        changes,
      },
    });
  }
);

// ─── PATCH /api/admin/opportunity-sources/:id ───────────────────────────────
// Correct what was read before approving: a missing title or section on a new
// entry, a wrong value. Re-cleaned exactly as a fresh extraction would be.
export const updateOpportunitySource = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const submission = await loadSubmission(requireId(req));
    if (submission.status !== "PENDING_REVIEW") {
      throw new AppError("Only a source waiting for review can be edited.", 400);
    }
    const patch = (req.body?.fields ?? {}) as Record<string, unknown>;
    const merged = { ...plain(submission.extractedData), ...patch };
    const cleaned = cleanOpportunityExtraction(
      merged,
      submission.opportunityTrack ?? "scholarship"
    );
    const published = (merged as { sourcePublishedOn?: unknown }).sourcePublishedOn;
    submission.extractedData = {
      ...cleaned.fields,
      ...(typeof published === "string" ? { sourcePublishedOn: published } : {}),
    };
    await submission.save();

    if (req.user?.id) {
      void recordAuditLog({
        adminId: req.user.id,
        adminEmail: req.user.email || "",
        action: "opportunity-source.edit",
        targetType: "DataSourceSubmission",
        targetId: String(submission._id),
      });
    }
    res.json({
      success: true,
      message: cleaned.warnings.length ? cleaned.warnings.join(" ") : "Saved.",
      data: submission.toObject(),
    });
  }
);

// ─── POST /api/admin/opportunity-sources/:id/re-extract ─────────────────────
export const reExtractOpportunitySource = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const submission = await loadSubmission(requireId(req));
    if (submission.status === "APPROVED") {
      throw new AppError("This source is already approved. Submit it again to re-read it.", 400);
    }
    submission.status = "PENDING_EXTRACTION";
    await submission.save();
    if (submission.followDocuments) {
      startOpportunityExtraction(submission);
      res.json({
        success: true,
        message: "Reading it again in the background.",
        data: submission.toObject(),
      });
      return;
    }
    await runOpportunityExtraction(submission);
    res.json({ success: true, message: "Read again.", data: submission.toObject() });
  }
);

// ─── POST /api/admin/opportunity-sources/:id/reject ─────────────────────────
export const rejectOpportunitySource = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    if (!req.user?.id) throw new AppError("Unauthorized", 401);
    const submission = await loadSubmission(requireId(req));
    const reason = (req.body?.reason as string | undefined)?.trim();
    if (!reason) throw new AppError("Say why, so the next reviewer knows.", 400);

    submission.status = "REJECTED";
    submission.reviewNotes = reason;
    submission.reviewedBy = req.user.id as unknown as mongoose.Types.ObjectId;
    submission.reviewedAt = new Date();
    await submission.save();

    void recordAuditLog({
      adminId: req.user.id,
      adminEmail: req.user.email || "",
      action: "opportunity-source.reject",
      targetType: "DataSourceSubmission",
      targetId: String(submission._id),
      metadata: { reason },
    });
    res.json({ success: true, message: "Rejected.", data: submission.toObject() });
  }
);

// ─── POST /api/admin/opportunity-sources/:id/approve ────────────────────────
// Body: { keep: string[] } — the change paths to write. Everything else stays.
export const approveOpportunitySource = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    if (!req.user?.id) throw new AppError("Unauthorized", 401);
    const submission = await loadSubmission(requireId(req));
    if (submission.status !== "PENDING_REVIEW") {
      throw new AppError(
        `This source is ${submission.status.toLowerCase()}, not waiting for review.`,
        400
      );
    }

    const doc = await liveEntry(submission);
    const current = doc ? plain(doc.toObject()) : null;
    const extracted = plain(submission.extractedData);
    const changes = proposedChanges(current, extracted);
    const requested = Array.isArray(req.body?.keep)
      ? (req.body.keep as unknown[]).filter((p): p is string => typeof p === "string")
      : [];
    const keep = new Set(requested.filter((path) => changes.some((c) => c.path === path)));

    const merged = applyChanges(current, changes, keep);
    const sourceUrl = submission.originUrl || submission.sourceUrl;
    if (!sourceUrl) throw new AppError("This source has no public link to cite.", 400);
    const publishedOn =
      typeof extracted.sourcePublishedOn === "string" ? extracted.sourcePublishedOn : undefined;
    // Cite what the kept fields came from. A single-source reading cites its one
    // source; one that read several cites each document that supplied a kept field.
    const records = (submission.documents as DocumentRecord[] | undefined) ?? [];
    // With several sources the merged date is the newest document's, which says
    // nothing about the page; the page's own date, if it printed one, is in its record.
    const ownRecord = records.find((r) => r.url === sourceUrl);
    const citeAs = sourcesToCite(
      records,
      (submission.fieldSources as Record<string, string> | undefined) ?? {},
      keep,
      {
        label: submission.sourceLabel || "Official source",
        url: sourceUrl,
        publishedOn: ownRecord ? ownRecord.sourcePublishedOn : publishedOn,
      }
    );
    let citedSources = merged.sources as
      Array<{ label: string; url: string; publishedOn?: string }> | undefined;
    // Oldest first, so the newest ends up at the top, as one source does.
    for (const source of [...citeAs].reverse()) citedSources = withSource(citedSources, source);
    merged.sources = citedSources;
    // Approval counts as verification: the reviewer checked each kept field
    // against its quote, and confirmed the rest did not change.
    merged.lastVerifiedOn = todayInIndia();

    if (!doc) {
      if (typeof merged.title !== "string" || !merged.category) {
        throw new AppError(
          "Keep a title and a section (or set them) before approving a new entry.",
          400
        );
      }
      merged.track = submission.opportunityTrack ?? "scholarship";
      merged.slug = await uniqueSlug(merged.title);
    }

    const isPublished = doc?.status === "published";
    const {
      _id: _ignoredId,
      status: _ignoredStatus,
      publishedAt: _ignoredPublishedAt,
      createdAt: _ignoredCreatedAt,
      updatedAt: _ignoredUpdatedAt,
      updatedBy: _ignoredUpdatedBy,
      __v: _ignoredVersion,
      ...fields
    } = merged;
    const parsed = isPublished ? parseOpportunity(fields) : parseOpportunityDraft(fields);
    if (!parsed.ok) {
      res.status(400).json({
        success: false,
        message: isPublished
          ? "The live entry would no longer be complete with these changes."
          : "The entry would not be valid with these changes.",
        errors: parsed.errors,
      });
      return;
    }

    let savedId: string;
    if (doc) {
      doc.overwrite({
        ...parsed.value,
        status: doc.status,
        publishedAt: doc.publishedAt ?? null,
        createdAt: doc.createdAt,
        updatedBy: req.user.id,
      } as never);
      await doc.save();
      savedId = String(doc._id);
    } else {
      const created = await Opportunity.create({
        ...parsed.value,
        status: "draft",
        updatedBy: req.user.id,
      } as Record<string, unknown>);
      savedId = String(created._id);
    }

    // Reviewing this entry against a source answers whatever the weekly watch
    // flagged on its links, so those flags are cleared with the approval.
    const saved = await Opportunity.findById(savedId).select("sources.url watchUrls").lean();
    await acknowledgeWatchUrls([
      ...(saved?.sources ?? []).map((s) => s.url),
      ...(saved?.watchUrls ?? []),
    ]);

    submission.status = "APPROVED";
    submission.reviewedBy = req.user.id as unknown as mongoose.Types.ObjectId;
    submission.reviewedAt = new Date();
    submission.reviewNotes = `Kept ${keep.size} of ${changes.length} proposed change(s).`;
    await submission.save();

    void recordAuditLog({
      adminId: req.user.id,
      adminEmail: req.user.email || "",
      action: "opportunity-source.approve",
      targetType: "Opportunity",
      targetId: savedId,
      metadata: { submissionId: String(submission._id), kept: [...keep], proposed: changes.length },
    });
    if (isPublished) revalidateOpportunities();

    res.json({
      success: true,
      message: doc
        ? `Applied ${keep.size} change(s) and marked it verified today.`
        : "Created a verified draft. Publish it from its page when ready.",
      data: { opportunityId: savedId },
    });
  }
);
