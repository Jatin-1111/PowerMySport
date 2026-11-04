"use client";

import { AdminPageHeader } from "@/modules/admin/components/AdminPageHeader";
import { PendingCounts, PlatformStats, statsApi } from "@/modules/analytics/services/stats";
import { ArrowUpRight, CheckCircle2, RotateCw } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

type QueueItem = {
  key: keyof PendingCounts;
  href: string;
  label: string;
  hint: string;
};

const QUEUE: QueueItem[] = [
  {
    key: "disputes",
    href: "/admin/disputes",
    label: "Disputes",
    hint: "Payment disputes waiting on a decision",
  },
  {
    key: "webhookErrors",
    href: "/admin/webhook-recovery",
    label: "Webhook errors",
    hint: "Payment events that failed and need a retry",
  },
  {
    key: "supportTickets",
    href: "/admin/support-tickets",
    label: "Support tickets",
    hint: "Open tickets from parents and providers",
  },
  {
    key: "coachVerification",
    href: "/admin/coach-verification",
    label: "Coach verification",
    hint: "Coaches submitted documents for review",
  },
  {
    key: "venueApprovals",
    href: "/admin/venue-approval",
    label: "Venue approvals",
    hint: "New venues waiting to go live",
  },
  {
    key: "academyOnboarding",
    href: "/admin/academy-onboarding",
    label: "Academy onboarding",
    hint: "Academies that finished the onboarding form",
  },
  {
    key: "conciergeRequests",
    href: "/admin/concierge-requests",
    label: "Concierge requests",
    hint: "Parents asking for hands-on help",
  },
  {
    key: "communityReports",
    href: "/admin/community-reports",
    label: "Community reports",
    hint: "Posts and members flagged by the community",
  },
  {
    key: "dataSourcesPending",
    href: "/admin/data-sources",
    label: "Data sources",
    hint: "Scraped records waiting for review",
  },
];

const inr = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});
const num = new Intl.NumberFormat("en-IN");

