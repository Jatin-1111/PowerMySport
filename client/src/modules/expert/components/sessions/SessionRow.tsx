"use client";

import { SlotPicker } from "@/modules/expert/components/SlotPicker";
import { expertApi, type ExpertSession } from "@/modules/expert/services/expert";
import {
  isActive,
  modeLabel,
  needsResponse,
  sessionKey,
  sessionStatusView,
  sessionTitle,
  whenLabel,
} from "@/modules/expert/utils/sessions";
import { toast } from "@/lib/toast";
import { FIELD_INPUT } from "@/modules/shared/components/settings/ProfileSection";
import { Button } from "@/modules/shared/ui/Button";
import { ConfirmDialog } from "@/modules/shared/ui/ConfirmDialog";
import { Modal } from "@/modules/shared/ui/Modal";
import { StatusTag } from "@/modules/shared/ui/StatusTag";
import { TEXT_LINK } from "@/modules/shared/ui/textLink";
import { formatRupees } from "@/modules/shared/utils/figures";
import { cn } from "@/utils/cn";
import Link from "next/link";
import { useState } from "react";
import { playerBriefLine, playerTraits } from "./playerBrief";

export const MOM_MIN_LENGTH = 20;

const ACTION = `${TEXT_LINK} min-h-11 text-sm disabled:opacity-50`;

/**
 * One session as a ruled row: when and who, what it pays and where it stands,
 * then only the actions that apply. A session waiting on the expert leads with
 * the three answers (accept, suggest another time, decline); a confirmed one
 * offers the meeting link and completing it with notes. Nothing is a card.
 */
