"use client";

import { useEffect, useState } from "react";
import {
  TrendingUp,
  Users,
  CheckCircle,
  Clock,
  BarChart2,
  Loader2,
  Activity,
  Building2,
} from "lucide-react";
import { motion } from "framer-motion";
import { SlideUp } from "@/modules/shared/ui/motion/SlideUp";
import { toast } from "@/lib/toast";
import axiosInstance from "@/lib/api/axios";
import {
  KpiCard,
  SparklineBarChart,
  SportBreakdownPanel,
  BusyHoursHeatmap,
  DonutChart,
  RetentionCard,
} from "@/modules/shared/components/dashboard/analytics";

// ─── types ───────────────────────────────────────────────────────────────────

interface VenueAnalyticsOverview {
  totalSessions: number;
  completedSessions: number;
  completionRate: number;
  totalCustomers: number;
  returningCustomers: number;
  retentionRate: number;
  avgRating: number;
  reviewCount: number;
}

interface VenueAnalyticsData {
  overview: VenueAnalyticsOverview;
  sessionsTrend: Array<{ label: string; count: number }>;
  sportBreakdown: Array<{ sport: string; count: number; percentage: number }>;
  popularHours: Array<{ hour: number; count: number }>;
  customerRetention: { newCustomers: number; returningCustomers: number };
}

// ─── helpers ─────────────────────────────────────────────────────────────────

function completionColor(rate: number): string {
  if (rate >= 80) return "text-emerald-600";
  if (rate >= 50) return "text-amber-600";
  return "text-red-500";
}

// ─── main page ───────────────────────────────────────────────────────────────

