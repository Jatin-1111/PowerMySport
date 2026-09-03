"use client";

import axiosInstance from "@/lib/api/axios";
import { toast } from "@/lib/toast";
import {
  BusyHoursHeatmap,
  DonutChart,
  KpiCard,
  RetentionCard,
  SparklineBarChart,
  SportBreakdownPanel,
} from "@/modules/shared/components/dashboard/analytics";
import { SlideUp } from "@/modules/shared/ui/motion/SlideUp";
import {
  Activity,
  BarChart2,
  Building2,
  CheckCircle,
  Clock,
  GraduationCap,
  Loader2,
  TrendingUp,
  Users,
} from "lucide-react";
import { useEffect, useState } from "react";

// ─── types ───────────────────────────────────────────────────────────────────

interface AcademyOverview {
  totalSessions: number;
  completedSessions: number;
  completionRate: number;
  totalStudents: number;
  returningStudents: number;
  retentionRate: number;
  totalVenues: number;
  totalCoaches: number;
}

interface TrendPoint {
  label: string;
  count: number;
}

interface SportBreakdownItem {
  sport: string;
  count: number;
  percentage: number;
}

interface PopularHourItem {
  hour: number;
  count: number;
}

interface StudentRetention {
  newStudents: number;
  returningStudents: number;
}

interface AcademyAnalyticsData {
  overview: AcademyOverview;
  sessionsTrend: TrendPoint[];
  sportBreakdown: SportBreakdownItem[];
  popularHours: PopularHourItem[];
  studentRetention: StudentRetention;
}

// ─── helpers ─────────────────────────────────────────────────────────────────

function completionColor(rate: number): string {
  if (rate >= 80) return "text-emerald-600";
  if (rate >= 50) return "text-amber-600";
  return "text-red-500";
}

// ─── main page ────────────────────────────────────────────────────────────────

