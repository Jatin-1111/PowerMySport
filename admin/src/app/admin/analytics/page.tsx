"use client";

import { AdminPageHeader } from "@/modules/admin/components/AdminPageHeader";
import {
  FinanceReconciliation,
  FunnelSummaryRow,
  FunnelTrends,
  GuestActivity,
  PlayersAnalytics,
  CoachesAnalytics,
  PlatformStats,
  ObservabilitySnapshot,
  UserGrowthPoint,
  UsersRoleSummary,
  VenueListersAnalytics,
  UnsupportedSportsStats,
  statsApi,
} from "@/modules/analytics/services/stats";
import { ServerMonitoringTab } from "@/modules/analytics/components/ServerMonitoringTab";
import { ConfirmModal } from "@/modules/shared/ui/ConfirmModal";
import { Panel } from "@/modules/shared/ui/Panel";
import { EmptyState, SkeletonBlock } from "@/modules/shared/ui/States";
import { StatusBadge } from "@/modules/shared/ui/StatusBadge";
import { Tabs } from "@/modules/shared/ui/Tabs";
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

type AnalyticsTab = "OVERVIEW" | "FUNNEL" | "GUESTS" | "FINANCE" | "OBSERVABILITY" | "SERVER";
const funnelDayOptions = [7, 14, 30, 90] as const;

// How often each tab silently re-fetches its data (real-time auto-refresh).
const POLL_MS = 15000;

const ROLE_COLORS = {
  Player: "#0ea5e9",
  Coach: "#10b981",
  VenueLister: "#f97316",
} as const;

const SOURCE_COLORS = {
  WEB: "#f97316",
  MOBILE: "#0ea5e9",
  SERVER: "#64748b",
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
  EXPERT: 0,
  Parent: 0,
  Player: 0,
  Coach: 0,
  VenueLister: 0,
};

function formatNumber(value: number): string {
  return value.toLocaleString("en-IN");
}

// One look for every chart: light horizontal grid only, no axis lines, small
// slate ticks, and a tooltip that matches the rest of the admin.
const GRID = { vertical: false, stroke: "#e8ebf0" } as const;
const AXIS = {
  tick: { fill: "#64748b", fontSize: 12 },
  axisLine: false,
  tickLine: false,
} as const;
const LEGEND = {
  iconType: "circle",
  iconSize: 8,
  formatter: (name: string) => <span style={{ color: "#475569", fontSize: 13 }}>{name}</span>,
} as const;
const TOOLTIP = {
  formatter: (value: unknown) => formatNumber(Number(value)),
  contentStyle: {
    border: "1px solid #e2e8f0",
    borderRadius: 10,
    boxShadow: "0 8px 24px -12px rgb(15 23 42 / 0.25)",
    fontSize: 13,
  },
  cursor: { fill: "rgb(15 23 42 / 0.04)" },
} as const;

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
    <Panel title={title} description={description}>
      <div className="h-80">{children}</div>
    </Panel>
  );
}

function MetricCard({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail?: string;
  accentClassName?: string;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <p className="text-sm text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums tracking-tight text-slate-900">
        {value}
      </p>
      {detail ? <p className="mt-1 text-xs text-slate-500">{detail}</p> : null}
    </div>
  );
}

