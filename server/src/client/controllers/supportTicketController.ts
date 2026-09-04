import { Request, Response } from "express";
import mongoose from "mongoose";
import { SupportTicket } from "../models/SupportTicket";
import { User } from "../models/User";
import { sendSupportTicketReceivedEmail, sendSupportTicketStatusEmail } from "../../utils/email";
import { log as __rootLog } from "../../utils/logger";
import { asyncHandler } from "../../middleware/asyncHandler";
import { AppError } from "../../utils/AppError";
const log = __rootLog.child("supportTicket");

const parsePagination = (pageRaw: unknown, limitRaw: unknown) => {
  const page = Math.max(1, Number(pageRaw) || 1);
  const limit = Math.min(100, Math.max(1, Number(limitRaw) || 20));
  const skip = (page - 1) * limit;

  return { page, limit, skip };
};

export const createSupportTicket = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    if (!req.user?.id) {
      throw new AppError("Unauthorized", 401);
    }

    await createTicketFromRequest(req, res, {
      requireAuth: true,
      authorId: req.user.id,
    });
  }
);

export const createPublicSupportTicket = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    await createTicketFromRequest(req, res, { requireAuth: false });
  }
);

const createTicketFromRequest = async (
  req: Request,
  res: Response,
  options: { requireAuth: boolean; authorId?: string }
): Promise<void> => {
  const {
    subject,
    description,
    category,
    priority,
    initialNote,
    requesterName,
    requesterEmail,
    requesterPhone,
    requesterType,
  }: {
    subject?: string;
    description?: string;
    category?: "BOOKING" | "PAYMENT" | "ACCOUNT" | "TECHNICAL" | "OTHER";
    priority?: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
    initialNote?: string;
    requesterName?: string;
    requesterEmail?: string;
    requesterPhone?: string;
    requesterType?: "player" | "venue_owner" | "coach" | "academy_owner" | "other";
  } = req.body;

  if (!subject?.trim() || !description?.trim()) {
    throw new AppError("subject and description are required", 400);
  }

  if (!options.requireAuth) {
    if (!requesterName?.trim() || !requesterEmail?.trim()) {
      throw new AppError("name and email are required", 400);
    }
  }

  const notes = initialNote?.trim()
    ? [
        {
          authorType: options.requireAuth ? ("USER" as const) : ("Admin" as const),
          authorId: options.authorId
            ? new mongoose.Types.ObjectId(options.authorId)
            : new mongoose.Types.ObjectId(),
          message: initialNote.trim(),
          createdAt: new Date(),
        },
      ]
    : [];

  const ticket = await SupportTicket.create({
    ...(options.requireAuth && options.authorId
      ? { userId: new mongoose.Types.ObjectId(options.authorId) }
      : {}),
    ...(requesterName?.trim() ? { requesterName: requesterName.trim() } : {}),
    ...(requesterEmail?.trim() ? { requesterEmail: requesterEmail.trim().toLowerCase() } : {}),
    ...(requesterPhone?.trim() ? { requesterPhone: requesterPhone.trim() } : {}),
    ...(requesterType ? { requesterType } : {}),
    subject: subject.trim(),
    description: description.trim(),
    category: category || "OTHER",
    priority: priority || "MEDIUM",
    notes,
    ...(options.authorId ? { lastUpdatedBy: new mongoose.Types.ObjectId(options.authorId) } : {}),
  });

  // Acknowledge the ticket by email (fire-and-forget). Prefer the explicit
  // requester email; fall back to the authenticated user's account email.
  void (async () => {
    try {
      let toEmail = ticket.requesterEmail;
      let toName = ticket.requesterName;
      if (!toEmail && ticket.userId) {
        const owner = await User.findById(ticket.userId).select("name email").lean();
        toEmail = owner?.email;
        toName = toName || owner?.name;
      }
      if (toEmail) {
        await sendSupportTicketReceivedEmail({
          name: toName,
          email: toEmail,
          ticketId: String(ticket._id),
          subject: ticket.subject,
          category: ticket.category,
        });
      }
    } catch (error) {
      log.error("Failed to send support ticket received email:", error);
    }
  })();

  res.status(201).json({
    success: true,
    message: "Support ticket created",
    data: ticket,
  });
};

