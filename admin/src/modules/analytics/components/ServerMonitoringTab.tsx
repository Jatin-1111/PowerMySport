"use client";

import {
  InfraMetricPoint,
  InfraMetrics,
  InfraOverview,
  statsApi,
} from "@/modules/analytics/services/stats";
import { Card } from "@/modules/shared/ui/Card";
import { useCallback, useEffect, useRef, useState } from "react";
import { io, Socket } from "socket.io-client";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const rangeOptions = [
  { hours: 1, label: "1h" },
  { hours: 6, label: "6h" },
  { hours: 24, label: "24h" },
  { hours: 72, label: "3d" },
  { hours: 168, label: "7d" },
] as const;

function formatNumber(value: number): string {
  return value.toLocaleString();
}

// EB health colours → tailwind accents.
function colorAccent(color?: string): {
  dot: string;
  badge: string;
} {
  switch ((color || "").toLowerCase()) {
    case "green":
      return { dot: "bg-emerald-500", badge: "bg-emerald-50 text-emerald-700" };
    case "yellow":
      return { dot: "bg-amber-500", badge: "bg-amber-50 text-amber-700" };
    case "red":
      return { dot: "bg-red-500", badge: "bg-red-50 text-red-700" };
    default:
      return { dot: "bg-slate-400", badge: "bg-slate-100 text-slate-600" };
  }
}

function MetricCard({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail?: string;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </p>
      <p className="mt-2 text-2xl font-semibold text-slate-900">{value}</p>
      {detail ? <p className="mt-1 text-sm text-slate-500">{detail}</p> : null}
    </div>
  );
}

function formatTick(iso: string, hours: number): string {
  const date = new Date(iso);
  if (hours <= 24) {
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }
  return date.toLocaleDateString([], { month: "short", day: "numeric" });
}

