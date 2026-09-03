"use client";

import axiosInstance from "@/lib/api/axios";
import { toast } from "@/lib/toast";
import {
  CategoryBreakdownList,
  EarningsStatCard,
  MonthlyBarChart,
  RecentTransactionsList,
} from "@/modules/shared/components/dashboard/earnings";
import { Button } from "@/modules/shared/ui/Button";
import { SlideUp } from "@/modules/shared/ui/motion/SlideUp";
import type { Booking, EarningsData, MonthlyEarning, SportEarning } from "@/types";
import { motion } from "framer-motion";
import {
  ArrowRight,
  Calendar,
  Clock,
  IndianRupee,
  Loader2,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

// ─── helpers ────────────────────────────────────────────────────────────────

function getCustomerName(booking: Booking): string {
  const user = booking.userId;
  if (typeof user === "object" && user !== null && "name" in user) {
    return (user as { name: string }).name;
  }
  if (booking.participantName) return booking.participantName;
  return "Customer";
}

// ─── Main Page ───────────────────────────────────────────────────────────────

export default function VenueListerEarningsPage() {
  const [data, setData] = useState<EarningsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchEarnings = async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await axiosInstance.get<{
          success: boolean;
          data: EarningsData;
          message?: string;
        }>("/venues/earnings");
        if (res.data.success && res.data.data) {
          setData(res.data.data);
        } else {
          throw new Error(res.data.message || "Failed to load earnings data.");
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

  // Compute monthly trend: thisMonth vs lastMonth
  const monthlyTrend =
    data && data.lastMonth.total > 0
      ? {
          value: Number(
            (((data.thisMonth.total - data.lastMonth.total) / data.lastMonth.total) * 100).toFixed(
              1
            )
          ),
          positive: data.thisMonth.total >= data.lastMonth.total,
        }
      : null;

  // Map bySport → CategoryBreakdownList items
  const categoryItems = (data?.bySport ?? []).map((s: SportEarning) => ({
    category: s.sport,
    total: s.total,
    sessions: s.sessions,
  }));

  // Map recentBookings → RecentTransactionsList transactions
  const recentTransactions = (data?.recentBookings ?? []).map((b: Booking) => ({
    id: b.id,
    customerName: getCustomerName(b),
    category: b.sport,
    date: b.date,
    amount: b.totalAmount,
  }));

  // Last 6 months for the chart
  const last6Months: MonthlyEarning[] = data ? data.byMonth.slice(-6) : [];

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

  // ── Empty state ──────────────────────────────────────────────────────────
  const isEmpty =
    data.allTime.total === 0 &&
    data.byMonth.length === 0 &&
    data.bySport.length === 0 &&
    data.recentBookings.length === 0;

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
              <p className="mt-0.5 text-sm text-slate-400">Your venue revenue overview</p>
            </div>
            <Link href="/venue-lister/inventory">
              <Button variant="outline" size="sm" icon={<IndianRupee className="h-4 w-4" />}>
                Update Pricing
              </Button>
            </Link>
          </div>
        </SlideUp>

        {/* ── Empty state banner ── */}
        {isEmpty && (
          <SlideUp delay={0.05}>
            <div className="flex flex-col items-center gap-3 rounded-2xl border border-slate-100 bg-white p-8 text-center shadow-sm">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-orange-50">
                <IndianRupee className="h-6 w-6 text-orange-400" />
              </div>
              <p className="font-semibold text-slate-700">No earnings yet</p>
              <p className="max-w-xs text-sm text-slate-400">
                Once customers book your venue, your earnings will appear here.
              </p>
              <Link href="/venue-lister/inventory">
                <Button variant="primary" size="sm">
                  Set up your venue
                </Button>
              </Link>
            </div>
          </SlideUp>
        )}

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
              icon={
                (monthlyTrend?.positive ?? true) ? (
                  <TrendingUp className="h-5 w-5" />
                ) : (
                  <TrendingDown className="h-5 w-5" />
                )
              }
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

        {/* ── Monthly Trend chart ── */}
        <SlideUp delay={0.1}>
          <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
            <div className="mb-5 flex items-center justify-between">
              <div>
                <h2 className="text-base font-semibold text-slate-800">Monthly Trend</h2>
                <p className="mt-0.5 text-xs text-slate-400">
                  Last {last6Months.length} month
                  {last6Months.length !== 1 ? "s" : ""}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="bg-power-orange inline-block h-3 w-3 rounded-sm" />
                <span className="text-xs text-slate-400">Revenue</span>
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
            {/* By sport / category */}
            <div className="flex flex-col gap-5 rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
              <div>
                <h2 className="text-base font-semibold text-slate-800">Earnings by Sport</h2>
                <p className="mt-0.5 text-xs text-slate-400">Breakdown across all sports offered</p>
              </div>
              <CategoryBreakdownList items={categoryItems} emptyMessage="No sport bookings yet." />
            </div>

            {/* Recent transactions */}
            <div className="flex flex-col gap-5 rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
              <div>
                <h2 className="text-base font-semibold text-slate-800">Recent Transactions</h2>
                <p className="mt-0.5 text-xs text-slate-400">
                  Last {Math.min(10, data.recentBookings.length)} completed booking
                  {data.recentBookings.length !== 1 ? "s" : ""}
                </p>
              </div>
              <RecentTransactionsList
                transactions={recentTransactions}
                emptyMessage="No completed bookings yet."
              />
            </div>
          </div>
        </SlideUp>

        {/* ── Dark CTA ── */}
        <SlideUp delay={0.2}>
          <motion.div
            className="flex flex-col items-start justify-between gap-5 rounded-2xl bg-gradient-to-br from-slate-800 to-slate-900 p-6 shadow-md sm:flex-row sm:items-center sm:p-8"
            whileHover={{ scale: 1.005 }}
            transition={{ type: "spring", stiffness: 300, damping: 25 }}
          >
            <div className="flex flex-col gap-1.5">
              <span className="text-xs font-semibold tracking-widest text-orange-400 uppercase">
                Pricing Management
              </span>
              <h3 className="text-lg font-bold text-white">Update venue pricing</h3>
              <p className="max-w-md text-sm text-slate-400">
                Keep your venue competitive. Adjust slot rates, sport-specific pricing, and
                availability to maximise your revenue.
              </p>
            </div>
            <Link href="/venue-lister/inventory" className="shrink-0">
              <Button
                variant="primary"
                size="md"
                icon={<ArrowRight className="h-4 w-4" />}
                className="whitespace-nowrap"
              >
                Manage Inventory
              </Button>
            </Link>
          </motion.div>
        </SlideUp>
      </div>
    </div>
  );
}
