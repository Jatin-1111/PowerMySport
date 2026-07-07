"use client";

import {
  expertApi,
  type ExpertSession,
} from "@/modules/expert/services/expert";
import { ConfirmDialog } from "@/modules/shared/ui/ConfirmDialog";
import { SlotPicker } from "@/modules/expert/components/SlotPicker";
import { formatSessionTimeWithZone } from "@/modules/expert/utils/time";
import { toast } from "sonner";
import { CalendarClock, Check, Star, Users, Wallet } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

const formatInr = (n: number) => `₹${Number(n || 0).toLocaleString("en-IN")}`;

const STATUS_STYLES: Record<string, string> = {
  PENDING_PAYMENT: "bg-amber-50 text-amber-700",
  PAID: "bg-indigo-50 text-indigo-700",
  SCHEDULED: "bg-indigo-50 text-indigo-700",
  COMPLETED: "bg-emerald-50 text-emerald-700",
  CANCELLED: "bg-red-50 text-red-700",
};

export default function ExpertDashboardPage() {
  const [sessions, setSessions] = useState<ExpertSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const s = await expertApi.expertSessions();
      if (s.success && s.data) setSessions(s.data);
      else setError(s.message || "Failed to load your sessions.");
    } catch {
      setError("Failed to load your dashboard.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const stats = useMemo(() => {
    const paid = sessions.filter((s) => s.paymentStatus === "COMPLETED");
    const earnings = paid.reduce((sum, s) => sum + (s.amount || 0), 0);
    const reviews = sessions.filter((s) => s.reviewed && s.rating);
    const avg = reviews.length
      ? reviews.reduce((a, s) => a + (s.rating || 0), 0) / reviews.length
      : 0;
    return {
      total: sessions.length,
      upcoming: sessions.filter((s) => s.status === "SCHEDULED").length,
      earnings,
      avg,
      reviewCount: reviews.length,
    };
  }, [sessions]);

  const updateOne = (updated: ExpertSession) =>
    setSessions((list) =>
      list.map((s) =>
        (s.id || s._id) === (updated.id || updated._id)
          ? { ...s, ...updated }
          : s,
      ),
    );

  return (
    <div className="mx-auto max-w-5xl px-6 py-8">
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 to-slate-800 p-6 text-white shadow-lg sm:p-8">
        <div className="pointer-events-none absolute -right-16 -top-12 h-40 w-40 rounded-full bg-power-orange/20 blur-3xl" />
        <span className="relative inline-flex items-center rounded-full bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-white/80">
          Expert
        </span>
        <h1 className="relative mt-3 text-2xl font-bold sm:text-3xl">
          Your dashboard
        </h1>
        <p className="relative mt-1 text-sm text-slate-200">
          Manage your upcoming and past sessions.
        </p>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={<Users className="h-5 w-5" />}
          label="Total sessions"
          value={String(stats.total)}
        />
        <StatCard
          icon={<CalendarClock className="h-5 w-5" />}
          label="Upcoming"
          value={String(stats.upcoming)}
        />
        <StatCard
          icon={<Wallet className="h-5 w-5" />}
          label="Collected"
          value={formatInr(stats.earnings)}
        />
        <StatCard
          icon={<Star className="h-5 w-5" />}
          label="Avg rating"
          value={
            stats.reviewCount
              ? `${stats.avg.toFixed(1)} (${stats.reviewCount})`
              : "—"
          }
        />
      </div>

      <h2 className="mt-8 text-lg font-bold text-slate-900">Sessions</h2>

      <div className="mt-4">
        {loading ? (
          <div className="py-16 text-center text-slate-500">Loading...</div>
        ) : error ? (
          <div className="py-12 text-center">
            <p className="font-semibold text-red-600">{error}</p>
            <button
              onClick={load}
              className="mt-3 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
            >
              Retry
            </button>
          </div>
        ) : sessions.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-white py-16 text-center text-slate-500">
            No sessions booked yet.
          </div>
        ) : (
          <div className="space-y-3">
            {sessions.map((s) => (
              <SessionRow
                key={s.id || s._id}
                session={s}
                onChange={updateOne}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function SessionRow({
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
  const id = String(session.id || session._id || "");
  const canManage = ["PAID", "SCHEDULED"].includes(session.status);
  const needsResponse = canManage && session.expertAcceptance !== "ACCEPTED";

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
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
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
                onClick={() => run(() => expertApi.completeSession(id))}
                disabled={busy}
                className="rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
              >
                Mark complete
              </button>
              <button
                onClick={() => setShowCancel(true)}
                disabled={busy}
                className="rounded-lg border border-red-200 px-3 py-1.5 text-sm font-semibold text-red-600 hover:bg-red-50 disabled:opacity-60"
              >
                Cancel
              </button>
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
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center gap-2 text-slate-400">{icon}</div>
      <p className="mt-2 text-xs uppercase tracking-wide text-slate-500">
        {label}
      </p>
      <p className="mt-1 text-2xl font-bold text-slate-900">{value}</p>
    </div>
  );
}
