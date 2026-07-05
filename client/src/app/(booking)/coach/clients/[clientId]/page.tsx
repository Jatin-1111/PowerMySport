"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  Calendar,
  CheckCircle,
  Clock,
  FileText,
  Loader2,
  Plus,
  Target,
  Trash2,
  User,
} from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { toast } from "@/lib/toast";
import { coachApi } from "@/modules/coach/services/coach";
import { Button } from "@/modules/shared/ui/Button";
import { Modal } from "@/modules/shared/ui/Modal";
import { Booking, ClientDetails, ClientNote, NoteType } from "@/types";

// ─── Helpers ────────────────────────────────────────────────────────────────

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function formatDate(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return dateStr;
  }
}

function formatTime(timeStr: string): string {
  try {
    const [h, m] = timeStr.split(":");
    const hour = parseInt(h, 10);
    const ampm = hour >= 12 ? "PM" : "AM";
    const displayHour = hour % 12 === 0 ? 12 : hour % 12;
    return `${displayHour}:${m} ${ampm}`;
  } catch {
    return timeStr;
  }
}

function formatStatusLabel(status: Booking["status"]): string {
  return status
    .split("_")
    .map((w) => w.charAt(0) + w.slice(1).toLowerCase())
    .join(" ");
}

// ─── Badge configs ───────────────────────────────────────────────────────────

const NOTE_TYPE_CONFIG: Record<
  NoteType,
  { label: string; className: string; icon: React.ReactNode }
> = {
  GENERAL: {
    label: "General",
    className: "bg-slate-100 text-slate-700 border border-slate-200",
    icon: <FileText size={12} />,
  },
  SESSION: {
    label: "Session",
    className: "bg-indigo-100 text-indigo-700 border border-indigo-200",
    icon: <Activity size={12} />,
  },
  INJURY: {
    label: "Injury",
    className: "bg-rose-100 text-rose-700 border border-rose-200",
    icon: <AlertTriangle size={12} />,
  },
  GOAL: {
    label: "Goal",
    className: "bg-orange-100 text-orange-700 border border-orange-200",
    icon: <Target size={12} />,
  },
  PROGRESS: {
    label: "Progress",
    className: "bg-emerald-100 text-emerald-700 border border-emerald-200",
    icon: <CheckCircle size={12} />,
  },
};

function getBookingStatusClass(status: Booking["status"]): string {
  switch (status) {
    case "CONFIRMED":
      return "bg-emerald-100 text-emerald-700 border border-emerald-200";
    case "COMPLETED":
      return "bg-emerald-100 text-emerald-700 border border-emerald-200";
    case "PENDING_CONFIRMATION":
    case "PENDING_INVITES":
      return "bg-amber-100 text-amber-700 border border-amber-200";
    case "IN_PROGRESS":
      return "bg-indigo-100 text-indigo-700 border border-indigo-200";
    case "NO_SHOW":
      return "bg-yellow-100 text-yellow-700 border border-yellow-200";
    case "CANCELLED":
      return "bg-red-100 text-red-700 border border-red-200";
    default:
      return "bg-slate-100 text-slate-600 border border-slate-200";
  }
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function StatCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
}) {
  return (
    <div className="flex flex-col items-center gap-1 rounded-xl bg-white/60 border border-slate-200 px-4 py-3 min-w-[90px]">
      <span className="text-slate-400">{icon}</span>
      <span className="text-xl font-bold text-slate-800">{value}</span>
      <span className="text-xs text-slate-500 text-center leading-tight">
        {label}
      </span>
    </div>
  );
}

