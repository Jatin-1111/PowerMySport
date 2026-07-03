"use client";

import {
  expertApi,
  type ExpertSession,
} from "@/modules/expert/services/expert";
import { CalendarClock, Star, Users, Wallet } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

const formatInr = (n: number) => `₹${Number(n || 0).toLocaleString("en-IN")}`;

const STATUS_STYLES: Record<string, string> = {
  PENDING_PAYMENT: "bg-amber-50 text-amber-700",
  PAID: "bg-blue-50 text-blue-700",
  SCHEDULED: "bg-blue-50 text-blue-700",
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
      const res = await expertApi.expertSessions();
      if (res.success && res.data) setSessions(res.data);
      else setError(res.message || "Failed to load your sessions.");
    } catch {
      setError("Failed to load your sessions.");
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

  return (
    <div className="mx-auto max-w-5xl px-6 py-8">
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 to-slate-800 p-6 text-white shadow-lg sm:p-8">
        <div className="pointer-events-none absolute -right-16 -top-12 h-40 w-40 rounded-full bg-power-orange/20 blur-3xl" />
        <span className="relative inline-flex items-center rounded-full bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-white/80">
          Expert
        </span>
        <h1 className="relative mt-3 text-2xl font-bold sm:text-3xl">
          Your sessions
        </h1>
        <p className="relative mt-1 text-sm text-slate-200">
          Manage the sessions clients have booked with you.
        </p>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={<Users className="h-5 w-5" />} label="Total sessions" value={String(stats.total)} />
        <StatCard icon={<CalendarClock className="h-5 w-5" />} label="Upcoming" value={String(stats.upcoming)} />
        <StatCard icon={<Wallet className="h-5 w-5" />} label="Collected" value={formatInr(stats.earnings)} />
        <StatCard
          icon={<Star className="h-5 w-5" />}
          label="Avg rating"
          value={stats.reviewCount ? `${stats.avg.toFixed(1)} (${stats.reviewCount})` : "—"}
        />
      </div>

      <div className="mt-6 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
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
          <div className="py-16 text-center text-slate-500">
            No sessions booked yet.
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {sessions.map((s) => (
              <div
                key={s.id || s._id}
                className="flex flex-col gap-2 p-5 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p className="font-semibold text-slate-900">
                    {s.clientName || "Client"}
                  </p>
                  <p className="text-sm text-slate-500">
                    {s.scheduledAt
                      ? new Date(s.scheduledAt).toLocaleString()
                      : "Not scheduled yet"}
                    {s.mode ? ` · ${s.mode === "ONLINE" ? "Online" : "In-person"}` : ""}
                  </p>
                  {s.reviewed && s.rating && (
                    <p className="mt-1 flex items-center gap-1 text-sm text-amber-600">
                      <Star className="h-3.5 w-3.5 fill-amber-500 text-amber-500" />
                      {s.rating}/5{s.review ? ` — "${s.review}"` : ""}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-semibold text-slate-900">
                    {formatInr(s.amount)}
                  </span>
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wide ${STATUS_STYLES[s.status] || "bg-slate-100 text-slate-600"}`}
                  >
                    {s.status.replace(/_/g, " ")}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
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