export default function VenueListerAnalyticsPage() {
  const [data, setData] = useState<VenueAnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        setError(null);
        const response = await axiosInstance.get<{ success: boolean; data: VenueAnalyticsData }>(
          "/venues/analytics"
        );
        if (response.data.success && response.data.data) {
          setData(response.data.data);
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

  // ── loading state ─────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-slate-400">
          <Loader2 size={36} className="animate-spin text-orange-500" />
          <p className="text-sm">Loading analytics…</p>
        </div>
      </div>
    );
  }

  // ── error state ───────────────────────────────────────────────────────────
  if (error || !data) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
        <div className="text-center max-w-sm">
          <Activity size={40} className="text-red-400 mx-auto mb-3" />
          <p className="text-slate-900 font-semibold mb-1">Unable to load analytics</p>
          <p className="text-slate-500 text-sm">{error ?? "No data available."}</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-4 px-5 py-2 bg-orange-500 hover:bg-orange-600 text-white text-sm font-medium rounded-lg transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  const { overview, sessionsTrend, sportBreakdown, popularHours, customerRetention } = data;

  const kpiCards = [
    {
      label: "Total Sessions",
      value: overview.totalSessions,
      icon: <Building2 size={20} />,
      valueClass: "text-slate-900",
    },
    {
      label: "Completion Rate",
      value: `${overview.completionRate.toFixed(1)}%`,
      icon: <CheckCircle size={20} />,
      valueClass: completionColor(overview.completionRate),
    },
    {
      label: "Total Customers",
      value: overview.totalCustomers,
      icon: <Users size={20} />,
      valueClass: "text-slate-900",
    },
    {
      label: "Retention Rate",
      value: `${overview.retentionRate.toFixed(1)}%`,
      icon: <TrendingUp size={20} />,
      valueClass: completionColor(overview.retentionRate),
    },
  ];

  return (
    <div className="min-h-screen bg-slate-50 pb-16">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-8 space-y-8">

        {/* ── Page header ──────────────────────────────────────────────────── */}
        <SlideUp>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 flex items-center gap-2">
                <TrendingUp size={28} className="text-orange-500" />
                Analytics &amp; Insights
              </h1>
              <p className="text-slate-500 text-sm mt-1">
                Track your venue performance and customer engagement.
              </p>
            </div>
            <div className="inline-flex items-center gap-1.5 bg-white border border-slate-200 rounded-full px-4 py-1.5 text-xs text-slate-600 font-medium self-start sm:self-auto shadow-sm">
              <Clock size={12} className="text-orange-500" />
              Last 30 days
            </div>
          </div>
        </SlideUp>

        {/* ── KPI cards ────────────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {kpiCards.map((card, i) => (
            <KpiCard key={card.label} {...card} delay={i * 0.08} />
          ))}
        </div>

        {/* ── Sessions Trend ───────────────────────────────────────────────── */}
        <SlideUp delay={0.15}>
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-slate-700 flex items-center gap-2 uppercase tracking-wider">
                <BarChart2 size={16} className="text-orange-500" />
                Sessions Trend
              </h2>
              <span className="text-slate-400 text-xs">Daily · last 30 days</span>
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

        {/* ── Sport Breakdown + Busy Hours ─────────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <SlideUp delay={0.2}>
            <div className="bg-white border border-slate-200 rounded-2xl p-6 h-full shadow-sm">
              <h2 className="text-sm font-semibold text-slate-700 flex items-center gap-2 uppercase tracking-wider mb-5">
                <Activity size={16} className="text-orange-500" />
                Sport Breakdown
              </h2>
              <SportBreakdownPanel data={sportBreakdown} />
            </div>
          </SlideUp>

          <SlideUp delay={0.25}>
            <div className="bg-white border border-slate-200 rounded-2xl p-6 h-full shadow-sm">
              <h2 className="text-sm font-semibold text-slate-700 flex items-center gap-2 uppercase tracking-wider mb-5">
                <Clock size={16} className="text-orange-500" />
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

        {/* ── Customer Retention ───────────────────────────────────────────── */}
        <SlideUp delay={0.3}>
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
            <h2 className="text-sm font-semibold text-slate-700 flex items-center gap-2 uppercase tracking-wider mb-5">
              <Users size={16} className="text-orange-500" />
              Customer Retention
            </h2>
            <RetentionCard
              newCount={customerRetention.newCustomers}
              returningCount={customerRetention.returningCustomers}
              retentionRate={overview.retentionRate}
              newLabel="New Customers"
              returningLabel="Returning"
            />
          </div>
        </SlideUp>

        {/* ── Completion Rate + All-time Summary ───────────────────────────── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <SlideUp delay={0.35}>
            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
              <h2 className="text-sm font-semibold text-slate-700 flex items-center gap-2 uppercase tracking-wider mb-5">
                <CheckCircle size={16} className="text-orange-500" />
                Completion Rate
              </h2>
              <div className="flex items-center gap-6">
                <DonutChart rate={overview.completionRate} />
                <div className="space-y-3">
                  <div>
                    <p className="text-slate-500 text-xs uppercase tracking-wide">Completed</p>
                    <p className="text-slate-900 font-bold text-xl">{overview.completedSessions}</p>
                  </div>
                  <div>
                    <p className="text-slate-500 text-xs uppercase tracking-wide">Total</p>
                    <p className="text-slate-900 font-bold text-xl">{overview.totalSessions}</p>
                  </div>
                </div>
              </div>
            </div>
          </SlideUp>

          <SlideUp delay={0.4}>
            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
              <h2 className="text-sm font-semibold text-slate-700 flex items-center gap-2 uppercase tracking-wider mb-5">
                <TrendingUp size={16} className="text-orange-500" />
                All-time Stats
              </h2>
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-slate-50 border border-slate-100 rounded-xl p-4">
                  <p className="text-slate-500 text-xs uppercase tracking-wide mb-1">Sessions</p>
                  <p className="text-slate-900 font-bold text-2xl">{overview.totalSessions}</p>
                </div>
                <div className="bg-slate-50 border border-slate-100 rounded-xl p-4">
                  <p className="text-slate-500 text-xs uppercase tracking-wide mb-1">Customers</p>
                  <p className="text-slate-900 font-bold text-2xl">{overview.totalCustomers}</p>
                </div>
                <div className="bg-slate-50 border border-slate-100 rounded-xl p-4">
                  <p className="text-slate-500 text-xs uppercase tracking-wide mb-1">Reviews</p>
                  <p className="text-slate-900 font-bold text-2xl">{overview.reviewCount}</p>
                </div>
                <div className="bg-orange-50 border border-orange-100 rounded-xl p-4">
                  <p className="text-slate-500 text-xs uppercase tracking-wide mb-1">Avg Rating</p>
                  <p className="text-orange-500 font-bold text-2xl">
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