export function SessionRow({
  session,
  onChange,
  onBand = false,
}: {
  session: ExpertSession;
  onChange: (s: ExpertSession) => void;
  /** True when the row sits on the tonal requests band, where the rules are darker. */
  onBand?: boolean;
}) {
  const [busy, setBusy] = useState(false);
  // Read once when the row mounts: the server enforces both gates again on the action.
  const [now] = useState(() => Date.now());
  const [linkOpen, setLinkOpen] = useState(false);
  const [link, setLink] = useState(session.meetingLink || "");
  const [showCancel, setShowCancel] = useState(false);
  const [showDecline, setShowDecline] = useState(false);
  const [rescheduleOpen, setRescheduleOpen] = useState(false);
  const [newSlot, setNewSlot] = useState<string | null>(null);
  const [momOpen, setMomOpen] = useState(false);
  const [momMode, setMomMode] = useState<"complete" | "edit">("complete");
  const [momText, setMomText] = useState(session.momNotes || "");

  const id = sessionKey(session);
  const status = sessionStatusView(session);
  const canManage = isActive(session);
  const awaiting = needsResponse(session);
  const modeText = modeLabel(session.mode);
  const brief = session.player ? playerBriefLine(session.player) : "";
  const traits = session.player ? playerTraits(session.player) : [];
  // Mirrors completeExpertSession's server-side gate: can't complete before the session starts.
  const sessionStarted = Boolean(
    session.scheduledAt && new Date(session.scheduledAt).getTime() <= now
  );
  // Mirrors cancelExpertSession's server-side gate: can't cancel once it's over.
  const sessionEnded = Boolean(
    session.scheduledAt &&
    new Date(session.scheduledAt).getTime() + (session.durationMinutes || 60) * 60_000 < now
  );

  const run = async (
    fn: () => Promise<{ success: boolean; message: string; data?: ExpertSession }>,
    done: string
  ) => {
    setBusy(true);
    try {
      const res = await fn();
      if (res.success && res.data) {
        onChange(res.data);
        toast.success(done);
      } else {
        toast.error(res.message || "We could not do that. Try again.");
      }
    } catch (err: unknown) {
      toast.error(
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
          "We could not do that. Try again."
      );
    } finally {
      setBusy(false);
    }
  };

  const saveLink = async () => {
    if (link && !/^https?:\/\//i.test(link)) {
      toast.error("Enter a valid link starting with https://");
      return;
    }
    await run(() => expertApi.setMeetingLink(id, link.trim()), "Meeting link saved.");
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
      toast.error(`Add at least ${MOM_MIN_LENGTH} characters.`);
      return;
    }
    await run(
      () =>
        momMode === "complete"
          ? expertApi.completeSession(id, trimmed)
          : expertApi.updateSessionMom(id, trimmed),
      momMode === "complete" ? "Session completed." : "Notes saved."
    );
    setMomOpen(false);
  };

  const saveReschedule = async () => {
    if (!newSlot) {
      toast.error("Pick a new time first.");
      return;
    }
    await run(
      () => expertApi.respondSession(id, { action: "RESCHEDULE", scheduledAt: newSlot }),
      "New time proposed."
    );
    setRescheduleOpen(false);
    setNewSlot(null);
  };

  return (
    <li
      className={cn(
        "border-t py-6 first:border-t-0 first:pt-0",
        onBand ? "border-ink/15" : "border-hairline"
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-2">
        <div className="min-w-0">
          <p className="text-ink font-medium tabular-nums">{whenLabel(session)}</p>
          <p className="text-ink mt-0.5">{sessionTitle(session)}</p>
          <p className="text-ink-body text-sm">
            {[
              session.player && session.clientName ? `Booked by ${session.clientName}` : "",
              modeText,
              session.expertTimezone || "",
            ]
              .filter(Boolean)
              .join(", ")}
          </p>
        </div>
        <div className="flex items-center gap-4">
          <p className="text-ink font-medium tabular-nums">{formatRupees(session.amount)}</p>
          <StatusTag tone={status.tone}>{status.tag}</StatusTag>
        </div>
      </div>

      {session.player && (brief || traits.length > 0) && (
        <div className="text-ink-body mt-3 max-w-[64ch] text-sm">
          {brief && <p>{brief}</p>}
          {traits.length > 0 && <p className="mt-1 text-pretty">{traits.join(", ")}</p>}
          <p className="mt-1">
            <Link href={`/expert/sessions/${id}`} className={`${TEXT_LINK} ring-offset-paper`}>
              View full child profile
            </Link>
          </p>
        </div>
      )}

      {session.clientNote && (
        <p className="text-ink-body border-ink/20 mt-3 max-w-[64ch] text-pretty border-l-2 pl-4 text-sm">
          <span className="mb-0.5 block">Note from the parent</span>
          {session.clientNote}
        </p>
      )}

      {session.reviewed && session.rating ? (
        <p className="text-ink-body mt-3 text-sm">
          Review: {session.rating} out of 5{session.review ? `, "${session.review}"` : ""}
        </p>
      ) : null}

      {session.status === "COMPLETED" && (
        <div className="mt-3 max-w-[64ch] text-sm">
          <div className="flex flex-wrap items-center gap-x-4">
            <p className="text-ink font-medium">Session notes</p>
            <button type="button" onClick={() => openMomDialog("edit")} className={ACTION}>
              Edit notes
            </button>
          </div>
          {session.momNotes && <p className="text-ink-body text-pretty">{session.momNotes}</p>}
        </div>
      )}

      {awaiting &&
        (rescheduleOpen ? (
          <div className="mt-5">
            <p className="text-ink mb-3 font-medium">Suggest a new time</p>
            <SlotPicker
              expertId={session.expertId}
              value={newSlot}
              onChange={setNewSlot}
              timezone={session.expertTimezone}
            />
            <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2">
              <Button onClick={saveReschedule} disabled={busy || !newSlot} className="min-h-11">
                Send new time
              </Button>
              <button
                type="button"
                className={ACTION}
                onClick={() => {
                  setRescheduleOpen(false);
                  setNewSlot(null);
                }}
              >
                Back
              </button>
            </div>
          </div>
        ) : (
          <div className="mt-5">
            <p className="text-ink-body mb-3 text-sm">
              The parent is waiting for you to confirm this time.
            </p>
            <div className="flex flex-wrap items-center gap-x-6 gap-y-1">
              <Button
                size="sm"
                variant="secondary"
                className="min-h-11"
                disabled={busy}
                onClick={() =>
                  run(() => expertApi.respondSession(id, { action: "ACCEPT" }), "Time accepted.")
                }
              >
                Accept time
              </Button>
              <button
                type="button"
                className={ACTION}
                disabled={busy}
                onClick={() => setRescheduleOpen(true)}
              >
                Suggest another time
              </button>
              <button
                type="button"
                className={ACTION}
                disabled={busy}
                onClick={() => setShowDecline(true)}
              >
                Decline
              </button>
            </div>
          </div>
        ))}

      {canManage && !awaiting && (
        <div className="mt-4">
          {linkOpen ? (
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <label htmlFor={`meeting-link-${id}`} className="sr-only">
                Meeting link
              </label>
              <input
                id={`meeting-link-${id}`}
                type="url"
                value={link}
                onChange={(e) => setLink(e.target.value)}
                placeholder="https://meet.google.com/..."
                className={cn(FIELD_INPUT, "sm:max-w-md")}
              />
              <div className="flex items-center gap-x-6">
                <Button size="sm" onClick={saveLink} disabled={busy} className="min-h-11">
                  Save link
                </Button>
                <button type="button" className={ACTION} onClick={() => setLinkOpen(false)}>
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-x-6 gap-y-1">
              <Button
                size="sm"
                variant="secondary"
                className="min-h-11"
                disabled={busy || !sessionStarted}
                title={
                  sessionStarted ? undefined : "You can complete this session once it has started."
                }
                onClick={() => openMomDialog("complete")}
              >
                Add notes and complete
              </Button>
              <button type="button" className={ACTION} onClick={() => setLinkOpen(true)}>
                {session.meetingLink ? "Edit meeting link" : "Add meeting link"}
              </button>
              {!sessionEnded && (
                <button
                  type="button"
                  className={ACTION}
                  disabled={busy}
                  onClick={() => setShowCancel(true)}
                >
                  Cancel session
                </button>
              )}
            </div>
          )}
          {session.meetingLink && !linkOpen && (
            <p className="text-ink-body mt-1 truncate text-sm">{session.meetingLink}</p>
          )}
        </div>
      )}

      <ConfirmDialog
        isOpen={showCancel}
        onClose={() => setShowCancel(false)}
        onConfirm={() => run(() => expertApi.cancelSession(id), "Session cancelled.")}
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
          run(() => expertApi.respondSession(id, { action: "DECLINE" }), "Session declined.")
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
        title={momMode === "complete" ? "Add session notes to complete" : "Edit session notes"}
        size="md"
      >
        <p className="text-ink-body text-sm">
          {momMode === "complete"
            ? "Summarize what you covered and any next steps. The parent will see this once the session is complete."
            : "Update your notes for this session."}
        </p>
        <label htmlFor={`mom-${id}`} className="sr-only">
          Session notes
        </label>
        <textarea
          id={`mom-${id}`}
          rows={6}
          value={momText}
          onChange={(e) => setMomText(e.target.value)}
          placeholder="What did you cover? Any homework or next steps for the player?"
          className={cn(FIELD_INPUT, "mt-3")}
        />
        <p className="text-ink-body mt-1.5 text-sm tabular-nums">
          {momText.trim().length} of {MOM_MIN_LENGTH} characters minimum
        </p>
        <div className="mt-5 flex flex-wrap items-center justify-end gap-x-6 gap-y-2">
          <button type="button" className={ACTION} onClick={() => setMomOpen(false)}>
            Cancel
          </button>
          <Button
            onClick={submitMom}
            disabled={busy || momText.trim().length < MOM_MIN_LENGTH}
            className="min-h-11"
          >
            {momMode === "complete" ? "Complete session" : "Save notes"}
          </Button>
        </div>
      </Modal>
    </li>
  );
}
