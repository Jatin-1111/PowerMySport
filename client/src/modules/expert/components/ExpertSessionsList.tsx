"use client";

import { SlotPicker } from "@/modules/expert/components/SlotPicker";
import {
    expertApi,
    type ExpertSession,
    type ExpertSessionPlayer,
} from "@/modules/expert/services/expert";
import { formatSessionTimeWithZone } from "@/modules/expert/utils/time";
import { ConfirmDialog } from "@/modules/shared/ui/ConfirmDialog";
import { Modal } from "@/modules/shared/ui/Modal";
import {
    StaggerContainer,
    StaggerItem,
} from "@/modules/shared/ui/motion/StaggerContainer";
import { Check, FileText, Star, Target, Users } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";

export const MOM_MIN_LENGTH = 20;

export const formatInr = (n: number) => `₹${Number(n || 0).toLocaleString("en-IN")}`;

const GENDER_LABEL: Record<string, string> = {
  MALE: "Boy",
  FEMALE: "Girl",
  OTHER: "Other",
};

/** A few of the most useful wizard signals for a quick pre-session read — not the full profile. */
const playerTraitChips = (player: ExpertSessionPlayer): string[] =>
  [
    player.ambition && { fun: "Health & fun", competitive: "Competitive", national: "National", professional: "Pro career" }[player.ambition],
    player.competitiveResponse && { "fired-up": "Fires up on a loss", calm: "Calm on a loss", discouraged: "Needs time after a loss" }[player.competitiveResponse],
    player.pressureResponse && { thrives: "Thrives under pressure", manages: "Manages pressure", avoids: "Avoids the spotlight" }[player.pressureResponse],
    player.energyType && { explosive: "Explosive energy", endurance: "Endurance-built" }[player.energyType],
  ].filter((v): v is string => Boolean(v));

export const STATUS_STYLES: Record<string, string> = {
  PENDING_PAYMENT: "bg-amber-50 text-amber-700",
  PAID: "bg-indigo-50 text-indigo-700",
  SCHEDULED: "bg-indigo-50 text-indigo-700",
  COMPLETED: "bg-emerald-50 text-emerald-700",
  CANCELLED: "bg-red-50 text-red-700",
};

/** Loading/error/empty states + the session list itself — shared by the
 *  dashboard's capped preview and the full /expert/sessions page. */
export function ExpertSessionsList({
  sessions,
  loading,
  error,
  onRetry,
  onChange,
  emptyMessage = "No sessions booked yet.",
}: {
  sessions: ExpertSession[];
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  onChange: (s: ExpertSession) => void;
  emptyMessage?: string;
}) {
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-16">
        <div className="h-9 w-9 animate-spin rounded-full border-2 border-slate-100 border-t-power-orange" />
        <p className="text-sm text-slate-500">Loading...</p>
      </div>
    );
  }
  if (error) {
    return (
      <div className="py-12 text-center">
        <p className="font-semibold text-red-600">{error}</p>
        <button
          onClick={onRetry}
          className="mt-4 rounded-lg bg-power-orange px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-orange-600"
        >
          Retry
        </button>
      </div>
    );
  }
  if (sessions.length === 0) {
    return (
      <div className="rounded-2xl border-0 bg-white py-16 text-center text-slate-500 shadow-[0_2px_16px_rgb(0,0,0,0.06)]">
        {emptyMessage}
      </div>
    );
  }
  return (
    <StaggerContainer className="space-y-3">
      {sessions.map((s) => (
        <StaggerItem key={s.id || s._id}>
          <SessionRow session={s} onChange={onChange} />
        </StaggerItem>
      ))}
    </StaggerContainer>
  );
}

