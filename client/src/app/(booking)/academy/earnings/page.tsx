"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  TrendingUp,
  TrendingDown,
  IndianRupee,
  Clock,
  Calendar,
  ArrowRight,
  Loader2,
} from "lucide-react";
import { Button } from "@/modules/shared/ui/Button";
import { SlideUp } from "@/modules/shared/ui/motion/SlideUp";
import { toast } from "@/lib/toast";
import Link from "next/link";
import axiosInstance from "@/lib/api/axios";
import type { EarningsData, MonthlyEarning, SportEarning, Booking, User } from "@/types";

// ─── helpers ────────────────────────────────────────────────────────────────

function fmt(amount: number): string {
  return amount.toLocaleString("en-IN");
}

function fmtDate(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return dateStr;
  }
}

function getPlayerName(booking: Booking): string {
  const user = booking.userId;
  if (typeof user === "object" && user !== null && "name" in user) {
    return (user as User).name;
  }
  if (booking.participantName) return booking.participantName;
  return "Player";
}

// ─── Sub-components ─────────────────────────────────────────────────────────

interface StatCardProps {
  title: string;
  amount: number;
  subtitle: string;
  icon: React.ReactNode;
  accent?: boolean;
  trend?: { value: number; positive: boolean } | null;
}

function StatCard({ title, amount, subtitle, icon, accent, trend }: StatCardProps) {
  return (
    <div
      className={`rounded-2xl p-5 flex flex-col gap-3 shadow-sm border transition-shadow hover:shadow-md ${
        accent
          ? "bg-gradient-to-br from-orange-500 to-orange-600 text-white border-orange-400"
          : "bg-white text-slate-800 border-slate-100"
      }`}
    >
      <div className="flex items-start justify-between">
        <div
          className={`rounded-xl p-2.5 ${
            accent ? "bg-white/20" : "bg-orange-50"
          }`}
        >
          <span className={accent ? "text-white" : "text-orange-500"}>
            {icon}
          </span>
        </div>
        {trend !== null && trend !== undefined && (
          <div
            className={`flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-full ${
              accent
                ? "bg-white/20 text-white"
                : trend.positive
                ? "bg-green-50 text-green-600"
                : "bg-red-50 text-red-600"
            }`}
          >
            {trend.positive ? (
              <TrendingUp className="w-3 h-3" />
            ) : (
              <TrendingDown className="w-3 h-3" />
            )}
            {Math.abs(trend.value).toFixed(1)}%
          </div>
        )}
      </div>
      <div>
        <p
          className={`text-xs font-medium uppercase tracking-wider mb-1 ${
            accent ? "text-white/80" : "text-slate-400"
          }`}
        >
          {title}
        </p>
        <div className="flex items-baseline gap-0.5">
          <IndianRupee
            className={`w-4 h-4 mb-0.5 ${accent ? "text-white" : "text-slate-700"}`}
          />
          <span
            className={`text-2xl font-bold tracking-tight ${
              accent ? "text-white" : "text-slate-800"
            }`}
          >
            {fmt(amount)}
          </span>
        </div>
        <p
          className={`text-xs mt-1 ${
            accent ? "text-white/70" : "text-slate-400"
          }`}
        >
          {subtitle}
        </p>
      </div>
    </div>
  );
}

// ─── Monthly Bar Chart ───────────────────────────────────────────────────────