export default function AdminDashboard() {
  const [stats, setStats] = useState<PlatformStats | null>(null);
  const [pending, setPending] = useState<PendingCounts | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [statsRes, pendingRes] = await Promise.all([
        statsApi.getPlatformStats(),
        statsApi.getPendingCounts().catch(() => null),
      ]);

      if (statsRes.success && statsRes.data) {
        setStats(statsRes.data);
      } else {
        setError(statsRes.message || "We couldn't load the platform totals.");
      }
      if (pendingRes?.success && pendingRes.data) {
        setPending(pendingRes.data);
      }
    } catch (err) {
      console.error("Failed to fetch dashboard data:", err);
      setError("We couldn't load the platform totals.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const queue = useMemo(() => {
    if (!pending) return [];
    return QUEUE.map((item) => ({ ...item, count: pending[item.key] ?? 0 })).sort(
      (a, b) => b.count - a.count
    );
  }, [pending]);

  const waiting = queue.filter((item) => item.count > 0);
  const totalWaiting = waiting.reduce((sum, item) => sum + item.count, 0);

  const figures = stats
    ? [
        { label: "Revenue", value: inr.format(stats.revenue), href: "/admin/payouts" },
        { label: "Bookings", value: num.format(stats.totalBookings), href: "/admin/bookings" },
        { label: "Users", value: num.format(stats.totalUsers), href: "/admin/users" },
        { label: "Venues", value: num.format(stats.totalVenues), href: "/admin/venues" },
      ]
    : [];

  return (
    <div className="space-y-8">
      <AdminPageHeader
        badge="Overview"
        title="Dashboard"
        subtitle="What needs a decision today, and where the platform stands."
      />

      {error && (
        <div
          role="alert"
          className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3"
        >
          <p className="text-sm font-medium text-red-800">{error}</p>
          <button
            type="button"
            onClick={() => void load()}
            className="inline-flex items-center gap-1.5 rounded-lg border border-red-300 bg-white px-3 py-1.5 text-sm font-semibold text-red-800 hover:bg-red-100"
          >
            <RotateCw size={14} aria-hidden />
            Try again
          </button>
        </div>
      )}

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,7fr)_minmax(0,4fr)]">
        {/* ── Work queue ── */}
        <section
          aria-labelledby="queue-heading"
          className="rounded-2xl bg-slate-900/[0.04] p-1.5 ring-1 ring-slate-900/5"
        >
          <div className="rounded-[calc(1rem-0.375rem)] bg-white shadow-[inset_0_1px_0_rgb(255_255_255),0_1px_2px_rgb(15_23_42/0.04)]">
            <div className="flex items-baseline justify-between gap-4 px-5 pb-3 pt-5">
              <h2 id="queue-heading" className="text-base font-semibold text-slate-900">
                Needs attention
              </h2>
              {!loading && pending && (
                <p className="text-sm tabular-nums text-slate-500">
                  {totalWaiting > 0 ? `${num.format(totalWaiting)} waiting` : "Nothing waiting"}
                </p>
              )}
            </div>

            {loading ? (
              <ul aria-hidden className="divide-y divide-slate-100 px-5 pb-3">
                {Array.from({ length: 5 }, (_, i) => (
                  <li key={i} className="flex items-center justify-between gap-4 py-4">
                    <div className="space-y-2">
                      <div className="skeleton h-4 w-40" />
                      <div className="skeleton h-3 w-64 max-w-full" />
                    </div>
                    <div className="skeleton h-6 w-8" />
                  </li>
                ))}
              </ul>
            ) : !pending ? (
              <p className="px-5 pb-6 pt-2 text-sm text-slate-600">
                The queue didn&apos;t load. Use the menu to open a section directly.
              </p>
            ) : waiting.length === 0 ? (
              <div className="flex items-center gap-3 px-5 pb-6 pt-2">
                <CheckCircle2 className="text-emerald-600" size={20} aria-hidden />
                <p className="text-sm text-slate-700">
                  Every queue is empty. New items will show up here.
                </p>
              </div>
            ) : (
              <ul className="divide-y divide-slate-100 px-2 pb-2">
                {waiting.map((item) => (
                  <li key={item.key}>
                    <Link
                      href={item.href}
                      className="group flex items-center justify-between gap-4 rounded-lg px-3 py-3.5 hover:bg-slate-50"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-slate-900">{item.label}</p>
                        <p className="mt-0.5 truncate text-sm text-slate-500">{item.hint}</p>
                      </div>
                      <div className="flex shrink-0 items-center gap-3">
                        <span className="text-xl font-semibold tabular-nums text-slate-900">
                          {num.format(item.count)}
                        </span>
                        <ArrowUpRight
                          size={16}
                          aria-hidden
                          className="text-slate-400 transition-transform duration-200 ease-[cubic-bezier(0.32,0.72,0,1)] group-hover:-translate-y-px group-hover:translate-x-0.5 group-hover:text-slate-700"
                        />
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}

            {!loading && pending && waiting.length > 0 && queue.length > waiting.length && (
              <p className="border-t border-slate-100 px-5 py-3 text-xs text-slate-500">
                {queue.length - waiting.length} other queues are clear.
              </p>
            )}
          </div>
        </section>

        {/* ── Platform figures ── */}
        <section aria-labelledby="figures-heading">
          <h2 id="figures-heading" className="mb-3 text-base font-semibold text-slate-900">
            Platform totals
          </h2>
          <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl bg-slate-200 ring-1 ring-slate-200 lg:grid-cols-1">
            {loading
              ? Array.from({ length: 4 }, (_, i) => (
                  <div key={i} aria-hidden className="bg-white p-5">
                    <div className="skeleton h-3 w-16" />
                    <div className="skeleton mt-3 h-7 w-28" />
                  </div>
                ))
              : figures.map((figure) => (
                  <Link
                    key={figure.label}
                    href={figure.href}
                    className="group bg-white p-5 transition-colors hover:bg-slate-50"
                  >
                    <dt className="text-sm text-slate-500">{figure.label}</dt>
                    <dd className="mt-1.5 text-2xl font-semibold tabular-nums tracking-tight text-slate-900">
                      {figure.value}
                    </dd>
                  </Link>
                ))}
          </dl>
          {!loading && stats && stats.pendingInquiries > 0 && (
            <p className="mt-3 text-sm text-slate-600">
              <span className="font-semibold tabular-nums text-slate-900">
                {num.format(stats.pendingInquiries)}
              </span>{" "}
              inquiries haven&apos;t been answered yet.
            </p>
          )}
        </section>
      </div>
    </div>
  );
}
