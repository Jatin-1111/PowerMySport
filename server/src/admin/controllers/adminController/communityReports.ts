import { Request, Response } from "express";
import mongoose from "mongoose";
import { CommunityReport } from "../../../community/models/CommunityReport";
import { CommunityMessage } from "../../../community/models/CommunityMessage";
import { CommunityGroup } from "../../../community/models/CommunityGroup";
import { CommunityPost } from "../../../community/models/CommunityPost";
import { CommunityAnswer } from "../../../community/models/CommunityAnswer";
import { recordAuditLog } from "../../services/AuditLogService";

const TARGET_PREVIEW_MAX_LENGTH = 140;

const truncatePreview = (value: string): string =>
  value.length > TARGET_PREVIEW_MAX_LENGTH
    ? `${value.slice(0, TARGET_PREVIEW_MAX_LENGTH)}…`
    : value;

const resolveCommunityReportTargets = async (
  reports: Array<{ targetType: string; targetId: mongoose.Types.ObjectId }>
): Promise<Map<string, { preview: string; deleted: boolean } | null>> => {
  const idsByType: Record<"MESSAGE" | "GROUP" | "POST" | "ANSWER", mongoose.Types.ObjectId[]> = {
    MESSAGE: [],
    GROUP: [],
    POST: [],
    ANSWER: [],
  };

  for (const report of reports) {
    if (report.targetType in idsByType) {
      idsByType[report.targetType as keyof typeof idsByType].push(report.targetId);
    }
  }

  const result = new Map<string, { preview: string; deleted: boolean } | null>();

  const [messages, groups, posts, answers] = await Promise.all([
    idsByType.MESSAGE.length
      ? CommunityMessage.find({ _id: { $in: idsByType.MESSAGE } })
          .select("content isDeleted")
          .lean()
      : Promise.resolve([]),
    idsByType.GROUP.length
      ? CommunityGroup.find({ _id: { $in: idsByType.GROUP } })
          .select("name")
          .lean()
      : Promise.resolve([]),
    idsByType.POST.length
      ? CommunityPost.find({ _id: { $in: idsByType.POST } })
          .select("title isDeleted")
          .lean()
      : Promise.resolve([]),
    idsByType.ANSWER.length
      ? CommunityAnswer.find({ _id: { $in: idsByType.ANSWER } })
          .select("content isDeleted")
          .lean()
      : Promise.resolve([]),
  ]);

  for (const message of messages) {
    result.set(String(message._id), {
      preview: message.isDeleted ? "[message deleted]" : truncatePreview(message.content),
      deleted: Boolean(message.isDeleted),
    });
  }
  for (const group of groups) {
    result.set(String(group._id), {
      preview: group.name,
      deleted: false,
    });
  }
  for (const post of posts) {
    result.set(String(post._id), {
      preview: post.isDeleted ? "[post deleted]" : truncatePreview(post.title),
      deleted: Boolean(post.isDeleted),
    });
  }
  for (const answer of answers) {
    result.set(String(answer._id), {
      preview: answer.isDeleted ? "[answer deleted]" : truncatePreview(answer.content),
      deleted: Boolean(answer.isDeleted),
    });
  }

  return result;
};

export const listCommunityReports = async (req: Request, res: Response): Promise<void> => {
  try {
    const status = typeof req.query.status === "string" ? req.query.status : undefined;
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));
    const skip = (page - 1) * limit;

    const query = status
      ? { status }
      : { status: { $in: ["OPEN", "UNDER_REVIEW", "RESOLVED", "REJECTED"] } };

    const [reports, total] = await Promise.all([
      CommunityReport.find(query)
        .populate("reporterUserId", "name email")
        .populate("reviewedBy", "name")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      CommunityReport.countDocuments(query),
    ]);

    const targetPreviews = await resolveCommunityReportTargets(reports);

    res.status(200).json({
      success: true,
      message: "Community reports fetched",
      data: reports.map((report) => {
        const reporter = report.reporterUserId as unknown as
          { _id: mongoose.Types.ObjectId; name?: string; email?: string } | mongoose.Types.ObjectId;
        const reviewer = report.reviewedBy as unknown as
          { _id: mongoose.Types.ObjectId; name?: string } | mongoose.Types.ObjectId | undefined;
        const target = targetPreviews.get(String(report.targetId)) || null;

        return {
          id: String(report._id),
          reporterUserId:
            reporter && typeof reporter === "object" && "name" in reporter
              ? {
                  id: String(reporter._id),
                  name: reporter.name || "Unknown user",
                  email: reporter.email || "",
                }
              : { id: String(reporter), name: "Unknown user", email: "" },
          targetType: report.targetType,
          targetId: String(report.targetId),
          targetPreview: target ? target.preview : "[content not found — may have been removed]",
          targetDeleted: target ? target.deleted : true,
          reason: report.reason,
          details: report.details || "",
          status: report.status,
          resolutionNote: report.resolutionNote || "",
          reviewedBy:
            reviewer && typeof reviewer === "object" && "name" in reviewer
              ? {
                  id: String(reviewer._id),
                  name: reviewer.name || "Unknown admin",
                }
              : null,
          reviewedAt: report.reviewedAt || null,
          createdAt: report.createdAt,
        };
      }),
      pagination: {
        total,
        page,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : "Failed to fetch community reports",
    });
  }
};

