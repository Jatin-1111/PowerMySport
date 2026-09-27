import { Request, Response } from "express";

import { Opportunity } from "../../shared/models/Opportunity";
import {
  cycleStateOf,
  isStale,
  parseOpportunity,
  parseOpportunityDraft,
  todayInIndia,
} from "../../shared/validation/opportunityFormat";
import { recordAuditLog } from "../services/AuditLogService";
import { revalidateOpportunities } from "../services/ClientCacheRevalidationService";
import { asyncHandler } from "../../middleware/asyncHandler";
import { AppError } from "../../utils/AppError";

// ─── Admissions & scholarships CMS (admin) ──────────────────────────────────
//
// A draft can be saved half-checked; publishing re-validates the whole record
// with the same schema the public pages are typed by, and demands sources and a
// verification date. A published record is held to that bar on every save, so
// an edit can never quietly take a live page below it.
//
// "Mark verified" is its own action rather than a date field someone types, so
// the date on the page means a person pressed a button having checked the
// sources, not that a form was saved.

const audit = (
  req: Request,
  action: string,
  targetId: string,
  metadata: Record<string, unknown>
): void => {
  if (!req.user?.id || !req.user.email) return;
  void recordAuditLog({
    adminId: req.user.id,
    adminEmail: req.user.email,
    action,
    targetType: "Opportunity",
    targetId,
    metadata,
  });
};

const badRequest = (res: Response, message: string, errors: string[]): void => {
  res.status(400).json({ success: false, message, errors });
};

/** The fields a save may write. Anything else in the body is ignored. */
const editable = (doc: Record<string, unknown>) => {
  const {
    _id: _ignoredId,
    status: _ignoredStatus,
    publishedAt: _ignoredPublishedAt,
    updatedBy: _ignoredUpdatedBy,
    createdAt: _ignoredCreatedAt,
    updatedAt: _ignoredUpdatedAt,
    __v: _ignoredVersion,
    cycleState: _ignoredCycleState,
    stale: _ignoredStale,
    ...rest
  } = doc;
  return rest;
};

const assertSlugFree = async (slug: string, exceptId?: string): Promise<void> => {
  const clash = await Opportunity.exists({
    slug,
    ...(exceptId ? { _id: { $ne: exceptId } } : {}),
  });
  if (clash) throw new AppError(`Another entry already uses the slug "${slug}".`, 400);
};

// ─── GET /api/admin/opportunities ────────────────────────────────────────────
// Every record, drafts included, with what needs attention worked out.
export const listAdminOpportunities = asyncHandler(
  async (_req: Request, res: Response): Promise<void> => {
    const docs = await Opportunity.find({})
      .select("slug track category title status lastVerifiedOn cycle updatedAt publishedAt")
      .sort({ track: 1, title: 1 })
      .lean();
    const today = todayInIndia();
    res.json({
      success: true,
      data: docs.map((doc) => ({
        ...doc,
        _id: String(doc._id),
        cycleState: cycleStateOf(doc.cycle ?? undefined, today),
        stale: isStale(doc.lastVerifiedOn, today),
      })),
    });
  }
);

// ─── GET /api/admin/opportunities/:id ────────────────────────────────────────
export const getAdminOpportunity = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const doc = await Opportunity.findById(req.params.id).lean();
    if (!doc) throw new AppError("No entry with that id.", 404);
    res.json({ success: true, data: doc });
  }
);

// ─── POST /api/admin/opportunities ───────────────────────────────────────────
// Creates a draft. Only the identifying fields are required.
export const createAdminOpportunity = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const parsed = parseOpportunityDraft(editable(req.body ?? {}));
    if (!parsed.ok) return badRequest(res, "Check the entry.", parsed.errors);

    await assertSlugFree(parsed.value.slug as string);
    const created = await Opportunity.create({
      ...parsed.value,
      status: "draft",
      ...(req.user?.id ? { updatedBy: req.user.id } : {}),
    });

    audit(req, "opportunity.create", String(created._id), { slug: created.slug });
    res.status(201).json({ success: true, message: "Draft created.", data: created.toObject() });
  }
);

