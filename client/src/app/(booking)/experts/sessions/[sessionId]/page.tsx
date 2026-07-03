"use client";

import {
  expertApi,
  type ExpertSession,
} from "@/modules/expert/services/expert";
import { toast } from "sonner";
import {
  ArrowLeft,
  CalendarClock,
  CheckCircle2,
  Clock,
  Star,
} from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

const formatInr = (n: number) => `₹${Number(n || 0).toLocaleString("en-IN")}`;

export default function ExpertSessionPage() {
  const params = useParams();
  const sessionId = String(params?.sessionId || "");

  const [session, setSession] = useState<ExpertSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [scheduledAt, setScheduledAt] = useState("");
  const [saving, setSaving] = useState(false);
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [reviewText, setReviewText] = useState("");

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

  const handleSchedule = async () => {
    if (!scheduledAt) {
      toast.error("Please pick a date and time.");
      return;
    }
    setSaving(true);
    try {
      const res = await expertApi.scheduleSession(sessionId, {
        scheduledAt: new Date(scheduledAt).toISOString(),
      });
      if (res.success && res.data) {
        setSession(res.data);
        toast.success("Session scheduled!");
      } else {
        toast.error(res.message || "Could not schedule.");
      }
    } catch {
      toast.error("Could not schedule the session.");
    } finally {
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
          {paid ? (
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

          <h1
            className="text-xl font-bold text-slate-900"
            style={{ fontFamily: "var(--font-syne)" }}
          >
            Session with {expertName}
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Status: {session.status.replace(/_/g, " ")}
          </p>

          {paid && session.status === "PAID" && (
            <div className="mt-6">
              <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                <CalendarClock className="h-4 w-4 text-power-orange" /> Pick a
                date &amp; time
              </h2>
              <div className="mt-3 flex flex-col gap-3 sm:flex-row">
                <input
                  type="datetime-local"
                  value={scheduledAt}
                  onChange={(e) => setScheduledAt(e.target.value)}
                  className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
                <button
                  onClick={handleSchedule}
                  disabled={saving}
                  className="rounded-lg bg-power-orange px-6 py-2 text-sm font-semibold text-white hover:bg-orange-600 disabled:opacity-60"
                >
                  {saving ? "Saving..." : "Schedule"}
                </button>
              </div>
            </div>
          )}

          {session.status === "SCHEDULED" && session.scheduledAt && (
            <div className="mt-6 rounded-xl bg-slate-50 p-4">
              <p className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                <CalendarClock className="h-4 w-4 text-power-orange" /> Scheduled
              </p>
              <p className="mt-1 text-sm text-slate-700">
                {new Date(session.scheduledAt).toLocaleString()}
              </p>
              {session.meetingLink && (
                <a
                  href={session.meetingLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-2 inline-block text-sm font-semibold text-power-orange hover:underline"
                >
                  Join meeting link
                </a>
              )}
            </div>
          )}

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
    </div>
  );
}