export const reviewCommunityReport = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user?.id) {
      res.status(401).json({ success: false, message: "Unauthorized" });
      return;
    }

    const reportId = String(req.params.reportId || "");
    if (!reportId || !mongoose.Types.ObjectId.isValid(reportId)) {
      res.status(400).json({ success: false, message: "Invalid report id" });
      return;
    }

    const { status, resolutionNote } = req.body as {
      status: "UNDER_REVIEW" | "RESOLVED" | "REJECTED";
      resolutionNote?: string;
    };

    const updated = await CommunityReport.findByIdAndUpdate(
      reportId,
      {
        $set: {
          status,
          resolutionNote: resolutionNote?.trim() || "",
          reviewedBy: req.user.id,
          reviewedAt: new Date(),
        },
      },
      { new: true }
    ).lean();

    if (!updated) {
      res.status(404).json({ success: false, message: "Report not found" });
      return;
    }

    void recordAuditLog({
      adminId: req.user.id,
      adminEmail: req.user.email || "",
      action: "communityReport.review",
      targetType: "CommunityReport",
      targetId: reportId,
      metadata: { status, resolutionNote },
    });

    res.status(200).json({
      success: true,
      message: "Report updated",
      data: {
        id: String(updated._id),
        status: updated.status,
        reviewedAt: updated.reviewedAt,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : "Failed to update community report",
    });
  }
};

/**
 * Bulk-review community reports (resolve/reject several at once)
 * PATCH /api/admin/community/reports/bulk-review
 */
export const bulkReviewCommunityReports = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user?.id) {
      res.status(401).json({ success: false, message: "Unauthorized" });
      return;
    }

    const { reportIds, status, resolutionNote } = req.body as {
      reportIds: string[];
      status: "UNDER_REVIEW" | "RESOLVED" | "REJECTED";
      resolutionNote?: string;
    };

    if (!Array.isArray(reportIds) || reportIds.length === 0) {
      res.status(400).json({
        success: false,
        message: "reportIds must be a non-empty array",
      });
      return;
    }

    const validIds = reportIds.filter((id) => mongoose.Types.ObjectId.isValid(id));
    if (validIds.length === 0) {
      res.status(400).json({ success: false, message: "No valid report ids" });
      return;
    }

    if (!["UNDER_REVIEW", "RESOLVED", "REJECTED"].includes(status)) {
      res.status(400).json({ success: false, message: "Invalid status" });
      return;
    }

    const result = await CommunityReport.updateMany(
      { _id: { $in: validIds } },
      {
        $set: {
          status,
          resolutionNote: resolutionNote?.trim() || "",
          reviewedBy: req.user.id,
          reviewedAt: new Date(),
        },
      }
    );

    void recordAuditLog({
      adminId: req.user.id,
      adminEmail: req.user.email || "",
      action: "communityReport.bulkReview",
      targetType: "CommunityReport",
      metadata: {
        reportIds: validIds,
        status,
        modifiedCount: result.modifiedCount,
      },
    });

    res.status(200).json({
      success: true,
      message: `${result.modifiedCount} report(s) updated`,
      data: { modifiedCount: result.modifiedCount },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : "Failed to bulk-update community reports",
    });
  }
};
