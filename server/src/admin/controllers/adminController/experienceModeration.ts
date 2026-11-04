import { Request, Response } from "express";
import mongoose from "mongoose";
import { Experience } from "../../../community/models/Experience";
import { User } from "../../../client/models/User";
import { recordAuditLog } from "../../services/AuditLogService";
import { asyncHandler } from "../../../middleware/asyncHandler";
import { AppError } from "../../../utils/AppError";

/**
 * The admin side of the moderation gate introduced with subject anchoring:
 * an experience naming a coach or expert publishes as PENDING
 * (requiresPreModeration, see community/constants/experience.ts) and stays
 * invisible to everyone but its author until an admin acts on it here. Before
 * this file existed, that queue had a producer (BlogService.createBlog) and
 * no consumer — a PENDING experience had no way to ever become visible.
 *
 * Reuses the reviews:view / reviews:manage permissions rather than minting a
 * new experiences:* pair, per the plan's "extend the existing admin page
 * rather than building a second queue" — the admin UI adds an Experiences tab
 * to the existing Review Moderation page instead of a new permission a role
 * template would need to be updated to grant.
 */

const MODERATION_ACTIONS = ["APPROVE", "FLAG", "REMOVE"] as const;
type ModerationAction = (typeof MODERATION_ACTIONS)[number];

const ACTION_TO_STATUS: Record<ModerationAction, "APPROVED" | "FLAGGED" | "REMOVED"> = {
  APPROVE: "APPROVED",
  FLAG: "FLAGGED",
  REMOVE: "REMOVED",
};

export const getExperienceModerationQueue = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));
    const skip = (page - 1) * limit;

    const query = { moderationStatus: { $in: ["PENDING", "FLAGGED"] } };

    const [total, experiences] = await Promise.all([
      Experience.countDocuments(query),
      Experience.find(query)
        .select(
          "title excerpt authorId subject category moderationStatus moderationNotes createdAt"
        )
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
    ]);

    const authors = await User.find({ _id: { $in: experiences.map((e) => e.authorId) } })
      .select("_id name email")
      .lean();
    const authorMap = new Map(authors.map((author) => [String(author._id), author]));

    res.status(200).json({
      success: true,
      message: "Experience moderation queue fetched",
      data: experiences.map((experience) => {
        const author = authorMap.get(String(experience.authorId));
        return {
          id: String(experience._id),
          title: experience.title || "Untitled experience",
          excerpt: experience.excerpt || "",
          category: experience.category,
          author: author
            ? { id: String(author._id), name: author.name, email: author.email }
            : { id: String(experience.authorId), name: "Unknown", email: "" },
          // Denormalised at write time (see Experience.subject.nameSnapshot) —
          // no populate needed, and it survives the subject being renamed or
          // deleted later.
          subject: experience.subject
            ? {
                kind: experience.subject.kind,
                name: experience.subject.nameSnapshot,
              }
            : null,
          moderationStatus: experience.moderationStatus,
          moderationNotes: experience.moderationNotes || "",
          createdAt: experience.createdAt,
        };
      }),
      pagination: {
        total,
        page,
        totalPages: Math.ceil(total / limit),
      },
    });
  }
);

export const moderateExperience = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    if (!req.user?.id) {
      throw new AppError("Unauthorized", 401);
    }

    const experienceId = String(req.params.experienceId || "");
    if (!experienceId || !mongoose.Types.ObjectId.isValid(experienceId)) {
      throw new AppError("Invalid experience id", 400);
    }

    const { action, moderationNotes } = req.body as {
      action?: ModerationAction;
      moderationNotes?: string;
    };

    if (!action || !MODERATION_ACTIONS.includes(action)) {
      throw new AppError(`action must be one of ${MODERATION_ACTIONS.join(", ")}`, 400);
    }

    const updated = await Experience.findByIdAndUpdate(
      experienceId,
      {
        $set: {
          moderationStatus: ACTION_TO_STATUS[action],
          moderationNotes: moderationNotes?.trim() || "",
        },
      },
      { new: true }
    )
      .select("moderationStatus moderationNotes")
      .lean();

    if (!updated) {
      throw new AppError("Experience not found", 404);
    }

    void recordAuditLog({
      adminId: req.user.id,
      adminEmail: req.user.email || "",
      action: "experience.moderate",
      targetType: "Experience",
      targetId: experienceId,
      metadata: { action, moderationNotes },
    });

    res.status(200).json({
      success: true,
      message: "Experience moderated",
      data: {
        id: experienceId,
        moderationStatus: updated.moderationStatus,
        moderationNotes: updated.moderationNotes,
      },
    });
  }
);
