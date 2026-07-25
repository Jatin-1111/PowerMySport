"use client";

import {
    ExpertSessionsList,
    formatInr,
} from "@/modules/expert/components/ExpertSessionsList";
import {
    expertApi,
    type Expert,
    type ExpertSession,
} from "@/modules/expert/services/expert";
import { AlertCircle, ArrowRight, CalendarClock, Clock, Star, Users, Wallet } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

export default function ExpertDashboardPage() {
  const [sessions, setSessions] = useState<ExpertSession[]>([]);
  const [profile, setProfile] = useState<Expert | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const [sessionsRes, profileRes] = await Promise.all([
        expertApi.expertSessions(),
        expertApi.getMyProfile(),
      ]);
      if (sessionsRes.success && sessionsRes.data) setSessions(sessionsRes.data);
      else setError(sessionsRes.message || "Failed to load your sessions.");
      if (profileRes.success && profileRes.data) setProfile(profileRes.data);
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

  // The API already returns sessions sorted newest-first, so the first 3
  // are the most recent — no re-sort needed.
  const recentSessions = sessions.slice(0, 3);

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
      {/* Verification status banners */}
      {profile?.verificationStatus === "PENDING" && (
        <div className="mb-6 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-900/40 dark:bg-amber-900/20">
          <Clock className="mt-0.5 h-5 w-5 shrink-0 text-amber-500" />
          <div>
            <p className="font-semibold text-amber-900 dark:text-amber-300">Profile under review</p>
            <p className="mt-0.5 text-sm text-amber-800 dark:text-amber-400">
              Our team is reviewing your profile. You&apos;ll receive an email once it&apos;s approved (typically 1–2 business days). In the meantime, you can update your profile and set your availability.
            </p>
          </div>
        </div>
      )}
      {profile?.verificationStatus === "REJECTED" && (
        <div className="mb-6 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 dark:border-red-900/40 dark:bg-red-900/20">
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-500" />
          <div className="flex-1">
            <p className="font-semibold text-red-900 dark:text-red-300">Profile needs updates</p>
            {profile.rejectionReason && (
              <p className="mt-0.5 text-sm text-red-800 dark:text-red-400">
                {profile.rejectionReason}
              </p>
            )}
            <Link
              href="/expert/onboarding"
              className="mt-2 inline-block text-sm font-semibold text-red-700 underline hover:text-red-600 dark:text-red-400"
            >
              Update &amp; resubmit profile →
            </Link>
          </div>
        </div>
      )}

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
          icon={<Users className="h-4.5 w-4.5" />}
          label="Total sessions"
          value={String(stats.total)}
          tint="bg-indigo-50 text-indigo-600"
        />
        <StatCard
          icon={<CalendarClock className="h-4.5 w-4.5" />}
          label="Upcoming"
          value={String(stats.upcoming)}
          tint="bg-orange-50 text-power-orange"
        />
        <StatCard
          icon={<Wallet className="h-4.5 w-4.5" />}
          label="Collected"
          value={formatInr(stats.earnings)}
          tint="bg-emerald-50 text-emerald-600"
        />
        <StatCard
          icon={<Star className="h-4.5 w-4.5" />}
          label="Avg rating"
          value={
            stats.reviewCount
              ? `${stats.avg.toFixed(1)} (${stats.reviewCount})`
              : "—"
          }
          tint="bg-amber-50 text-amber-600"
        />
      </div>

      <div className="mt-8 flex items-center justify-between">
        <h2 className="text-lg font-bold text-slate-900">Recent sessions</h2>
        {!loading && !error && sessions.length > 0 && (
          <Link
            href="/expert/sessions"
            className="inline-flex items-center gap-1 text-sm font-semibold text-power-orange hover:text-orange-600"
          >
            View all sessions <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        )}
      </div>

      <div className="mt-4">
        <ExpertSessionsList
          sessions={recentSessions}
          loading={loading}
          error={error}
          onRetry={load}
          onChange={updateOne}
        />
      </div>
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  tint,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  tint: string;
}) {
  return (
    <div className="rounded-xl border-0 bg-white p-4 shadow-[0_2px_16px_rgb(0,0,0,0.06)] transition-shadow hover:shadow-[0_8px_24px_rgb(0,0,0,0.1)]">
      <div className={`flex h-9 w-9 items-center justify-center rounded-full ${tint}`}>
        {icon}
      </div>
      <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </p>
      <p className="mt-1 text-2xl font-bold text-slate-900">{value}</p>
    </div>
  );
}
