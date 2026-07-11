import type { CoachClientNote, NoteType } from "@prisma/client";
import prisma from "../../lib/prisma";

// Legacy alias — the Mongoose document type is replaced by the Prisma row type.
type CoachClientNoteDocument = CoachClientNote;
export type { NoteType };

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

const PENDING_STATUSES = ["PENDING_CONFIRMATION", "CONFIRMED", "IN_PROGRESS"];

export const getCoachClients = async (
  coachUserId: string,
): Promise<ClientSummary[]> => {
  const coach = await prisma.coach.findFirst({
    where: { userId: coachUserId },
    select: { id: true },
  });
  if (!coach) throw new Error("Coach profile not found");

  // The old MongoDB $group aggregation is done in code: fetch the (small)
  // per-coach booking set and fold it into per-client session summaries.
  const bookings = await prisma.booking.findMany({
    where: {
      coachId: coach.id,
      status: { not: "CANCELLED" },
    },
    select: { userId: true, status: true, sport: true, date: true },
  });

  if (bookings.length === 0) return [];

  type Agg = {
    _id: string;
    totalSessions: number;
    completedSessions: number;
    pendingSessions: number;
    sports: Set<string>;
    firstSessionDate: Date | null;
    lastSessionDate: Date | null;
  };

  const aggMap = new Map<string, Agg>();
  for (const b of bookings) {
    let agg = aggMap.get(b.userId);
    if (!agg) {
      agg = {
        _id: b.userId,
        totalSessions: 0,
        completedSessions: 0,
        pendingSessions: 0,
        sports: new Set<string>(),
        firstSessionDate: null,
        lastSessionDate: null,
      };
      aggMap.set(b.userId, agg);
    }
    agg.totalSessions += 1;
    if (b.status === "COMPLETED") agg.completedSessions += 1;
    if (PENDING_STATUSES.includes(b.status)) agg.pendingSessions += 1;
    if (b.sport) agg.sports.add(b.sport);
    if (!agg.firstSessionDate || b.date < agg.firstSessionDate) {
      agg.firstSessionDate = b.date;
    }
    if (!agg.lastSessionDate || b.date > agg.lastSessionDate) {
      agg.lastSessionDate = b.date;
    }
  }

  const clientAgg = Array.from(aggMap.values()).sort((a, b) => {
    const at = a.lastSessionDate ? a.lastSessionDate.getTime() : 0;
    const bt = b.lastSessionDate ? b.lastSessionDate.getTime() : 0;
    return bt - at;
  });

  const clientIds = clientAgg.map((c) => c._id);
  const users = await prisma.user.findMany({
    where: { id: { in: clientIds } },
    select: { id: true, name: true, email: true, photoUrl: true },
  });

  const userMap = new Map(users.map((u) => [u.id, u]));
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - ACTIVE_THRESHOLD_DAYS);

  return clientAgg
    .map((agg) => {
      const user = userMap.get(agg._id);
      if (!user) return null;
      const lastDate = agg.lastSessionDate
        ? new Date(agg.lastSessionDate)
        : null;
      return {
        clientId: agg._id,
        name: user.name ?? "Unknown",
        email: user.email ?? "",
        photoUrl: user.photoUrl ?? undefined,
        sports: Array.from(agg.sports),
        totalSessions: agg.totalSessions,
        completedSessions: agg.completedSessions,
        pendingSessions: agg.pendingSessions,
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
  const coach = await prisma.coach.findFirst({
    where: { userId: coachUserId },
    select: { id: true },
  });
  if (!coach) throw new Error("Coach profile not found");

  // TODO(prisma): the old mongoose.Types.ObjectId.isValid() guard is gone —
  // Postgres ids are cuids. Keep a truthiness guard to preserve the error path.
  if (!clientUserId) {
    throw new Error("Invalid client ID");
  }

  const [user, bookings, notes] = await Promise.all([
    prisma.user.findUnique({
      where: { id: clientUserId },
      select: { id: true, name: true, email: true, photoUrl: true },
    }),
    prisma.booking.findMany({
      where: {
        coachId: coach.id,
        userId: clientUserId,
        status: { not: "CANCELLED" },
      },
      orderBy: { date: "desc" },
      take: 50,
    }),
    prisma.coachClientNote.findMany({
      where: {
        coachId: coach.id,
        clientId: clientUserId,
      },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  if (!user) throw new Error("Client not found");

  const totalSessions = bookings.length;
  const completedSessions = bookings.filter(
    (b) => b.status === "COMPLETED",
  ).length;
  const pendingSessions = bookings.filter((b) =>
    PENDING_STATUSES.includes(b.status),
  ).length;
  const dates = bookings
    .map((b) => new Date(b.date).getTime())
    .filter(Boolean);
  const firstSessionDate = dates.length
    ? new Date(Math.min(...dates)).toISOString()
    : null;
  const lastSessionDate = dates.length
    ? new Date(Math.max(...dates)).toISOString()
    : null;
  const sports = [...new Set(bookings.map((b) => b.sport as string))];
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - ACTIVE_THRESHOLD_DAYS);

  return {
    clientId: clientUserId,
    name: user.name ?? "Unknown",
    email: user.email ?? "",
    photoUrl: user.photoUrl ?? undefined,
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
  payload: {
    note: string;
    noteType?: NoteType;
    sessionDate?: string;
    bookingId?: string;
  },
): Promise<CoachClientNoteDocument> => {
  const coach = await prisma.coach.findFirst({
    where: { userId: coachUserId },
    select: { id: true },
  });
  if (!coach) throw new Error("Coach profile not found");

  // TODO(prisma): ObjectId validity check removed (cuid ids); guard truthiness.
  if (!clientUserId) {
    throw new Error("Invalid client ID");
  }

  const created = await prisma.coachClientNote.create({
    data: {
      coachId: coach.id,
      clientId: clientUserId,
      note: payload.note.trim(),
      noteType: payload.noteType ?? "GENERAL",
      ...(payload.sessionDate
        ? { sessionDate: new Date(payload.sessionDate) }
        : {}),
      ...(payload.bookingId ? { bookingId: payload.bookingId } : {}),
    },
  });

  return created;
};

export const deleteClientNote = async (
  coachUserId: string,
  clientUserId: string,
  noteId: string,
): Promise<void> => {
  const coach = await prisma.coach.findFirst({
    where: { userId: coachUserId },
    select: { id: true },
  });
  if (!coach) throw new Error("Coach profile not found");

  if (!noteId) throw new Error("Invalid note ID");

  const result = await prisma.coachClientNote.deleteMany({
    where: {
      id: noteId,
      coachId: coach.id,
      clientId: clientUserId,
    },
  });

  if (result.count === 0) throw new Error("Note not found or not authorized");
};

export type { CoachClientNoteDocument };