export default function AdminAnalyticsPage() {
  const [activeTab, setActiveTab] = useState<AnalyticsTab>("OVERVIEW");
  const [funnelDays, setFunnelDays] = useState<(typeof funnelDayOptions)[number]>(30);
  const [platformStats, setPlatformStats] = useState<PlatformStats>(DEFAULT_PLATFORM_STATS);
  const [roleSummary, setRoleSummary] = useState<UsersRoleSummary>(DEFAULT_ROLE_SUMMARY);
  const [playersAnalytics, setPlayersAnalytics] = useState<PlayersAnalytics | null>(null);
  const [coachesAnalytics, setCoachesAnalytics] = useState<CoachesAnalytics | null>(null);
  const [venueListersAnalytics, setVenueListersAnalytics] = useState<VenueListersAnalytics | null>(
    null
  );
  const [userGrowth, setUserGrowth] = useState<UserGrowthPoint[]>([]);
  const [funnelRows, setFunnelRows] = useState<FunnelSummaryRow[]>([]);
  const [funnelTrends, setFunnelTrends] = useState<FunnelTrends | null>(null);
  const [unsupportedSports, setUnsupportedSports] = useState<UnsupportedSportsStats | null>(null);
  const [finance, setFinance] = useState<FinanceReconciliation | null>(null);
  const [observability, setObservability] = useState<ObservabilitySnapshot | null>(null);
  const [guestActivity, setGuestActivity] = useState<GuestActivity | null>(null);
  const [guestDays, setGuestDays] = useState<(typeof funnelDayOptions)[number]>(30);
  const [loadingOverview, setLoadingOverview] = useState(true);
  const [loadingFunnel, setLoadingFunnel] = useState(true);
  const [loadingGuests, setLoadingGuests] = useState(true);
  const [loadingFinance, setLoadingFinance] = useState(false);
  const [loadingObservability, setLoadingObservability] = useState(false);
  const [clearModalOpen, setClearModalOpen] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [clearResult, setClearResult] = useState<string | null>(null);

  const loadOverview = useCallback(async (silent = false) => {
    if (!silent) setLoadingOverview(true);
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
    } finally {
      if (!silent) setLoadingOverview(false);
    }
  }, []);

  const loadFunnel = useCallback(
    async (silent = false) => {
      if (!silent) setLoadingFunnel(true);
      try {
        const [summaryResponse, trendResponse, unsupportedResponse] = await Promise.all([
          statsApi.getFunnelSummary(funnelDays),
          statsApi.getFunnelTrends(funnelDays),
          statsApi.getUnsupportedSportsStats(funnelDays),
        ]);

        if (summaryResponse.success && summaryResponse.data) {
          setFunnelRows(summaryResponse.data.events ?? []);
        }

        if (trendResponse.success && trendResponse.data) {
          setFunnelTrends(trendResponse.data);
        }

        if (unsupportedResponse.success && unsupportedResponse.data) {
          setUnsupportedSports(unsupportedResponse.data);
        }
      } finally {
        if (!silent) setLoadingFunnel(false);
      }
    },
    [funnelDays]
  );

  const loadGuests = useCallback(
    async (silent = false) => {
      if (!silent) setLoadingGuests(true);
      try {
        const response = await statsApi.getGuestActivity(guestDays);
        if (response.success && response.data) {
          setGuestActivity(response.data);
        }
      } finally {
        if (!silent) setLoadingGuests(false);
      }
    },
    [guestDays]
  );

  const handleClearAnalytics = useCallback(async () => {
    setClearing(true);
    setClearResult(null);
    try {
      const response = await statsApi.clearAnalytics();
      if (response.success) {
        const deleted = response.data?.deletedCount ?? 0;
        setClearResult(`Cleared ${deleted.toLocaleString()} analytics events.`);
        // Refetch the affected views against the now-empty dataset.
        setGuestActivity(null);
        setFunnelRows([]);
        setFunnelTrends(null);
        void loadOverview(true);
        void loadGuests(true);
        void loadFunnel(true);
      } else {
        setClearResult(response.message || "Failed to clear analytics data.");
      }
    } catch (error) {
      setClearResult(error instanceof Error ? error.message : "Failed to clear analytics data.");
    } finally {
      setClearing(false);
      setClearModalOpen(false);
    }
  }, [loadOverview, loadFunnel, loadGuests]);

  const loadFinance = useCallback(async (silent = false) => {
    if (!silent) setLoadingFinance(true);
    try {
      const response = await statsApi.getFinanceReconciliation();
      if (response.success && response.data) {
        setFinance(response.data);
      }
    } finally {
      if (!silent) setLoadingFinance(false);
    }
  }, []);

  const loadObservability = useCallback(async (silent = false) => {
    if (!silent) setLoadingObservability(true);
    try {
      const response = await statsApi.getObservabilitySnapshot();
      if (response.success) {
        setObservability(response.data ?? null);
      }
    } finally {
      if (!silent) setLoadingObservability(false);
    }
  }, []);

  // Initial load when a tab is first opened.
  useEffect(() => {
    void loadOverview();
  }, [loadOverview]);

  useEffect(() => {
    if (activeTab === "FUNNEL") void loadFunnel();
  }, [activeTab, loadFunnel]);

  useEffect(() => {
    if (activeTab === "GUESTS") void loadGuests();
  }, [activeTab, loadGuests]);

  useEffect(() => {
    if (activeTab === "FINANCE") void loadFinance();
    if (activeTab === "OBSERVABILITY") void loadObservability();
  }, [activeTab, loadFinance, loadObservability]);

  // Real-time auto-refresh: silently re-fetch the active tab's data on an
  // interval. Pauses while the browser tab is hidden to avoid wasted calls.
  useEffect(() => {
    const refreshActive = () => {
      if (typeof document !== "undefined" && document.visibilityState !== "visible") {
        return;
      }
      switch (activeTab) {
        case "OVERVIEW":
          void loadOverview(true);
          break;
        case "FUNNEL":
          void loadFunnel(true);
          break;
        case "GUESTS":
          void loadGuests(true);
          break;
        case "FINANCE":
          void loadFinance(true);
          break;
        case "OBSERVABILITY":
          void loadObservability(true);
          break;
        // SERVER tab manages its own polling.
      }
    };

    const id = window.setInterval(refreshActive, POLL_MS);
    return () => window.clearInterval(id);
  }, [activeTab, loadOverview, loadFunnel, loadGuests, loadFinance, loadObservability]);

  const roleDistributionData = useMemo(
    () => [
      {
        name: "Players",
        value: roleSummary.Player,
        color: ROLE_COLORS.Player,
      },
      {
        name: "Coaches",
        value: roleSummary.Coach,
        color: ROLE_COLORS.Coach,
      },
      {
        name: "Venue Listers",
        value: roleSummary.VenueLister,
        color: ROLE_COLORS.VenueLister,
      },
    ],
    [roleSummary]
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
    return `${((coachesAnalytics.verifiedCount / coachesAnalytics.totalCoaches) * 100).toFixed(
      1
    )}%`;
  }, [coachesAnalytics]);

  const venueCoverageRate = useMemo(() => {
    if (!venueListersAnalytics || venueListersAnalytics.totalVenueListers === 0) {
      return "0%";
    }

    return `${(
      (venueListersAnalytics.withAtLeastOneVenue / venueListersAnalytics.totalVenueListers) *
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
        route.routeKey.length > 34 ? `${route.routeKey.slice(0, 34)}...` : route.routeKey,
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

  const tabs: Array<{ id: AnalyticsTab; label: string }> = [
    { id: "OVERVIEW", label: "Overview" },
    { id: "FUNNEL", label: "Funnel" },
    { id: "GUESTS", label: "Guests" },
    { id: "FINANCE", label: "Finance" },
    { id: "OBSERVABILITY", label: "Observability" },
    { id: "SERVER", label: "Server" },
  ];

  return (
    <div className="space-y-6">
      <AdminPageHeader
        badge="Overview"
        title="Analytics"
        subtitle="Growth, funnel activity and payment reconciliation. Data refreshes on its own."
        action={
          <div className="flex items-center gap-3">
            <span
              className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600"
              title={`Auto-refreshing every ${POLL_MS / 1000}s`}
            >
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75 motion-reduce:animate-none" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-600" />
              </span>
              Live, every {POLL_MS / 1000}s
            </span>
            <button
              type="button"
              onClick={() => {
                setClearResult(null);
                setClearModalOpen(true);
              }}
              className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-red-700 hover:border-red-300 hover:bg-red-50"
            >
              Clear analytics data
            </button>
          </div>
        }
      />

      <div className="space-y-6">
        <Tabs tabs={tabs} value={activeTab} onChange={setActiveTab} label="Analytics sections" />

        {clearResult ? <p className="text-sm font-medium text-slate-600">{clearResult}</p> : null}

        {activeTab === "OVERVIEW" && loadingOverview && (
          <SkeletonBlock rows={8} label="Loading overview" />
        )}

        {activeTab === "OVERVIEW" && !loadingOverview && (
          <div className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <MetricCard
                label="Total Users"
                value={formatNumber(platformStats.totalUsers)}
                detail="Platform-wide user base"
              />
              <MetricCard
                label="Total Venues"
                value={formatNumber(platformStats.totalVenues)}
                detail="Approved and pending venues"
              />
              <MetricCard
                label="Total Bookings"
                value={formatNumber(platformStats.totalBookings)}
                detail="Bookings tracked in the platform"
              />
              <MetricCard
                label="Revenue"
                value={formatNumber(platformStats.revenue)}
                detail="Confirmed booking revenue"
              />
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <MetricCard
                label="Player accounts"
                value={formatNumber(playersAnalytics?.totalPlayers ?? 0)}
                detail={`${formatNumber(playersAnalytics?.newThisMonth ?? 0)} new this month`}
              />
              <MetricCard
                label="Coach verification"
                value={coachVerificationRate}
                detail={`${formatNumber(coachesAnalytics?.verifiedCount ?? 0)} verified coaches`}
              />
              <MetricCard
                label="Venue coverage"
                value={venueCoverageRate}
                detail={`${formatNumber(venueListersAnalytics?.withAtLeastOneVenue ?? 0)} venue listers with venues`}
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
                    <Tooltip {...TOOLTIP} />
                    <Legend {...LEGEND} />
                  </PieChart>
                </ResponsiveContainer>
              </ChartCard>

              <ChartCard
                title="Monthly user growth"
                description="Signups by role across the last six months."
              >
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={monthlyGrowthSeries}>
                    <CartesianGrid {...GRID} />
                    <XAxis dataKey="label" {...AXIS} />
                    <YAxis {...AXIS} />
                    <Tooltip {...TOOLTIP} />
                    <Legend {...LEGEND} />
                    <Bar dataKey="Player" stackId="users" fill={ROLE_COLORS.Player} />
                    <Bar dataKey="Coach" stackId="users" fill={ROLE_COLORS.Coach} />
                    <Bar dataKey="VenueLister" stackId="users" fill={ROLE_COLORS.VenueLister} />
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
                    <CartesianGrid {...GRID} />
                    <XAxis dataKey="label" {...AXIS} />
                    <YAxis {...AXIS} />
                    <Tooltip {...TOOLTIP} />
                    <Legend {...LEGEND} />
                    <Bar
                      dataKey="WEB"
                      stackId="source"
                      fill={SOURCE_COLORS.WEB}
                      radius={[0, 0, 0, 0]}
                    />
                    <Bar dataKey="MOBILE" stackId="source" fill={SOURCE_COLORS.MOBILE} />
                    <Bar dataKey="SERVER" stackId="source" fill={SOURCE_COLORS.SERVER} />
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
                        <Cell key={entry.source} fill={SOURCE_COLORS[entry.source]} />
                      ))}
                    </Pie>
                    <Tooltip {...TOOLTIP} />
                    <Legend {...LEGEND} />
                  </PieChart>
                </ResponsiveContainer>
              </ChartCard>
            </div>
          </div>
        )}

        {activeTab === "FUNNEL" && (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-slate-700">Time window</span>
              <select
                value={funnelDays}
                onChange={(event) =>
                  setFunnelDays(Number(event.target.value) as (typeof funnelDayOptions)[number])
                }
                className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm hover:border-slate-400"
              >
                {funnelDayOptions.map((days) => (
                  <option key={days} value={days}>
                    Last {days} days
                  </option>
                ))}
              </select>
            </div>

            {loadingFunnel ? (
              <SkeletonBlock rows={6} label="Loading funnel analytics" />
            ) : (
              <div className="grid gap-6 xl:grid-cols-2">
                <ChartCard
                  title="Top funnel events"
                  description="Most frequent event names in the selected window."
                >
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={topEventData} layout="vertical" margin={{ left: 12 }}>
                      <CartesianGrid {...GRID} />
                      <XAxis type="number" {...AXIS} />
                      <YAxis type="category" dataKey="eventName" width={140} {...AXIS} />
                      <Tooltip {...TOOLTIP} />
                      <Legend {...LEGEND} />
                      <Bar dataKey="count" fill="#f97316" name="Events" />
                      <Bar dataKey="uniqueUsers" fill="#0ea5e9" name="Unique users" />
                    </BarChart>
                  </ResponsiveContainer>
                </ChartCard>

                <ChartCard
                  title="Daily source activity"
                  description="Event volume by source across the selected window."
                >
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={funnelTrends?.dailyActivity ?? []}>
                      <CartesianGrid {...GRID} />
                      <XAxis dataKey="label" {...AXIS} />
                      <YAxis {...AXIS} />
                      <Tooltip {...TOOLTIP} />
                      <Legend {...LEGEND} />
                      <Bar
                        dataKey="WEB"
                        stackId="source"
                        fill={SOURCE_COLORS.WEB}
                        radius={[0, 0, 0, 0]}
                      />
                      <Bar dataKey="MOBILE" stackId="source" fill={SOURCE_COLORS.MOBILE} />
                      <Bar dataKey="SERVER" stackId="source" fill={SOURCE_COLORS.SERVER} />
                    </BarChart>
                  </ResponsiveContainer>
                </ChartCard>
              </div>
            )}

            {loadingFunnel ? null : funnelRows.length === 0 ? (
              <EmptyState
                title="No funnel events in this window"
                description="Try a longer time window."
              />
            ) : (
              <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Event</th>
                      <th>Count</th>
                      <th>Unique Users</th>
                    </tr>
                  </thead>
                  <tbody>
                    {funnelRows.map((row) => (
                      <tr key={row.eventName}>
                        <td>{row.eventName}</td>
                        <td>{row.count}</td>
                        <td>{row.uniqueUsers}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* ── Sports Gap Intelligence ─────────────────────────────── */}
            {!loadingFunnel && (
              <Panel
                title="Sports gap intelligence"
                description="Sports users searched for that we do not support yet, ranked by demand. Use it to choose the next pathway to build."
                action={
                  unsupportedSports && unsupportedSports.totalSearches > 0 ? (
                    <span className="text-sm font-semibold tabular-nums text-slate-900">
                      {formatNumber(unsupportedSports.totalSearches)} searches
                    </span>
                  ) : null
                }
              >
                <div className="space-y-3">
                  {!unsupportedSports || unsupportedSports.rows.length === 0 ? (
                    <EmptyState
                      title="No unsupported sport searches"
                      description="Nobody searched for a sport we do not cover in this window."
                    />
                  ) : (
                    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
                      <table className="data-table">
                        <thead>
                          <tr>
                            <th>#</th>
                            <th>Sport</th>
                            <th>Searches</th>
                            <th>Source</th>
                            <th>Last searched</th>
                          </tr>
                        </thead>
                        <tbody>
                          {unsupportedSports.rows.map((row, i) => (
                            <tr key={row.sport}>
                              <td>{i + 1}</td>
                              <td className="px-4 py-3 font-medium capitalize text-slate-900">
                                {row.sport}
                              </td>
                              <td className="px-4 py-3">
                                <span className="inline-flex items-center rounded-md bg-orange-50 px-2 py-0.5 text-xs font-semibold tabular-nums text-orange-800">
                                  {row.count.toLocaleString()}
                                </span>
                              </td>
                              <td>{row.sources.join(", ")}</td>
                              <td>
                                {new Date(row.lastSearched).toLocaleDateString("en-IN", {
                                  day: "2-digit",
                                  month: "short",
                                  year: "numeric",
                                })}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </Panel>
            )}
          </div>
        )}

        {activeTab === "GUESTS" && (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-slate-700">Time window</span>
              <select
                value={guestDays}
                onChange={(event) =>
                  setGuestDays(Number(event.target.value) as (typeof funnelDayOptions)[number])
                }
                className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm hover:border-slate-400"
              >
                {funnelDayOptions.map((days) => (
                  <option key={days} value={days}>
                    Last {days} days
                  </option>
                ))}
              </select>
            </div>

            <p className="text-xs text-slate-500">
              Anonymous activity from not-signed-in visitors. No personal data — visitors are
              counted with a random id only.
            </p>

            {loadingGuests ? (
              <SkeletonBlock rows={6} label="Loading guest activity" />
            ) : !guestActivity || guestActivity.totals.events === 0 ? (
              <EmptyState
                title="No guest activity yet"
                description="Anonymous visits will appear here once guests browse the site."
              />
            ) : (
              <>
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
                  <MetricCard
                    label="Unique Visitors"
                    value={formatNumber(guestActivity.totals.uniqueGuests)}
                    detail="Distinct anonymous guests"
                  />
                  <MetricCard
                    label="Page Views"
                    value={formatNumber(guestActivity.totals.pageViews)}
                    detail="Total pages opened"
                  />
                  <MetricCard
                    label="Total Events"
                    value={formatNumber(guestActivity.totals.events)}
                    detail="Views, clicks & scrolls"
                  />
                  <MetricCard
                    label="Avg. Time / Page"
                    value={`${guestActivity.totals.avgTimeOnPageSec}s`}
                    detail="Across tracked pages"
                  />
                  <MetricCard
                    label="Avg. Scroll Depth"
                    value={`${guestActivity.totals.avgScrollPct}%`}
                    detail="How far visitors scroll"
                  />
                </div>

                <ChartCard
                  title="Daily guest activity"
                  description="Page views and unique visitors across the selected window."
                >
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={guestActivity.daily}>
                      <CartesianGrid {...GRID} />
                      <XAxis dataKey="label" {...AXIS} />
                      <YAxis {...AXIS} />
                      <Tooltip {...TOOLTIP} />
                      <Legend {...LEGEND} />
                      <Bar dataKey="views" fill="#f97316" name="Page views" />
                      <Bar dataKey="uniqueGuests" fill="#0ea5e9" name="Unique visitors" />
                    </BarChart>
                  </ResponsiveContainer>
                </ChartCard>

                <div className="grid gap-6 xl:grid-cols-2">
                  <div className="space-y-3">
                    <h3 className="text-lg font-semibold text-slate-900">Top pages</h3>
                    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
                      <table className="data-table">
                        <thead>
                          <tr>
                            <th>Page</th>
                            <th>Views</th>
                            <th>Unique</th>
                          </tr>
                        </thead>
                        <tbody>
                          {guestActivity.topPages.map((page) => (
                            <tr key={page.path}>
                              <td className="px-4 py-3 font-mono text-xs text-slate-800">
                                {page.path}
                              </td>
                              <td>{formatNumber(page.views)}</td>
                              <td>{formatNumber(page.uniqueGuests)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <h3 className="text-lg font-semibold text-slate-900">Top activity</h3>
                    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
                      <table className="data-table">
                        <thead>
                          <tr>
                            <th>Activity</th>
                            <th>Count</th>
                            <th>Unique</th>
                          </tr>
                        </thead>
                        <tbody>
                          {guestActivity.topEvents.map((event) => (
                            <tr key={event.eventName}>
                              <td>{event.eventName}</td>
                              <td>{formatNumber(event.count)}</td>
                              <td>{formatNumber(event.uniqueGuests)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {activeTab === "FINANCE" && (
          <div className="space-y-4">
            {loadingFinance ? (
              <SkeletonBlock rows={6} label="Loading finance reconciliation" />
            ) : !finance ? (
              <EmptyState
                title="No reconciliation data"
                description="Nothing has been checked yet."
              />
            ) : (
              <>
                <div className="grid gap-4 md:grid-cols-4">
                  <MetricCard
                    label="Bookings Checked"
                    value={formatNumber(finance.totalBookingsChecked)}
                  />
                  <MetricCard label="Matched" value={formatNumber(finance.matched)} />
                  <MetricCard label="Mismatched" value={formatNumber(finance.mismatched)} />
                  <MetricCard label="Mismatch Rate" value={mismatchRateLabel} />
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
                      <Tooltip {...TOOLTIP} />
                      <Legend {...LEGEND} />
                    </PieChart>
                  </ResponsiveContainer>
                </ChartCard>

                <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Booking</th>
                        <th>Expected</th>
                        <th>Paid</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {finance.sampleMismatches.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="px-4 py-8 text-center text-slate-500">
                            No mismatches found in the sample.
                          </td>
                        </tr>
                      ) : (
                        finance.sampleMismatches.map((item) => (
                          <tr key={item.bookingId}>
                            <td className="px-4 py-3 font-mono text-xs text-slate-700">
                              {item.bookingId}
                            </td>
                            <td>{item.expected}</td>
                            <td>{item.paid}</td>
                            <td>
                              <StatusBadge status={item.status} size="sm" />
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
              <SkeletonBlock rows={6} label="Loading observability snapshot" />
            ) : !observability ? (
              <EmptyState
                title="No snapshot available"
                description="The server has not captured route metrics yet."
              />
            ) : (
              <div className="space-y-6">
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                  {observabilitySummary.map((item) => (
                    <MetricCard
                      key={item.label}
                      label={item.label}
                      value={item.value}
                      detail={item.detail}
                    />
                  ))}
                </div>

                <ChartCard
                  title="Top routes by requests"
                  description="The busiest routes in the current in-memory snapshot."
                >
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={observabilityTopRoutes} layout="vertical" margin={{ left: 12 }}>
                      <CartesianGrid {...GRID} />
                      <XAxis type="number" {...AXIS} />
                      <YAxis type="category" dataKey="shortRouteKey" width={180} {...AXIS} />
                      <Tooltip
                        {...TOOLTIP}
                        formatter={(value, name, entry) => {
                          const routeKey = entry?.payload?.routeKey || "";
                          return [formatNumber(Number(value)), routeKey];
                        }}
                      />
                      <Legend {...LEGEND} />
                      <Bar dataKey="totalRequests" fill="#0ea5e9" name="Requests" />
                      <Bar dataKey="totalErrors" fill="#ef4444" name="Errors" />
                    </BarChart>
                  </ResponsiveContainer>
                </ChartCard>

                <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Route</th>
                        <th>Requests</th>
                        <th>Errors</th>
                        <th>Error Rate</th>
                        <th>Avg Latency</th>
                        <th>Max Latency</th>
                        <th>Last Seen</th>
                      </tr>
                    </thead>
                    <tbody>
                      {observabilityRoutes.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="px-4 py-8 text-center text-slate-500">
                            No route metrics have been captured yet.
                          </td>
                        </tr>
                      ) : (
                        observabilityRoutes.map((route) => (
                          <tr key={route.routeKey}>
                            <td className="px-4 py-3 font-mono text-xs text-slate-700">
                              {route.routeKey}
                            </td>
                            <td>{formatNumber(route.totalRequests)}</td>
                            <td>{formatNumber(route.totalErrors)}</td>
                            <td>{(route.errorRate * 100).toFixed(2)}%</td>
                            <td>{route.avgLatencyMs.toFixed(2)} ms</td>
                            <td>{route.maxLatencyMs.toFixed(2)} ms</td>
                            <td>{new Date(route.lastSeenAt).toLocaleString()}</td>
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

        {activeTab === "SERVER" && <ServerMonitoringTab />}
      </div>

      <ConfirmModal
        open={clearModalOpen}
        variant="danger"
        title="Delete all analytics data?"
        description="This permanently removes every funnel event and all guest activity. It cannot be undone."
        confirmLabel="Delete everything"
        loading={clearing}
        onConfirm={() => void handleClearAnalytics()}
        onCancel={() => setClearModalOpen(false)}
      />
    </div>
  );
}
