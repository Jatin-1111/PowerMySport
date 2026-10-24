"use client";

import { AdminPageHeader } from "@/modules/admin/components/AdminPageHeader";
import {
  notificationApi,
  MonitoringStats,
  SchedulerHealth,
  FailedReminder,
} from "@/modules/admin/services/notifications";
import { btn, fieldClass, labelClass } from "@/modules/shared/ui/buttonStyles";
import { MetricStrip, Panel } from "@/modules/shared/ui/Panel";
import { EmptyState, ErrorNotice, SkeletonBlock } from "@/modules/shared/ui/States";
import { StatusBadge } from "@/modules/shared/ui/StatusBadge";
import { toast } from "@/lib/toast";
import { formatDate, formatTime } from "@/utils/format";
import { Activity, RefreshCw, Send, Download, RotateCcw, Filter, X, Copy } from "lucide-react";
import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef, useState } from "react";
import { io, Socket } from "socket.io-client";

const NotificationStatusChart = dynamic(
  () =>
    import("@/modules/admin/components/NotificationStatusChart").then(
      (module) => module.NotificationStatusChart
    ),
  {
    ssr: false,
    loading: () => <div className="h-75 animate-pulse rounded-lg bg-slate-100" />,
  }
);

// Filter interface
interface Filters {
  bookingId: string;
  userId: string;
  interval: string;
  dateFrom: string;
  dateTo: string;
}

