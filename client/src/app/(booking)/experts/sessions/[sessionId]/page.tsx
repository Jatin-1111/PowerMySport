"use client";

import { SlotPicker } from "@/modules/expert/components/SlotPicker";
import {
    expertApi,
    type ExpertSession,
} from "@/modules/expert/services/expert";
import { formatSessionTimeWithZone } from "@/modules/expert/utils/time";
import { Button } from "@/modules/shared/ui/Button";
import { Card } from "@/modules/shared/ui/Card";
import { ConfirmDialog } from "@/modules/shared/ui/ConfirmDialog";
import { Skeleton } from "@/modules/shared/ui/Skeleton";
import { FadeIn } from "@/modules/shared/ui/motion/FadeIn";
import { SlideUp } from "@/modules/shared/ui/motion/SlideUp";
import { cn } from "@/utils/cn";
import {
    ArrowLeft,
    CalendarClock,
    CheckCircle2,
    Clock,
    MapPin,
    MessageSquareText,
    RefreshCcw,
    ShieldCheck,
    Sparkles,
    Star,
    Target,
    Users,
    Video,
    XCircle,
} from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

const formatInr = (n: number) => `₹${Number(n || 0).toLocaleString("en-IN")}`;

function ExpertAvatar({
  photoUrl,
  name,
}: {
  photoUrl?: string;
  name: string;
}) {
  const [failed, setFailed] = useState(false);
  const initial = (name || "E").charAt(0).toUpperCase();
  if (!photoUrl || failed) {
    return (
      <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full border-4 border-white/10 bg-white/10 text-2xl font-bold text-white/70">
        {initial}
      </div>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={photoUrl}
      alt={name}
      onError={() => setFailed(true)}
      className="h-16 w-16 shrink-0 rounded-full border-4 border-white/10 object-cover"
    />
  );
}

function SessionDetailSkeleton() {
  return (
    <div className="min-h-screen bg-[#F4F3F0]">
      <div className="mx-auto max-w-2xl px-6 py-10">
        <Skeleton className="mb-6 h-5 w-28" />
        <Card className="overflow-hidden border-0 bg-white p-0 shadow-[0_2px_16px_rgb(0,0,0,0.06)]">
          <Skeleton className="h-28 w-full rounded-none" />
          <div className="space-y-4 p-6">
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="h-20 w-full rounded-xl" />
            <Skeleton className="h-11 w-full rounded-lg" />
          </div>
        </Card>
      </div>
    </div>
  );
}

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

  if (loading) return <SessionDetailSkeleton />;

  if (error || !session) {
    return (
      <div className="min-h-screen bg-[#F4F3F0]">
        <div className="mx-auto max-w-2xl px-6 py-20 text-center">
          <p className="font-semibold text-red-600">{error || "Not found."}</p>
          <Link
            href="/experts"
            className="mt-4 inline-flex items-center gap-2 rounded-lg bg-power-orange px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-orange-600"
          >
            <ArrowLeft className="h-4 w-4" /> Back to experts
          </Link>
        </div>
      </div>
    );
  }

  const paid = session.paymentStatus === "COMPLETED";
  const expertName = session.expert?.name || "your expert";
  const canManage = ["PAID", "SCHEDULED"].includes(session.status);
  const cancelled = session.status === "CANCELLED";

  const statusBanner = cancelled
    ? {
        icon: XCircle,
        classes: "bg-red-50 text-red-700",
        iconClasses: "bg-red-100 text-red-600",
        title: "Session cancelled",
        subtitle:
          session.refundStatus === "REQUIRED"
            ? "Refund pending"
            : session.refundStatus === "MANUAL_DONE"
              ? "Refunded"
              : session.cancelReason === "Payment failed"
                ? "Payment failed"
                : session.cancelReason,
      }
    : paid
      ? {
          icon: CheckCircle2,
          classes: "bg-emerald-50 text-emerald-700",
          iconClasses: "bg-emerald-100 text-emerald-600",
          title: "Payment received",
          subtitle: formatInr(session.amount),
        }
      : {
          icon: Clock,
          classes: "bg-amber-50 text-amber-700",
          iconClasses: "bg-amber-100 text-amber-600",
          title: `Payment ${session.paymentStatus.toLowerCase()}`,
          subtitle: undefined,
        };

  return (
    <div className="min-h-screen bg-[#F4F3F0]">
      <div className="mx-auto max-w-2xl px-6 py-10">
        <Link
          href="/experts/sessions"
          className="mb-6 inline-flex items-center gap-2 text-sm font-semibold text-slate-500 transition-colors hover:text-power-orange"
        >
          <ArrowLeft className="h-4 w-4" /> My sessions
        </Link>

        <SlideUp>
          <Card className="overflow-hidden border-0 bg-white p-0 shadow-[0_2px_16px_rgb(0,0,0,0.06)]">
            {/* Dark hero strip — consistent with the expert profile page */}
            <div className="relative overflow-hidden bg-gradient-to-br from-slate-900 to-slate-800 px-6 py-7 text-white sm:px-8">
              <div className="pointer-events-none absolute -right-14 -top-14 h-44 w-44 rounded-full bg-power-orange/20 blur-3xl" />
              <div className="relative flex items-center gap-4">
                <ExpertAvatar
                  photoUrl={session.expert?.photoUrl}
                  name={expertName}
                />
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold uppercase tracking-wide text-white/60">
                    Session with
                  </p>
                  <h1 className="font-title truncate text-xl font-bold sm:text-2xl">
                    {expertName}
                  </h1>
                  <span
                    className={cn(
                      "mt-1.5 inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide ring-1 ring-inset ring-white/20",
                      "bg-white/10 text-white/90",
                    )}
                  >
                    {session.status.replace(/_/g, " ")}
                  </span>
                </div>
                <div className="hidden shrink-0 text-right sm:block">
                  <p className="text-xs text-white/50">Amount</p>
                  <p className="text-lg font-bold">
                    {formatInr(session.amount)}
                  </p>
                </div>
              </div>
            </div>

            <div className="p-6 sm:p-8">
              {/* Payment / cancellation status */}
              <div
                className={cn(
                  "flex flex-col gap-3 rounded-xl px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between",
                  statusBanner.classes,
                )}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={cn(
                      "flex h-9 w-9 shrink-0 items-center justify-center rounded-full",
                      statusBanner.iconClasses,
                    )}
                  >
                    <statusBanner.icon className="h-4.5 w-4.5" />
                  </div>
                  <div>
                    <p className="text-sm font-bold">{statusBanner.title}</p>
                    {statusBanner.subtitle && (
                      <p className="text-xs font-medium opacity-80">
                        {statusBanner.subtitle}
                      </p>
                    )}
                  </div>
                </div>
                {cancelled && session.cancelReason === "Payment failed" && (
                  <Button
                    onClick={handleRetryPayment}
                    disabled={saving}
                    loading={saving}
                    size="sm"
                    variant="danger"
                    icon={<RefreshCcw className="h-3.5 w-3.5" />}
                  >
                    Retry payment
                  </Button>
                )}
              </div>

              {/* Expert confirmation status */}
              {["PAID", "SCHEDULED"].includes(session.status) && (
                <div className="mt-3">
                  {session.expertAcceptance === "ACCEPTED" ? (
                    <p className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 ring-1 ring-inset ring-emerald-100">
                      <CheckCircle2 className="h-3.5 w-3.5" /> Confirmed by
                      your expert
                    </p>
                  ) : (
                    <p className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700 ring-1 ring-inset ring-amber-100">
                      <Clock className="h-3.5 w-3.5" /> Awaiting expert
                      confirmation
                    </p>
                  )}
                </div>
              )}

              {/* Scheduled time + meeting link */}
              {session.scheduledAt && !cancelled && (
                <FadeIn delay={0.05}>
                  <div className="mt-5 rounded-xl bg-slate-50 p-4">
                    <div className="flex items-center gap-2.5">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-power-orange/10">
                        <CalendarClock className="h-4 w-4 text-power-orange" />
                      </div>
                      <p className="text-sm font-bold text-slate-900">
                        {session.status === "COMPLETED"
                          ? "Session time"
                          : "Scheduled"}
                      </p>
                    </div>
                    <p className="mt-2 text-sm font-medium text-slate-700">
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
                          className="mt-2.5 inline-flex items-center gap-1.5 text-sm font-semibold text-power-orange hover:underline"
                        >
                          <Video className="h-3.5 w-3.5" /> Join meeting link
                        </a>
                      ) : (
                        session.status === "SCHEDULED" && (
                          <p className="mt-2 text-xs text-slate-500">
                            Your expert will add a meeting link before the
                            session.
                          </p>
                        )
                      )
                    ) : session.mode === "IN_PERSON" ? (
                      session.inPersonAddress ? (
                        <p className="mt-2 flex items-start gap-1.5 text-sm text-slate-700">
                          <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" />
                          {session.inPersonAddress}
                        </p>
                      ) : (
                        session.status === "SCHEDULED" && (
                          <p className="mt-2 text-xs text-slate-500">
                            Your expert hasn&apos;t shared a location yet —
                            check back closer to your session.
                          </p>
                        )
                      )
                    ) : null}
                  </div>
                </FadeIn>
              )}

              {/* What was shared with the expert */}
              {(session.player || session.clientNote) && (
                <FadeIn delay={0.1}>
                  <div className="mt-3 rounded-xl bg-slate-50 p-4">
                    <div className="flex items-center gap-2.5">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-power-orange/10">
                        <Users className="h-4 w-4 text-power-orange" />
                      </div>
                      <p className="text-sm font-bold text-slate-900">
                        Shared with your expert
                      </p>
                    </div>
                    {session.player && (
                      <p className="mt-2 flex items-center gap-1.5 text-sm text-slate-700">
                        <Target className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                        {session.player.name}&apos;s sport profile
                        {session.player.topSportMatch
                          ? ` — best fit: ${session.player.topSportMatch.sport}`
                          : ""}
                      </p>
                    )}
                    {session.clientNote && (
                      <p className="mt-2 flex items-start gap-1.5 text-sm italic leading-relaxed text-slate-600">
                        <MessageSquareText className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" />
                        &ldquo;{session.clientNote}&rdquo;
                      </p>
                    )}
                  </div>
                </FadeIn>
              )}

              {/* Reschedule + cancel */}
              {canManage && (
                <div className="mt-6 border-t border-slate-100 pt-6">
                  {!rescheduleOpen ? (
                    <div className="flex flex-wrap gap-3">
                      <button
                        onClick={() => setRescheduleOpen(true)}
                        className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition-colors hover:border-slate-300 hover:bg-slate-50"
                      >
                        {session.scheduledAt ? "Reschedule" : "Pick a time"}
                      </button>
                      <button
                        onClick={() => setShowCancel(true)}
                        disabled={saving}
                        className="rounded-lg border border-red-200 px-4 py-2 text-sm font-semibold text-red-600 transition-colors hover:bg-red-50 disabled:opacity-60"
                      >
                        Cancel session
                      </button>
                    </div>
                  ) : (
                    <div>
                      <h2 className="flex items-center gap-2 text-sm font-bold text-slate-900">
                        <CalendarClock className="h-4 w-4 text-power-orange" />{" "}
                        Pick a new time
                      </h2>
                      <SlotPicker
                        expertId={session.expertId}
                        value={newSlot}
                        onChange={setNewSlot}
                        timezone={session.expertTimezone}
                        className="mt-3"
                      />
                      <div className="mt-4 flex gap-2">
                        <Button
                          onClick={handleReschedule}
                          disabled={saving || !newSlot}
                          loading={saving}
                          size="sm"
                        >
                          Confirm time
                        </Button>
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
                  <h2 className="flex items-center gap-2 text-sm font-bold text-slate-900">
                    <Sparkles className="h-4 w-4 text-power-orange" /> Rate
                    your session
                  </h2>
                  <div
                    className="mt-3 flex gap-1.5"
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
                          className="transition-transform hover:scale-110"
                        >
                          <Star
                            className={cn(
                              "h-9 w-9 transition-colors",
                              active
                                ? "fill-amber-500 text-amber-500"
                                : "text-slate-200 hover:text-amber-300",
                            )}
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
                    className="mt-4 w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm transition-all focus:border-power-orange focus:bg-white focus:outline-none focus:ring-2 focus:ring-power-orange/20"
                  />
                  <label className="mt-3 flex items-center gap-2 text-sm text-slate-600">
                    <input
                      type="checkbox"
                      checked={anonymous}
                      onChange={(e) => setAnonymous(e.target.checked)}
                      className="h-4 w-4 rounded border-slate-300 text-power-orange focus:ring-power-orange"
                    />
                    Post anonymously
                  </label>
                  <Button
                    onClick={handleReview}
                    disabled={saving}
                    loading={saving}
                    className="mt-4"
                  >
                    Submit review
                  </Button>
                </div>
              )}

              {session.status === "COMPLETED" && session.reviewed && (
                <div className="mt-6 flex items-center gap-3 rounded-xl bg-emerald-50 px-4 py-3.5">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
                    <CheckCircle2 className="h-4.5 w-4.5" />
                  </div>
                  <p className="text-sm font-semibold text-emerald-700">
                    Thanks — your review has been recorded.
                  </p>
                </div>
              )}
            </div>
          </Card>
        </SlideUp>

        <FadeIn delay={0.15}>
          <p className="mt-5 flex items-center justify-center gap-1.5 text-xs text-slate-400">
            <ShieldCheck className="h-3.5 w-3.5" /> Secure payment via PhonePe
          </p>
        </FadeIn>
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