export const getMySupportTickets = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    if (!req.user?.id) {
      throw new AppError("Unauthorized", 401);
    }

    const { page, limit, skip } = parsePagination(req.query.page, req.query.limit);

    const status = typeof req.query.status === "string" ? req.query.status : undefined;

    const query: Record<string, unknown> = {
      userId: new mongoose.Types.ObjectId(req.user.id),
    };

    if (status) {
      query.status = status;
    }

    const [tickets, total] = await Promise.all([
      SupportTicket.find(query).sort({ updatedAt: -1 }).skip(skip).limit(limit).lean(),
      SupportTicket.countDocuments(query),
    ]);

    res.status(200).json({
      success: true,
      message: "Support tickets retrieved",
      data: tickets,
      pagination: {
        total,
        page,
        totalPages: Math.ceil(total / limit),
      },
    });
  }
);

export const getSupportTicketsForAdmin = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const { page, limit, skip } = parsePagination(req.query.page, req.query.limit);
    const status = typeof req.query.status === "string" ? req.query.status : undefined;
    const priority = typeof req.query.priority === "string" ? req.query.priority : undefined;

    const query: Record<string, unknown> = {};
    if (status) {
      query.status = status;
    }
    if (priority) {
      query.priority = priority;
    }

    const [tickets, total] = await Promise.all([
      SupportTicket.find(query)
        .populate("userId", "name email role")
        .populate("assignedAdminId", "name email role")
        .sort({ priority: -1, updatedAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      SupportTicket.countDocuments(query),
    ]);

    res.status(200).json({
      success: true,
      message: "Support tickets retrieved",
      data: tickets,
      pagination: {
        total,
        page,
        totalPages: Math.ceil(total / limit),
      },
    });
  }
);

export const updateSupportTicketByAdmin = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    if (!req.user?.id) {
      throw new AppError("Unauthorized", 401);
    }

    const ticketId = (req.params as Record<string, unknown>).ticketId as string;
    if (!ticketId || !mongoose.Types.ObjectId.isValid(ticketId)) {
      throw new AppError("Invalid ticket id", 400);
    }

    const {
      status,
      priority,
      assignedAdminId,
      note,
    }: {
      status?: "OPEN" | "IN_PROGRESS" | "RESOLVED" | "CLOSED";
      priority?: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
      assignedAdminId?: string | null;
      note?: string;
    } = req.body;

    const update: Record<string, unknown> = {
      lastUpdatedBy: new mongoose.Types.ObjectId(req.user.id),
    };

    if (status) {
      update.status = status;
    }

    if (priority) {
      update.priority = priority;
    }

    if (assignedAdminId === null) {
      update.assignedAdminId = null;
    } else if (
      typeof assignedAdminId === "string" &&
      mongoose.Types.ObjectId.isValid(assignedAdminId)
    ) {
      update.assignedAdminId = new mongoose.Types.ObjectId(assignedAdminId);
    }

    const ticket = await SupportTicket.findByIdAndUpdate(
      ticketId,
      {
        $set: update,
        ...(note?.trim()
          ? {
              $push: {
                notes: {
                  authorType: "Admin",
                  authorId: new mongoose.Types.ObjectId(req.user.id),
                  message: note.trim(),
                  createdAt: new Date(),
                },
              },
            }
          : {}),
      },
      { new: true }
    )
      .populate("userId", "name email role")
      .populate("assignedAdminId", "name email role");

    if (!ticket) {
      throw new AppError("Ticket not found", 404);
    }

    // Notify the requester when the status changes (fire-and-forget).
    if (status) {
      const populatedUser = ticket.userId as unknown as {
        name?: string;
        email?: string;
      } | null;
      const toEmail = ticket.requesterEmail || populatedUser?.email;
      const toName = ticket.requesterName || populatedUser?.name;
      if (toEmail) {
        sendSupportTicketStatusEmail({
          name: toName,
          email: toEmail,
          ticketId: String(ticket._id),
          subject: ticket.subject,
          status,
          note: note?.trim() || undefined,
        }).catch((error) => log.error("Failed to send support ticket status email:", error));
      }
    }

    res.status(200).json({
      success: true,
      message: "Support ticket updated",
      data: ticket,
    });
  }
);
