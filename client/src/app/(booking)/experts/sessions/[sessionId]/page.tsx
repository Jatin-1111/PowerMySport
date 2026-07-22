"use client";

import { SlotPicker } from "@/modules/expert/components/SlotPicker";
import {
    expertApi,
    type ExpertSession,
} from "@/modules/expert/services/expert";
import { formatSessionTimeWithZone } from "@/modules/expert/utils/time";
import { ConfirmDialog } from "@/modules/shared/ui/ConfirmDialog";
import {
    ArrowLeft,
    CalendarClock,
    CheckCircle2,
    Clock,
    Star,
    XCircle,
} from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

const formatInr = (n: number) => `₹${Number(n || 0).toLocaleString("en-IN")}`;

export default function ExpertSessionPage() {
  const params = useParams();
  const sessionId = String(params?.sessionId || "");

  const [session, setSession] = useState<ExpertSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [reviewText, setReviewText] = useState("");
  const [anonymous, setAnonymous] = useState(false);
  const [rescheduleOpen, setRescheduleOpen] = useState(false);
  const [newSlot, setNewSlot] = useState<string | null>(null);
  const [showCancel, setShowCancel] = useState(false);

  const init = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      await expertApi.reconcileSession(sessionId).catch(() => undefined);
      const res = await expertApi.getSession(sessionId);
      if (res.success && res.data) setSession(res.data);
      else setError(res.message || "Session not found.");
    } catch {
      setError("Failed to load session.");
    } finally {
      setLoading(false);
    }
  }, [sessionId]);

  useEffect(() => {
    if (sessionId) init();
  }, [sessionId, init]);

  const handleReschedule = async () => {
    if (!newSlot) {
      toast.error("Please pick a new time.");
      return;
    }
    setSaving(true);
    try {
      const res = await expertApi.scheduleSession(sessionId, {
        scheduledAt: newSlot,
      });
      if (res.success && res.data) {
        setSession(res.data);
        setRescheduleOpen(false);
        setNewSlot(null);
        toast.success("Session scheduled!");
      } else {
        toast.error(res.message || "Could not schedule.");
      }
    } catch (err: unknown) {
      toast.error(
        (err as { response?: { data?: { message?: string } } })?.response?.data
          ?.message || "Could not schedule the session.",
      );
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = async () => {
    setSaving(true);
    try {
      const res = await expertApi.cancelSession(sessionId);
      if (res.success && res.data) {
        setSession(res.data);
        toast.success("Session cancelled.");
      } else {
        toast.error(res.message || "Could not cancel.");
      }
    } catch (err: unknown) {
      toast.error(
        (err as { response?: { data?: { message?: string } } })?.response?.data
          ?.message || "Could not cancel the session.",
      );
    } finally {
      setSaving(false);
      setShowCancel(false);
    }
  };

  const handleRetryPayment = async () => {
    if (!session || !session.scheduledAt) return;
    setSaving(true);
    try {
      const res = await expertApi.initiateSession(session.expertId, {
        scheduledAt: session.scheduledAt,
        mode: session.mode,
        clientNote: session.clientNote,
      });
      if (res.success && res.data?.redirectUrl) {
        window.location.href = res.data.redirectUrl;
      } else {
        toast.error(res.message || "Could not start payment.");
        setSaving(false);
      }
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data
          ?.message || "This slot was taken or is no longer available.";
      toast.error(msg);
      setSaving(false);
    }
  };

  const handleReview = async () => {
    if (rating < 1) {
      toast.error("Please select a rating.");
      return;
    }
    setSaving(true);
    try {
      const res = await expertApi.reviewSession(sessionId, {
        rating,
        review: reviewText.trim() || undefined,
        anonymous,
      });
      if (res.success && res.data) {
        setSession(res.data);
        toast.success("Thanks for your review!");
      } else {
        toast.error(res.message || "Could not submit review.");
      }
    } catch {
      toast.error("Could not submit the review.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center text-slate-500">
        Confirming your session...
      </div>
    );
  }

  if (error || !session) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-20 text-center">
        <p className="font-semibold text-red-600">{error || "Not found."}</p>
        <Link
          href="/experts"
          className="mt-4 inline-flex items-center gap-2 rounded-lg bg-power-orange px-5 py-2.5 text-sm font-semibold text-white hover:bg-orange-600"
        >
          <ArrowLeft className="h-4 w-4" /> Back to experts
        </Link>
      </div>
    );
  }

  const paid = session.paymentStatus === "COMPLETED";
  const expertName = session.expert?.name || "your expert";
  const canManage = ["PAID", "SCHEDULED"].includes(session.status);

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-2xl px-6 py-10">
        <Link
          href="/experts/sessions"
          className="mb-6 inline-flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-power-orange"
        >
          <ArrowLeft className="h-4 w-4" /> My sessions
        </Link>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          {session.status === "CANCELLED" ? (
            <div className="mb-4 flex flex-col items-start gap-3 rounded-lg bg-red-50 px-4 py-4 text-sm font-semibold text-red-700 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-2">
                <XCircle className="h-5 w-5" /> Session cancelled
                {session.refundStatus === "REQUIRED"
                  ? " · refund pending"
                  : session.refundStatus === "MANUAL_DONE"
                    ? " · refunded"
                    : session.cancelReason === "Payment failed"
                      ? " · payment failed"
                      : ""}
              </div>
              {session.cancelReason === "Payment failed" && (
                <button
                  onClick={handleRetryPayment}
                  disabled={saving}
                  className="rounded bg-red-100 px-3 py-1.5 text-xs font-bold text-red-800 transition-colors hover:bg-red-200 disabled:opacity-50"
                >
                  {saving ? "Retrying..." : "Retry Payment"}
                </button>
              )}
            </div>
          ) : paid ? (
            <div className="mb-4 flex items-center gap-2 rounded-lg bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">
              <CheckCircle2 className="h-5 w-5" /> Payment received ·{" "}
              {formatInr(session.amount)}
            </div>
          ) : (
            <div className="mb-4 flex items-center gap-2 rounded-lg bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-700">
              <Clock className="h-5 w-5" /> Payment{" "}
              {session.paymentStatus.toLowerCase()}
            </div>
          )}

          <h1 className="font-title text-xl font-bold text-slate-900">
            Session with {expertName}
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Status: {session.status.replace(/_/g, " ")}
          </p>

          {/* Expert confirmation status */}
          {["PAID", "SCHEDULED"].includes(session.status) &&
            (session.expertAcceptance === "ACCEPTED" ? (
              <p className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                <CheckCircle2 className="h-3.5 w-3.5" /> Confirmed by your
                expert
              </p>
            ) : (
              <p className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700">
                <Clock className="h-3.5 w-3.5" /> Awaiting expert confirmation
              </p>
            ))}

          {/* Scheduled time + meeting link */}
          {session.scheduledAt && session.status !== "CANCELLED" && (
            <div className="mt-6 rounded-xl bg-slate-50 p-4">
              <p className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                <CalendarClock className="h-4 w-4 text-power-orange" />{" "}
                {session.status === "COMPLETED" ? "Session time" : "Scheduled"}
              </p>
              <p className="mt-1 text-sm text-slate-700">
                {formatSessionTimeWithZone(
                  session.scheduledAt,
                  session.expertTimezone,
                )}
                {session.mode
                  ? ` · ${session.mode === "ONLINE" ? "Online" : "In-person"}`
                  : ""}
              </p>
              {session.mode === "ONLINE" ? (
                session.meetingLink ? (
                  <a
                    href={session.meetingLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-2 inline-block text-sm font-semibold text-power-orange hover:underline"
                  >
                    Join meeting link
                  </a>
                ) : (
                  session.status === "SCHEDULED" && (
                    <p className="mt-2 text-xs text-slate-500">
                      Your expert will add a meeting link before the session.
                    </p>
                  )
                )
              ) : session.mode === "IN_PERSON" ? (
                session.inPersonAddress ? (
                  <p className="mt-2 text-sm text-slate-700">
                    <span className="font-semibold">Location:</span>{" "}
                    {session.inPersonAddress}
                  </p>
                ) : (
                  session.status === "SCHEDULED" && (
                    <p className="mt-2 text-xs text-slate-500">
                      Your expert hasn&apos;t shared a location yet — check back
                      closer to your session.
                    </p>
                  )
                )
              ) : null}
            </div>
          )}

          {/* What was shared with the expert */}
          {(session.player || session.clientNote) && (
            <div className="mt-4 rounded-xl bg-slate-50 p-4">
              <p className="text-sm font-semibold text-slate-900">
                Shared with your expert
              </p>
              {session.player && (
                <p className="mt-1 text-sm text-slate-700">
                  {session.player.name}&apos;s sport profile
                  {session.player.topSportMatch
                    ? ` — best fit: ${session.player.topSportMatch.sport}`
                    : ""}
                </p>
              )}
              {session.clientNote && (
                <p className="mt-1 text-sm italic text-slate-600">
                  “{session.clientNote}”
                </p>
              )}
            </div>
          )}

          {/* Reschedule + cancel */}
          {canManage && (
            <div className="mt-6 border-t border-slate-100 pt-6">
              {!rescheduleOpen ? (
                <div className="flex flex-wrap gap-3">
                  <button
                    onClick={() => setRescheduleOpen(true)}
                    className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    {session.scheduledAt ? "Reschedule" : "Pick a time"}
                  </button>
                  <button
                    onClick={() => setShowCancel(true)}
                    disabled={saving}
                    className="rounded-lg border border-red-200 px-4 py-2 text-sm font-semibold text-red-600 hover:bg-red-50 disabled:opacity-60"
                  >
                    Cancel session
                  </button>
                </div>
              ) : (
                <div>
                  <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                    <CalendarClock className="h-4 w-4 text-power-orange" /> Pick
                    a new time
                  </h2>
                  <SlotPicker
                    expertId={session.expertId}
                    value={newSlot}
                    onChange={setNewSlot}
                    timezone={session.expertTimezone}
                    className="mt-3"
                  />
                  <div className="mt-3 flex gap-2">
                    <button
                      onClick={handleReschedule}
                      disabled={saving || !newSlot}
                      className="rounded-lg bg-power-orange px-6 py-2 text-sm font-semibold text-white hover:bg-orange-600 disabled:opacity-60"
                    >
                      {saving ? "Saving..." : "Confirm time"}
                    </button>
                    <button
                      onClick={() => {
                        setRescheduleOpen(false);
                        setNewSlot(null);
                      }}
                      className="rounded-lg px-4 py-2 text-sm font-semibold text-slate-500 hover:text-slate-800"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Review */}
          {session.status === "COMPLETED" && !session.reviewed && (
            <div className="mt-6 border-t border-slate-100 pt-6">
              <h2 className="text-sm font-semibold text-slate-900">
                Rate your session
              </h2>
              <div
                className="mt-2 flex gap-1"
                onMouseLeave={() => setHoverRating(0)}
              >
                {Array.from({ length: 5 }).map((_, i) => {
                  const active = i < (hoverRating || rating);
                  return (
                    <button
                      key={i}
                      type="button"
                      onClick={() => setRating(i + 1)}
                      onMouseEnter={() => setHoverRating(i + 1)}
                      aria-label={`${i + 1} star`}
                    >
                      <Star
                        className={`h-8 w-8 transition-colors ${active ? "fill-amber-500 text-amber-500" : "text-slate-300 hover:text-amber-300"}`}
                      />
                    </button>
                  );
                })}
              </div>
              <textarea
                rows={3}
                value={reviewText}
                onChange={(e) => setReviewText(e.target.value)}
                placeholder="Share how the session went (optional)"
                className="mt-3 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
              <label className="mt-2 flex items-center gap-2 text-sm text-slate-600">
                <input
                  type="checkbox"
                  checked={anonymous}
                  onChange={(e) => setAnonymous(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 text-power-orange focus:ring-power-orange"
                />
                Post anonymously
              </label>
              <button
                onClick={handleReview}
                disabled={saving}
                className="mt-3 rounded-lg bg-power-orange px-6 py-2 text-sm font-semibold text-white hover:bg-orange-600 disabled:opacity-60"
              >
                {saving ? "Submitting..." : "Submit review"}
              </button>
            </div>
          )}

          {session.status === "COMPLETED" && session.reviewed && (
            <div className="mt-6 flex items-center gap-2 rounded-lg bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">
              <CheckCircle2 className="h-5 w-5" /> Thanks — your review has been
              recorded.
            </div>
          )}
        </div>
      </div>

      <ConfirmDialog
        isOpen={showCancel}
        onClose={() => setShowCancel(false)}
        onConfirm={handleCancel}
        title="Cancel session?"
        message="If you've paid, a refund will be initiated to your original payment method. This can't be undone."
        confirmLabel="Cancel session"
        cancelLabel="Keep session"
        variant="danger"
        loading={saving}
      />
    </div>
  );
}