function TrendChart({
  title,
  description,
  points,
  hours,
  color,
  unit,
}: {
  title: string;
  description: string;
  points: InfraMetricPoint[];
  hours: number;
  color: string;
  unit?: string;
}) {
  const data = points.map((p) => ({
    label: formatTick(p.t, hours),
    value: p.v,
  }));

  return (
    <Card className="bg-white">
      <div className="space-y-4">
        <div>
          <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
          <p className="text-sm text-slate-500">{description}</p>
        </div>
        <div className="h-64">
          {data.length === 0 ? (
            <div className="flex h-full items-center justify-center text-sm text-slate-400">
              No data in this window.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis
                  dataKey="label"
                  tick={{ fill: "#475569", fontSize: 11 }}
                  minTickGap={24}
                />
                <YAxis tick={{ fill: "#475569", fontSize: 11 }} />
                <Tooltip
                  formatter={(value) =>
                    `${formatNumber(Number(value))}${unit ? ` ${unit}` : ""}`
                  }
                />
                <Line
                  type="monotone"
                  dataKey="value"
                  stroke={color}
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </Card>
  );
}

export function ServerMonitoringTab() {
  const [overview, setOverview] = useState<InfraOverview | null>(null);
  const [metrics, setMetrics] = useState<InfraMetrics | null>(null);
  const [hours, setHours] = useState<number>(6);
  const [loadingOverview, setLoadingOverview] = useState(true);
  const [loadingMetrics, setLoadingMetrics] = useState(true);
  const [live, setLive] = useState(false);
  const socketRef = useRef<Socket | null>(null);
  const hoursRef = useRef(hours);

  const loadOverview = useCallback(async (silent = false) => {
    if (!silent) setLoadingOverview(true);
    try {
      const response = await statsApi.getInfraOverview();
      if (response.success && response.data) setOverview(response.data);
    } finally {
      if (!silent) setLoadingOverview(false);
    }
  }, []);

  const loadMetrics = useCallback(
    async (silent = false) => {
      if (!silent) setLoadingMetrics(true);
      try {
        const response = await statsApi.getInfraMetrics(hours);
        if (response.success && response.data) setMetrics(response.data);
      } finally {
        if (!silent) setLoadingMetrics(false);
      }
    },
    [hours],
  );

  useEffect(() => {
    hoursRef.current = hours;
  }, [hours]);

  // Initial REST load so the tab paints immediately; the websocket then takes
  // over live updates.
  useEffect(() => {
    void loadOverview();
  }, [loadOverview]);

  // Fetch metrics for the selected range — over the socket when connected,
  // otherwise via REST (covers both fallback mode and pre-connect paint).
  useEffect(() => {
    const socket = socketRef.current;
    if (socket && socket.connected) {
      socket.emit("infra:setRange", hours);
    } else {
      void loadMetrics();
    }
  }, [hours, loadMetrics]);

  // Live updates over websocket (primary path).
  useEffect(() => {
    const origin = (
      process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api"
    ).replace(/\/api\/?$/, "");
    const token =
      typeof window !== "undefined" ? localStorage.getItem("token") : null;

    const socket = io(`${origin}/infra`, {
      transports: ["websocket", "polling"],
      auth: token ? { token } : undefined,
      reconnection: true,
      reconnectionDelay: 5000,
      reconnectionAttempts: Infinity,
    });
    socketRef.current = socket;

    socket.on("connect", () => {
      setLive(true);
      socket.emit("infra:setRange", hoursRef.current);
    });
    socket.on("infra:overview", (data: InfraOverview) => {
      setOverview(data);
      setLoadingOverview(false);
    });
    socket.on("infra:metrics", (data: InfraMetrics) => {
      setMetrics(data);
      setLoadingMetrics(false);
    });
    socket.on("disconnect", () => setLive(false));
    socket.on("connect_error", () => setLive(false));

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, []);

  // REST fallback polling — only while the websocket is NOT connected.
  useEffect(() => {
    if (live) return;
    const visible = () =>
      typeof document === "undefined" || document.visibilityState === "visible";

    const overviewTimer = window.setInterval(() => {
      if (visible()) void loadOverview(true);
    }, 15000);
    const metricsTimer = window.setInterval(() => {
      if (visible()) void loadMetrics(true);
    }, 30000);

    return () => {
      window.clearInterval(overviewTimer);
      window.clearInterval(metricsTimer);
    };
  }, [live, loadOverview, loadMetrics]);

  const env = overview?.environment;
  const accent = colorAccent(env?.color);
  const totalInstances = overview
    ? Object.values(overview.instanceCounts).reduce((a, b) => a + b, 0)
    : 0;
  const okInstances = overview?.instanceCounts?.Ok ?? 0;

  return (
    <div className="space-y-6">
      {/* Header / status banner */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className={`h-3 w-3 rounded-full ${accent.dot}`} />
          <div>
            <p className="text-base font-semibold text-slate-900">
              {env?.healthStatus || env?.health || "Unknown"}
              <span className="ml-2 text-sm font-normal text-slate-500">
                {overview?.environmentName} · {overview?.region}
              </span>
            </p>
            <p className="text-xs text-slate-500">
              {env?.status ? `Status: ${env.status}` : ""}
              {env?.versionLabel ? ` · ${env.versionLabel}` : ""}
              {overview?.refreshedAt
                ? ` · updated ${new Date(overview.refreshedAt).toLocaleTimeString()}`
                : ""}
            </p>
            {overview?.runtime ? (
              <p className="text-xs text-slate-400">
                {overview.runtime.hostname} · up{" "}
                {Math.floor(overview.runtime.uptimeSec / 3600)}h · load{" "}
                {overview.runtime.loadAvg[0] ?? 0} · {overview.runtime.cpuCount}{" "}
                vCPU
              </p>
            ) : null}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${
              live
                ? "bg-emerald-50 text-emerald-700"
                : "bg-slate-100 text-slate-500"
            }`}
            title={
              live
                ? "Live updates over websocket"
                : "Websocket disconnected — falling back to polling"
            }
          >
            <span className="relative flex h-1.5 w-1.5">
              {live ? (
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              ) : null}
              <span
                className={`relative inline-flex h-1.5 w-1.5 rounded-full ${
                  live ? "bg-emerald-500" : "bg-slate-400"
                }`}
              />
            </span>
            {live ? "Live" : "Reconnecting"}
          </span>
          <button
            onClick={() => {
              void loadOverview();
              void loadMetrics();
            }}
            className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
          >
            Refresh
          </button>
        </div>
      </div>

      {loadingOverview && !overview ? (
        <div className="py-10 text-center text-slate-500">
          Loading server health...
        </div>
      ) : !overview?.available ? (
        <Card className="bg-white">
          <div className="space-y-1">
            <p className="font-semibold text-slate-900">
              Couldn&apos;t reach AWS Elastic Beanstalk.
            </p>
            <p className="text-sm text-slate-500">
              {overview?.error ||
                "Check that the configured AWS credentials have read access to Elastic Beanstalk and CloudWatch."}
            </p>
          </div>
        </Card>
      ) : (
        <>
          {/* Live metric cards (EB enhanced health + instance runtime) */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
            <MetricCard
              label="Instances"
              value={`${okInstances}/${totalInstances}`}
              detail="Healthy / total"
            />
            {overview.runtime ? (
              <MetricCard
                label="Memory (instance)"
                value={`${overview.runtime.memory.usedPct}%`}
                detail={`${overview.runtime.memory.usedMb.toLocaleString()} / ${overview.runtime.memory.totalMb.toLocaleString()} MB · RSS ${overview.runtime.memory.processRssMb} MB`}
              />
            ) : null}
            <MetricCard
              label="Requests"
              value={formatNumber(overview.application?.requestCount ?? 0)}
              detail={`Last ${overview.application?.durationSec ?? 0}s`}
            />
            <MetricCard
              label="Latency p90"
              value={`${overview.application?.latencyMs.p90 ?? 0} ms`}
              detail={`p50 ${overview.application?.latencyMs.p50 ?? 0} · p99 ${
                overview.application?.latencyMs.p99 ?? 0
              }`}
            />
            <MetricCard
              label="5xx (recent)"
              value={formatNumber(overview.application?.statusCodes.p5xx ?? 0)}
              detail={`4xx ${overview.application?.statusCodes.p4xx ?? 0}`}
            />
            <MetricCard
              label="2xx (recent)"
              value={formatNumber(overview.application?.statusCodes.p2xx ?? 0)}
              detail={`3xx ${overview.application?.statusCodes.p3xx ?? 0}`}
            />
          </div>

          {/* Environment causes */}
          {env?.causes && env.causes.length > 0 ? (
            <Card className="bg-amber-50">
              <p className="mb-1 text-sm font-semibold text-amber-800">
                Health causes
              </p>
              <ul className="list-disc space-y-1 pl-5 text-sm text-amber-700">
                {env.causes.map((cause, i) => (
                  <li key={i}>{cause}</li>
                ))}
              </ul>
            </Card>
          ) : null}

          {/* Instances table */}
          <div className="space-y-3">
            <h3 className="text-lg font-semibold text-slate-900">Instances</h3>
            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="min-w-full divide-y divide-slate-200 text-sm">
                <thead className="bg-slate-50">
                  <tr>
                    {[
                      "Instance",
                      "Health",
                      "CPU",
                      "Load (1/5/15m)",
                      "Version",
                      "Launched",
                    ].map((h) => (
                      <th
                        key={h}
                        className="px-4 py-3 text-left font-semibold text-slate-700"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {overview.instances.length === 0 ? (
                    <tr>
                      <td
                        colSpan={6}
                        className="px-4 py-8 text-center text-slate-500"
                      >
                        No instance data reported.
                      </td>
                    </tr>
                  ) : (
                    overview.instances.map((inst) => {
                      const dot = colorAccent(inst.color).dot;
                      return (
                        <tr key={inst.instanceId}>
                          <td className="px-4 py-3 font-mono text-xs text-slate-700">
                            {inst.instanceId}
                          </td>
                          <td className="px-4 py-3">
                            <span className="inline-flex items-center gap-2 text-slate-700">
                              <span
                                className={`h-2.5 w-2.5 rounded-full ${dot}`}
                              />
                              {inst.health || "Unknown"}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-slate-600">
                            {inst.cpuBusyPct}%
                          </td>
                          <td className="px-4 py-3 text-slate-600">
                            {inst.loadAvg.length
                              ? inst.loadAvg.join(" / ")
                              : "—"}
                          </td>
                          <td className="px-4 py-3 text-slate-600">
                            {inst.version || "—"}
                          </td>
                          <td className="px-4 py-3 text-slate-600">
                            {inst.launchedAt
                              ? new Date(inst.launchedAt).toLocaleString()
                              : "—"}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Trend charts */}
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-slate-700">Window:</span>
            <select
              value={hours}
              onChange={(event) => setHours(Number(event.target.value))}
              className="rounded border border-slate-300 px-3 py-1.5 text-sm"
            >
              {rangeOptions.map((opt) => (
                <option key={opt.hours} value={opt.hours}>
                  Last {opt.label}
                </option>
              ))}
            </select>
            {loadingMetrics ? (
              <span className="text-sm text-slate-400">Loading…</span>
            ) : null}
          </div>

          {metrics && !metrics.available ? (
            <Card className="bg-white">
              <p className="text-sm text-slate-500">
                CloudWatch trends unavailable: {metrics.error}
              </p>
            </Card>
          ) : (
            <div className="grid gap-6 xl:grid-cols-2">
              <TrendChart
                title="CPU utilisation"
                description="Average across the Auto Scaling group."
                points={metrics?.series.cpuPct ?? []}
                hours={hours}
                color="#f97316"
                unit="%"
              />
              <TrendChart
                title="Request count"
                description="Total requests handled by the load balancer."
                points={metrics?.series.requestCount ?? []}
                hours={hours}
                color="#0ea5e9"
              />
              <TrendChart
                title="Target response time"
                description="Average backend latency."
                points={metrics?.series.latencyMs ?? []}
                hours={hours}
                color="#8b5cf6"
                unit="ms"
              />
              <TrendChart
                title="5xx errors"
                description="Target 5xx responses over the window."
                points={metrics?.series.errors5xx ?? []}
                hours={hours}
                color="#ef4444"
              />
            </div>
          )}

          {/* Recent EB events */}
          <div className="space-y-3">
            <h3 className="text-lg font-semibold text-slate-900">
              Recent environment events
            </h3>
            <div className="space-y-2">
              {overview.events.length === 0 ? (
                <p className="text-sm text-slate-500">No recent events.</p>
              ) : (
                overview.events.map((event, i) => (
                  <div
                    key={i}
                    className="rounded-lg border border-slate-200 bg-white px-4 py-2"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-xs font-semibold uppercase text-slate-400">
                        {event.severity || "INFO"}
                      </span>
                      <span className="text-xs text-slate-400">
                        {event.date
                          ? new Date(event.date).toLocaleString()
                          : ""}
                      </span>
                    </div>
                    <p className="text-sm text-slate-700">{event.message}</p>
                  </div>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
