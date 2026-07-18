import { Request, Response } from "express";
import prisma from "../../lib/prisma";
import type {
  SupportStatus,
  SupportPriority,
  SupportCategory,
  SupportRequesterType,
  SupportNoteAuthorType,
} from "@prisma/client";
import {
  sendSupportTicketReceivedEmail,
  sendSupportTicketStatusEmail,
} from "../../utils/email";

const parsePagination = (pageRaw: unknown, limitRaw: unknown) => {
  const page = Math.max(1, Number(pageRaw) || 1);
  const limit = Math.min(100, Math.max(1, Number(limitRaw) || 20));
  const skip = (page - 1) * limit;

  return { page, limit, skip };
};

export const createSupportTicket = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    if (!req.user?.id) {
      res.status(401).json({ success: false, message: "Unauthorized" });
      return;
    }

    await createTicketFromRequest(req, res, {
      requireAuth: true,
      authorId: req.user.id,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message:
        error instanceof Error ? error.message : "Failed to create ticket",
    });
  }
};

export const createPublicSupportTicket = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    await createTicketFromRequest(req, res, { requireAuth: false });
  } catch (error) {
    res.status(500).json({
      success: false,
      message:
        error instanceof Error ? error.message : "Failed to create ticket",
    });
  }
};

const createTicketFromRequest = async (
  req: Request,
  res: Response,
  options: { requireAuth: boolean; authorId?: string },
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
    requesterType?:
      "player" | "venue_owner" | "coach" | "academy_owner" | "other";
  } = req.body;

  if (!subject?.trim() || !description?.trim()) {
    res.status(400).json({
      success: false,
      message: "subject and description are required",
    });
    return;
  }

  if (!options.requireAuth) {
    if (!requesterName?.trim() || !requesterEmail?.trim()) {
      res.status(400).json({
        success: false,
        message: "name and email are required",
      });
      return;
    }
  }

  const ticket = await prisma.supportTicket.create({
    data: {
      ...(options.requireAuth && options.authorId
        ? { userId: options.authorId }
        : {}),
      ...(requesterName?.trim() ? { requesterName: requesterName.trim() } : {}),
      ...(requesterEmail?.trim()
        ? { requesterEmail: requesterEmail.trim().toLowerCase() }
        : {}),
      ...(requesterPhone?.trim()
        ? { requesterPhone: requesterPhone.trim() }
        : {}),
      ...(requesterType
        ? { requesterType: requesterType as SupportRequesterType }
        : {}),
      subject: subject.trim(),
      description: description.trim(),
      category: (category || "OTHER") as SupportCategory,
      priority: (priority || "MEDIUM") as SupportPriority,
      ...(options.authorId ? { lastUpdatedBy: options.authorId } : {}),
      ...(initialNote?.trim()
        ? {
            notes: {
              create: [
                {
                  authorType: (options.requireAuth
                    ? "USER"
                    : "Admin") as SupportNoteAuthorType,
                  // TODO(prisma): public tickets had no author; the Mongo code
                  // generated a throwaway ObjectId here. authorId is a required
                  // String column now, so fall back to an empty string.
                  authorId: options.authorId ?? "",
                  message: initialNote.trim(),
                },
              ],
            },
          }
        : {}),
    },
    include: { notes: true },
  });

  // Acknowledge the ticket by email (fire-and-forget). Prefer the explicit
  // requester email; fall back to the authenticated user's account email.
  void (async () => {
    try {
      let toEmail = ticket.requesterEmail ?? undefined;
      let toName = ticket.requesterName ?? undefined;
      if (!toEmail && ticket.userId) {
        const owner = await prisma.user.findUnique({
          where: { id: ticket.userId },
          select: { name: true, email: true },
        });
        toEmail = owner?.email;
        toName = toName || owner?.name;
      }
      if (toEmail) {
        await sendSupportTicketReceivedEmail({
          name: toName,
          email: toEmail,
          ticketId: String(ticket.id),
          subject: ticket.subject,
          category: ticket.category,
        });
      }
    } catch (error) {
      console.error("Failed to send support ticket received email:", error);
    }
  })();

  res.status(201).json({
    success: true,
    message: "Support ticket created",
    data: ticket,
  });
};