// ─── PUT /api/admin/opportunities/:id ────────────────────────────────────────
// Replaces the editable fields wholesale, so a field cleared in the form is
// cleared in the record instead of surviving from the last save.
export const updateAdminOpportunity = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const doc = await Opportunity.findById(req.params.id);
    if (!doc) throw new AppError("No entry with that id.", 404);

    const body = editable(req.body ?? {});
    const isPublished = doc.status === "published";
    // A save must not change what lastVerifiedOn means: only "Mark verified"
    // moves it, so keep the stored value whatever the form sent.
    const input = { ...body, lastVerifiedOn: doc.lastVerifiedOn ?? undefined };
    const parsed = isPublished ? parseOpportunity(input) : parseOpportunityDraft(input);
    if (!parsed.ok) {
      return badRequest(
        res,
        isPublished
          ? "A live entry must stay complete. Fix these, or unpublish it first."
          : "Check the entry.",
        parsed.errors
      );
    }

    await assertSlugFree(parsed.value.slug as string, String(doc._id));
    const previousSlug = doc.slug;
    doc.overwrite({
      ...parsed.value,
      status: doc.status,
      publishedAt: doc.publishedAt ?? null,
      createdAt: doc.createdAt,
      ...(req.user?.id ? { updatedBy: req.user.id } : {}),
    } as never);
    await doc.save();

    audit(req, "opportunity.update", String(doc._id), { slug: doc.slug, previousSlug });
    if (isPublished) revalidateOpportunities();
    res.json({ success: true, message: "Saved.", data: doc.toObject() });
  }
);

// ─── POST /api/admin/opportunities/:id/verify ────────────────────────────────
export const verifyAdminOpportunity = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const doc = await Opportunity.findById(req.params.id);
    if (!doc) throw new AppError("No entry with that id.", 404);
    if ((doc.sources ?? []).length === 0) {
      throw new AppError("Add the sources you checked before marking this verified.", 400);
    }

    doc.lastVerifiedOn = todayInIndia();
    if (req.user?.id) doc.set("updatedBy", req.user.id);
    await doc.save();

    audit(req, "opportunity.verify", String(doc._id), {
      slug: doc.slug,
      lastVerifiedOn: doc.lastVerifiedOn,
    });
    if (doc.status === "published") revalidateOpportunities();
    res.json({ success: true, message: "Marked as verified today.", data: doc.toObject() });
  }
);

// ─── POST /api/admin/opportunities/:id/status ────────────────────────────────
export const setAdminOpportunityStatus = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const publish = req.body?.status !== "draft";
    const doc = await Opportunity.findById(req.params.id);
    if (!doc) throw new AppError("No entry with that id.", 404);

    if (publish) {
      // Round-tripped so Mongoose's subdocument wrappers become the plain
      // objects the schema expects.
      const plain = JSON.parse(JSON.stringify(doc.toObject())) as Record<string, unknown>;
      const check = parseOpportunity(editable(plain));
      if (!check.ok) {
        return badRequest(res, "This entry isn't ready to publish yet.", check.errors);
      }
    }

    doc.status = publish ? "published" : "draft";
    doc.publishedAt = publish ? new Date() : null;
    await doc.save();

    audit(req, publish ? "opportunity.publish" : "opportunity.unpublish", String(doc._id), {
      slug: doc.slug,
    });
    revalidateOpportunities();
    res.json({
      success: true,
      message: publish
        ? "Published. It is live now."
        : "Unpublished. Parents can no longer see it.",
      data: { status: doc.status, publishedAt: doc.publishedAt },
    });
  }
);

// ─── DELETE /api/admin/opportunities/:id ─────────────────────────────────────
export const deleteAdminOpportunity = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const deleted = await Opportunity.findByIdAndDelete(req.params.id).lean();
    if (!deleted) throw new AppError("No entry with that id.", 404);

    audit(req, "opportunity.delete", String(deleted._id), { slug: deleted.slug });
    if (deleted.status === "published") revalidateOpportunities();
    res.json({ success: true, message: `Deleted "${deleted.title}".` });
  }
);