function NoteTypeBadge({ type }: { type: NoteType }) {
  const cfg = NOTE_TYPE_CONFIG[type];
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${cfg.className}`}
    >
      {cfg.icon}
      {cfg.label}
    </span>
  );
}

function NoteCard({
  note,
  onDelete,
  deleting,
}: {
  note: ClientNote;
  onDelete: (id: string) => void;
  deleting: boolean;
}) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const noteId = note._id ?? note.id ?? "";

  return (
    <>
      <motion.div
        layout
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -8 }}
        transition={{ duration: 0.2 }}
        className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm hover:shadow-md transition-shadow"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <NoteTypeBadge type={note.noteType} />
              <span className="text-xs text-slate-400 flex items-center gap-1">
                <Calendar size={11} />
                {formatDate(note.createdAt)}
              </span>
              {note.sessionDate && (
                <span className="text-xs text-slate-400 flex items-center gap-1">
                  <Clock size={11} />
                  Session: {formatDate(note.sessionDate)}
                </span>
              )}
            </div>
            <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">
              {note.note}
            </p>
          </div>
          <button
            onClick={() => setConfirmOpen(true)}
            disabled={deleting}
            className="shrink-0 p-1.5 rounded-lg text-slate-400 hover:bg-rose-50 hover:text-rose-500 transition-colors disabled:opacity-40"
            aria-label="Delete note"
          >
            {deleting ? (
              <Loader2 size={15} className="animate-spin" />
            ) : (
              <Trash2 size={15} />
            )}
          </button>
        </div>
      </motion.div>

      <Modal
        isOpen={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        title="Delete Note"
        size="sm"
        footer={
          <div className="flex gap-3 justify-end">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setConfirmOpen(false)}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              size="sm"
              loading={deleting}
              onClick={() => {
                onDelete(noteId);
                setConfirmOpen(false);
              }}
            >
              Delete
            </Button>
          </div>
        }
      >
        <p className="text-sm text-slate-600">
          Are you sure you want to delete this note? This action cannot be
          undone.
        </p>
      </Modal>
    </>
  );
}

function BookingRow({ booking }: { booking: Booking }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-2 rounded-xl border border-slate-200 bg-white p-4 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap items-center gap-2 mb-1">
          <span className="text-sm font-medium text-slate-800">
            {formatDate(booking.date)}
          </span>
          <span className="text-xs text-slate-500 flex items-center gap-1">
            <Clock size={11} />
            {formatTime(booking.startTime)} – {formatTime(booking.endTime)}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {booking.sport && (
            <span className="rounded-full bg-orange-100 px-2.5 py-0.5 text-xs font-medium text-orange-700 border border-orange-200">
              {booking.sport}
            </span>
          )}
          <span
            className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${getBookingStatusClass(booking.status)}`}
          >
            {formatStatusLabel(booking.status)}
          </span>
        </div>
      </div>
      {booking.totalAmount !== undefined && (
        <div className="text-sm font-semibold text-slate-700 shrink-0">
          ₹{booking.totalAmount.toLocaleString("en-IN")}
        </div>
      )}
    </div>
  );
}

// ─── Main page ───────────────────────────────────────────────────────────────

const BOOKINGS_PAGE_SIZE = 10;

