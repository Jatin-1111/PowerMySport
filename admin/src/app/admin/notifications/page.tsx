"use client";

import { AdminPageHeader } from "@/modules/admin/components/AdminPageHeader";
import {
  notificationApi,
  MonitoringStats,
  SchedulerHealth,
  FailedReminder,
} from "@/modules/admin/services/notifications";
import { Card } from "@/modules/shared/ui/Card";
import { Button } from "@/modules/shared/ui/Button";
import { toast } from "@/lib/toast";
import { formatDate, formatTime } from "@/utils/format";
import {
  Bell,
  CheckCircle2,
  XCircle,
  Clock,
  AlertTriangle,
  Activity,
  RefreshCw,
  Send,
  Calendar,
  Download,
  RotateCcw,
  Filter,
  X,
} from "lucide-react";
import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef, useState } from "react";
import { io, Socket } from "socket.io-client";

const NotificationStatusChart = dynamic(
  () =>
    import("@/modules/admin/components/NotificationStatusChart").then(
      (module) => module.NotificationStatusChart,
    ),
  {
    ssr: false,
    loading: () => (
      <div className="h-75 animate-pulse rounded-lg bg-slate-100" />
    ),
  },
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
  const [filteredReminders, setFilteredReminders] = useState<FailedReminder[]>(
    [],
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [failedLimit, setFailedLimit] = useState(50);
  const [selectedReminders, setSelectedReminders] = useState<Set<string>>(
    new Set(),
  );
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState<Filters>({
    bookingId: "",
    userId: "",
    interval: "",
    dateFrom: "",
    dateTo: "",
  });
  const socketRef = useRef<Socket | null>(null);
  const updateFlushTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
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

      const [statsResponse, healthResponse, failedResponse] = await Promise.all(
        [
          notificationApi.getStats(),
          notificationApi.getHealth(),
          notificationApi.getFailedReminders(failedLimit),
        ],
      );

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
        r.bookingId?.toLowerCase().includes(filters.bookingId.toLowerCase()),
      );
    }
    if (filters.userId) {
      filtered = filtered.filter((r) =>
        r.userId.toLowerCase().includes(filters.userId.toLowerCase()),
      );
    }
    if (filters.interval) {
      filtered = filtered.filter((r) => r.interval === filters.interval);
    }
    if (filters.dateFrom) {
      const fromDate = new Date(filters.dateFrom);
      filtered = filtered.filter((r) => new Date(r.scheduledFor) >= fromDate);
    }
    if (filters.dateTo) {
      const toDate = new Date(filters.dateTo);
      toDate.setHours(23, 59, 59, 999); // End of day
      filtered = filtered.filter((r) => new Date(r.scheduledFor) <= toDate);
    }

    setFilteredReminders(filtered);
  }, [filters, failedReminders]);

  // Socket.IO connection for real-time updates
  useEffect(() => {
    const API_BASE_URL =
      process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

    const socket = io(API_BASE_URL, {
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionDelay: 5000,
      reconnectionAttempts: Infinity,
    });

    socketRef.current = socket;

    socket.on("connect", () => {
      console.log("✅ Socket.IO connected for real-time notifications");
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
        toast.success(
          `Daily summary sent successfully! (${response.data.emailsSent} emails)`,
        );
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
      const response = await notificationApi.retryMultiple(
        Array.from(selectedReminders),
      );

      if (response.success && response.data) {
        const successCount = response.data.results.filter(
          (r) => r.success,
        ).length;
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
      "User ID",
      "Booking ID",
      "Interval",
      "Scheduled For",
      "Status",
      "Retry Count",
      "Failure Reason",
      "Created At",
    ];

    const rows = filteredReminders.map((r) => [
      r._id,
      r.userId,
      r.bookingId || "N/A",
      r.interval,
      new Date(r.scheduledFor).toISOString(),
      r.status,
      r.retryCount.toString(),
      r.failureReason || "N/A",
      new Date(r.createdAt).toISOString(),
    ]);

    const csvContent = [
      headers.join(","),
      ...rows.map((row) =>
        row.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(","),
      ),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute(
      "download",
      `failed-reminders-${new Date().toISOString().split("T")[0]}.csv`,
    );
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

  if (loading) {
    return <div className="text-center py-12">Loading notifications...</div>;
  }

  if (error || !stats) {
    return (
      <div className="space-y-6">
        <AdminPageHeader
          badge="Monitoring"
          title="Notification Dashboard"
          subtitle="Monitor booking reminders and scheduler health."
        />
        <Card className="bg-white">
          <div className="py-10 text-center space-y-3">
            <p className="text-red-600 font-semibold">{error}</p>
            <button
              onClick={fetchData}
              className="px-4 py-2 rounded-lg bg-slate-900 text-white hover:bg-slate-800 transition-colors"
            >
              Retry
            </button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <AdminPageHeader
        badge="Monitoring"
        title="Notification Dashboard"
        subtitle="Monitor booking reminders and scheduler health in real-time."
      />

      {/* Manual Action Buttons */}
      <div className="flex gap-3 flex-wrap">
        <Button
          onClick={handleHealthCheck}
          disabled={actionLoading}
          className="bg-blue-600 hover:bg-blue-700 text-white"
        >
          <Activity className="w-4 h-4 mr-2" />
          Run Health Check
        </Button>
        <Button
          onClick={handleSendDailySummary}
          disabled={actionLoading}
          className="bg-green-600 hover:bg-green-700 text-white"
        >
          <Send className="w-4 h-4 mr-2" />
          Send Daily Summary
        </Button>
        <Button
          onClick={handleExportCSV}
          className="bg-purple-600 hover:bg-purple-700 text-white"
        >
          <Download className="w-4 h-4 mr-2" />
          Export CSV
        </Button>
        {selectedReminders.size > 0 && (
          <Button
            onClick={handleRetrySelected}
            disabled={actionLoading}
            className="bg-orange-600 hover:bg-orange-700 text-white"
          >
            <RotateCcw className="w-4 h-4 mr-2" />
            Retry Selected ({selectedReminders.size})
          </Button>
        )}
        <Button
          onClick={fetchData}
          disabled={loading}
          className="bg-slate-600 hover:bg-slate-700 text-white ml-auto"
        >
          <RefreshCw className="w-4 h-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Statistics Cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card className="bg-white p-6">
            <div className="flex items-center justify-between mb-2">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Bell className="w-6 h-6 text-blue-600" />
              </div>
              <span className="text-sm text-slate-500">24h Total</span>
            </div>
            <div className="space-y-1">
              <p className="text-3xl font-bold text-slate-900">
                {stats?.totalProcessed?.toLocaleString() || "0"}
              </p>
              <p className="text-sm text-slate-600">Total Processed</p>
            </div>
          </Card>

          <Card className="bg-white p-6">
            <div className="flex items-center justify-between mb-2">
              <div className="p-2 bg-green-100 rounded-lg">
                <CheckCircle2 className="w-6 h-6 text-green-600" />
              </div>
              <span className="text-sm text-slate-500">24h Sent</span>
            </div>
            <div className="space-y-1">
              <p className="text-3xl font-bold text-slate-900">
                {stats?.totalSent?.toLocaleString() || "0"}
              </p>
              <p className="text-sm text-slate-600">Successfully Sent</p>
            </div>
          </Card>

          <Card className="bg-white p-6">
            <div className="flex items-center justify-between mb-2">
              <div className="p-2 bg-red-100 rounded-lg">
                <XCircle className="w-6 h-6 text-red-600" />
              </div>
              <span className="text-sm text-slate-500">24h Failed</span>
            </div>
            <div className="space-y-1">
              <p className="text-3xl font-bold text-slate-900">
                {stats?.totalFailed?.toLocaleString() || "0"}
              </p>
              <p className="text-sm text-slate-600">Failed Deliveries</p>
            </div>
          </Card>

          <Card className="bg-white p-6">
            <div className="flex items-center justify-between mb-2">
              <div className="p-2 bg-orange-100 rounded-lg">
                <AlertTriangle className="w-6 h-6 text-orange-600" />
              </div>
              <span className="text-sm text-slate-500">Failure Rate</span>
            </div>
            <div className="space-y-1">
              <p className="text-3xl font-bold text-slate-900">
                {stats?.failureRate?.toFixed(2) || "0.00"}%
              </p>
              <p className="text-sm text-slate-600">
                {(stats?.failureRate || 0) < 1
                  ? "Excellent"
                  : (stats?.failureRate || 0) < 5
                    ? "Good"
                    : "Needs Attention"}
              </p>
            </div>
          </Card>
        </div>
      )}

      {/* Analytics Charts */}
      {stats && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="bg-white p-6">
            <h3 className="text-lg font-bold text-slate-900 mb-4">
              Status Distribution (24h)
            </h3>
            <NotificationStatusChart
              totalProcessed={stats.totalProcessed || 0}
              totalSent={stats.totalSent || 0}
              totalFailed={stats.totalFailed || 0}
              totalCancelled={stats.totalCancelled || 0}
            />
          </Card>

          <Card className="bg-white p-6">
            <h3 className="text-lg font-bold text-slate-900 mb-4">
              Performance Metrics
            </h3>
            <div className="space-y-4">
              <div>
                <div className="flex justify-between mb-1">
                  <span className="text-sm text-slate-600">Success Rate</span>
                  <span className="text-sm font-semibold text-green-600">
                    {stats?.totalProcessed
                      ? (
                          (stats.totalSent / stats.totalProcessed) *
                          100
                        ).toFixed(1)
                      : "0.0"}
                    %
                  </span>
                </div>
                <div className="w-full bg-slate-200 rounded-full h-2">
                  <div
                    className="bg-green-500 h-2 rounded-full"
                    style={{
                      width: stats?.totalProcessed
                        ? `${(stats.totalSent / stats.totalProcessed) * 100}%`
                        : "0%",
                    }}
                  />
                </div>
              </div>
              <div>
                <div className="flex justify-between mb-1">
                  <span className="text-sm text-slate-600">Failure Rate</span>
                  <span className="text-sm font-semibold text-red-600">
                    {stats?.failureRate?.toFixed(1) || "0.0"}%
                  </span>
                </div>
                <div className="w-full bg-slate-200 rounded-full h-2">
                  <div
                    className="bg-red-500 h-2 rounded-full"
                    style={{ width: `${stats?.failureRate || 0}%` }}
                  />
                </div>
              </div>
              <div>
                <div className="flex justify-between mb-1">
                  <span className="text-sm text-slate-600">
                    Cancellation Rate
                  </span>
                  <span className="text-sm font-semibold text-slate-600">
                    {stats?.totalProcessed
                      ? (
                          (stats.totalCancelled / stats.totalProcessed) *
                          100
                        ).toFixed(1)
                      : "0.0"}
                    %
                  </span>
                </div>
                <div className="w-full bg-slate-200 rounded-full h-2">
                  <div
                    className="bg-slate-500 h-2 rounded-full"
                    style={{
                      width: stats?.totalProcessed
                        ? `${(stats.totalCancelled / stats.totalProcessed) * 100}%`
                        : "0%",
                    }}
                  />
                </div>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Health Status */}
      {health && (
        <Card className="bg-white p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
              <Activity className="w-5 h-5" />
              Scheduler Health
            </h2>
            <div
              className={`px-3 py-1 rounded-full text-sm font-semibold ${
                health?.isHealthy
                  ? "bg-green-100 text-green-700"
                  : "bg-red-100 text-red-700"
              }`}
            >
              {health?.isHealthy ? "✓ Healthy" : "✗ Unhealthy"}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <div className="space-y-1">
              <p className="text-sm text-slate-600">Last Run</p>
              <p className="text-base font-semibold text-slate-900">
                {health?.lastRun
                  ? `${formatTime(health.lastRun)} (${health?.minutesSinceLastRun || 0}m ago)`
                  : "Never"}
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-slate-600">Pending</p>
              <p className="text-base font-semibold text-slate-900">
                {health?.pendingCount || 0}
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-slate-600">Overdue</p>
              <p
                className={`text-base font-semibold ${
                  (health?.overdueCount || 0) > 50
                    ? "text-red-600"
                    : "text-slate-900"
                }`}
              >
                {health?.overdueCount || 0}
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-slate-600">Failure Rate</p>
              <p
                className={`text-base font-semibold ${
                  (health?.failureRate || 0) > 10
                    ? "text-red-600"
                    : "text-slate-900"
                }`}
              >
                {health?.failureRate?.toFixed(2) || "0.00"}%
              </p>
            </div>
          </div>

          {health.issues && health.issues.length > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <h3 className="text-sm font-semibold text-red-900 mb-2">
                Issues Detected:
              </h3>
              <ul className="space-y-1">
                {health.issues.map((issue, index) => (
                  <li key={index} className="text-sm text-red-800">
                    • {issue}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Card>
      )}

      {/* Failed Reminders Table */}
      <Card className="bg-white p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <XCircle className="w-5 h-5" />
            Failed Reminders
            {hasActiveFilters && (
              <span className="text-sm font-normal text-slate-500">
                ({filteredReminders.length} filtered)
              </span>
            )}
          </h2>
          <div className="flex gap-2">
            <Button
              onClick={() => setShowFilters(!showFilters)}
              className={`${showFilters ? "bg-blue-600 text-white" : "bg-slate-200 text-slate-700"}`}
            >
              <Filter className="w-4 h-4 mr-2" />
              Filters
            </Button>
            <select
              value={failedLimit}
              onChange={(e) => setFailedLimit(Number(e.target.value))}
              className="px-3 py-2 border border-slate-300 rounded-lg text-sm"
            >
              <option value={10}>Show 10</option>
              <option value={25}>Show 25</option>
              <option value={50}>Show 50</option>
              <option value={100}>Show 100</option>
            </select>
          </div>
        </div>

        {/* Filter Panel */}
        {showFilters && (
          <div className="mb-6 p-4 bg-slate-50 rounded-lg border border-slate-200">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Booking ID
                </label>
                <input
                  type="text"
                  value={filters.bookingId}
                  onChange={(e) =>
                    setFilters({ ...filters, bookingId: e.target.value })
                  }
                  placeholder="Search by booking ID..."
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  User ID
                </label>
                <input
                  type="text"
                  value={filters.userId}
                  onChange={(e) =>
                    setFilters({ ...filters, userId: e.target.value })
                  }
                  placeholder="Search by user ID..."
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Interval
                </label>
                <select
                  value={filters.interval}
                  onChange={(e) =>
                    setFilters({ ...filters, interval: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                >
                  <option value="">All intervals</option>
                  <option value="24h">24 Hours</option>
                  <option value="1h">1 Hour</option>
                  <option value="15min">15 Minutes</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Date From
                </label>
                <input
                  type="date"
                  value={filters.dateFrom}
                  onChange={(e) =>
                    setFilters({ ...filters, dateFrom: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Date To
                </label>
                <input
                  type="date"
                  value={filters.dateTo}
                  onChange={(e) =>
                    setFilters({ ...filters, dateTo: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                />
              </div>
              <div className="flex items-end">
                <Button
                  onClick={clearFilters}
                  disabled={!hasActiveFilters}
                  className="w-full bg-slate-600 text-white hover:bg-slate-700"
                >
                  <X className="w-4 h-4 mr-2" />
                  Clear Filters
                </Button>
              </div>
            </div>
          </div>
        )}

        {filteredReminders.length === 0 ? (
          <div className="text-center py-8">
            <CheckCircle2 className="w-12 h-12 text-green-500 mx-auto mb-3" />
            <p className="text-slate-600">
              {hasActiveFilters
                ? "No failed reminders match your filters."
                : "No failed reminders in the last 24 hours!"}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="text-left py-3 px-4">
                    <input
                      type="checkbox"
                      checked={
                        selectedReminders.size === filteredReminders.length &&
                        filteredReminders.length > 0
                      }
                      onChange={toggleSelectAll}
                      className="rounded"
                    />
                  </th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-slate-700">
                    Reminder ID
                  </th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-slate-700">
                    Interval
                  </th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-slate-700">
                    Scheduled For
                  </th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-slate-700">
                    Retry Count
                  </th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-slate-700">
                    Failure Reason
                  </th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-slate-700">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredReminders.map((reminder) => (
                  <tr
                    key={reminder._id}
                    className="border-b border-slate-100 hover:bg-slate-50"
                  >
                    <td className="py-3 px-4">
                      <input
                        type="checkbox"
                        checked={selectedReminders.has(reminder._id)}
                        onChange={() => toggleReminderSelection(reminder._id)}
                        className="rounded"
                      />
                    </td>
                    <td className="py-3 px-4 text-sm font-mono text-slate-600">
                      {reminder._id.slice(-8)}
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`px-2 py-1 rounded text-xs font-semibold ${
                          reminder.interval === "24h"
                            ? "bg-blue-100 text-blue-700"
                            : reminder.interval === "1h"
                              ? "bg-orange-100 text-orange-700"
                              : "bg-red-100 text-red-700"
                        }`}
                      >
                        {reminder.interval}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-sm text-slate-600">
                      <div className="flex items-center gap-1">
                        <Calendar className="w-4 h-4" />
                        {formatDate(reminder.scheduledFor)}
                        <Clock className="w-4 h-4 ml-2" />
                        {formatTime(reminder.scheduledFor)}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-sm text-slate-600">
                      {reminder.retryCount}
                    </td>
                    <td className="py-3 px-4 text-sm text-red-600">
                      {reminder.failureReason || "Unknown error"}
                    </td>
                    <td className="py-3 px-4">
                      <Button
                        onClick={() => handleRetryReminder(reminder._id)}
                        disabled={actionLoading}
                        className="bg-orange-600 text-white hover:bg-orange-700 text-xs py-1 px-2"
                      >
                        <RotateCcw className="w-3 h-3 mr-1" />
                        Retry
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
