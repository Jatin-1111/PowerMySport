"use client";

import { SlideUp } from "@/modules/shared/ui/motion/SlideUp";
import { motion } from "framer-motion";
import { BarChart2 } from "lucide-react";
import React from "react";

// ---------------------------------------------------------------------------
// KpiCard
// ---------------------------------------------------------------------------

export function KpiCard({
  label,
  value,
  icon,
  valueClass,
  delay,
}: {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  valueClass?: string;
  delay?: number;
}) {
  return (
    <SlideUp delay={delay ?? 0}>
      <div className="group flex items-center gap-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition-colors hover:border-orange-300">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-orange-50 text-power-orange">
          {icon}
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm text-slate-500">{label}</p>
          <p
            className={`mt-0.5 text-2xl font-semibold text-slate-900 ${valueClass ?? ""}`}
          >
            {value}
          </p>
        </div>
      </div>
    </SlideUp>
  );
}

// ---------------------------------------------------------------------------
// SparklineBarChart
// ---------------------------------------------------------------------------

export function SparklineBarChart({
  data,
}: {
  data: Array<{ label: string; count: number }>;
}) {
  const PAD = { top: 12, right: 0, bottom: 28, left: 28 };
  const W = 600;
  const H = 120;
  const chartW = W - PAD.left - PAD.right;
  const chartH = H - PAD.top - PAD.bottom;

  const maxCount = Math.max(...data.map((d) => d.count), 1);
  const barCount = data.length;
  const gap = 4;
  const barW = barCount > 0 ? (chartW - gap * (barCount - 1)) / barCount : 0;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto">
      {/* Y-axis labels */}
      <text
        x={PAD.left - 4}
        y={PAD.top + 4}
        textAnchor="end"
        fontSize={10}
        fill="#94a3b8"
      >
        {maxCount}
      </text>
      <text
        x={PAD.left - 4}
        y={PAD.top + chartH}
        textAnchor="end"
        fontSize={10}
        fill="#94a3b8"
      >
        0
      </text>

      {/* Baseline */}
      <line
        x1={PAD.left}
        y1={PAD.top + chartH}
        x2={PAD.left + chartW}
        y2={PAD.top + chartH}
        stroke="#e2e8f0"
        strokeWidth={1}
      />

      {/* Bars */}
      {data.map((d, i) => {
        const barH = maxCount > 0 ? (d.count / maxCount) * chartH : 0;
        const x = PAD.left + i * (barW + gap);
        const y = PAD.top + chartH - barH;

        return (
          <rect
            key={i}
            x={x}
            y={y}
            width={barW}
            height={barH}
            fill="rgba(249,115,22,0.75)"
            rx={2}
          />
        );
      })}

      {/* X-axis: first and last labels only */}
      {data.length > 0 && (
        <>
          <text
            x={PAD.left + barW / 2}
            y={H - 4}
            textAnchor="middle"
            fontSize={10}
            fill="#94a3b8"
          >
            {data[0].label}
          </text>
          {data.length > 1 && (
            <text
              x={PAD.left + (barCount - 1) * (barW + gap) + barW / 2}
              y={H - 4}
              textAnchor="middle"
              fontSize={10}
              fill="#94a3b8"
            >
              {data[data.length - 1].label}
            </text>
          )}
        </>
      )}
    </svg>
  );
}

// ---------------------------------------------------------------------------
// SportBreakdownPanel
// ---------------------------------------------------------------------------

const SPORT_BAR_OPACITIES = [1, 0.85, 0.7, 0.55, 0.4];

