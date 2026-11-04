import { Request, Response } from "express";
import {
  getCoachClients,
  getClientDetails,
  addClientNote,
  deleteClientNote,
} from "../services/CoachClientService";
import { NoteType } from "../models/CoachClientNote";
import { asyncHandler } from "../../middleware/asyncHandler";
import { AppError } from "../../utils/AppError";

export const getCoachClientsHandler = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    if (!req.user?.id) {
      throw new AppError("Unauthorized", 401);
    }
    const clients = await getCoachClients(req.user.id);
    res.status(200).json({ success: true, message: "Clients retrieved", data: clients });
  }
);

export const getClientDetailsHandler = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    if (!req.user?.id) {
      throw new AppError("Unauthorized", 401);
    }
    const { clientUserId } = req.params as { clientUserId: string };
    // NOTE: getClientDetails throws a plain Error; this preserves the existing
    // 404-vs-400 classification (based on the "not found" message) by
    // re-throwing as AppError with the classified status, rather than letting
    // it collapse to a generic 500 like a true catch-all would.
    try {
      const details = await getClientDetails(req.user.id, clientUserId);
      res.status(200).json({
        success: true,
        message: "Client details retrieved",
        data: details,
      });
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      const status = error instanceof Error && error.message.includes("not found") ? 404 : 400;
      throw new AppError(error instanceof Error ? error.message : "Failed to fetch client", status);
    }
  }
);

export const addClientNoteHandler = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    if (!req.user?.id) {
      throw new AppError("Unauthorized", 401);
    }
    const { clientUserId } = req.params as { clientUserId: string };
    const { note, noteType, sessionDate, bookingId } = req.body as {
      note: string;
      noteType?: string;
      sessionDate?: string;
      bookingId?: string;
    };
    if (!note?.trim()) {
      throw new AppError("Note text is required", 400);
    }
    const created = await addClientNote(req.user.id, clientUserId, {
      note,
      ...(noteType !== undefined ? { noteType: noteType as NoteType } : {}),
      ...(sessionDate !== undefined ? { sessionDate } : {}),
      ...(bookingId !== undefined ? { bookingId } : {}),
    });
    res.status(201).json({ success: true, message: "Note added", data: created });
  }
);

export const deleteClientNoteHandler = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    if (!req.user?.id) {
      throw new AppError("Unauthorized", 401);
    }
    const { clientUserId, noteId } = req.params as {
      clientUserId: string;
      noteId: string;
    };
    // NOTE: same rationale as getClientDetailsHandler above — deleteClientNote
    // throws a plain Error and the existing 404-vs-400 classification is
    // preserved via a thrown AppError rather than deleted outright.
    try {
      await deleteClientNote(req.user.id, clientUserId, noteId);
      res.status(200).json({ success: true, message: "Note deleted" });
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      const status = error instanceof Error && error.message.includes("not found") ? 404 : 400;
      throw new AppError(error instanceof Error ? error.message : "Failed to delete note", status);
    }
  }
);
