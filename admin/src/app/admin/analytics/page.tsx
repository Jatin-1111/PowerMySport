"use client";

import { AdminPageHeader } from "@/modules/admin/components/AdminPageHeader";
import {
  FinanceReconciliation,
  FunnelSummaryRow,
  FunnelTrends,
  PlayersAnalytics,
  CoachesAnalytics,
  PlatformStats,
  ObservabilitySnapshot,
  UserGrowthPoint,
  UsersRoleSummary,
  VenueListersAnalytics,
  statsApi,
} from "@/modules/analytics/services/stats";
import { Card } from "@/modules/shared/ui/Card";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useCallback, useEffect, useMemo, useState } from "react";

type AnalyticsTab = "OVERVIEW" | "FUNNEL" | "FINANCE" | "OBSERVABILITY";
const funnelDayOptions = [7, 14, 30, 90] as const;

const ROLE_COLORS = {
  PLAYER: "#0ea5e9",
  COACH: "#10b981",
  VENUE_LISTER: "#f97316",
} as const;

const SOURCE_COLORS = {
  WEB: "#f97316",
  MOBILE: "#0ea5e9",
  SERVER: "#8b5cf6",
} as const;

const FINANCE_COLORS = {
  matched: "#10b981",
  mismatched: "#ef4444",
} as const;

const DEFAULT_PLATFORM_STATS: PlatformStats = {
  totalUsers: 0,
  totalVenues: 0,
  totalBookings: 0,
  pendingInquiries: 0,
  revenue: 0,
};

const DEFAULT_ROLE_SUMMARY: UsersRoleSummary = {
  PLAYER: 0,
  COACH: 0,
  VENUE_LISTER: 0,
};

function formatNumber(value: number): string {
  return value.toLocaleString();
}

function ChartCard({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <Card className="bg-white">
      <div className="space-y-4">
        <div>
          <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
          <p className="text-sm text-slate-500">{description}</p>
        </div>
        <div className="h-80">{children}</div>
      </div>
    </Card>
  );
}

function MetricCard({
  label,
  value,
  detail,
  accentClassName,
}: {
  label: string;
  value: string;
  detail?: string;
  accentClassName: string;
}) {
  return (
    <div className={`rounded-xl border bg-white p-4 ${accentClassName}`}>
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </p>
      <p className="mt-2 text-2xl font-semibold text-slate-900">{value}</p>
      {detail ? <p className="mt-1 text-sm text-slate-500">{detail}</p> : null}
    </div>
  );
}