export default function AcademyAnalyticsPage() {
  const [data, setData] = useState<AcademyAnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        setError(null);
        const res = await axiosInstance.get<{ data: AcademyAnalyticsData }>(
          "/academies/my/analytics"
        );
        setData(res.data.data);
      } catch {
        setError("Failed to load analytics data.");
        toast.error("Failed to load analytics data.");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  // ── loading ──────────────────────────────────────────────────────────────
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

  // ── error ────────────────────────────────────────────────────────────────
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

  const { overview, sessionsTrend, sportBreakdown, popularHours, studentRetention } = data;

  return (
    <div className="min-h-screen bg-slate-50 pb-16">
      <div className="mx-auto max-w-6xl space-y-8 px-4 pt-8 sm:px-6">
        {/* ── Header ───────────────────────────────────────────────────── */}
        <SlideUp>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-900 sm:text-3xl">
                <TrendingUp size={28} className="text-power-orange" />
                Academy Analytics
              </h1>
              <p className="mt-1 text-sm text-slate-500">
                Track your academy's performance and student engagement.
              </p>
            </div>
            <div className="inline-flex items-center gap-1.5 self-start rounded-full border border-slate-200 bg-white px-4 py-1.5 text-xs font-medium text-slate-600 shadow-sm sm:self-auto">
              <Clock size={12} className="text-power-orange" />
              Last 30 days
            </div>
          </div>
        </SlideUp>

        {/* ── 4 KPI cards ──────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <KpiCard
            label="Total Sessions"
            value={overview.totalSessions}
            icon={<BarChart2 size={20} />}
            delay={0}
          />
          <KpiCard
            label="Completion Rate"
            value={`${overview.completionRate.toFixed(1)}%`}
            icon={<CheckCircle size={20} />}
            valueClass={completionColor(overview.completionRate)}
            delay={0.08}
          />
          <KpiCard
            label="Total Students"
            value={overview.totalStudents}
            icon={<GraduationCap size={20} />}
            delay={0.16}
          />
          <KpiCard
            label="Retention Rate"
            value={`${overview.retentionRate.toFixed(1)}%`}
            icon={<Users size={20} />}
            valueClass="text-power-orange"
            delay={0.24}
          />
        </div>

        {/* ── Sessions Trend ────────────────────────────────────────────── */}
        <SlideUp delay={0.15}>
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-sm font-semibold tracking-wider text-slate-700 uppercase">
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
              <h2 className="mb-5 flex items-center gap-2 text-sm font-semibold tracking-wider text-slate-700 uppercase">
                <Activity size={16} className="text-power-orange" />
                Sport Breakdown
              </h2>
              <SportBreakdownPanel data={sportBreakdown} />
            </div>
          </SlideUp>

          <SlideUp delay={0.25}>
            <div className="h-full rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="mb-5 flex items-center gap-2 text-sm font-semibold tracking-wider text-slate-700 uppercase">
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

        {/* ── Student Retention ────────────────────────────────────────── */}
        <SlideUp delay={0.3}>
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="mb-5 flex items-center gap-2 text-sm font-semibold tracking-wider text-slate-700 uppercase">
              <GraduationCap size={16} className="text-power-orange" />
              Student Retention
            </h2>
            <RetentionCard
              newCount={studentRetention.newStudents}
              returningCount={studentRetention.returningStudents}
              retentionRate={overview.retentionRate}
              newLabel="New Students"
              returningLabel="Returning Students"
            />
          </div>
        </SlideUp>

        {/* ── Completion Rate donut + Academy Stats ─────────────────────── */}
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
          <SlideUp delay={0.35}>
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="mb-5 flex items-center gap-2 text-sm font-semibold tracking-wider text-slate-700 uppercase">
                <CheckCircle size={16} className="text-power-orange" />
                Completion Rate
              </h2>
              <div className="flex items-center gap-6">
                <DonutChart rate={overview.completionRate} />
                <div className="space-y-3">
                  <div>
                    <p className="text-xs tracking-wide text-slate-500 uppercase">Completed</p>
                    <p className="text-xl font-bold text-slate-900">{overview.completedSessions}</p>
                  </div>
                  <div>
                    <p className="text-xs tracking-wide text-slate-500 uppercase">Total</p>
                    <p className="text-xl font-bold text-slate-900">{overview.totalSessions}</p>
                  </div>
                </div>
              </div>
            </div>
          </SlideUp>

          <SlideUp delay={0.4}>
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="mb-5 flex items-center gap-2 text-sm font-semibold tracking-wider text-slate-700 uppercase">
                <Building2 size={16} className="text-power-orange" />
                Academy Stats
              </h2>
              <div className="grid grid-cols-2 gap-4">
                <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
                  <div className="mb-1 flex items-center gap-2">
                    <Building2 size={14} className="text-orange-400" />
                    <p className="text-xs tracking-wide text-slate-500 uppercase">Venues</p>
                  </div>
                  <p className="text-2xl font-bold text-slate-900">{overview.totalVenues}</p>
                </div>
                <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
                  <div className="mb-1 flex items-center gap-2">
                    <Users size={14} className="text-orange-400" />
                    <p className="text-xs tracking-wide text-slate-500 uppercase">Coaches</p>
                  </div>
                  <p className="text-2xl font-bold text-slate-900">{overview.totalCoaches}</p>
                </div>
                <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
                  <div className="mb-1 flex items-center gap-2">
                    <BarChart2 size={14} className="text-orange-400" />
                    <p className="text-xs tracking-wide text-slate-500 uppercase">Sessions</p>
                  </div>
                  <p className="text-2xl font-bold text-slate-900">{overview.totalSessions}</p>
                </div>
                <div className="rounded-xl border border-orange-100 bg-orange-50 p-4">
                  <div className="mb-1 flex items-center gap-2">
                    <CheckCircle size={14} className="text-orange-400" />
                    <p className="text-xs tracking-wide text-slate-500 uppercase">Completed</p>
                  </div>
                  <p className="text-power-orange text-2xl font-bold">
                    {overview.completedSessions}
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
