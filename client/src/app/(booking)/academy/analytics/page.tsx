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
          "/academies/my/analytics",
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
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-slate-400">
          <Loader2 size={36} className="animate-spin text-power-orange" />
          <p className="text-sm">Loading analytics…</p>
        </div>
      </div>
    );
  }

  // ── error ────────────────────────────────────────────────────────────────
  if (error || !data) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
        <div className="text-center max-w-sm">
          <Activity size={40} className="text-red-400 mx-auto mb-3" />
          <p className="text-slate-900 font-semibold mb-1">
            Unable to load analytics
          </p>
          <p className="text-slate-500 text-sm">
            {error ?? "No data available."}
          </p>
          <button
            onClick={() => window.location.reload()}
            className="mt-4 px-5 py-2 bg-power-orange hover:bg-orange-600 text-white text-sm font-medium rounded-lg transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  const {
    overview,
    sessionsTrend,
    sportBreakdown,
    popularHours,
    studentRetention,
  } = data;

  return (
    <div className="min-h-screen bg-slate-50 pb-16">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-8 space-y-8">
        {/* ── Header ───────────────────────────────────────────────────── */}
        <SlideUp>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 flex items-center gap-2">
                <TrendingUp size={28} className="text-power-orange" />
                Academy Analytics
              </h1>
              <p className="text-slate-500 text-sm mt-1">
                Track your academy's performance and student engagement.
              </p>
            </div>
            <div className="inline-flex items-center gap-1.5 bg-white border border-slate-200 rounded-full px-4 py-1.5 text-xs text-slate-600 font-medium self-start sm:self-auto shadow-sm">
              <Clock size={12} className="text-power-orange" />
              Last 30 days
            </div>
          </div>
        </SlideUp>

        {/* ── 4 KPI cards ──────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
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
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-slate-700 flex items-center gap-2 uppercase tracking-wider">
                <BarChart2 size={16} className="text-power-orange" />
                Sessions Trend
              </h2>
              <span className="text-slate-400 text-xs">
                Daily • last 30 days
              </span>
            </div>
            {sessionsTrend.length === 0 ? (
              <div className="flex items-center justify-center h-28 text-slate-400 text-sm">
                No session data for this period.
              </div>
            ) : (
              <SparklineBarChart data={sessionsTrend} />
            )}
          </div>
        </SlideUp>

        {/* ── Sport Breakdown + Busy Hours ──────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <SlideUp delay={0.2}>
            <div className="bg-white border border-slate-200 rounded-2xl p-6 h-full shadow-sm">
              <h2 className="text-sm font-semibold text-slate-700 flex items-center gap-2 uppercase tracking-wider mb-5">
                <Activity size={16} className="text-power-orange" />
                Sport Breakdown
              </h2>
              <SportBreakdownPanel data={sportBreakdown} />
            </div>
          </SlideUp>

          <SlideUp delay={0.25}>
            <div className="bg-white border border-slate-200 rounded-2xl p-6 h-full shadow-sm">
              <h2 className="text-sm font-semibold text-slate-700 flex items-center gap-2 uppercase tracking-wider mb-5">
                <Clock size={16} className="text-power-orange" />
                Busy Hours
              </h2>
              {popularHours.length === 0 ? (
                <div className="flex items-center justify-center h-24 text-slate-400 text-sm">
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
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
            <h2 className="text-sm font-semibold text-slate-700 flex items-center gap-2 uppercase tracking-wider mb-5">
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
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <SlideUp delay={0.35}>
            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
              <h2 className="text-sm font-semibold text-slate-700 flex items-center gap-2 uppercase tracking-wider mb-5">
                <CheckCircle size={16} className="text-power-orange" />
                Completion Rate
              </h2>
              <div className="flex items-center gap-6">
                <DonutChart rate={overview.completionRate} />
                <div className="space-y-3">
                  <div>
                    <p className="text-slate-500 text-xs uppercase tracking-wide">
                      Completed
                    </p>
                    <p className="text-slate-900 font-bold text-xl">
                      {overview.completedSessions}
                    </p>
                  </div>
                  <div>
                    <p className="text-slate-500 text-xs uppercase tracking-wide">
                      Total
                    </p>
                    <p className="text-slate-900 font-bold text-xl">
                      {overview.totalSessions}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </SlideUp>

          <SlideUp delay={0.4}>
            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
              <h2 className="text-sm font-semibold text-slate-700 flex items-center gap-2 uppercase tracking-wider mb-5">
                <Building2 size={16} className="text-power-orange" />
                Academy Stats
              </h2>
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-slate-50 border border-slate-100 rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-1">
                    <Building2 size={14} className="text-orange-400" />
                    <p className="text-slate-500 text-xs uppercase tracking-wide">
                      Venues
                    </p>
                  </div>
                  <p className="text-slate-900 font-bold text-2xl">
                    {overview.totalVenues}
                  </p>
                </div>
                <div className="bg-slate-50 border border-slate-100 rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-1">
                    <Users size={14} className="text-orange-400" />
                    <p className="text-slate-500 text-xs uppercase tracking-wide">
                      Coaches
                    </p>
                  </div>
                  <p className="text-slate-900 font-bold text-2xl">
                    {overview.totalCoaches}
                  </p>
                </div>
                <div className="bg-slate-50 border border-slate-100 rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-1">
                    <BarChart2 size={14} className="text-orange-400" />
                    <p className="text-slate-500 text-xs uppercase tracking-wide">
                      Sessions
                    </p>
                  </div>
                  <p className="text-slate-900 font-bold text-2xl">
                    {overview.totalSessions}
                  </p>
                </div>
                <div className="bg-orange-50 border border-orange-100 rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-1">
                    <CheckCircle size={14} className="text-orange-400" />
                    <p className="text-slate-500 text-xs uppercase tracking-wide">
                      Completed
                    </p>
                  </div>
                  <p className="text-power-orange font-bold text-2xl">
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
