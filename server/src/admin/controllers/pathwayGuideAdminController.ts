import { Request, Response } from "express";

import {
  PathwayGuide,
  type PathwayContributorDocument,
  type PathwayStageDocument,
} from "../../shared/models/PathwayGuide";
import {
  PATHWAY_FORMAT_VERSION,
  formatPathwayIssues,
  parsePathwayGuide,
  parsePathwayStage,
  PathwayGuideSchema,
} from "../../shared/validation/pathwayGuideFormat";
import { Coach } from "../../client/models/Coach";
import { Expert } from "../../client/models/ExpertProfile";
import { User } from "../../client/models/User";
import { recordAuditLog } from "../services/AuditLogService";
import { revalidatePathway } from "../services/PathwayRevalidationService";
import { asyncHandler } from "../../middleware/asyncHandler";
import { AppError } from "../../utils/AppError";

// ─── Pathway CMS (admin) ─────────────────────────────────────────────────────
//
// The write side of the pathway. Deliberately granular: the guide's own
// metadata, the stage list, and each individual stage are separate endpoints, so
// the CMS saves the one stage the author is editing instead of re-sending the
// whole sport on every keystroke of a text field. That is what makes concurrent
// editing of two stages safe and what keeps a failed save from taking the other
// five stages down with it.
//
// Everything is validated with the same Zod schema the seed script and the
// public reader use, and errors come back pathed so the form can point at the
// field that is wrong.

const auditContext = (req: Request): { adminId: string; adminEmail: string } | null => {
  if (!req.user?.id || !req.user.email) return null;
  return { adminId: req.user.id, adminEmail: req.user.email };
};

const audit = (
  req: Request,
  action: string,
  targetId: string,
  metadata: Record<string, unknown>
): void => {
  const context = auditContext(req);
  if (!context) return;
  void recordAuditLog({
    ...context,
    action,
    targetType: "PathwayGuide",
    targetId,
    metadata,
  });
};

/** Renumber `order` to 1..n in array position. Called after every list change. */
const resequence = (stages: PathwayStageDocument[]): PathwayStageDocument[] =>
  stages.map((stage, index) => ({ ...stage, order: index + 1 }));

/**
 * Drop keys whose value is `undefined`.
 *
 * `exactOptionalPropertyTypes` is on, so `{ eyebrow: undefined }` is not the
 * same type as `{}` and Mongoose's typed setters reject the former. Zod hands
 * back the former for every absent optional field.
 */
const compact = <T extends Record<string, unknown>>(value: T): Partial<T> =>
  Object.fromEntries(Object.entries(value).filter(([, v]) => v !== undefined)) as Partial<T>;

/** The stage list as plain objects, whatever Mongoose is storing internally. */
const plainStages = (doc: { stages?: PathwayStageDocument[] }): PathwayStageDocument[] =>
  (doc.stages ?? []).map((stage) => JSON.parse(JSON.stringify(stage))) as PathwayStageDocument[];

/** Same round trip as `plainStages`, and for the same reason. */
const plainContributor = (contributor: PathwayContributorDocument): unknown =>
  JSON.parse(JSON.stringify(contributor));

const badRequest = (res: Response, message: string, errors?: string[]): void => {
  res.status(400).json({ success: false, message, ...(errors ? { errors } : {}) });
};

// ─── GET /api/admin/pathway-guides ───────────────────────────────────────────
// The index the CMS opens on: one row per sport, no stage bodies.
export const listPathwayGuides = asyncHandler(
  async (_req: Request, res: Response): Promise<void> => {
    const docs = await PathwayGuide.find({})
      .select("sportSlug sportName status reviewedOn updatedAt publishedAt stages.key")
      .sort({ sportName: 1 })
      .lean();

    res.json({
      success: true,
      data: docs.map((doc) => ({
        _id: String(doc._id),
        sportSlug: doc.sportSlug,
        sportName: doc.sportName,
        status: doc.status,
        stageCount: doc.stages?.length ?? 0,
        reviewedOn: doc.reviewedOn ?? null,
        publishedAt: doc.publishedAt ?? null,
        updatedAt: doc.updatedAt,
      })),
    });
  }
);

// ─── GET /api/admin/pathway-guides/:id ───────────────────────────────────────
export const getPathwayGuide = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const doc = await PathwayGuide.findById(req.params.id).lean();
  if (!doc) throw new AppError("No pathway guide with that id.", 404);
  res.json({ success: true, data: doc });
});

