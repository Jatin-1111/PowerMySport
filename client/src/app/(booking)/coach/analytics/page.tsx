"use client";

import { toast } from "@/lib/toast";
import { coachApi } from "@/modules/coach/services/coach";
import {
  BusyHoursHeatmap,
  DonutChart,
  KpiCard,
  RetentionCard,
  SparklineBarChart,
  SportBreakdownPanel,
} from "@/modules/shared/components/dashboard/analytics";
import { SlideUp } from "@/modules/shared/ui/motion/SlideUp";
import type { AnalyticsData } from "@/types";
import {
  Activity,
  BarChart2,
  CheckCircle,
  Clock,
  Loader2,
  Star,
  Target,
  TrendingUp,
  Users,
} from "lucide-react";
import { useEffect, useState } from "react";

// ─── helpers ────────────────────────────────────────────────────────────────

function completionColor(rate: number): string {
  if (rate >= 80) return "text-emerald-600";
  if (rate >= 50) return "text-amber-600";
  return "text-red-500";
}

// ─── main page ────────────────────────────────────────────────────────────────

export default function CoachAnalyticsPage() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        setError(null);
        const res = await coachApi.getAnalytics();
        if (res.success && res.data) {
          setData(res.data);
        } else {
          setError("Failed to load analytics data.");
          toast.error("Failed to load analytics data.");
        }
      } catch {
        setError("Something went wrong. Please try again.");
        toast.error("Something went wrong loading analytics.");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  // ── loading state ────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-3 text-slate-400">
          <Loader2 size={36} className="text-power-orange animate-spin" />
          <p className="text-sm">Loading analytics…</p>
        </div>
      </div>
    );
  }

  // ── error state ──────────────────────────────────────────────────────────
  if (error || !data) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
        <div className="max-w-sm text-center">
          <Activity size={40} className="mx-auto mb-3 text-red-400" />
          <p className="mb-1 font-semibold text-slate-900">Unable to load analytics</p>
          <p className="text-sm text-slate-500">{error ?? "No data available."}</p>
          <button
            onClick={() => window.location.reload()}
            className="bg-power-orange mt-4 rounded-lg px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-orange-600"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  const { overview, sessionsTrend, sportBreakdown, popularHours, clientRetention } = data;

  const kpiCards = [
    {
      label: "Total Sessions",
      value: overview.totalSessions,
      icon: <Target size={20} />,
      valueClass: "text-slate-900",
    },
    {
      label: "Completion Rate",
      value: `${overview.completionRate.toFixed(1)}%`,
      icon: <CheckCircle size={20} />,
      valueClass: completionColor(overview.completionRate),
    },
    {
      label: "Total Clients",
      value: overview.totalClients,
      icon: <Users size={20} />,
      valueClass: "text-slate-900",
    },
    {
      label: "Avg Rating",
      value: overview.avgRating > 0 ? `${overview.avgRating.toFixed(1)} ★` : "—",
      icon: <Star size={20} />,
      valueClass: "text-power-orange",
    },
  ];

  return (
    <div className="min-h-screen bg-slate-50 pb-16">
      <div className="mx-auto max-w-6xl space-y-8 px-4 pt-8 sm:px-6">
        {/* ── Page header ───────────────────────────────────────────────── */}
        <SlideUp>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-900 sm:text-3xl">
                <TrendingUp size={28} className="text-power-orange" />
                Analytics &amp; Insights
              </h1>
              <p className="mt-1 text-sm text-slate-500">
                Track your coaching performance and client engagement.
              </p>
            </div>
            <div className="inline-flex items-center gap-1.5 self-start rounded-full border border-slate-200 bg-white px-4 py-1.5 text-xs font-medium text-slate-600 shadow-sm sm:self-auto">
              <Clock size={12} className="text-power-orange" />
              Last 30 days
            </div>
          </div>
        </SlideUp>

        {/* ── KPI cards ─────────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {kpiCards.map((card, i) => (
            <KpiCard key={card.label} {...card} delay={i * 0.08} />
          ))}
        </div>

        {/* ── Sessions Trend ────────────────────────────────────────────── */}
        <SlideUp delay={0.15}>
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-slate-700">
                <BarChart2 size={16} className="text-power-orange" />
                Sessions Trend
              </h2>
              <span className="text-xs text-slate-400">Daily • last 30 days</span>
            </div>
            {sessionsTrend.length === 0 ? (
              <div className="flex h-28 items-center justify-center text-sm text-slate-400">
                No session data for this period.
              </div>
            ) : (
              <SparklineBarChart data={sessionsTrend} />
            )}
          </div>
        </SlideUp>

        {/* ── Sport Breakdown + Busy Hours ──────────────────────────────── */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <SlideUp delay={0.2}>
            <div className="h-full rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="mb-5 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-slate-700">
                <Activity size={16} className="text-power-orange" />
                Sport Breakdown
              </h2>
              <SportBreakdownPanel data={sportBreakdown} />
            </div>
          </SlideUp>

          <SlideUp delay={0.25}>
            <div className="h-full rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="mb-5 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-slate-700">
                <Clock size={16} className="text-power-orange" />
                Busy Hours
              </h2>
              {popularHours.length === 0 ? (
                <div className="flex h-24 items-center justify-center text-sm text-slate-400">
                  No hour data yet.
                </div>
              ) : (
                <BusyHoursHeatmap data={popularHours} />
              )}
            </div>
          </SlideUp>
        </div>

        {/* ── Client Retention ──────────────────────────────────────────── */}
        <SlideUp delay={0.3}>
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="mb-5 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-slate-700">
              <Users size={16} className="text-power-orange" />
              Client Retention
            </h2>
            <RetentionCard
              newCount={clientRetention.newClients}
              returningCount={clientRetention.returningClients}
              retentionRate={overview.retentionRate}
            />
          </div>
        </SlideUp>

        {/* ── Completion Rate + All-time Summary ────────────────────────── */}
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
          <SlideUp delay={0.35}>
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="mb-5 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-slate-700">
                <CheckCircle size={16} className="text-power-orange" />
                Completion Rate
              </h2>
              <div className="flex items-center gap-6">
                <DonutChart rate={overview.completionRate} />
                <div className="space-y-3">
                  <div>
                    <p className="text-xs uppercase tracking-wide text-slate-500">Completed</p>
                    <p className="text-xl font-bold text-slate-900">{overview.completedSessions}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wide text-slate-500">Total</p>
                    <p className="text-xl font-bold text-slate-900">{overview.totalSessions}</p>
                  </div>
                </div>
              </div>
            </div>
          </SlideUp>

          <SlideUp delay={0.4}>
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="mb-5 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-slate-700">
                <TrendingUp size={16} className="text-power-orange" />
                All-time Summary
              </h2>
              <div className="grid grid-cols-2 gap-4">
                <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
                  <p className="mb-1 text-xs uppercase tracking-wide text-slate-500">Sessions</p>
                  <p className="text-2xl font-bold text-slate-900">{overview.totalSessions}</p>
                </div>
                <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
                  <p className="mb-1 text-xs uppercase tracking-wide text-slate-500">Clients</p>
                  <p className="text-2xl font-bold text-slate-900">{overview.totalClients}</p>
                </div>
                <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
                  <p className="mb-1 text-xs uppercase tracking-wide text-slate-500">Reviews</p>
                  <p className="text-2xl font-bold text-slate-900">{overview.reviewCount}</p>
                </div>
                <div className="rounded-xl border border-orange-100 bg-orange-50 p-4">
                  <p className="mb-1 text-xs uppercase tracking-wide text-slate-500">Avg Rating</p>
                  <p className="text-power-orange text-2xl font-bold">
                    {overview.avgRating > 0 ? overview.avgRating.toFixed(1) : "—"}
                  </p>
                </div>
              </div>
            </div>
          </SlideUp>
        </div>
      </div>
    </div>
  );
}
