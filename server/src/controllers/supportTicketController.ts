import { Request, Response } from "express";
import mongoose from "mongoose";
import { SupportTicket } from "../models/SupportTicket";

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

    const {
      subject,
      description,
      category,
      priority,
      initialNote,
    }: {
      subject?: string;
      description?: string;
      category?: "BOOKING" | "PAYMENT" | "ACCOUNT" | "TECHNICAL" | "OTHER";
      priority?: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
      initialNote?: string;
    } = req.body;

    if (!subject?.trim() || !description?.trim()) {
      res.status(400).json({
        success: false,
        message: "subject and description are required",
      });
      return;
    }

    const notes = initialNote?.trim()
      ? [
          {
            authorType: "USER" as const,
            authorId: new mongoose.Types.ObjectId(req.user.id),
            message: initialNote.trim(),
            createdAt: new Date(),
          },
        ]
      : [];

    const ticket = await SupportTicket.create({
      userId: new mongoose.Types.ObjectId(req.user.id),
      subject: subject.trim(),
      description: description.trim(),
      category: category || "OTHER",
      priority: priority || "MEDIUM",
      notes,
      lastUpdatedBy: new mongoose.Types.ObjectId(req.user.id),
    });

    res.status(201).json({
      success: true,
      message: "Support ticket created",
      data: ticket,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message:
        error instanceof Error ? error.message : "Failed to create ticket",
    });
  }
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

    const query: Record<string, unknown> = {
      userId: new mongoose.Types.ObjectId(req.user.id),
    };

    if (status) {
      query.status = status;
    }

    const [tickets, total] = await Promise.all([
      SupportTicket.find(query)
        .sort({ updatedAt: -1 })
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
    if (!ticketId || !mongoose.Types.ObjectId.isValid(ticketId)) {
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
                  authorType: "ADMIN",
                  authorId: new mongoose.Types.ObjectId(req.user.id),
                  message: note.trim(),
                  createdAt: new Date(),
                },
              },
            }
          : {}),
      },
      { new: true },
    )
      .populate("userId", "name email role")
      .populate("assignedAdminId", "name email role");

    if (!ticket) {
      res.status(404).json({ success: false, message: "Ticket not found" });
      return;
    }

    res.status(200).json({
      success: true,
      message: "Support ticket updated",
      data: ticket,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message:
        error instanceof Error ? error.message : "Failed to update ticket",
    });
  }
};