export const getMySupportTickets = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    if (!req.user?.id) {
      res.status(401).json({ success: false, message: "Unauthorized" });
      return;
    }

    const { page, limit, skip } = parsePagination(
      req.query.page,
      req.query.limit,
    );

    const status =
      typeof req.query.status === "string" ? req.query.status : undefined;

    const where: Record<string, unknown> = {
      userId: req.user.id,
    };

    if (status) {
      where.status = status as SupportStatus;
    }

    const [tickets, total] = await Promise.all([
      prisma.supportTicket.findMany({
        where,
        orderBy: { updatedAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.supportTicket.count({ where }),
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
  } catch (error) {
    res.status(500).json({
      success: false,
      message:
        error instanceof Error
          ? error.message
          : "Failed to retrieve support tickets",
    });
  }
};

export const getSupportTicketsForAdmin = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { page, limit, skip } = parsePagination(
      req.query.page,
      req.query.limit,
    );
    const status =
      typeof req.query.status === "string" ? req.query.status : undefined;
    const priority =
      typeof req.query.priority === "string" ? req.query.priority : undefined;

    const where: Record<string, unknown> = {};
    if (status) {
      where.status = status as SupportStatus;
    }
    if (priority) {
      where.priority = priority as SupportPriority;
    }

    const [tickets, total] = await Promise.all([
      prisma.supportTicket.findMany({
        where,
        // TODO(prisma): the Mongo query sorted `priority: -1` alphabetically on
        // the string values; Postgres enums sort by declaration order
        // (LOW, MEDIUM, HIGH, URGENT). `desc` therefore yields a different
        // ordering than Mongo did — confirm the intended ranking if it matters.
        orderBy: [{ priority: "desc" }, { updatedAt: "desc" }],
        skip,
        take: limit,
      }),
      prisma.supportTicket.count({ where }),
    ]);

    // Emulate .populate("userId"/"assignedAdminId", "name email role"): these are
    // String FK refs with no relation, so resolve them with a follow-up query.
    const refIds = [
      ...new Set(
        tickets
          .flatMap((t) => [t.userId, t.assignedAdminId])
          .filter((id): id is string => Boolean(id)),
      ),
    ];
    const refUsers = refIds.length
      ? await prisma.user.findMany({
          where: { id: { in: refIds } },
          select: { id: true, name: true, email: true, role: true },
        })
      : [];
    const byId = new Map(refUsers.map((u) => [u.id, u]));

    const data = tickets.map((t) => ({
      ...t,
      userId: t.userId ? byId.get(t.userId) ?? null : null,
      assignedAdminId: t.assignedAdminId
        ? byId.get(t.assignedAdminId) ?? null
        : null,
    }));

    res.status(200).json({
      success: true,
      message: "Support tickets retrieved",
      data,
      pagination: {
        total,
        page,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message:
        error instanceof Error
          ? error.message
          : "Failed to retrieve support tickets",
    });
  }
};

export const updateSupportTicketByAdmin = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    if (!req.user?.id) {
      res.status(401).json({ success: false, message: "Unauthorized" });
      return;
    }

    const ticketId = (req.params as Record<string, unknown>).ticketId as string;
    // TODO(prisma): dropped mongoose ObjectId.isValid() — ids are cuids now.
    if (!ticketId) {
      res.status(400).json({ success: false, message: "Invalid ticket id" });
      return;
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
      lastUpdatedBy: req.user.id,
    };

    if (status) {
      update.status = status as SupportStatus;
    }

    if (priority) {
      update.priority = priority as SupportPriority;
    }

    if (assignedAdminId === null) {
      update.assignedAdminId = null;
    } else if (typeof assignedAdminId === "string" && assignedAdminId) {
      update.assignedAdminId = assignedAdminId;
    }

    const existingTicket = await prisma.supportTicket.findUnique({
      where: { id: ticketId },
    });
    if (!existingTicket) {
      res.status(404).json({ success: false, message: "Ticket not found" });
      return;
    }

    const ticket = await prisma.supportTicket.update({
      where: { id: ticketId },
      data: {
        ...update,
        ...(note?.trim()
          ? {
              notes: {
                create: {
                  authorType: "Admin" as SupportNoteAuthorType,
                  authorId: req.user.id,
                  message: note.trim(),
                },
              },
            }
          : {}),
      },
      include: { notes: true },
    });

    // Emulate .populate("userId"/"assignedAdminId", "name email role").
    const refIds = [ticket.userId, ticket.assignedAdminId].filter(
      (id): id is string => Boolean(id),
    );
    const refUsers = refIds.length
      ? await prisma.user.findMany({
          where: { id: { in: refIds } },
          select: { id: true, name: true, email: true, role: true },
        })
      : [];
    const byId = new Map(refUsers.map((u) => [u.id, u]));
    const populatedUser = ticket.userId
      ? byId.get(ticket.userId) ?? null
      : null;

    const populatedTicket = {
      ...ticket,
      userId: populatedUser,
      assignedAdminId: ticket.assignedAdminId
        ? byId.get(ticket.assignedAdminId) ?? null
        : null,
    };

    // Notify the requester when the status changes (fire-and-forget).
    if (status) {
      const toEmail = ticket.requesterEmail || populatedUser?.email;
      const toName = ticket.requesterName || populatedUser?.name;
      if (toEmail) {
        sendSupportTicketStatusEmail({
          name: toName ?? undefined,
          email: toEmail,
          ticketId: String(ticket.id),
          subject: ticket.subject,
          status,
          note: note?.trim() || undefined,
        }).catch((error) =>
          console.error("Failed to send support ticket status email:", error),
        );
      }
    }

    res.status(200).json({
      success: true,
      message: "Support ticket updated",
      data: populatedTicket,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message:
        error instanceof Error ? error.message : "Failed to update ticket",
    });
  }
};