// ─── GET /api/admin/pathway-guides/contributors?type=coach&q=lalit ───────────
//
// The byline picker. Contributors are people who already have a profile on the
// platform, and the CMS has to let an author attach one WITHOUT typing a Mongo
// id — pasting raw ids into a form is both unusable and the exact pattern the
// admin audit cleaned out of these pages.
//
// Its own endpoint rather than the existing coach/expert admin listings: those
// page through everything filtered by verification status, and what this needs
// is "find me the three people called Lalit". It also returns both kinds in the
// one shape the form binds to, so the picker has no per-type branch.
//
// Only currently-bookable people are searchable. Attaching someone unverified
// would store a pointer the public reader then refuses to render — better that
// the CMS cannot offer the choice than that it silently does nothing.
const CONTRIBUTOR_SEARCH_LIMIT = 10;

export const searchPathwayContributors = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const type = req.query.type === "expert" ? "expert" : "coach";
    const q = typeof req.query.q === "string" ? req.query.q.trim() : "";
    if (q.length < 2) {
      return void res.json({ success: true, data: [] });
    }

    // Escaped: an admin typing "C++ coach" should search for that, not blow up
    // the regex compiler.
    const nameMatch = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
    const users = await User.find({ name: nameMatch }).select("_id name").limit(50).lean();
    const userIds = users.map((user) => user._id);
    if (userIds.length === 0) {
      return void res.json({ success: true, data: [] });
    }
    const nameByUser = new Map(users.map((user) => [String(user._id), user.name]));

    const rows =
      type === "coach"
        ? await Coach.find({
            userId: { $in: userIds },
            isVerified: true,
            verificationStatus: "VERIFIED",
          })
            .select("_id userId sports")
            .limit(CONTRIBUTOR_SEARCH_LIMIT)
            .lean()
        : await Expert.find({
            userId: { $in: userIds },
            isActive: true,
            verificationStatus: "APPROVED",
          })
            .select("_id userId sports")
            .limit(CONTRIBUTOR_SEARCH_LIMIT)
            .lean();

    res.json({
      success: true,
      data: (rows as Array<{ _id: unknown; userId: unknown; sports?: string[] }>).map((row) => ({
        type,
        id: String(row._id),
        name: nameByUser.get(String(row.userId)) ?? "",
        sports: row.sports ?? [],
      })),
    });
  }
);

// ─── POST /api/admin/pathway-guides ──────────────────────────────────────────
// Create the shell for a sport. Stages are added afterwards, one at a time —
// asking for a full six-stage guide before anything can be saved is exactly the
// friction the old JSON-upload CMS had.
export const createPathwayGuide = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const body = req.body ?? {};
    const meta = PathwayGuideSchema.pick({
      sport: true,
      intro: true,
      sportIntro: true,
    }).safeParse({
      sport: body.sport,
      intro: body.intro ?? {},
      sportIntro: body.sportIntro ?? [],
    });

    if (!meta.success) {
      return badRequest(res, "Check the sport details.", formatPathwayIssues(meta.error));
    }

    const exists = await PathwayGuide.exists({ sportSlug: meta.data.sport.slug });
    if (exists) {
      throw new AppError(
        `A pathway guide already exists for ${meta.data.sport.name}. Edit that one instead.`,
        400
      );
    }

    const created = new PathwayGuide({
      sportSlug: meta.data.sport.slug,
      sportName: meta.data.sport.name,
      status: "draft",
      formatVersion: PATHWAY_FORMAT_VERSION,
      intro: compact(meta.data.intro),
      sportIntro: meta.data.sportIntro,
      stages: [],
      ...(req.user?.id ? { updatedBy: req.user.id } : {}),
    });
    await created.save();

    audit(req, "pathwayGuide.create", String(created._id), {
      sportSlug: created.sportSlug,
    });

    res.status(201).json({
      success: true,
      message: `Created a draft pathway for ${created.sportName}.`,
      data: created.toObject(),
    });
  }
);