export function SportBreakdownPanel({
  data,
  emptyMessage,
}: {
  data: Array<{ sport: string; count: number; percentage: number }>;
  emptyMessage?: string;
}) {
  const top5 = data.slice(0, 5);

  if (top5.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-10 text-slate-400">
        <BarChart2 className="h-8 w-8 opacity-40" />
        <p className="text-sm">{emptyMessage ?? "No data available"}</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {top5.map((item, i) => (
        <div key={item.sport} className="flex items-center gap-3">
          <div className="w-28 shrink-0">
            <p className="truncate text-sm font-medium text-slate-700">
              {item.sport}
            </p>
            <p className="text-xs text-slate-500">{item.count} sessions</p>
          </div>
          <div
            className="relative flex-1 overflow-hidden rounded-full bg-slate-100"
            style={{ height: 8 }}
          >
            <motion.div
              className="absolute inset-y-0 left-0 rounded-full"
              style={{
                backgroundColor: `rgba(249,115,22,${SPORT_BAR_OPACITIES[i] ?? 0.4})`,
              }}
              initial={{ width: 0 }}
              animate={{ width: `${item.percentage}%` }}
              transition={{ duration: 0.7, delay: i * 0.1, ease: "easeOut" }}
            />
          </div>
          <span className="w-10 shrink-0 text-right text-xs text-slate-500">
            {item.percentage.toFixed(0)}%
          </span>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// BusyHoursHeatmap
// ---------------------------------------------------------------------------

const HEATMAP_HOURS = Array.from({ length: 16 }, (_, i) => i + 6); // 6–21

export function BusyHoursHeatmap({
  data,
}: {
  data: Array<{ hour: number; count: number }>;
}) {
  const countByHour = new Map(data.map((d) => [d.hour, d.count]));
  const maxCount = Math.max(...Array.from(countByHour.values()), 1);

  return (
    <div className="flex flex-wrap gap-2">
      {HEATMAP_HOURS.map((hour) => {
        const count = countByHour.get(hour) ?? 0;
        const intensity = count / maxCount;
        const isEmpty = count === 0;

        const bgColor = isEmpty
          ? "#f1f5f9"
          : `rgba(249,115,22,${0.12 + intensity * 0.75})`;
        const borderColor = isEmpty ? "#e2e8f0" : "transparent";
        const textColor = intensity > 0.55 ? "#ffffff" : "#64748b";

        return (
          <div
            key={hour}
            className="flex flex-col items-center gap-0.5"
            title={`${hour}:00 — ${count} bookings`}
          >
            <div
              className="flex h-9 w-9 items-center justify-center rounded-lg border text-xs font-medium"
              style={{
                backgroundColor: bgColor,
                borderColor,
                color: textColor,
                transition: "background-color 0.3s",
              }}
            >
              {count > 0 ? count : ""}
            </div>
            <span className="text-[10px] text-slate-400">{hour}</span>
          </div>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// DonutChart
// ---------------------------------------------------------------------------

const R = 36;
const CIRCUMFERENCE = 2 * Math.PI * R;

function donutColor(rate: number): string {
  if (rate >= 80) return "#10b981"; // emerald-500
  if (rate >= 50) return "#f59e0b"; // amber-500
  return "#ef4444"; // red-500
}

export function DonutChart({ rate }: { rate: number }) {
  const clampedRate = Math.max(0, Math.min(100, rate));
  const strokeDashoffset = CIRCUMFERENCE * (1 - clampedRate / 100);
  const color = donutColor(clampedRate);

  return (
    <svg width={96} height={96} viewBox="0 0 96 96">
      {/* Track */}
      <circle
        cx={48}
        cy={48}
        r={R}
        fill="none"
        stroke="#f1f5f9"
        strokeWidth={10}
      />
      {/* Animated arc */}
      <motion.circle
        cx={48}
        cy={48}
        r={R}
        fill="none"
        stroke={color}
        strokeWidth={10}
        strokeLinecap="round"
        strokeDasharray={CIRCUMFERENCE}
        initial={{ strokeDashoffset: CIRCUMFERENCE }}
        animate={{ strokeDashoffset }}
        transition={{ duration: 1, ease: "easeOut" }}
        transform="rotate(-90 48 48)"
      />
      {/* Center text */}
      <text
        x={48}
        y={48}
        dominantBaseline="middle"
        textAnchor="middle"
        fontSize={14}
        fontWeight={600}
        fill="#0f172a"
      >
        {clampedRate.toFixed(0)}%
      </text>
    </svg>
  );
}

// ---------------------------------------------------------------------------
// RetentionCard
// ---------------------------------------------------------------------------

export function RetentionCard({
  newCount,
  returningCount,
  retentionRate,
  newLabel = "New Clients",
  returningLabel = "Returning",
}: {
  newCount: number;
  returningCount: number;
  retentionRate: number;
  newLabel?: string;
  returningLabel?: string;
}) {
  const total = newCount + returningCount;
  const returningPct = total > 0 ? (returningCount / total) * 100 : 0;
  const clampedRate = Math.max(0, Math.min(100, retentionRate));

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        {/* New clients */}
        <div className="rounded-xl border border-indigo-100 bg-indigo-50 p-4 text-center">
          <p className="text-2xl font-bold text-indigo-700">{newCount}</p>
          <p className="mt-1 text-xs text-indigo-500">{newLabel}</p>
        </div>
        {/* Returning clients */}
        <div className="rounded-xl border border-orange-100 bg-orange-50 p-4 text-center">
          <p className="text-2xl font-bold text-orange-600">{returningCount}</p>
          <p className="mt-1 text-xs text-orange-400">{returningLabel}</p>
        </div>
      </div>

      {/* Returning percentage bar */}
      <div>
        <div className="mb-1 flex items-center justify-between text-xs text-slate-500">
          <span>{returningLabel} %</span>
          <span>{returningPct.toFixed(0)}%</span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
          <motion.div
            className="h-full rounded-full bg-orange-400"
            initial={{ width: 0 }}
            animate={{ width: `${returningPct}%` }}
            transition={{ duration: 0.8, ease: "easeOut" }}
          />
        </div>
      </div>

      {/* Retention rate label */}
      <p className="text-center text-sm text-slate-500">
        Retention rate:{" "}
        <span className="font-semibold text-slate-700">
          {clampedRate.toFixed(0)}%
        </span>
      </p>
    </div>
  );
}