export default function ClientProfilePage() {
  const params = useParams();
  const router = useRouter();
  const clientId = typeof params.clientId === "string" ? params.clientId : "";

  // Data state
  const [client, setClient] = useState<ClientDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Note form state
  const [showNoteForm, setShowNoteForm] = useState(false);
  const [noteText, setNoteText] = useState("");
  const [noteType, setNoteType] = useState<NoteType>("GENERAL");
  const [sessionDate, setSessionDate] = useState("");
  const [savingNote, setSavingNote] = useState(false);

  // Delete state
  const [deletingNoteId, setDeletingNoteId] = useState<string | null>(null);

  // Bookings pagination
  const [visibleBookings, setVisibleBookings] = useState(BOOKINGS_PAGE_SIZE);

  // ── Fetch ─────────────────────────────────────────────────────────────────
  const fetchClient = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await coachApi.getClientDetails(clientId);
      if (res.success && res.data) {
        // Sort bookings descending by date
        const sorted = {
          ...res.data,
          bookings: [...(res.data.bookings ?? [])].sort(
            (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
          ),
          notes: [...(res.data.notes ?? [])].sort(
            (a, b) =>
              new Date(b.createdAt).getTime() -
              new Date(a.createdAt).getTime(),
          ),
        };
        setClient(sorted);
      } else {
        setError(res.message ?? "Failed to load client details.");
      }
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : "Failed to load client details.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (clientId) fetchClient();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId]);

  // ── Add note ──────────────────────────────────────────────────────────────
  const handleSaveNote = async () => {
    if (!noteText.trim()) {
      toast.error("Note text is required.");
      return;
    }
    try {
      setSavingNote(true);
      const payload: {
        note: string;
        noteType: NoteType;
        sessionDate?: string;
      } = {
        note: noteText.trim(),
        noteType,
      };
      if (sessionDate) payload.sessionDate = sessionDate;

      const res = await coachApi.addClientNote(clientId, payload);
      if (res.success) {
        toast.success("Note added successfully.");
        setNoteText("");
        setNoteType("GENERAL");
        setSessionDate("");
        setShowNoteForm(false);
        await fetchClient();
      } else {
        toast.error(res.message ?? "Failed to add note.");
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to add note.";
      toast.error(msg);
    } finally {
      setSavingNote(false);
    }
  };

  // ── Delete note ───────────────────────────────────────────────────────────
  const handleDeleteNote = async (noteId: string) => {
    try {
      setDeletingNoteId(noteId);
      const res = await coachApi.deleteClientNote(clientId, noteId);
      if (res.success) {
        toast.success("Note deleted.");
        await fetchClient();
      } else {
        toast.error(res.message ?? "Failed to delete note.");
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to delete note.";
      toast.error(msg);
    } finally {
      setDeletingNoteId(null);
    }
  };

  // ── Loading skeleton ──────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50">
        <div className="max-w-6xl mx-auto px-4 py-8">
          {/* Back button skeleton */}
          <div className="mb-6 h-8 w-28 rounded-lg bg-slate-200 animate-pulse" />
          {/* Header skeleton */}
          <div className="mb-8 rounded-2xl bg-white border border-slate-200 p-6 flex gap-5 items-center shadow-sm animate-pulse">
            <div className="w-16 h-16 rounded-full bg-slate-200 shrink-0" />
            <div className="flex-1 space-y-2">
              <div className="h-5 w-48 rounded bg-slate-200" />
              <div className="h-4 w-64 rounded bg-slate-200" />
              <div className="h-4 w-32 rounded bg-slate-200" />
            </div>
          </div>
          {/* Body skeleton */}
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
            <div className="lg:col-span-3 space-y-3">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="h-24 rounded-xl bg-slate-200 animate-pulse"
                />
              ))}
            </div>
            <div className="lg:col-span-2 space-y-3">
              {[1, 2].map((i) => (
                <div
                  key={i}
                  className="h-20 rounded-xl bg-slate-200 animate-pulse"
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Error state ───────────────────────────────────────────────────────────
  if (error || !client) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
        <div className="text-center max-w-sm">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-red-100">
            <AlertTriangle size={28} className="text-red-500" />
          </div>
          <h2 className="text-xl font-semibold text-slate-800 mb-2">
            Could not load client
          </h2>
          <p className="text-sm text-slate-500 mb-6">
            {error ?? "Client not found."}
          </p>
          <Button variant="outline" onClick={() => router.back()}>
            <ArrowLeft size={16} />
            Go Back
          </Button>
        </div>
      </div>
    );
  }

  const displayedBookings = client.bookings.slice(0, visibleBookings);
  const hasMoreBookings = client.bookings.length > visibleBookings;

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">

        {/* Back button */}
        <motion.button
          initial={{ opacity: 0, x: -8 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.25 }}
          onClick={() => router.back()}
          className="mb-6 inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-slate-600 hover:bg-white hover:text-slate-900 hover:shadow-sm border border-transparent hover:border-slate-200 transition-all"
        >
          <ArrowLeft size={16} />
          Clients
        </motion.button>

        {/* ── Header card ── */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="mb-8 rounded-2xl bg-white border border-slate-200 shadow-sm overflow-hidden"
        >
          {/* Orange top bar accent */}
          <div className="h-1.5 bg-gradient-to-r from-orange-400 to-orange-600" />

          <div className="p-6">
            <div className="flex flex-col sm:flex-row gap-5 items-start sm:items-center">
              {/* Avatar */}
              <div className="shrink-0 flex h-16 w-16 items-center justify-center rounded-full bg-power-orange text-white text-xl font-bold shadow-md select-none">
                {client.photoUrl ? (
                  <img
                    src={client.photoUrl}
                    alt={client.name}
                    className="h-16 w-16 rounded-full object-cover"
                  />
                ) : (
                  getInitials(client.name)
                )}
              </div>

              {/* Name / email / sports */}
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-3 mb-1">
                  <h1 className="text-2xl font-bold text-slate-900 leading-tight">
                    {client.name}
                  </h1>
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-xs font-semibold border ${
                      client.isActive
                        ? "bg-emerald-100 text-emerald-700 border-emerald-200"
                        : "bg-slate-100 text-slate-500 border-slate-200"
                    }`}
                  >
                    {client.isActive ? "Active" : "Inactive"}
                  </span>
                </div>
                <p className="text-sm text-slate-500 mb-3">{client.email}</p>

                {client.sports && client.sports.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {client.sports.map((sport) => (
                      <span
                        key={sport}
                        className="rounded-full bg-orange-50 border border-orange-200 px-2.5 py-0.5 text-xs font-medium text-orange-700"
                      >
                        {sport}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Stats row */}
            <div className="mt-5 flex flex-wrap gap-3">
              <StatCard
                icon={<Calendar size={16} />}
                label="Total Sessions"
                value={client.totalSessions}
              />
              <StatCard
                icon={<CheckCircle size={16} />}
                label="Completed"
                value={client.completedSessions}
              />
              <StatCard
                icon={<Clock size={16} />}
                label="Pending"
                value={client.pendingSessions}
              />
              {client.lastSessionDate && (
                <StatCard
                  icon={<Activity size={16} />}
                  label="Last Session"
                  value={formatDate(client.lastSessionDate)}
                />
              )}
            </div>
          </div>
        </motion.div>

        {/* ── Body: 2-column grid ── */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">

          {/* LEFT: Session Notes */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay: 0.05 }}
            className="lg:col-span-3"
          >
            <div className="rounded-2xl bg-white border border-slate-200 shadow-sm overflow-hidden">
              <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
                <h2 className="text-base font-semibold text-slate-800 flex items-center gap-2">
                  <FileText size={17} className="text-power-orange" />
                  Session Notes
                  {client.notes.length > 0 && (
                    <span className="ml-1 rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500 font-medium">
                      {client.notes.length}
                    </span>
                  )}
                </h2>
                <Button
                  variant="primary"
                  size="sm"
                  icon={<Plus size={15} />}
                  onClick={() => setShowNoteForm((v) => !v)}
                >
                  Add Note
                </Button>
              </div>

              {/* Inline add-note form */}
              <AnimatePresence>
                {showNoteForm && (
                  <motion.div
                    key="note-form"
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.25 }}
                    className="overflow-hidden"
                  >
                    <div className="px-6 py-5 border-b border-slate-100 bg-slate-50/60">
                      <h3 className="text-sm font-semibold text-slate-700 mb-4">
                        New Note
                      </h3>
                      <div className="space-y-4">
                        {/* Note textarea */}
                        <div>
                          <label className="block text-xs font-medium text-slate-600 mb-1.5">
                            Note <span className="text-red-500">*</span>
                          </label>
                          <textarea
                            rows={4}
                            value={noteText}
                            onChange={(e) => setNoteText(e.target.value)}
                            placeholder="Write your note here..."
                            className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-800 placeholder-slate-400 focus:border-orange-400 focus:outline-none focus:ring-2 focus:ring-orange-100 resize-none transition"
                          />
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          {/* Note type */}
                          <div>
                            <label className="block text-xs font-medium text-slate-600 mb-1.5">
                              Note Type
                            </label>
                            <select
                              value={noteType}
                              onChange={(e) =>
                                setNoteType(e.target.value as NoteType)
                              }
                              className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-800 focus:border-orange-400 focus:outline-none focus:ring-2 focus:ring-orange-100 transition"
                            >
                              <option value="GENERAL">General</option>
                              <option value="SESSION">Session</option>
                              <option value="INJURY">Injury</option>
                              <option value="GOAL">Goal</option>
                              <option value="PROGRESS">Progress</option>
                            </select>
                          </div>

                          {/* Session date */}
                          <div>
                            <label className="block text-xs font-medium text-slate-600 mb-1.5">
                              Session Date{" "}
                              <span className="text-slate-400">(optional)</span>
                            </label>
                            <input
                              type="date"
                              value={sessionDate}
                              onChange={(e) => setSessionDate(e.target.value)}
                              className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-800 focus:border-orange-400 focus:outline-none focus:ring-2 focus:ring-orange-100 transition"
                            />
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="flex gap-3 pt-1">
                          <Button
                            variant="primary"
                            size="sm"
                            loading={savingNote}
                            onClick={handleSaveNote}
                          >
                            Save Note
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            disabled={savingNote}
                            onClick={() => {
                              setShowNoteForm(false);
                              setNoteText("");
                              setNoteType("GENERAL");
                              setSessionDate("");
                            }}
                          >
                            Cancel
                          </Button>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Notes list */}
              <div className="p-5 space-y-3">
                <AnimatePresence mode="popLayout">
                  {client.notes.length === 0 ? (
                    <motion.div
                      key="empty-notes"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="flex flex-col items-center justify-center py-12 text-center"
                    >
                      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-slate-100">
                        <FileText size={22} className="text-slate-400" />
                      </div>
                      <p className="text-sm font-medium text-slate-600 mb-1">
                        No notes yet
                      </p>
                      <p className="text-xs text-slate-400">
                        Add notes to track this athlete's progress.
                      </p>
                    </motion.div>
                  ) : (
                    client.notes.map((note) => {
                      const noteId = note._id ?? note.id ?? "";
                      return (
                        <NoteCard
                          key={noteId}
                          note={note}
                          onDelete={handleDeleteNote}
                          deleting={deletingNoteId === noteId}
                        />
                      );
                    })
                  )}
                </AnimatePresence>
              </div>
            </div>
          </motion.div>

          {/* RIGHT: Session History */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay: 0.1 }}
            className="lg:col-span-2"
          >
            <div className="rounded-2xl bg-white border border-slate-200 shadow-sm overflow-hidden">
              <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
                <h2 className="text-base font-semibold text-slate-800 flex items-center gap-2">
                  <Calendar size={17} className="text-power-orange" />
                  Session History
                  {client.bookings.length > 0 && (
                    <span className="ml-1 rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500 font-medium">
                      {client.bookings.length}
                    </span>
                  )}
                </h2>
              </div>

              <div className="p-5 space-y-3">
                <AnimatePresence mode="popLayout">
                  {client.bookings.length === 0 ? (
                    <motion.div
                      key="empty-bookings"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="flex flex-col items-center justify-center py-12 text-center"
                    >
                      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-slate-100">
                        <Calendar size={22} className="text-slate-400" />
                      </div>
                      <p className="text-sm font-medium text-slate-600 mb-1">
                        No sessions yet
                      </p>
                      <p className="text-xs text-slate-400">
                        Past sessions with this athlete will appear here.
                      </p>
                    </motion.div>
                  ) : (
                    <>
                      {displayedBookings.map((booking) => (
                        <motion.div
                          key={booking.id}
                          initial={{ opacity: 0, y: 6 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.2 }}
                        >
                          <BookingRow booking={booking} />
                        </motion.div>
                      ))}

                      {hasMoreBookings && (
                        <motion.div
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          className="pt-2"
                        >
                          <Button
                            variant="ghost"
                            size="sm"
                            fullWidth
                            onClick={() =>
                              setVisibleBookings((v) => v + BOOKINGS_PAGE_SIZE)
                            }
                          >
                            Load more (
                            {client.bookings.length - visibleBookings} more)
                          </Button>
                        </motion.div>
                      )}
                    </>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