// ─── PUT /api/admin/pathway-guides/:id ───────────────────────────────────────
// Guide-level fields only. Stages have their own endpoints, so a save here can
// never silently drop them.
export const updatePathwayGuide = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const body = req.body ?? {};
    const meta = PathwayGuideSchema.pick({ intro: true, sportIntro: true })
      .extend({
        reviewedOn: PathwayGuideSchema.shape.reviewedOn,
        contributor: PathwayGuideSchema.shape.contributor,
      })
      .safeParse({
        intro: body.intro ?? {},
        sportIntro: body.sportIntro ?? [],
        reviewedOn: body.reviewedOn,
        // An empty contributor form posts `{}`, which is not a contributor —
        // `name` is required, so passing it through would reject the whole save
        // over a section the author never filled in. Treat nameless as absent.
        contributor: body.contributor?.name ? body.contributor : undefined,
      });

    if (!meta.success) {
      return badRequest(res, "Check the guide details.", formatPathwayIssues(meta.error));
    }

    const updated = await PathwayGuide.findByIdAndUpdate(
      req.params.id,
      {
        $set: {
          intro: compact(meta.data.intro),
          sportIntro: meta.data.sportIntro,
          reviewedOn: meta.data.reviewedOn ?? null,
          // `null`, not `undefined` — `$set: { contributor: undefined }` is a
          // no-op in Mongo, so clearing the byline in the form would never stick.
          contributor: meta.data.contributor ?? null,
          ...(req.user?.id ? { updatedBy: req.user.id } : {}),
        },
      },
      { new: true }
    ).lean();

    if (!updated) throw new AppError("No pathway guide with that id.", 404);

    audit(req, "pathwayGuide.update", String(updated._id), {
      sportSlug: updated.sportSlug,
    });
    revalidatePathway(updated.sportSlug);
    res.json({ success: true, message: "Saved.", data: updated });
  }
);

// ─── DELETE /api/admin/pathway-guides/:id ────────────────────────────────────
export const deletePathwayGuide = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const deleted = await PathwayGuide.findByIdAndDelete(req.params.id).lean();
    if (!deleted) throw new AppError("No pathway guide with that id.", 404);

    audit(req, "pathwayGuide.delete", String(deleted._id), {
      sportSlug: deleted.sportSlug,
      stageCount: deleted.stages?.length ?? 0,
    });
    revalidatePathway(deleted.sportSlug);
    res.json({ success: true, message: `Deleted the ${deleted.sportName} pathway.` });
  }
);

// ─── POST /api/admin/pathway-guides/:id/publish ──────────────────────────────
// Publishing is a separate action from saving, and it re-validates the whole
// guide: a draft is allowed to be half-written, a published one is not. This is
// the only gate between an author's working copy and a parent reading it.
export const setPathwayGuideStatus = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const publish = req.body?.status !== "draft";
    const doc = await PathwayGuide.findById(req.params.id);
    if (!doc) throw new AppError("No pathway guide with that id.", 404);

    if (publish) {
      const check = parsePathwayGuide({
        formatVersion: doc.formatVersion,
        sport: { slug: doc.sportSlug, name: doc.sportName },
        intro: doc.intro ?? {},
        sportIntro: doc.sportIntro ?? [],
        stages: plainStages(doc),
        ...(doc.reviewedOn ? { reviewedOn: doc.reviewedOn } : {}),
        // Round-tripped like `plainStages` above: this is a Mongoose subdocument,
        // and the round trip both flattens it and turns `profile.id` from an
        // ObjectId into the hex string the schema validates.
        ...(doc.contributor?.name ? { contributor: plainContributor(doc.contributor) } : {}),
      });
      if (!check.ok) {
        return badRequest(res, "This guide isn't ready to publish yet.", check.errors);
      }
    }

    doc.status = publish ? "published" : "draft";
    doc.publishedAt = publish ? new Date() : null;
    if (req.user?.id) doc.set("updatedBy", req.user.id);
    await doc.save();

    audit(req, publish ? "pathwayGuide.publish" : "pathwayGuide.unpublish", String(doc._id), {
      sportSlug: doc.sportSlug,
    });
    revalidatePathway(doc.sportSlug);

    res.json({
      success: true,
      message: publish
        ? `${doc.sportName} is live for parents.`
        : `${doc.sportName} is back to a draft.`,
      data: { status: doc.status, publishedAt: doc.publishedAt },
    });
  }
);

// ─── POST /api/admin/pathway-guides/:id/stages ───────────────────────────────
// Append one stage.
export const addPathwayStage = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const parsed = parsePathwayStage(req.body ?? {});
  if (!parsed.ok) return badRequest(res, "Check the stage.", parsed.errors);

  const doc = await PathwayGuide.findById(req.params.id);
  if (!doc) throw new AppError("No pathway guide with that id.", 404);

  if (doc.stages.some((stage) => stage.key === parsed.stage.key)) {
    throw new AppError(`This pathway already has a stage keyed "${parsed.stage.key}".`, 400);
  }

  doc.set(
    "stages",
    resequence([
      ...plainStages(doc),
      { ...parsed.stage, order: doc.stages.length + 1 } as PathwayStageDocument,
    ])
  );
  if (req.user?.id) doc.set("updatedBy", req.user.id);
  await doc.save();

  audit(req, "pathwayGuide.stage.add", String(doc._id), {
    sportSlug: doc.sportSlug,
    stageKey: parsed.stage.key,
  });
  revalidatePathway(doc.sportSlug);
  res.status(201).json({
    success: true,
    message: `Added "${parsed.stage.name}".`,
    data: doc.toObject(),
  });
});

