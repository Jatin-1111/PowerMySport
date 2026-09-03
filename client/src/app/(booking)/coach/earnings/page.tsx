"use client";

import { toast } from "@/lib/toast";
import { coachApi } from "@/modules/coach/services/coach";
import {
  CategoryBreakdownList,
  EarningsStatCard,
  MonthlyBarChart,
  RecentTransactionsList,
} from "@/modules/shared/components/dashboard/earnings";
import { Button } from "@/modules/shared/ui/Button";
import { SlideUp } from "@/modules/shared/ui/motion/SlideUp";
import type { Booking, EarningsData } from "@/types";
import { motion } from "framer-motion";
import { ArrowRight, Calendar, Clock, IndianRupee, Loader2, TrendingUp } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

// ─── helpers ────────────────────────────────────────────────────────────────

function getPlayerName(booking: Booking): string {
  const user = booking.userId;
  if (typeof user === "object" && user !== null && "name" in user) {
    return (user as { name: string }).name;
  }
  if (booking.participantName) return booking.participantName;
  return "Player";
}

// ─── Main Page ───────────────────────────────────────────────────────────────

export default function CoachEarningsPage() {
  const [data, setData] = useState<EarningsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchEarnings = async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await coachApi.getEarnings();
        if (res.success && res.data) {
          setData(res.data);
        } else {
          throw new Error(res.message || "Failed to load earnings data.");
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Failed to load earnings.";
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
          value: ((data.thisMonth.total - data.lastMonth.total) / data.lastMonth.total) * 100,
          positive: data.thisMonth.total >= data.lastMonth.total,
        }
      : null;

  // Last 6 months from byMonth
  const last6Months = data ? data.byMonth.slice(-6) : [];

  // ── Loading ──────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-3 text-slate-400">
          <Loader2 className="text-power-orange h-8 w-8 animate-spin" />
          <p className="text-sm font-medium">Loading earnings…</p>
        </div>
      </div>
    );
  }

  // ── Error ────────────────────────────────────────────────────────────────
  if (error || !data) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
        <div className="flex w-full max-w-sm flex-col items-center gap-4 rounded-2xl border border-slate-100 bg-white p-8 text-center shadow-sm">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-50">
            <IndianRupee className="h-5 w-5 text-red-400" />
          </div>
          <div>
            <p className="font-semibold text-slate-700">Could not load earnings</p>
            <p className="mt-1 text-sm text-slate-400">{error || "Please try again."}</p>
          </div>
          <Button variant="outline" size="sm" onClick={() => window.location.reload()}>
            Retry
          </Button>
        </div>
      </div>
    );
  }

  // ── Main content ─────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto flex max-w-5xl flex-col gap-8 px-4 py-8 sm:px-6">
        {/* ── Page header ── */}
        <SlideUp delay={0}>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-800">
                Earnings &amp; Financials
              </h1>
              <p className="mt-0.5 text-sm text-slate-400">
                Your revenue overview and session history
              </p>
            </div>
            <Link href="/coach/profile">
              <Button variant="outline" size="sm" icon={<IndianRupee className="h-4 w-4" />}>
                Manage Pricing
              </Button>
            </Link>
          </div>
        </SlideUp>

        {/* ── Stats row ── */}
        <SlideUp delay={0.05}>
          <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
            <EarningsStatCard
              title="Total Earnings"
              amount={data.allTime.total}
              subtitle={`${data.allTime.sessions} session${data.allTime.sessions !== 1 ? "s" : ""} all time`}
              icon={<IndianRupee className="h-5 w-5" />}
              accent
            />
            <EarningsStatCard
              title="This Month"
              amount={data.thisMonth.total}
              subtitle={`${data.thisMonth.sessions} session${data.thisMonth.sessions !== 1 ? "s" : ""}`}
              icon={<TrendingUp className="h-5 w-5" />}
              trend={monthlyTrend}
            />
            <EarningsStatCard
              title="Last Month"
              amount={data.lastMonth.total}
              subtitle={`${data.lastMonth.sessions} session${data.lastMonth.sessions !== 1 ? "s" : ""}`}
              icon={<Calendar className="h-5 w-5" />}
            />
            <EarningsStatCard
              title="Pending"
              amount={data.pending.total}
              subtitle={`${data.pending.sessions} session${data.pending.sessions !== 1 ? "s" : ""} in progress`}
              icon={<Clock className="h-5 w-5" />}
            />
          </div>
        </SlideUp>

        {/* ── Monthly trend chart ── */}
        <SlideUp delay={0.1}>
          <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
            <div className="mb-5 flex items-center justify-between">
              <div>
                <h2 className="text-base font-semibold text-slate-800">Monthly Trend</h2>
                <p className="mt-0.5 text-xs text-slate-400">Last {last6Months.length} months</p>
              </div>
              <div className="flex items-center gap-2">
                <span className="bg-power-orange inline-block h-3 w-3 rounded-sm" />
                <span className="text-xs text-slate-400">Earnings</span>
              </div>
            </div>

            {last6Months.length === 0 ? (
              <div className="flex h-40 items-center justify-center text-sm text-slate-300">
                No monthly data available yet.
              </div>
            ) : (
              <MonthlyBarChart months={last6Months} />
            )}
          </div>
        </SlideUp>

        {/* ── Two-column section ── */}
        <SlideUp delay={0.15}>
          <div className="grid grid-cols-1 gap-4 sm:gap-5 lg:grid-cols-2">
            {/* By sport */}
            <div className="flex flex-col gap-5 rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
              <div>
                <h2 className="text-base font-semibold text-slate-800">Earnings by Sport</h2>
                <p className="mt-0.5 text-xs text-slate-400">Breakdown across all sports</p>
              </div>
              <CategoryBreakdownList
                items={data.bySport.map((s) => ({
                  category: s.sport,
                  total: s.total,
                  sessions: s.sessions,
                }))}
                emptyMessage="No sport earnings data yet."
              />
            </div>

            {/* Recent transactions */}
            <div className="flex flex-col gap-5 rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
              <div>
                <h2 className="text-base font-semibold text-slate-800">Recent Transactions</h2>
                <p className="mt-0.5 text-xs text-slate-400">
                  Last {Math.min(10, data.recentBookings.length)} completed sessions
                </p>
              </div>
              <RecentTransactionsList
                transactions={data.recentBookings.slice(0, 10).map((b) => ({
                  id: b.id,
                  customerName: getPlayerName(b),
                  category: b.sport,
                  date: b.date,
                  amount: b.totalAmount,
                }))}
                emptyMessage="No completed transactions yet."
              />
            </div>
          </div>
        </SlideUp>

        {/* ── Pricing CTA ── */}
        <SlideUp delay={0.2}>
          <motion.div
            className="flex flex-col items-start justify-between gap-5 rounded-2xl bg-gradient-to-br from-slate-800 to-slate-900 p-6 shadow-md sm:flex-row sm:items-center sm:p-8"
            whileHover={{ scale: 1.005 }}
            transition={{ type: "spring", stiffness: 300, damping: 25 }}
          >
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold uppercase tracking-widest text-orange-400">
                  Pricing Management
                </span>
              </div>
              <h3 className="text-lg font-bold text-white">Update your session rates</h3>
              <p className="max-w-md text-sm text-slate-400">
                Keep your pricing competitive. Adjust hourly rates, sport-specific pricing, and
                session packages to maximize your earnings.
              </p>
            </div>
            <Link href="/coach/profile" className="shrink-0">
              <Button
                variant="primary"
                size="md"
                icon={<ArrowRight className="h-4 w-4" />}
                className="whitespace-nowrap"
              >
                Go to Profile
              </Button>
            </Link>
          </motion.div>
        </SlideUp>
      </div>
    </div>
  );
}
