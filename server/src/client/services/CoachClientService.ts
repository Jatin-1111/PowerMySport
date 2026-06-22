import mongoose from "mongoose";
import { Booking } from "../models/Booking";
import { Coach } from "../models/Coach";
import { User } from "../models/User";
import { CoachClientNote, NoteType, CoachClientNoteDocument } from "../models/CoachClientNote";

export interface ClientSummary {
  clientId: string;
  name: string;
  email: string;
  photoUrl?: string;
  sports: string[];
  totalSessions: number;
  completedSessions: number;
  pendingSessions: number;
  firstSessionDate: string | null;
  lastSessionDate: string | null;
  isActive: boolean;
}

export interface ClientDetails extends ClientSummary {
  bookings: any[];
  notes: any[];
}

const ACTIVE_THRESHOLD_DAYS = 60;

export const getCoachClients = async (
  coachUserId: string,
): Promise<ClientSummary[]> => {
  const coach = await Coach.findOne({ userId: coachUserId }).select("_id");
  if (!coach) throw new Error("Coach profile not found");

  // Aggregate unique clients with session counts using MongoDB aggregation
  const clientAgg = await Booking.aggregate([
    {
      $match: {
        coachId: coach._id,
        status: { $nin: ["CANCELLED"] },
      },
    },
    {
      $group: {
        _id: "$userId",
        totalSessions: { $sum: 1 },
        completedSessions: {
          $sum: { $cond: [{ $eq: ["$status", "COMPLETED"] }, 1, 0] },
        },
        pendingSessions: {
          $sum: {
            $cond: [
              { $in: ["$status", ["PENDING_CONFIRMATION", "CONFIRMED", "IN_PROGRESS"]] },
              1,
              0,
            ],
          },
        },
        sports: { $addToSet: "$sport" },
        firstSessionDate: { $min: "$date" },
        lastSessionDate: { $max: "$date" },
      },
    },
    { $sort: { lastSessionDate: -1 } },
  ]);

  if (clientAgg.length === 0) return [];

  const clientIds = clientAgg.map((c) => c._id);
  const users = await User.find({ _id: { $in: clientIds } })
    .select("_id name email photoUrl")
    .lean();

  const userMap = new Map(users.map((u: any) => [u._id.toString(), u]));
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - ACTIVE_THRESHOLD_DAYS);

  return clientAgg
    .map((agg) => {
      const user = userMap.get(agg._id.toString()) as any;
      if (!user) return null;
      const lastDate = agg.lastSessionDate ? new Date(agg.lastSessionDate) : null;
      return {
        clientId: agg._id.toString(),
        name: user.name ?? "Unknown",
        email: user.email ?? "",
        photoUrl: user.photoUrl,
        sports: agg.sports as string[],
        totalSessions: agg.totalSessions as number,
        completedSessions: agg.completedSessions as number,
        pendingSessions: agg.pendingSessions as number,
        firstSessionDate: agg.firstSessionDate
          ? new Date(agg.firstSessionDate).toISOString()
          : null,
        lastSessionDate: lastDate ? lastDate.toISOString() : null,
        isActive: lastDate ? lastDate >= cutoff : false,
      } as ClientSummary;
    })
    .filter(Boolean) as ClientSummary[];
};

export const getClientDetails = async (
  coachUserId: string,
  clientUserId: string,
): Promise<ClientDetails> => {
  const coach = await Coach.findOne({ userId: coachUserId }).select("_id");
  if (!coach) throw new Error("Coach profile not found");

  if (!mongoose.Types.ObjectId.isValid(clientUserId)) {
    throw new Error("Invalid client ID");
  }

  const [user, bookings, notes] = await Promise.all([
    User.findById(clientUserId).select("_id name email photoUrl").lean(),
    Booking.find({
      coachId: coach._id,
      userId: new mongoose.Types.ObjectId(clientUserId),
      status: { $nin: ["CANCELLED"] },
    })
      .sort({ date: -1 })
      .limit(50)
      .lean(),
    CoachClientNote.find({
      coachId: coach._id,
      clientId: new mongoose.Types.ObjectId(clientUserId),
    })
      .sort({ createdAt: -1 })
      .lean(),
  ]);

  if (!user) throw new Error("Client not found");

  const totalSessions = bookings.length;
  const completedSessions = bookings.filter((b: any) => b.status === "COMPLETED").length;
  const pendingSessions = bookings.filter((b: any) =>
    ["PENDING_CONFIRMATION", "CONFIRMED", "IN_PROGRESS"].includes(b.status),
  ).length;
  const dates = bookings.map((b: any) => new Date(b.date).getTime()).filter(Boolean);
  const firstSessionDate = dates.length ? new Date(Math.min(...dates)).toISOString() : null;
  const lastSessionDate = dates.length ? new Date(Math.max(...dates)).toISOString() : null;
  const sports = [...new Set(bookings.map((b: any) => b.sport as string))];
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - ACTIVE_THRESHOLD_DAYS);

  const userAny = user as any;

  return {
    clientId: clientUserId,
    name: userAny.name ?? "Unknown",
    email: userAny.email ?? "",
    photoUrl: userAny.photoUrl,
    sports,
    totalSessions,
    completedSessions,
    pendingSessions,
    firstSessionDate,
    lastSessionDate,
    isActive: lastSessionDate ? new Date(lastSessionDate) >= cutoff : false,
    bookings,
    notes,
  };
};

export const addClientNote = async (
  coachUserId: string,
  clientUserId: string,
  payload: { note: string; noteType?: NoteType; sessionDate?: string; bookingId?: string },
): Promise<CoachClientNoteDocument> => {
  const coach = await Coach.findOne({ userId: coachUserId }).select("_id");
  if (!coach) throw new Error("Coach profile not found");

  if (!mongoose.Types.ObjectId.isValid(clientUserId)) {
    throw new Error("Invalid client ID");
  }

  const created = await CoachClientNote.create({
    coachId: coach._id,
    clientId: new mongoose.Types.ObjectId(clientUserId),
    note: payload.note.trim(),
    noteType: payload.noteType ?? "GENERAL",
    ...(payload.sessionDate ? { sessionDate: new Date(payload.sessionDate) } : {}),
    ...(payload.bookingId && mongoose.Types.ObjectId.isValid(payload.bookingId)
      ? { bookingId: new mongoose.Types.ObjectId(payload.bookingId) }
      : {}),
  });

  return created;
};

export const deleteClientNote = async (
  coachUserId: string,
  clientUserId: string,
  noteId: string,
): Promise<void> => {
  const coach = await Coach.findOne({ userId: coachUserId }).select("_id");
  if (!coach) throw new Error("Coach profile not found");

  if (!mongoose.Types.ObjectId.isValid(noteId)) throw new Error("Invalid note ID");

  const result = await CoachClientNote.findOneAndDelete({
    _id: new mongoose.Types.ObjectId(noteId),
    coachId: coach._id,
    clientId: new mongoose.Types.ObjectId(clientUserId),
  });

  if (!result) throw new Error("Note not found or not authorized");
};

export type { CoachClientNoteDocument };