// ─── PUT /api/admin/pathway-guides/:id/stages/:stageKey ──────────────────────
// Replace one stage in place. The stage's position is preserved even if the key
// itself is renamed, so re-keying a stage doesn't send it to the end of the list.
export const updatePathwayStage = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const parsed = parsePathwayStage(req.body ?? {});
    if (!parsed.ok) return badRequest(res, "Check the stage.", parsed.errors);

    const doc = await PathwayGuide.findById(req.params.id);
    if (!doc) throw new AppError("No pathway guide with that id.", 404);

    const stageKey = String(req.params.stageKey).toLowerCase();
    const index = doc.stages.findIndex((stage) => stage.key === stageKey);
    if (index === -1) throw new AppError("No stage with that key.", 404);

    const clash = doc.stages.findIndex((stage, i) => i !== index && stage.key === parsed.stage.key);
    if (clash !== -1) {
      return badRequest(res, `Another stage already uses the key "${parsed.stage.key}".`);
    }

    const next = plainStages(doc);
    next[index] = { ...parsed.stage, order: index + 1 } as PathwayStageDocument;
    doc.set("stages", next);
    if (req.user?.id) doc.set("updatedBy", req.user.id);
    await doc.save();

    audit(req, "pathwayGuide.stage.update", String(doc._id), {
      sportSlug: doc.sportSlug,
      stageKey,
    });
    revalidatePathway(doc.sportSlug);
    res.json({ success: true, message: "Stage saved.", data: doc.toObject() });
  }
);

// ─── DELETE /api/admin/pathway-guides/:id/stages/:stageKey ───────────────────
export const deletePathwayStage = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const doc = await PathwayGuide.findById(req.params.id);
    if (!doc) throw new AppError("No pathway guide with that id.", 404);

    const stageKey = String(req.params.stageKey).toLowerCase();
    const index = doc.stages.findIndex((stage) => stage.key === stageKey);
    if (index === -1) throw new AppError("No stage with that key.", 404);

    const remaining = plainStages(doc);
    remaining.splice(index, 1);
    doc.set("stages", resequence(remaining));
    if (req.user?.id) doc.set("updatedBy", req.user.id);
    await doc.save();

    audit(req, "pathwayGuide.stage.delete", String(doc._id), {
      sportSlug: doc.sportSlug,
      stageKey,
    });
    revalidatePathway(doc.sportSlug);
    res.json({ success: true, message: "Stage deleted.", data: doc.toObject() });
  }
);

// ─── PUT /api/admin/pathway-guides/:id/stages/order ──────────────────────────
// Body: { keys: string[] } — the full ordering, so a reorder is one idempotent
// write rather than a sequence of swaps that can half-apply.
export const reorderPathwayStages = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const keys: unknown = req.body?.keys;
    if (!Array.isArray(keys) || keys.some((key) => typeof key !== "string")) {
      throw new AppError("Send the new order as { keys: [...] }.", 400);
    }

    const doc = await PathwayGuide.findById(req.params.id);
    if (!doc) throw new AppError("No pathway guide with that id.", 404);

    const wanted = (keys as string[]).map((key) => key.toLowerCase());
    const current = doc.stages.map((stage) => stage.key);
    const sameSet =
      wanted.length === current.length &&
      new Set(wanted).size === wanted.length &&
      current.every((key) => wanted.includes(key));

    if (!sameSet) {
      throw new AppError("The new order must list every existing stage exactly once.", 400);
    }

    const byKey = new Map(plainStages(doc).map((stage) => [stage.key, stage]));
    doc.set("stages", resequence(wanted.map((key) => byKey.get(key) as PathwayStageDocument)));
    if (req.user?.id) doc.set("updatedBy", req.user.id);
    await doc.save();

    audit(req, "pathwayGuide.stage.reorder", String(doc._id), {
      sportSlug: doc.sportSlug,
      order: wanted,
    });
    revalidatePathway(doc.sportSlug);
    res.json({ success: true, message: "Order saved.", data: doc.toObject() });
  }
);