export default function AdminAnalyticsPage() {
  const [activeTab, setActiveTab] = useState<AnalyticsTab>("OVERVIEW");
  const [funnelDays, setFunnelDays] =
    useState<(typeof funnelDayOptions)[number]>(30);
  const [platformStats, setPlatformStats] = useState<PlatformStats>(
    DEFAULT_PLATFORM_STATS,
  );
  const [roleSummary, setRoleSummary] =
    useState<UsersRoleSummary>(DEFAULT_ROLE_SUMMARY);
  const [playersAnalytics, setPlayersAnalytics] =
    useState<PlayersAnalytics | null>(null);
  const [coachesAnalytics, setCoachesAnalytics] =
    useState<CoachesAnalytics | null>(null);
  const [venueListersAnalytics, setVenueListersAnalytics] =
    useState<VenueListersAnalytics | null>(null);
  const [userGrowth, setUserGrowth] = useState<UserGrowthPoint[]>([]);
  const [funnelRows, setFunnelRows] = useState<FunnelSummaryRow[]>([]);
  const [funnelTrends, setFunnelTrends] = useState<FunnelTrends | null>(null);
  const [finance, setFinance] = useState<FinanceReconciliation | null>(null);
  const [observability, setObservability] =
    useState<ObservabilitySnapshot | null>(null);
  const [loadingOverview, setLoadingOverview] = useState(true);
  const [loadingFunnel, setLoadingFunnel] = useState(true);
  const [loadingFinance, setLoadingFinance] = useState(false);
  const [loadingObservability, setLoadingObservability] = useState(false);
  const [overviewLoaded, setOverviewLoaded] = useState(false);
  const [financeLoaded, setFinanceLoaded] = useState(false);
  const [observabilityLoaded, setObservabilityLoaded] = useState(false);

  const loadOverview = useCallback(async () => {
    if (overviewLoaded) return;

    setLoadingOverview(true);
    try {
      const [
        platformResponse,
        roleSummaryResponse,
        playersResponse,
        coachesResponse,
        venueListersResponse,
        userGrowthResponse,
        funnelTrendsResponse,
      ] = await Promise.all([
        statsApi.getPlatformStats(),
        statsApi.getUsersRoleSummary(),
        statsApi.getPlayersAnalytics(),
        statsApi.getCoachesAnalytics(),
        statsApi.getVenueListersAnalytics(),
        statsApi.getUserGrowthAnalytics(),
        statsApi.getFunnelTrends(30),
      ]);

      if (platformResponse.success && platformResponse.data) {
        setPlatformStats(platformResponse.data);
      }

      if (roleSummaryResponse.success && roleSummaryResponse.data) {
        setRoleSummary(roleSummaryResponse.data);
      }

      if (playersResponse.success && playersResponse.data) {
        setPlayersAnalytics(playersResponse.data);
      }

      if (coachesResponse.success && coachesResponse.data) {
        setCoachesAnalytics(coachesResponse.data);
      }

      if (venueListersResponse.success && venueListersResponse.data) {
        setVenueListersAnalytics(venueListersResponse.data);
      }

      if (userGrowthResponse.success && userGrowthResponse.data) {
        setUserGrowth(userGrowthResponse.data.series ?? []);
      }

      if (funnelTrendsResponse.success && funnelTrendsResponse.data) {
        setFunnelTrends(funnelTrendsResponse.data);
      }

      setOverviewLoaded(true);
    } finally {
      setLoadingOverview(false);
    }
  }, [overviewLoaded]);

  const loadFunnel = useCallback(async () => {
    setLoadingFunnel(true);
    try {
      const [summaryResponse, trendResponse] = await Promise.all([
        statsApi.getFunnelSummary(funnelDays),
        statsApi.getFunnelTrends(funnelDays),
      ]);

      if (summaryResponse.success && summaryResponse.data) {
        setFunnelRows(summaryResponse.data.events ?? []);
      }

      if (trendResponse.success && trendResponse.data) {
        setFunnelTrends(trendResponse.data);
      }
    } finally {
      setLoadingFunnel(false);
    }
  }, [funnelDays]);

  const loadFinance = useCallback(async () => {
    if (financeLoaded) return;
    setLoadingFinance(true);
    try {
      const response = await statsApi.getFinanceReconciliation();
      if (response.success && response.data) {
        setFinance(response.data);
        setFinanceLoaded(true);
      }
    } finally {
      setLoadingFinance(false);
    }
  }, [financeLoaded]);

  const loadObservability = useCallback(async () => {
    if (observabilityLoaded) return;
    setLoadingObservability(true);
    try {
      const response = await statsApi.getObservabilitySnapshot();
      if (response.success) {
        setObservability(response.data ?? null);
        setObservabilityLoaded(true);
      }
    } finally {
      setLoadingObservability(false);
    }
  }, [observabilityLoaded]);

  useEffect(() => {
    void loadOverview();
  }, [loadOverview]);

  useEffect(() => {
    if (activeTab === "FUNNEL") void loadFunnel();
  }, [activeTab, loadFunnel]);

  useEffect(() => {
    if (activeTab === "FINANCE") void loadFinance();
    if (activeTab === "OBSERVABILITY") void loadObservability();
  }, [activeTab, loadFinance, loadObservability]);

  const roleDistributionData = useMemo(
    () => [
      {
        name: "Players",
        value: roleSummary.PLAYER,
        color: ROLE_COLORS.PLAYER,
      },
      {
        name: "Coaches",
        value: roleSummary.COACH,
        color: ROLE_COLORS.COACH,
      },
      {
        name: "Venue Listers",
        value: roleSummary.VENUE_LISTER,
        color: ROLE_COLORS.VENUE_LISTER,
      },
    ],
    [roleSummary],
  );

  const financeChartData = useMemo(() => {
    if (!finance) return [];

    return [
      {
        name: "Matched",
        value: finance.matched,
        color: FINANCE_COLORS.matched,
      },
      {
        name: "Mismatched",
        value: finance.mismatched,
        color: FINANCE_COLORS.mismatched,
      },
    ];
  }, [finance]);

  const topEventData = useMemo(() => funnelRows.slice(0, 8), [funnelRows]);

  const mismatchRateLabel = useMemo(() => {
    if (!finance) return "0.00%";
    return `${(finance.mismatchRate * 100).toFixed(2)}%`;
  }, [finance]);

  const coachVerificationRate = useMemo(() => {
    if (!coachesAnalytics || coachesAnalytics.totalCoaches === 0) return "0%";
    return `${(
      (coachesAnalytics.verifiedCount / coachesAnalytics.totalCoaches) *
      100
    ).toFixed(1)}%`;
  }, [coachesAnalytics]);

  const venueCoverageRate = useMemo(() => {
    if (
      !venueListersAnalytics ||
      venueListersAnalytics.totalVenueListers === 0
    ) {
      return "0%";
    }

    return `${(
      (venueListersAnalytics.withAtLeastOneVenue /
        venueListersAnalytics.totalVenueListers) *
      100
    ).toFixed(1)}%`;
  }, [venueListersAnalytics]);

  const monthlyGrowthSeries = userGrowth.map((point) => ({
    ...point,
    label: point.label,
  }));

  const funnelTrendData = funnelTrends?.dailyActivity ?? [];
  const funnelSourceData = funnelTrends?.sourceBreakdown ?? [];
  const observabilityRoutes = observability?.routes ?? [];
  const observabilityTopRoutes = [...observabilityRoutes]
    .sort((a, b) => b.totalRequests - a.totalRequests)
    .slice(0, 8)
    .map((route) => ({
      ...route,
      shortRouteKey:
        route.routeKey.length > 34
          ? `${route.routeKey.slice(0, 34)}...`
          : route.routeKey,
    }));

  const observabilitySummary = observability
    ? [
        {
          label: "Total requests",
          value: formatNumber(observability.totals.requests),
          detail: "All tracked admin and API hits",
        },
        {
          label: "Total errors",
          value: formatNumber(observability.totals.errors),
          detail: `${(observability.totals.errorRate * 100).toFixed(2)}% error rate`,
        },
        {
          label: "Tracked routes",
          value: formatNumber(observability.routes.length),
          detail: "Routes in the current snapshot",
        },
        {
          label: "Snapshot time",
          value: new Date(observability.generatedAt).toLocaleTimeString(),
          detail: new Date(observability.generatedAt).toLocaleDateString(),
        },
      ]
    : [];

  if (loadingOverview) {
    return (
      <div className="py-12 text-center text-slate-500">
        Loading analytics...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <AdminPageHeader
        badge="Admin"
        title="Analytics"
        subtitle="Track growth, funnel activity, and payment reconciliation with chart-backed admin analytics."
      />

      <Card className="space-y-4 bg-white">
        <div className="flex flex-wrap items-center gap-2">
          {[
            { id: "OVERVIEW", label: "Overview" },
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

        {activeTab === "OVERVIEW" && (
          <div className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <MetricCard
                label="Total Users"
                value={formatNumber(platformStats.totalUsers)}
                detail="Platform-wide user base"
                accentClassName="border-slate-200"
              />
              <MetricCard
                label="Total Venues"
                value={formatNumber(platformStats.totalVenues)}
                detail="Approved and pending venues"
                accentClassName="border-slate-200"
              />
              <MetricCard
                label="Total Bookings"
                value={formatNumber(platformStats.totalBookings)}
                detail="Bookings tracked in the platform"
                accentClassName="border-slate-200"
              />
              <MetricCard
                label="Revenue"
                value={formatNumber(platformStats.revenue)}
                detail="Confirmed booking revenue"
                accentClassName="border-slate-200"
              />
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <MetricCard
                label="Player accounts"
                value={formatNumber(playersAnalytics?.totalPlayers ?? 0)}
                detail={`${formatNumber(playersAnalytics?.newThisMonth ?? 0)} new this month`}
                accentClassName="border-blue-100"
              />
              <MetricCard
                label="Coach verification"
                value={coachVerificationRate}
                detail={`${formatNumber(coachesAnalytics?.verifiedCount ?? 0)} verified coaches`}
                accentClassName="border-emerald-100"
              />
              <MetricCard
                label="Venue coverage"
                value={venueCoverageRate}
                detail={`${formatNumber(venueListersAnalytics?.withAtLeastOneVenue ?? 0)} venue listers with venues`}
                accentClassName="border-orange-100"
              />
            </div>

            <div className="grid gap-6 xl:grid-cols-2">
              <ChartCard
                title="User mix"
                description="Current distribution of players, coaches, and venue listers."
              >
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={roleDistributionData}
                      dataKey="value"
                      nameKey="name"
                      innerRadius={68}
                      outerRadius={100}
                      paddingAngle={3}
                    >
                      {roleDistributionData.map((entry) => (
                        <Cell key={entry.name} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(value) => formatNumber(Number(value))}
                    />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </ChartCard>

              <ChartCard
                title="Monthly user growth"
                description="Signups by role across the last six months."
              >
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={monthlyGrowthSeries}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis
                      dataKey="label"
                      tick={{ fill: "#475569", fontSize: 12 }}
                    />
                    <YAxis tick={{ fill: "#475569", fontSize: 12 }} />
                    <Tooltip
                      formatter={(value) => formatNumber(Number(value))}
                    />
                    <Legend />
                    <Bar
                      dataKey="PLAYER"
                      stackId="users"
                      fill={ROLE_COLORS.PLAYER}
                    />
                    <Bar
                      dataKey="COACH"
                      stackId="users"
                      fill={ROLE_COLORS.COACH}
                    />
                    <Bar
                      dataKey="VENUE_LISTER"
                      stackId="users"
                      fill={ROLE_COLORS.VENUE_LISTER}
                    />
                    <Line
                      type="monotone"
                      dataKey="total"
                      stroke="#0f172a"
                      strokeWidth={2}
                      dot={{ r: 3 }}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </ChartCard>
            </div>

            <div className="grid gap-6 xl:grid-cols-2">
              <ChartCard
                title="Daily funnel activity"
                description="Tracked funnel events split by source."
              >
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={funnelTrendData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis
                      dataKey="label"
                      tick={{ fill: "#475569", fontSize: 12 }}
                    />
                    <YAxis tick={{ fill: "#475569", fontSize: 12 }} />
                    <Tooltip
                      formatter={(value) => formatNumber(Number(value))}
                    />
                    <Legend />
                    <Bar
                      dataKey="WEB"
                      stackId="source"
                      fill={SOURCE_COLORS.WEB}
                    />
                    <Bar
                      dataKey="MOBILE"
                      stackId="source"
                      fill={SOURCE_COLORS.MOBILE}
                    />
                    <Bar
                      dataKey="SERVER"
                      stackId="source"
                      fill={SOURCE_COLORS.SERVER}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </ChartCard>

              <ChartCard
                title="Funnel source mix"
                description="How tracked events are distributed across web, mobile, and server."
              >
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={funnelSourceData}
                      dataKey="count"
                      nameKey="source"
                      innerRadius={68}
                      outerRadius={100}
                      paddingAngle={3}
                    >
                      {funnelSourceData.map((entry) => (
                        <Cell
                          key={entry.source}
                          fill={SOURCE_COLORS[entry.source]}
                        />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(value) => formatNumber(Number(value))}
                    />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </ChartCard>
            </div>
          </div>
        )}

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
                Loading funnel analytics...
              </div>
            ) : (
              <div className="grid gap-6 xl:grid-cols-2">
                <ChartCard
                  title="Top funnel events"
                  description="Most frequent event names in the selected window."
                >
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={topEventData}
                      layout="vertical"
                      margin={{ left: 12 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis
                        type="number"
                        tick={{ fill: "#475569", fontSize: 12 }}
                      />
                      <YAxis
                        type="category"
                        dataKey="eventName"
                        width={140}
                        tick={{ fill: "#475569", fontSize: 12 }}
                      />
                      <Tooltip
                        formatter={(value) => formatNumber(Number(value))}
                      />
                      <Legend />
                      <Bar dataKey="count" fill="#f97316" name="Events" />
                      <Bar
                        dataKey="uniqueUsers"
                        fill="#0ea5e9"
                        name="Unique users"
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </ChartCard>

                <ChartCard
                  title="Daily source activity"
                  description="Event volume by source across the selected window."
                >
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={funnelTrends?.dailyActivity ?? []}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis
                        dataKey="label"
                        tick={{ fill: "#475569", fontSize: 12 }}
                      />
                      <YAxis tick={{ fill: "#475569", fontSize: 12 }} />
                      <Tooltip
                        formatter={(value) => formatNumber(Number(value))}
                      />
                      <Legend />
                      <Bar
                        dataKey="WEB"
                        stackId="source"
                        fill={SOURCE_COLORS.WEB}
                      />
                      <Bar
                        dataKey="MOBILE"
                        stackId="source"
                        fill={SOURCE_COLORS.MOBILE}
                      />
                      <Bar
                        dataKey="SERVER"
                        stackId="source"
                        fill={SOURCE_COLORS.SERVER}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </ChartCard>
              </div>
            )}

            {loadingFunnel ? null : funnelRows.length === 0 ? (
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
                  <MetricCard
                    label="Bookings Checked"
                    value={formatNumber(finance.totalBookingsChecked)}
                    accentClassName="border-slate-200"
                  />
                  <MetricCard
                    label="Matched"
                    value={formatNumber(finance.matched)}
                    accentClassName="border-emerald-100"
                  />
                  <MetricCard
                    label="Mismatched"
                    value={formatNumber(finance.mismatched)}
                    accentClassName="border-rose-100"
                  />
                  <MetricCard
                    label="Mismatch Rate"
                    value={mismatchRateLabel}
                    accentClassName="border-slate-200"
                  />
                </div>

                <ChartCard
                  title="Finance reconciliation mix"
                  description="Matched versus mismatched bookings in the selected batch."
                >
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={financeChartData}
                        dataKey="value"
                        nameKey="name"
                        innerRadius={68}
                        outerRadius={100}
                        paddingAngle={3}
                      >
                        {financeChartData.map((entry) => (
                          <Cell key={entry.name} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(value) => formatNumber(Number(value))}
                      />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </ChartCard>

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
            ) : !observability ? (
              <div className="py-10 text-center text-slate-500">
                No observability snapshot available.
              </div>
            ) : (
              <div className="space-y-6">
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                  {observabilitySummary.map((item) => (
                    <MetricCard
                      key={item.label}
                      label={item.label}
                      value={item.value}
                      detail={item.detail}
                      accentClassName="border-slate-200"
                    />
                  ))}
                </div>

                <ChartCard
                  title="Top routes by requests"
                  description="The busiest routes in the current in-memory snapshot."
                >
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={observabilityTopRoutes}
                      layout="vertical"
                      margin={{ left: 12 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis
                        type="number"
                        tick={{ fill: "#475569", fontSize: 12 }}
                      />
                      <YAxis
                        type="category"
                        dataKey="shortRouteKey"
                        width={180}
                        tick={{ fill: "#475569", fontSize: 12 }}
                      />
                      <Tooltip
                        formatter={(value, name, entry) => {
                          const routeKey = entry?.payload?.routeKey || "";
                          return [formatNumber(Number(value)), routeKey];
                        }}
                      />
                      <Legend />
                      <Bar
                        dataKey="totalRequests"
                        fill="#0ea5e9"
                        name="Requests"
                      />
                      <Bar dataKey="totalErrors" fill="#ef4444" name="Errors" />
                    </BarChart>
                  </ResponsiveContainer>
                </ChartCard>

                <div className="overflow-x-auto rounded-xl border border-slate-200">
                  <table className="min-w-full divide-y divide-slate-200 text-sm">
                    <thead className="bg-slate-50">
                      <tr>
                        <th className="px-4 py-3 text-left font-semibold text-slate-700">
                          Route
                        </th>
                        <th className="px-4 py-3 text-left font-semibold text-slate-700">
                          Requests
                        </th>
                        <th className="px-4 py-3 text-left font-semibold text-slate-700">
                          Errors
                        </th>
                        <th className="px-4 py-3 text-left font-semibold text-slate-700">
                          Error Rate
                        </th>
                        <th className="px-4 py-3 text-left font-semibold text-slate-700">
                          Avg Latency
                        </th>
                        <th className="px-4 py-3 text-left font-semibold text-slate-700">
                          Max Latency
                        </th>
                        <th className="px-4 py-3 text-left font-semibold text-slate-700">
                          Last Seen
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white">
                      {observabilityRoutes.length === 0 ? (
                        <tr>
                          <td
                            colSpan={7}
                            className="px-4 py-8 text-center text-slate-500"
                          >
                            No route metrics have been captured yet.
                          </td>
                        </tr>
                      ) : (
                        observabilityRoutes.map((route) => (
                          <tr key={route.routeKey}>
                            <td className="px-4 py-3 font-mono text-xs text-slate-700">
                              {route.routeKey}
                            </td>
                            <td className="px-4 py-3 text-slate-600">
                              {formatNumber(route.totalRequests)}
                            </td>
                            <td className="px-4 py-3 text-slate-600">
                              {formatNumber(route.totalErrors)}
                            </td>
                            <td className="px-4 py-3 text-slate-600">
                              {(route.errorRate * 100).toFixed(2)}%
                            </td>
                            <td className="px-4 py-3 text-slate-600">
                              {route.avgLatencyMs.toFixed(2)} ms
                            </td>
                            <td className="px-4 py-3 text-slate-600">
                              {route.maxLatencyMs.toFixed(2)} ms
                            </td>
                            <td className="px-4 py-3 text-slate-600">
                              {new Date(route.lastSeenAt).toLocaleString()}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}
      </Card>
    </div>
  );
}