export default function NotificationsPage() {
  const [stats, setStats] = useState<MonitoringStats | null>(null);
  const [health, setHealth] = useState<SchedulerHealth | null>(null);
  const [failedReminders, setFailedReminders] = useState<FailedReminder[]>([]);
  const [filteredReminders, setFilteredReminders] = useState<FailedReminder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [failedLimit, setFailedLimit] = useState(50);
  const [selectedReminders, setSelectedReminders] = useState<Set<string>>(new Set());
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState<Filters>({
    bookingId: "",
    userId: "",
    interval: "",
    dateFrom: "",
    dateTo: "",
  });
  const socketRef = useRef<Socket | null>(null);
  const updateFlushTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingStatsRef = useRef<MonitoringStats | null>(null);
  const pendingHealthRef = useRef<SchedulerHealth | null>(null);

  const flushRealtimeUpdates = useCallback(() => {
    if (pendingStatsRef.current) {
      setStats(pendingStatsRef.current);
      pendingStatsRef.current = null;
    }

    if (pendingHealthRef.current) {
      setHealth(pendingHealthRef.current);
      pendingHealthRef.current = null;
    }

    updateFlushTimeoutRef.current = null;
  }, []);

  const scheduleRealtimeFlush = useCallback(() => {
    if (updateFlushTimeoutRef.current) {
      return;
    }

    // Batch frequent socket events so heavy UI (charts/cards) rerenders less often.
    updateFlushTimeoutRef.current = setTimeout(flushRealtimeUpdates, 500);
  }, [flushRealtimeUpdates]);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const [statsResponse, healthResponse, failedResponse] = await Promise.all([
        notificationApi.getStats(),
        notificationApi.getHealth(),
        notificationApi.getFailedReminders(failedLimit),
      ]);

      if (statsResponse.success && statsResponse.data) {
        setStats(statsResponse.data);
      } else {
        setError(statsResponse.message || "Failed to load stats.");
        return;
      }

      if (healthResponse.success && healthResponse.data) {
        setHealth(healthResponse.data);
      }

      if (failedResponse.success && failedResponse.data) {
        setFailedReminders(failedResponse.data);
        setFilteredReminders(failedResponse.data);
      }
    } catch (error) {
      console.error("Failed to fetch notification data:", error);
      setError("Failed to load notification monitoring data.");
    } finally {
      setLoading(false);
    }
  }, [failedLimit]);

  // Apply filters
  useEffect(() => {
    let filtered = [...failedReminders];

    if (filters.bookingId) {
      filtered = filtered.filter((r) =>
        r.bookingId?.toLowerCase().includes(filters.bookingId.toLowerCase())
      );
    }
    if (filters.userId) {
      const needle = filters.userId.toLowerCase();
      filtered = filtered.filter(
        (r) =>
          r.userId.toLowerCase().includes(needle) ||
          r.userName.toLowerCase().includes(needle) ||
          r.userEmail.toLowerCase().includes(needle)
      );
    }
    if (filters.interval) {
      filtered = filtered.filter((r) => r.interval === filters.interval);
    }
    if (filters.dateFrom) {
      const fromDate = new Date(filters.dateFrom);
      filtered = filtered.filter((r) => new Date(r.failedAt) >= fromDate);
    }
    if (filters.dateTo) {
      const toDate = new Date(filters.dateTo);
      toDate.setHours(23, 59, 59, 999); // End of day
      filtered = filtered.filter((r) => new Date(r.failedAt) <= toDate);
    }

    setFilteredReminders(filtered);
  }, [filters, failedReminders]);

  // Socket.IO connection for real-time updates
  useEffect(() => {
    const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

    const socket = io(API_BASE_URL, {
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionDelay: 5000,
      reconnectionAttempts: Infinity,
    });

    socketRef.current = socket;

    socket.on("connect", () => {
      console.log("Socket.IO connected for real-time notifications");
    });

    socket.on("REMINDER_STATS_UPDATE", (data) => {
      if (data.stats) {
        pendingStatsRef.current = data.stats;
        scheduleRealtimeFlush();
      }
    });

    socket.on("HEALTH_UPDATE", (data) => {
      if (data.health) {
        pendingHealthRef.current = data.health;
        scheduleRealtimeFlush();
      }
    });

    socket.on("disconnect", () => {
      console.log("Socket.IO disconnected, will auto-reconnect...");
    });

    socket.on("connect_error", (error) => {
      console.error("Socket.IO connection error:", error.message);
    });

    return () => {
      if (updateFlushTimeoutRef.current) {
        clearTimeout(updateFlushTimeoutRef.current);
        updateFlushTimeoutRef.current = null;
      }
      socket.disconnect();
    };
  }, [scheduleRealtimeFlush]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleHealthCheck = async () => {
    try {
      setActionLoading(true);
      const response = await notificationApi.triggerHealthCheck();

      if (response.success) {
        toast.success("Health check completed successfully!");
        await fetchData();
      } else {
        toast.error(response.message || "Health check failed.");
      }
    } catch (error) {
      console.error("Failed to trigger health check:", error);
      toast.error("Failed to trigger health check.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleSendDailySummary = async () => {
    try {
      setActionLoading(true);
      const response = await notificationApi.sendDailySummary();

      if (response.success && response.data) {
        toast.success(`Daily summary sent successfully! (${response.data.emailsSent} emails)`);
      } else {
        toast.error(response.message || "Failed to send daily summary.");
      }
    } catch (error) {
      console.error("Failed to send daily summary:", error);
      toast.error("Failed to send daily summary.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleRetryReminder = async (reminderId: string) => {
    try {
      setActionLoading(true);
      const response = await notificationApi.retryReminder(reminderId);

      if (response.success) {
        toast.success(response.data?.message || "Reminder queued for retry!");
        await fetchData();
      } else {
        toast.error(response.message || "Failed to retry reminder.");
      }
    } catch (error) {
      console.error("Failed to retry reminder:", error);
      toast.error("Failed to retry reminder.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleRetrySelected = async () => {
    if (selectedReminders.size === 0) {
      toast.error("Please select reminders to retry.");
      return;
    }

    try {
      setActionLoading(true);
      const response = await notificationApi.retryMultiple(Array.from(selectedReminders));

      if (response.success && response.data) {
        const successCount = response.data.results.filter((r) => r.success).length;
        toast.success(`${successCount} reminders queued for retry!`);
        setSelectedReminders(new Set());
        await fetchData();
      } else {
        toast.error(response.message || "Failed to retry reminders.");
      }
    } catch (error) {
      console.error("Failed to retry reminders:", error);
      toast.error("Failed to retry reminders.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleExportCSV = () => {
    if (filteredReminders.length === 0) {
      toast.error("No reminders to export.");
      return;
    }

    const headers = [
      "Reminder ID",
      "User Name",
      "User Email",
      "User ID",
      "Booking ID",
      "Interval",
      "Failed At",
      "Retry Count",
      "Failure Reason",
    ];

    const rows = filteredReminders.map((r) => [
      r._id,
      r.userName,
      r.userEmail || "N/A",
      r.userId,
      r.bookingId || "N/A",
      r.interval,
      new Date(r.failedAt).toISOString(),
      r.retryCount.toString(),
      r.failureReason || "N/A",
    ]);

    const csvContent = [
      headers.join(","),
      ...rows.map((row) => row.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(",")),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `failed-reminders-${new Date().toISOString().split("T")[0]}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast.success(`Exported ${filteredReminders.length} reminders to CSV!`);
  };

  const toggleReminderSelection = (id: string) => {
    const newSelection = new Set(selectedReminders);
    if (newSelection.has(id)) {
      newSelection.delete(id);
    } else {
      newSelection.add(id);
    }
    setSelectedReminders(newSelection);
  };

  const toggleSelectAll = () => {
    if (selectedReminders.size === filteredReminders.length) {
      setSelectedReminders(new Set());
    } else {
      setSelectedReminders(new Set(filteredReminders.map((r) => r._id)));
    }
  };

  const clearFilters = () => {
    setFilters({
      bookingId: "",
      userId: "",
      interval: "",
      dateFrom: "",
      dateTo: "",
    });
  };

  const hasActiveFilters = Object.values(filters).some((v) => v !== "");

  const successRate = stats?.totalProcessed ? (stats.totalSent / stats.totalProcessed) * 100 : 0;
  const cancelRate = stats?.totalProcessed
    ? (stats.totalCancelled / stats.totalProcessed) * 100
    : 0;
  const failureRate = stats?.failureRate ?? 0;

  const actions = (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={handleHealthCheck}
        disabled={actionLoading}
        className={btn("outline")}
      >
        <Activity className="size-4" aria-hidden />
        Run health check
      </button>
      <button
        type="button"
        onClick={handleSendDailySummary}
        disabled={actionLoading}
        className={btn("outline")}
      >
        <Send className="size-4" aria-hidden />
        Send daily summary
      </button>
      <button type="button" onClick={fetchData} disabled={loading} className={btn("quiet")}>
        <RefreshCw className={`size-4 ${loading ? "animate-spin" : ""}`} aria-hidden />
        Refresh
      </button>
    </div>
  );

  const header = (
    <AdminPageHeader
      badge="Monitoring"
      title="Notifications"
      subtitle="Booking reminders, delivery results and scheduler health, updated live."
      action={actions}
    />
  );

  if (loading && !stats) {
    return (
      <div className="space-y-6">
        {header}
        <SkeletonBlock rows={8} label="Loading notifications" />
      </div>
    );
  }

  if (error || !stats) {
    return (
      <div className="space-y-6">
        {header}
        <ErrorNotice message={error || "We couldn't load notification data."} onRetry={fetchData} />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {header}

      <MetricStrip
        items={[
          {
            label: "Processed, last 24h",
            value: (stats.totalProcessed ?? 0).toLocaleString("en-IN"),
          },
          {
            label: "Sent",
            value: (stats.totalSent ?? 0).toLocaleString("en-IN"),
            detail: `${successRate.toFixed(1)}% of processed`,
          },
          {
            label: "Failed",
            value: (stats.totalFailed ?? 0).toLocaleString("en-IN"),
            detail: `${failureRate.toFixed(2)}% failure rate`,
          },
          {
            label: "Cancelled",
            value: (stats.totalCancelled ?? 0).toLocaleString("en-IN"),
            detail: `${cancelRate.toFixed(1)}% of processed`,
          },
        ]}
      />

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
        <Panel
          title="Delivery results"
          description="Status split of reminders in the last 24 hours."
        >
          <NotificationStatusChart
            totalProcessed={stats.totalProcessed || 0}
            totalSent={stats.totalSent || 0}
            totalFailed={stats.totalFailed || 0}
            totalCancelled={stats.totalCancelled || 0}
          />
        </Panel>

        {health && (
          <Panel
            title="Scheduler health"
            action={
              <StatusBadge
                status={health.isHealthy ? "Healthy" : "Unhealthy"}
                tone={health.isHealthy ? "green" : "red"}
              />
            }
          >
            <dl className="grid grid-cols-2 gap-x-6 gap-y-5">
              <div className="col-span-2">
                <dt className="text-sm text-slate-500">Last run</dt>
                <dd className="mt-0.5 text-sm font-semibold text-slate-900">
                  {health.lastRun
                    ? `${formatTime(health.lastRun)}, ${health.minutesSinceLastRun || 0} min ago`
                    : "Never"}
                </dd>
              </div>
              <div>
                <dt className="text-sm text-slate-500">Pending</dt>
                <dd className="mt-0.5 text-xl font-semibold tabular-nums text-slate-900">
                  {health.pendingCount || 0}
                </dd>
              </div>
              <div>
                <dt className="text-sm text-slate-500">Overdue</dt>
                <dd
                  className={`mt-0.5 text-xl font-semibold tabular-nums ${
                    (health.overdueCount || 0) > 50 ? "text-red-700" : "text-slate-900"
                  }`}
                >
                  {health.overdueCount || 0}
                </dd>
              </div>
            </dl>

            {health.issues && health.issues.length > 0 && (
              <div className="mt-5 rounded-lg border border-red-200 bg-red-50 p-3">
                <p className="text-sm font-semibold text-red-900">Issues detected</p>
                <ul className="mt-1.5 list-disc space-y-1 pl-5">
                  {health.issues.map((issue, index) => (
                    <li key={index} className="text-sm text-red-800">
                      {issue}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </Panel>
        )}
      </div>

      <Panel
        flush
        title="Failed reminders"
        description={
          hasActiveFilters
            ? `${filteredReminders.length} match your filters.`
            : "Reminders that did not reach the user in the last 24 hours."
        }
        action={
          <div className="flex flex-wrap items-center gap-2">
            {selectedReminders.size > 0 && (
              <button
                type="button"
                onClick={handleRetrySelected}
                disabled={actionLoading}
                className={btn("primary")}
              >
                <RotateCcw className="size-4" aria-hidden />
                Retry {selectedReminders.size} selected
              </button>
            )}
            <button
              type="button"
              onClick={() => setShowFilters(!showFilters)}
              aria-expanded={showFilters}
              className={btn("outline")}
            >
              <Filter className="size-4" aria-hidden />
              Filters{hasActiveFilters ? " (on)" : ""}
            </button>
            <label className="sr-only" htmlFor="failed-limit">
              Rows to show
            </label>
            <select
              id="failed-limit"
              value={failedLimit}
              onChange={(e) => setFailedLimit(Number(e.target.value))}
              className={`${fieldClass} !w-auto`}
            >
              <option value={10}>Show 10</option>
              <option value={25}>Show 25</option>
              <option value={50}>Show 50</option>
              <option value={100}>Show 100</option>
            </select>
            <button type="button" onClick={handleExportCSV} className={btn("outline")}>
              <Download className="size-4" aria-hidden />
              Export CSV
            </button>
          </div>
        }
      >
        {showFilters && (
          <div className="mx-5 mb-4 grid gap-4 rounded-xl bg-slate-50 p-4 md:grid-cols-2 lg:grid-cols-3">
            <div>
              <label htmlFor="f-booking" className={labelClass}>
                Booking ID
              </label>
              <input
                id="f-booking"
                type="text"
                value={filters.bookingId}
                onChange={(e) => setFilters({ ...filters, bookingId: e.target.value })}
                placeholder="Paste a booking ID"
                className={fieldClass}
              />
            </div>
            <div>
              <label htmlFor="f-user" className={labelClass}>
                User
              </label>
              <input
                id="f-user"
                type="text"
                value={filters.userId}
                onChange={(e) => setFilters({ ...filters, userId: e.target.value })}
                placeholder="Name, email or user ID"
                className={fieldClass}
              />
            </div>
            <div>
              <label htmlFor="f-interval" className={labelClass}>
                Reminder timing
              </label>
              <select
                id="f-interval"
                value={filters.interval}
                onChange={(e) => setFilters({ ...filters, interval: e.target.value })}
                className={fieldClass}
              >
                <option value="">All</option>
                <option value="24h">24 hours before</option>
                <option value="1h">1 hour before</option>
                <option value="15min">15 minutes before</option>
              </select>
            </div>
            <div>
              <label htmlFor="f-from" className={labelClass}>
                From
              </label>
              <input
                id="f-from"
                type="date"
                value={filters.dateFrom}
                onChange={(e) => setFilters({ ...filters, dateFrom: e.target.value })}
                className={fieldClass}
              />
            </div>
            <div>
              <label htmlFor="f-to" className={labelClass}>
                To
              </label>
              <input
                id="f-to"
                type="date"
                value={filters.dateTo}
                onChange={(e) => setFilters({ ...filters, dateTo: e.target.value })}
                className={fieldClass}
              />
            </div>
            <div className="flex items-end">
              <button
                type="button"
                onClick={clearFilters}
                disabled={!hasActiveFilters}
                className={btn("outline", "md", "w-full")}
              >
                <X className="size-4" aria-hidden />
                Clear filters
              </button>
            </div>
          </div>
        )}

        {filteredReminders.length === 0 ? (
          <EmptyState
            title={hasActiveFilters ? "No reminders match these filters" : "No failed reminders"}
            description={
              hasActiveFilters
                ? "Clear a filter to see more."
                : "Every reminder in the last 24 hours was delivered."
            }
          />
        ) : (
          <div className="overflow-x-auto border-t border-slate-100">
            <table className="data-table">
              <thead>
                <tr>
                  <th className="w-10">
                    <input
                      type="checkbox"
                      aria-label="Select all failed reminders"
                      checked={
                        selectedReminders.size === filteredReminders.length &&
                        filteredReminders.length > 0
                      }
                      onChange={toggleSelectAll}
                      className="size-4 rounded accent-orange-700"
                    />
                  </th>
                  <th>Reminder</th>
                  <th>User</th>
                  <th>Timing</th>
                  <th>Failed at</th>
                  <th>Retries</th>
                  <th>Reason</th>
                  <th>
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredReminders.map((reminder) => (
                  <tr key={reminder._id}>
                    <td>
                      <input
                        type="checkbox"
                        aria-label={`Select reminder ${reminder._id}`}
                        checked={selectedReminders.has(reminder._id)}
                        onChange={() => toggleReminderSelection(reminder._id)}
                        className="size-4 rounded accent-orange-700"
                      />
                    </td>
                    <td>
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard.writeText(reminder._id);
                          toast.success("Reminder ID copied");
                        }}
                        title="Copy full ID"
                        className="inline-flex items-center gap-1.5 font-mono text-xs text-slate-600 hover:text-slate-900"
                      >
                        {reminder._id.slice(-8)}
                        <Copy className="size-3.5" aria-hidden />
                        <span className="sr-only">Copy reminder ID</span>
                      </button>
                    </td>
                    <td>
                      <div className="font-medium text-slate-900">{reminder.userName}</div>
                      {reminder.userEmail && (
                        <div className="text-xs text-slate-500">{reminder.userEmail}</div>
                      )}
                    </td>
                    <td>
                      <StatusBadge
                        status={reminder.interval}
                        size="sm"
                        dot={false}
                        tone={
                          reminder.interval === "24h"
                            ? "blue"
                            : reminder.interval === "1h"
                              ? "amber"
                              : "red"
                        }
                      />
                    </td>
                    <td className="whitespace-nowrap">
                      {formatDate(reminder.failedAt)}
                      <span className="text-slate-500"> · {formatTime(reminder.failedAt)}</span>
                    </td>
                    <td>{reminder.retryCount}</td>
                    <td className="max-w-xs text-red-700">
                      {reminder.failureReason || "No reason recorded"}
                    </td>
                    <td className="text-right">
                      <button
                        type="button"
                        onClick={() => handleRetryReminder(reminder._id)}
                        disabled={actionLoading}
                        className={btn("outline", "sm")}
                      >
                        <RotateCcw className="size-3.5" aria-hidden />
                        Retry
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  );
}