export function SessionRow({
  session,
  onChange,
}: {
  session: ExpertSession;
  onChange: (s: ExpertSession) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [linkOpen, setLinkOpen] = useState(false);
  const [link, setLink] = useState(session.meetingLink || "");
  const [showCancel, setShowCancel] = useState(false);
  const [showDecline, setShowDecline] = useState(false);
  const [rescheduleOpen, setRescheduleOpen] = useState(false);
  const [newSlot, setNewSlot] = useState<string | null>(null);
  const [momOpen, setMomOpen] = useState(false);
  const [momMode, setMomMode] = useState<"complete" | "edit">("complete");
  const [momText, setMomText] = useState(session.momNotes || "");
  const id = String(session.id || session._id || "");
  const canManage = ["PAID", "SCHEDULED"].includes(session.status);
  const needsResponse = canManage && session.expertAcceptance !== "ACCEPTED";
  // Mirrors completeExpertSession's server-side gate: can't complete before the session starts.
  const sessionStarted = Boolean(
    session.scheduledAt && new Date(session.scheduledAt) <= new Date(),
  );
  // Mirrors cancelExpertSession's server-side gate: can't cancel once it's over.
  const sessionEnded = Boolean(
    session.scheduledAt &&
      new Date(session.scheduledAt).getTime() +
        (session.durationMinutes || 60) * 60_000 <
        Date.now(),
  );

  const run = async (
    fn: () => Promise<{
      success: boolean;
      message: string;
      data?: ExpertSession;
    }>,
  ) => {
    setBusy(true);
    try {
      const res = await fn();
      if (res.success && res.data) {
        onChange(res.data);
        toast.success("Done.");
      } else {
        toast.error(res.message || "Action failed.");
      }
    } catch (err: unknown) {
      toast.error(
        (err as { response?: { data?: { message?: string } } })?.response?.data
          ?.message || "Action failed.",
      );
    } finally {
      setBusy(false);
    }
  };

  const saveLink = async () => {
    if (link && !/^https?:\/\//i.test(link)) {
      toast.error("Enter a valid URL (https://…).");
      return;
    }
    await run(() => expertApi.setMeetingLink(id, link.trim()));
    setLinkOpen(false);
  };

  const openMomDialog = (mode: "complete" | "edit") => {
    setMomMode(mode);
    setMomText(mode === "edit" ? session.momNotes || "" : "");
    setMomOpen(true);
  };

  const submitMom = async () => {
    const trimmed = momText.trim();
    if (trimmed.length < MOM_MIN_LENGTH) {
      toast.error(
        `Add at least ${MOM_MIN_LENGTH} characters — summarize what was covered and any next steps.`,
      );
      return;
    }
    await run(() =>
      momMode === "complete"
        ? expertApi.completeSession(id, trimmed)
        : expertApi.updateSessionMom(id, trimmed),
    );
    setMomOpen(false);
  };

  const saveReschedule = async () => {
    if (!newSlot) {
      toast.error("Pick a new time first.");
      return;
    }
    await run(() =>
      expertApi.respondSession(id, {
        action: "RESCHEDULE",
        scheduledAt: newSlot,
      }),
    );
    setRescheduleOpen(false);
    setNewSlot(null);
  };

  return (
    <div className="rounded-2xl border-0 bg-white p-5 shadow-[0_2px_16px_rgb(0,0,0,0.06)] transition-shadow hover:shadow-[0_8px_24px_rgb(0,0,0,0.1)]">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="font-semibold text-slate-900">
            {session.clientName || "Client"}
          </p>
          <p className="text-sm text-slate-500">
            {session.scheduledAt
              ? formatSessionTimeWithZone(
                  session.scheduledAt,
                  session.expertTimezone,
                )
              : "Not scheduled yet"}
            {session.mode
              ? ` · ${session.mode === "ONLINE" ? "Online" : "In-person"}`
              : ""}
          </p>
          {session.player && (
            <div className="mt-2 rounded-lg bg-slate-50 px-3 py-2">
              <p className="flex items-center gap-1.5 text-sm font-semibold text-slate-800">
                <Users className="h-3.5 w-3.5 text-power-orange" />
                {session.player.name}
                {session.player.age ? ` · ${session.player.age} yrs` : ""}
                {session.player.gender
                  ? ` · ${GENDER_LABEL[session.player.gender] || session.player.gender}`
                  : ""}
              </p>
              {session.player.topSportMatch && (
                <p className="mt-1 flex items-center gap-1.5 text-xs text-slate-600">
                  <Target className="h-3 w-3 text-power-orange" />
                  Best fit: {session.player.topSportMatch.sport} (
                  {session.player.topSportMatch.fitLabel})
                </p>
              )}
              {playerTraitChips(session.player).length > 0 && (
                <div className="mt-1.5 flex flex-wrap gap-1">
                  {playerTraitChips(session.player).map((chip) => (
                    <span
                      key={chip}
                      className="rounded-full bg-white px-2 py-0.5 text-[11px] font-medium text-slate-500 ring-1 ring-inset ring-slate-200"
                    >
                      {chip}
                    </span>
                  ))}
                </div>
              )}
              <Link
                href={`/expert/sessions/${id}`}
                className="mt-2 inline-block text-xs font-semibold text-power-orange hover:underline"
              >
                View full child profile →
              </Link>
            </div>
          )}
          {session.clientNote && (
            <p className="mt-1 text-sm italic text-slate-500">
              “{session.clientNote}”
            </p>
          )}
          {session.reviewed && session.rating && (
            <p className="mt-1 flex items-center gap-1 text-sm text-amber-600">
              <Star className="h-3.5 w-3.5 fill-amber-500 text-amber-500" />
              {session.rating}/5{session.review ? ` — "${session.review}"` : ""}
            </p>
          )}
          {session.status === "COMPLETED" && (
            <div className="mt-2 rounded-lg bg-slate-50 px-3 py-2">
              <div className="flex items-center justify-between gap-2">
                <p className="flex items-center gap-1.5 text-xs font-semibold text-slate-600">
                  <FileText className="h-3.5 w-3.5 text-power-orange" />
                  Session notes (MOM)
                </p>
                <button
                  onClick={() => openMomDialog("edit")}
                  className="text-xs font-semibold text-power-orange hover:underline"
                >
                  Edit
                </button>
              </div>
              {session.momNotes && (
                <p className="mt-1 text-sm text-slate-600">
                  {session.momNotes}
                </p>
              )}
            </div>
          )}
        </div>
        <div className="flex flex-col items-end gap-1.5">
          <div className="flex items-center gap-3">
            <span className="font-semibold text-slate-900">
              {formatInr(session.amount)}
            </span>
            <span
              className={`rounded-full px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wide ${STATUS_STYLES[session.status] || "bg-slate-100 text-slate-600"}`}
            >
              {session.status.replace(/_/g, " ")}
            </span>
          </div>
          {canManage && (
            <span
              className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                session.expertAcceptance === "ACCEPTED"
                  ? "bg-emerald-50 text-emerald-700"
                  : "bg-amber-50 text-amber-700"
              }`}
            >
              {session.expertAcceptance === "ACCEPTED"
                ? "Confirmed by you"
                : "Awaiting your response"}
            </span>
          )}
        </div>
      </div>

      {/* Respond to the client's requested time */}
      {needsResponse && (
        <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50/60 p-3">
          {rescheduleOpen ? (
            <div>
              <p className="mb-2 text-sm font-semibold text-slate-900">
                Propose a new time
              </p>
              <SlotPicker
                expertId={session.expertId}
                value={newSlot}
                onChange={setNewSlot}
                timezone={session.expertTimezone}
              />
              <div className="mt-3 flex gap-2">
                <button
                  onClick={saveReschedule}
                  disabled={busy || !newSlot}
                  className="rounded-lg bg-power-orange px-4 py-2 text-sm font-semibold text-white hover:bg-orange-600 disabled:opacity-60"
                >
                  Confirm new time
                </button>
                <button
                  onClick={() => {
                    setRescheduleOpen(false);
                    setNewSlot(null);
                  }}
                  className="rounded-lg px-3 py-2 text-sm font-semibold text-slate-500 hover:text-slate-800"
                >
                  Back
                </button>
              </div>
            </div>
          ) : (
            <>
              <p className="text-sm font-semibold text-slate-800">
                The client is waiting for you to confirm this time.
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                <button
                  onClick={() =>
                    run(() =>
                      expertApi.respondSession(id, { action: "ACCEPT" }),
                    )
                  }
                  disabled={busy}
                  className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
                >
                  <Check className="h-4 w-4" /> Accept time
                </button>
                <button
                  onClick={() => setRescheduleOpen(true)}
                  disabled={busy}
                  className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                >
                  Reschedule
                </button>
                <button
                  onClick={() => setShowDecline(true)}
                  disabled={busy}
                  className="rounded-lg border border-red-200 bg-white px-3 py-1.5 text-sm font-semibold text-red-600 hover:bg-red-50 disabled:opacity-60"
                >
                  Decline
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {canManage && (
        <div className="mt-4 border-t border-slate-100 pt-3">
          {linkOpen ? (
            <div className="flex flex-col gap-2 sm:flex-row">
              <input
                value={link}
                onChange={(e) => setLink(e.target.value)}
                placeholder="https://meet.google.com/…"
                className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
              <div className="flex gap-2">
                <button
                  onClick={saveLink}
                  disabled={busy}
                  className="rounded-lg bg-power-orange px-4 py-2 text-sm font-semibold text-white hover:bg-orange-600 disabled:opacity-60"
                >
                  Save link
                </button>
                <button
                  onClick={() => setLinkOpen(false)}
                  className="rounded-lg px-3 py-2 text-sm font-semibold text-slate-500 hover:text-slate-800"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setLinkOpen(true)}
                className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                {session.meetingLink ? "Edit meeting link" : "Add meeting link"}
              </button>
              <button
                onClick={() => openMomDialog("complete")}
                disabled={busy || !sessionStarted}
                title={
                  sessionStarted
                    ? undefined
                    : "You can complete this session once it has started."
                }
                className="rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
              >
                Add notes &amp; complete
              </button>
              {!sessionEnded && (
                <button
                  onClick={() => setShowCancel(true)}
                  disabled={busy}
                  className="rounded-lg border border-red-200 px-3 py-1.5 text-sm font-semibold text-red-600 hover:bg-red-50 disabled:opacity-60"
                >
                  Cancel
                </button>
              )}
            </div>
          )}
        </div>
      )}

      <ConfirmDialog
        isOpen={showCancel}
        onClose={() => setShowCancel(false)}
        onConfirm={() => run(() => expertApi.cancelSession(id))}
        title="Cancel session?"
        message="The client will be notified that this session was cancelled."
        confirmLabel="Cancel session"
        cancelLabel="Keep session"
        variant="danger"
        loading={busy}
      />

      <ConfirmDialog
        isOpen={showDecline}
        onClose={() => setShowDecline(false)}
        onConfirm={() =>
          run(() => expertApi.respondSession(id, { action: "DECLINE" }))
        }
        title="Decline this session?"
        message="The client will be notified and, if they've paid, a manual refund will be required."
        confirmLabel="Decline"
        cancelLabel="Back"
        variant="danger"
        loading={busy}
      />

      <Modal
        isOpen={momOpen}
        onClose={() => setMomOpen(false)}
        title={
          momMode === "complete"
            ? "Add session notes to complete"
            : "Edit session notes"
        }
        size="md"
      >
        <p className="text-sm text-slate-600">
          {momMode === "complete"
            ? "Summarize what you covered and any next steps — the parent will see this once the session is complete."
            : "Update your minutes of meeting for this session."}
        </p>
        <textarea
          rows={6}
          value={momText}
          onChange={(e) => setMomText(e.target.value)}
          placeholder="What did you cover? Any homework or next steps for the player?"
          className="mt-3 w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm transition-all focus:border-power-orange focus:bg-white focus:outline-none focus:ring-2 focus:ring-power-orange/20"
        />
        <p className="mt-1 text-xs text-slate-400">
          {momText.trim().length}/{MOM_MIN_LENGTH} characters minimum
        </p>
        <div className="mt-4 flex justify-end gap-2">
          <button
            onClick={() => setMomOpen(false)}
            className="rounded-lg px-4 py-2 text-sm font-semibold text-slate-500 hover:text-slate-800"
          >
            Cancel
          </button>
          <button
            onClick={submitMom}
            disabled={busy || momText.trim().length < MOM_MIN_LENGTH}
            className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
          >
            {momMode === "complete" ? "Complete session" : "Save notes"}
          </button>
        </div>
      </Modal>
    </div>
  );
}