function MonthlyChart({ months }: { months: MonthlyEarning[] }) {
  const W = 600;
  const H = 200;
  const PAD = { top: 20, right: 16, bottom: 40, left: 56 };
  const chartW = W - PAD.left - PAD.right;
  const chartH = H - PAD.top - PAD.bottom;

  const maxVal = Math.max(...months.map((m) => m.total), 1);
  const count = months.length || 1;
  const slotW = chartW / count;
  const barW = slotW * 0.55;

  const now = new Date();
  const currentShortMonth = now.toLocaleString("en-IN", { month: "short" });

  const yTicks = [0, 0.25, 0.5, 0.75, 1].map((t) => t * maxVal);

  return (
    <div className="w-full">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full h-auto"
        aria-label="Monthly earnings bar chart"
      >
        <defs>
          <linearGradient id="academyEarningsBarNormal" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#fb923c" />
            <stop offset="100%" stopColor="#f97316" />
          </linearGradient>
          <linearGradient id="academyEarningsBarHighlight" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#ea580c" />
            <stop offset="100%" stopColor="#c2410c" />
          </linearGradient>
        </defs>

        {/* Y-axis gridlines + labels */}
        {yTicks.map((tick, i) => {
          const y = PAD.top + chartH - (tick / maxVal) * chartH;
          const label =
            tick >= 100000
              ? `${(tick / 100000).toFixed(0)}L`
              : tick >= 1000
              ? `${(tick / 1000).toFixed(0)}k`
              : `${tick.toFixed(0)}`;
          return (
            <g key={i}>
              <line
                x1={PAD.left}
                x2={PAD.left + chartW}
                y1={y}
                y2={y}
                stroke={i === 0 ? "#e2e8f0" : "#f1f5f9"}
                strokeWidth={i === 0 ? 1.5 : 1}
              />
              <text
                x={PAD.left - 8}
                y={y + 4}
                textAnchor="end"
                fontSize={9}
                fill="#94a3b8"
              >
                {label}
              </text>
            </g>
          );
        })}

        {/* Bars + x-axis labels */}
        {months.map((m, i) => {
          const centerX = PAD.left + i * slotW + slotW / 2;
          const barX = centerX - barW / 2;
          const barH =
            m.total > 0 ? Math.max(4, (m.total / maxVal) * chartH) : 0;
          const barY = PAD.top + chartH - barH;
          const isCurrent = m.label.startsWith(currentShortMonth);

          return (
            <g key={m.label}>
              {m.total > 0 ? (
                <rect
                  x={barX}
                  y={barY}
                  width={barW}
                  height={barH}
                  rx={4}
                  fill={
                    isCurrent
                      ? "url(#academyEarningsBarHighlight)"
                      : "url(#academyEarningsBarNormal)"
                  }
                  opacity={isCurrent ? 1 : 0.82}
                >
                  <title>
                    {m.label}: ₹{fmt(m.total)} · {m.sessions} session
                    {m.sessions !== 1 ? "s" : ""}
                  </title>
                </rect>
              ) : (
                <rect
                  x={barX}
                  y={PAD.top + chartH - 3}
                  width={barW}
                  height={3}
                  rx={1.5}
                  fill="#e2e8f0"
                />
              )}

              {/* Value label above bar */}
              {m.total > 0 && barH > 18 && (
                <text
                  x={centerX}
                  y={barY - 5}
                  textAnchor="middle"
                  fontSize={8.5}
                  fill={isCurrent ? "#c2410c" : "#f97316"}
                  fontWeight="600"
                >
                  {m.total >= 100000
                    ? `${(m.total / 100000).toFixed(1)}L`
                    : m.total >= 1000
                    ? `${(m.total / 1000).toFixed(0)}k`
                    : fmt(m.total)}
                </text>
              )}

              {/* X-axis label */}
              <text
                x={centerX}
                y={H - 12}
                textAnchor="middle"
                fontSize={10}
                fill={isCurrent ? "#f97316" : "#94a3b8"}
                fontWeight={isCurrent ? "700" : "400"}
              >
                {m.label}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

// ─── Sport Earnings ──────────────────────────────────────────────────────────

function SportEarningsList({ sports }: { sports: SportEarning[] }) {
  const totalEarnings = sports.reduce((s, e) => s + e.total, 0) || 1;

  if (sports.length === 0) {
    return (
      <p className="text-slate-400 text-sm py-4 text-center">
        No sport earnings data yet.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {sports.map((s) => {
        const pct = Math.round((s.total / totalEarnings) * 100);
        return (
          <div key={s.sport} className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium text-slate-700 capitalize">
                {s.sport}
              </span>
              <div className="flex items-center gap-3 text-right">
                <span className="text-slate-400 text-xs">
                  {s.sessions} session{s.sessions !== 1 ? "s" : ""}
                </span>
                <span className="font-semibold text-slate-800">
                  ₹{fmt(s.total)}
                </span>
              </div>
            </div>
            <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-orange-400 to-orange-600 transition-all duration-700"
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Recent Transactions ─────────────────────────────────────────────────────

function RecentTransactions({ bookings }: { bookings: Booking[] }) {
  if (bookings.length === 0) {
    return (
      <p className="text-slate-400 text-sm py-4 text-center">
        No completed transactions yet.
      </p>
    );
  }

  return (
    <div className="flex flex-col divide-y divide-slate-50">
      {bookings.slice(0, 10).map((b) => (
        <div
          key={b.id}
          className="flex items-center justify-between py-3 gap-3"
        >
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-full bg-orange-50 flex items-center justify-center shrink-0">
              <IndianRupee className="w-4 h-4 text-orange-500" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium text-slate-800 truncate">
                {getPlayerName(b)}
              </p>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="text-xs text-slate-400 capitalize">
                  {b.sport}
                </span>
                <span className="text-slate-200">·</span>
                <span className="text-xs text-slate-400">{fmtDate(b.date)}</span>
              </div>
            </div>
          </div>
          <div className="flex flex-col items-end gap-1 shrink-0">
            <span className="text-sm font-bold text-slate-800">
              ₹{fmt(b.totalAmount)}
            </span>
            <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-100">
              Completed
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────────────

export default function AcademyEarningsPage() {
  const [data, setData] = useState<EarningsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchEarnings = async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await axiosInstance.get<{ success: boolean; message: string; data?: EarningsData }>(
          "/academies/my/earnings"
        );
        if (res.data.success && res.data.data) {
          setData(res.data.data);
        } else {
          throw new Error(res.data.message || "Failed to load earnings data.");
        }
      } catch (err: unknown) {
        const msg =
          err instanceof Error ? err.message : "Failed to load earnings.";
        setError(msg);
        toast.error(msg);
      } finally {
        setLoading(false);
      }
    };

    fetchEarnings();
  }, []);

  // Compute % change: thisMonth vs lastMonth
  const monthlyTrend =
    data && data.lastMonth.total > 0
      ? {
          value:
            ((data.thisMonth.total - data.lastMonth.total) /
              data.lastMonth.total) *
            100,
          positive: data.thisMonth.total >= data.lastMonth.total,
        }
      : null;

  // Last 6 months from byMonth
  const last6Months = data ? data.byMonth.slice(-6) : [];

  // ── Loading ──────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-slate-400">
          <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
          <p className="text-sm font-medium">Loading earnings…</p>
        </div>
      </div>
    );
  }

  // ── Error ────────────────────────────────────────────────────────────────
  if (error || !data) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-8 max-w-sm w-full text-center flex flex-col items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center">
            <IndianRupee className="w-5 h-5 text-red-400" />
          </div>
          <div>
            <p className="font-semibold text-slate-700">
              Could not load earnings
            </p>
            <p className="text-sm text-slate-400 mt-1">
              {error || "Please try again."}
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => window.location.reload()}
          >
            Retry
          </Button>
        </div>
      </div>
    );
  }

  // ── Main content ─────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 flex flex-col gap-8">

        {/* ── Page header ── */}
        <SlideUp delay={0}>
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <h1 className="text-2xl font-bold text-slate-800 tracking-tight">
                Academy Earnings
              </h1>
              <p className="text-slate-400 text-sm mt-0.5">
                Your academy&apos;s revenue overview and booking history
              </p>
            </div>
            <Link href="/academy">
              <Button
                variant="outline"
                size="sm"
                icon={<IndianRupee className="w-4 h-4" />}
              >
                Manage Academy
              </Button>
            </Link>
          </div>
        </SlideUp>

        {/* ── Stats row ── */}
        <SlideUp delay={0.05}>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            <StatCard
              title="Total Earnings"
              amount={data.allTime.total}
              subtitle={`${data.allTime.sessions} session${data.allTime.sessions !== 1 ? "s" : ""} all time`}
              icon={<IndianRupee className="w-5 h-5" />}
              accent
            />
            <StatCard
              title="This Month"
              amount={data.thisMonth.total}
              subtitle={`${data.thisMonth.sessions} session${data.thisMonth.sessions !== 1 ? "s" : ""}`}
              icon={<TrendingUp className="w-5 h-5" />}
              trend={monthlyTrend}
            />
            <StatCard
              title="Last Month"
              amount={data.lastMonth.total}
              subtitle={`${data.lastMonth.sessions} session${data.lastMonth.sessions !== 1 ? "s" : ""}`}
              icon={<Calendar className="w-5 h-5" />}
            />
            <StatCard
              title="Pending"
              amount={data.pending.total}
              subtitle={`${data.pending.sessions} session${data.pending.sessions !== 1 ? "s" : ""} in progress`}
              icon={<Clock className="w-5 h-5" />}
            />
          </div>
        </SlideUp>

        {/* ── Monthly trend chart ── */}
        <SlideUp delay={0.1}>
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h2 className="text-base font-semibold text-slate-800">
                  Monthly Trend
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Last {last6Months.length} months
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-sm bg-orange-500 inline-block" />
                <span className="text-xs text-slate-400">Earnings</span>
              </div>
            </div>

            {last6Months.length === 0 ? (
              <div className="h-40 flex items-center justify-center text-slate-300 text-sm">
                No monthly data available yet.
              </div>
            ) : (
              <MonthlyChart months={last6Months} />
            )}
          </div>
        </SlideUp>

        {/* ── Two-column section ── */}
        <SlideUp delay={0.15}>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-5">

            {/* By sport */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 flex flex-col gap-5">
              <div>
                <h2 className="text-base font-semibold text-slate-800">
                  Earnings by Sport
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Breakdown across all sports
                </p>
              </div>
              <SportEarningsList sports={data.bySport} />
            </div>

            {/* Recent transactions */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 flex flex-col gap-5">
              <div>
                <h2 className="text-base font-semibold text-slate-800">
                  Recent Transactions
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Last {Math.min(10, data.recentBookings.length)} completed bookings
                </p>
              </div>
              <RecentTransactions bookings={data.recentBookings} />
            </div>

          </div>
        </SlideUp>

        {/* ── Manage Academy CTA ── */}
        <SlideUp delay={0.2}>
          <motion.div
            className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl p-6 sm:p-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-5 shadow-md"
            whileHover={{ scale: 1.005 }}
            transition={{ type: "spring", stiffness: 300, damping: 25 }}
          >
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold uppercase tracking-widest text-orange-400">
                  Academy Management
                </span>
              </div>
              <h3 className="text-lg font-bold text-white">
                Manage your academy
              </h3>
              <p className="text-slate-400 text-sm max-w-md">
                Update your academy profile, manage enrollments, set pricing for
                programs, and keep your schedule up to date to maximize revenue.
              </p>
            </div>
            <Link href="/academy" className="shrink-0">
              <Button
                variant="primary"
                size="md"
                icon={<ArrowRight className="w-4 h-4" />}
                className="whitespace-nowrap"
              >
                Manage Academy
              </Button>
            </Link>
          </motion.div>
        </SlideUp>

      </div>
    </div>
  );
}
