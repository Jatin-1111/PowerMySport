import { Request, Response } from "express";
import {
  getCoachClients,
  getClientDetails,
  addClientNote,
  deleteClientNote,
} from "../services/CoachClientService";
import { NoteType } from "../models/CoachClientNote";

export const getCoachClientsHandler = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user?.id) { res.status(401).json({ success: false, message: "Unauthorized" }); return; }
    const clients = await getCoachClients(req.user.id);
    res.status(200).json({ success: true, message: "Clients retrieved", data: clients });
  } catch (error) {
    res.status(500).json({ success: false, message: error instanceof Error ? error.message : "Failed to fetch clients" });
  }
};

export const getClientDetailsHandler = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user?.id) { res.status(401).json({ success: false, message: "Unauthorized" }); return; }
    const { clientUserId } = req.params as { clientUserId: string };
    const details = await getClientDetails(req.user.id, clientUserId);
    res.status(200).json({ success: true, message: "Client details retrieved", data: details });
  } catch (error) {
    const status = error instanceof Error && error.message.includes("not found") ? 404 : 400;
    res.status(status).json({ success: false, message: error instanceof Error ? error.message : "Failed to fetch client" });
  }
};

export const addClientNoteHandler = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user?.id) { res.status(401).json({ success: false, message: "Unauthorized" }); return; }
    const { clientUserId } = req.params as { clientUserId: string };
    const { note, noteType, sessionDate, bookingId } = req.body as { note: string; noteType?: string; sessionDate?: string; bookingId?: string };
    if (!note?.trim()) { res.status(400).json({ success: false, message: "Note text is required" }); return; }
    const created = await addClientNote(req.user.id, clientUserId, {
      note,
      ...(noteType !== undefined ? { noteType: noteType as NoteType } : {}),
      ...(sessionDate !== undefined ? { sessionDate } : {}),
      ...(bookingId !== undefined ? { bookingId } : {}),
    });
    res.status(201).json({ success: true, message: "Note added", data: created });
  } catch (error) {
    res.status(400).json({ success: false, message: error instanceof Error ? error.message : "Failed to add note" });
  }
};

export const deleteClientNoteHandler = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user?.id) { res.status(401).json({ success: false, message: "Unauthorized" }); return; }
    const { clientUserId, noteId } = req.params as { clientUserId: string; noteId: string };
    await deleteClientNote(req.user.id, clientUserId, noteId);
    res.status(200).json({ success: true, message: "Note deleted" });
  } catch (error) {
    const status = error instanceof Error && error.message.includes("not found") ? 404 : 400;
    res.status(status).json({ success: false, message: error instanceof Error ? error.message : "Failed to delete note" });
  }
};
