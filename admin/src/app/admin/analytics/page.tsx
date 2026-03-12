"use client";

import { AdminPageHeader } from "@/modules/admin/components/AdminPageHeader";
import {
  FinanceReconciliation,
  FunnelSummaryRow,
  statsApi,
} from "@/modules/analytics/services/stats";
import { Card } from "@/modules/shared/ui/Card";
import { useCallback, useEffect, useMemo, useState } from "react";

type AnalyticsTab = "FUNNEL" | "FINANCE" | "OBSERVABILITY";
const funnelDayOptions = [7, 14, 30, 90] as const;

export default function AdminAnalyticsPage() {
  const [activeTab, setActiveTab] = useState<AnalyticsTab>("FUNNEL");
  const [funnelDays, setFunnelDays] =
    useState<(typeof funnelDayOptions)[number]>(30);
  const [funnelRows, setFunnelRows] = useState<FunnelSummaryRow[]>([]);
  const [finance, setFinance] = useState<FinanceReconciliation | null>(null);
  const [observability, setObservability] = useState<unknown>(null);
  const [loadingFunnel, setLoadingFunnel] = useState(true);
  const [loadingFinance, setLoadingFinance] = useState(true);
  const [loadingObservability, setLoadingObservability] = useState(true);

  const loadFunnel = useCallback(async () => {
    setLoadingFunnel(true);
    try {
      const response = await statsApi.getFunnelSummary(funnelDays);
      if (response.success && response.data) {
        setFunnelRows(response.data.events ?? []);
      }
    } finally {
      setLoadingFunnel(false);
    }
  }, [funnelDays]);

  const loadFinance = useCallback(async () => {
    setLoadingFinance(true);
    try {
      const response = await statsApi.getFinanceReconciliation();
      if (response.success && response.data) {
        setFinance(response.data);
      }
    } finally {
      setLoadingFinance(false);
    }
  }, []);

  const loadObservability = useCallback(async () => {
    setLoadingObservability(true);
    try {
      const response = await statsApi.getObservabilitySnapshot();
      if (response.success) {
        setObservability(response.data ?? null);
      }
    } finally {
      setLoadingObservability(false);
    }
  }, []);

  useEffect(() => {
    void loadFunnel();
  }, [loadFunnel]);

  useEffect(() => {
    void loadFinance();
    void loadObservability();
  }, [loadFinance, loadObservability]);

  const mismatchRateLabel = useMemo(() => {
    if (!finance) return "0%";
    return `${finance.mismatchRate.toFixed(2)}%`;
  }, [finance]);

  return (
    <div className="space-y-6">
      <AdminPageHeader
        badge="Admin"
        title="Analytics"
        subtitle="Monitor funnel activity, payment reconciliation, and platform observability snapshots."
      />

      <Card className="space-y-4 bg-white">
        <div className="flex flex-wrap items-center gap-2">
          {[
            { id: "FUNNEL", label: "Funnel" },
            { id: "FINANCE", label: "Finance" },
            { id: "OBSERVABILITY", label: "Observability" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as AnalyticsTab)}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                activeTab === tab.id
                  ? "bg-power-orange text-white"
                  : "border border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {activeTab === "FUNNEL" && (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-slate-700">
                Window:
              </span>
              <select
                value={funnelDays}
                onChange={(event) =>
                  setFunnelDays(
                    Number(
                      event.target.value,
                    ) as (typeof funnelDayOptions)[number],
                  )
                }
                className="rounded border border-slate-300 px-3 py-1.5 text-sm"
              >
                {funnelDayOptions.map((days) => (
                  <option key={days} value={days}>
                    Last {days} days
                  </option>
                ))}
              </select>
            </div>

            {loadingFunnel ? (
              <div className="py-10 text-center text-slate-500">
                Loading funnel summary...
              </div>
            ) : funnelRows.length === 0 ? (
              <div className="py-10 text-center text-slate-500">
                No funnel events found.
              </div>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-slate-200">
                <table className="min-w-full divide-y divide-slate-200 text-sm">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="px-4 py-3 text-left font-semibold text-slate-700">
                        Event
                      </th>
                      <th className="px-4 py-3 text-left font-semibold text-slate-700">
                        Count
                      </th>
                      <th className="px-4 py-3 text-left font-semibold text-slate-700">
                        Unique Users
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {funnelRows.map((row) => (
                      <tr key={row.eventName}>
                        <td className="px-4 py-3 text-slate-800">
                          {row.eventName}
                        </td>
                        <td className="px-4 py-3 text-slate-600">
                          {row.count}
                        </td>
                        <td className="px-4 py-3 text-slate-600">
                          {row.uniqueUsers}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {activeTab === "FINANCE" && (
          <div className="space-y-4">
            {loadingFinance ? (
              <div className="py-10 text-center text-slate-500">
                Loading finance reconciliation...
              </div>
            ) : !finance ? (
              <div className="py-10 text-center text-slate-500">
                No finance reconciliation data found.
              </div>
            ) : (
              <>
                <div className="grid gap-4 md:grid-cols-4">
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Bookings Checked
                    </p>
                    <p className="mt-2 text-2xl font-semibold text-slate-900">
                      {finance.totalBookingsChecked}
                    </p>
                  </div>
                  <div className="rounded-xl border border-green-200 bg-green-50 p-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-green-700">
                      Matched
                    </p>
                    <p className="mt-2 text-2xl font-semibold text-green-900">
                      {finance.matched}
                    </p>
                  </div>
                  <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">
                      Mismatched
                    </p>
                    <p className="mt-2 text-2xl font-semibold text-amber-900">
                      {finance.mismatched}
                    </p>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Mismatch Rate
                    </p>
                    <p className="mt-2 text-2xl font-semibold text-slate-900">
                      {mismatchRateLabel}
                    </p>
                  </div>
                </div>

                <div className="overflow-x-auto rounded-xl border border-slate-200">
                  <table className="min-w-full divide-y divide-slate-200 text-sm">
                    <thead className="bg-slate-50">
                      <tr>
                        <th className="px-4 py-3 text-left font-semibold text-slate-700">
                          Booking
                        </th>
                        <th className="px-4 py-3 text-left font-semibold text-slate-700">
                          Expected
                        </th>
                        <th className="px-4 py-3 text-left font-semibold text-slate-700">
                          Paid
                        </th>
                        <th className="px-4 py-3 text-left font-semibold text-slate-700">
                          Status
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white">
                      {finance.sampleMismatches.length === 0 ? (
                        <tr>
                          <td
                            colSpan={4}
                            className="px-4 py-8 text-center text-slate-500"
                          >
                            No mismatches found in the sample.
                          </td>
                        </tr>
                      ) : (
                        finance.sampleMismatches.map((item) => (
                          <tr key={item.bookingId}>
                            <td className="px-4 py-3 font-mono text-xs text-slate-700">
                              {item.bookingId}
                            </td>
                            <td className="px-4 py-3 text-slate-600">
                              {item.expected}
                            </td>
                            <td className="px-4 py-3 text-slate-600">
                              {item.paid}
                            </td>
                            <td className="px-4 py-3 text-slate-600">
                              {item.status}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        )}

        {activeTab === "OBSERVABILITY" && (
          <div className="space-y-4">
            {loadingObservability ? (
              <div className="py-10 text-center text-slate-500">
                Loading observability snapshot...
              </div>
            ) : (
              <pre className="max-h-128 overflow-auto rounded-xl border border-slate-200 bg-slate-950 p-4 text-xs text-slate-100">
                {JSON.stringify(observability, null, 2)}
              </pre>
            )}
          </div>
        )}
      </Card>
    </div>
  );
}
