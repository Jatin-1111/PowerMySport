"use client";

import React from "react";
import { motion } from "framer-motion";
import { IndianRupee, TrendingUp, TrendingDown, CheckCircle } from "lucide-react";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function fmtAmount(n: number): string {
  return n.toLocaleString("en-IN");
}

function fmtDate(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return dateStr;
  }
}

// ---------------------------------------------------------------------------
// 1. EarningsStatCard
// ---------------------------------------------------------------------------

interface EarningsStatCardProps {
  title: string;
  amount: number;
  subtitle: string;
  icon: React.ReactNode;
  accent?: boolean;
  trend?: { value: number; positive: boolean } | null;
}

export function EarningsStatCard({
  title,
  amount,
  subtitle,
  icon,
  accent = false,
  trend,
}: EarningsStatCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className={[
        "rounded-2xl p-5 shadow-sm flex flex-col gap-3 border",
        accent
          ? "bg-gradient-to-br from-orange-500 to-orange-600 border-orange-400 text-white"
          : "bg-white border-slate-100 text-slate-800",
      ].join(" ")}
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <span
          className={[
            "text-sm font-medium",
            accent ? "text-orange-100" : "text-slate-500",
          ].join(" ")}
        >
          {title}
        </span>
        <span
          className={[
            "flex items-center justify-center w-9 h-9 rounded-xl",
            accent ? "bg-white/20" : "bg-orange-50 text-orange-500",
          ].join(" ")}
        >
          {icon}
        </span>
      </div>

      {/* Amount */}
      <div className="flex items-baseline gap-1">
        <IndianRupee
          className={["w-5 h-5", accent ? "text-orange-100" : "text-slate-400"].join(" ")}
          strokeWidth={2.5}
        />
        <span className="text-2xl font-bold tracking-tight">{fmtAmount(amount)}</span>
      </div>

      {/* Subtitle + Trend */}
      <div className="flex items-center justify-between gap-2">
        <span
          className={[
            "text-xs",
            accent ? "text-orange-100" : "text-slate-400",
          ].join(" ")}
        >
          {subtitle}
        </span>
        {trend != null && (
          <span
            className={[
              "flex items-center gap-0.5 text-xs font-semibold px-2 py-0.5 rounded-full",
              trend.positive
                ? accent
                  ? "bg-white/20 text-white"
                  : "bg-green-50 text-green-600"
                : accent
                ? "bg-white/20 text-white"
                : "bg-red-50 text-red-500",
            ].join(" ")}
          >
            {trend.positive ? (
              <TrendingUp className="w-3 h-3" />
            ) : (
              <TrendingDown className="w-3 h-3" />
            )}
            {trend.positive ? "+" : ""}
            {trend.value}%
          </span>
        )}
      </div>
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// 2. MonthlyBarChart
// ---------------------------------------------------------------------------

interface MonthlyDataPoint {
  label: string;
  total: number;
  sessions: number;
}

const PAD = { top: 20, right: 16, bottom: 40, left: 56 } as const;
const CHART_W = 600;
const CHART_H = 200;
const INNER_W = CHART_W - PAD.left - PAD.right;
const INNER_H = CHART_H - PAD.top - PAD.bottom;
const GRID_LINES = 5;

function formatYLabel(n: number): string {
  if (n >= 100000) return `${(n / 100000).toFixed(1)}L`;
  if (n >= 1000) return `${(n / 1000).toFixed(0)}k`;
  return String(n);
}

export function MonthlyBarChart({ months }: { months: MonthlyDataPoint[] }) {
  const currentShortMonth = new Date()
    .toLocaleString("en-US", { month: "short" })
    .slice(0, 3);

  const maxVal = Math.max(...months.map((m) => m.total), 1);
  const yMax = Math.ceil(maxVal / GRID_LINES) * GRID_LINES || GRID_LINES;

  const barGroupW = months.length > 0 ? INNER_W / months.length : INNER_W;
  const barW = Math.max(8, barGroupW * 0.55);
  const barOffset = (barGroupW - barW) / 2;

  const gradNormal = "url(#earningsBarNormal)";
  const gradHighlight = "url(#earningsBarHighlight)";

  return (
    <div className="w-full overflow-x-auto">
      <svg
        viewBox={`0 0 ${CHART_W} ${CHART_H}`}
        className="w-full h-auto"
        aria-label="Monthly earnings bar chart"
      >
        <defs>
          <linearGradient id="earningsBarNormal" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#fb923c" />
            <stop offset="100%" stopColor="#f97316" />
          </linearGradient>
          <linearGradient id="earningsBarHighlight" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#ea580c" />
            <stop offset="100%" stopColor="#c2410c" />
          </linearGradient>
        </defs>

        {/* Y-axis gridlines + labels */}
        {Array.from({ length: GRID_LINES + 1 }).map((_, i) => {
          const val = (yMax / GRID_LINES) * (GRID_LINES - i);
          const y = PAD.top + (i / GRID_LINES) * INNER_H;
          return (
            <g key={`grid-${i}`}>
              <line
                x1={PAD.left}
                y1={y}
                x2={PAD.left + INNER_W}
                y2={y}
                stroke="#e2e8f0"
                strokeWidth={1}
              />
              <text
                x={PAD.left - 6}
                y={y + 4}
                textAnchor="end"
                fontSize={10}
                fill="#94a3b8"
              >
                {formatYLabel(val)}
              </text>
            </g>
          );
        })}

        {/* Bars */}
        {months.map((m, idx) => {
          const isCurrent = m.label.startsWith(currentShortMonth);
          const x = PAD.left + idx * barGroupW + barOffset;
          const barH = m.total > 0 ? (m.total / yMax) * INNER_H : 0;
          const y = PAD.top + INNER_H - barH;
          const labelY = PAD.top + INNER_H + 14;

          return (
            <g key={m.label}>
              {m.total > 0 ? (
                <rect
                  x={x}
                  y={y}
                  width={barW}
                  height={barH}
                  rx={4}
                  fill={isCurrent ? gradHighlight : gradNormal}
                />
              ) : (
                <rect
                  x={x}
                  y={PAD.top + INNER_H - 3}
                  width={barW}
                  height={3}
                  rx={2}
                  fill="#cbd5e1"
                />
              )}

              {/* Value label above bar */}
              {barH > 18 && (
                <text
                  x={x + barW / 2}
                  y={y - 4}
                  textAnchor="middle"
                  fontSize={9}
                  fill={isCurrent ? "#c2410c" : "#f97316"}
                  fontWeight="600"
                >
                  {formatYLabel(m.total)}
                </text>
              )}

              {/* X-axis label */}
              <text
                x={x + barW / 2}
                y={labelY}
                textAnchor="middle"
                fontSize={10}
                fill={isCurrent ? "#f97316" : "#64748b"}
                fontWeight={isCurrent ? "700" : "400"}
              >
                {m.label}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 3. CategoryBreakdownList
// ---------------------------------------------------------------------------

interface CategoryDataPoint {
  category: string;
  total: number;
  sessions: number;
}

function capitalize(str: string): string {
  if (!str) return str;
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}

export function CategoryBreakdownList({
  items,
  emptyMessage = "No data yet.",
}: {
  items: CategoryDataPoint[];
  emptyMessage?: string;
}) {
  const totalEarnings = items.reduce((sum, item) => sum + item.total, 0);

  if (items.length === 0) {
    return (
      <div className="py-10 flex flex-col items-center justify-center text-slate-400 text-sm gap-2">
        <IndianRupee className="w-8 h-8 text-slate-200" />
        <span>{emptyMessage}</span>
      </div>
    );
  }

  return (
    <ul className="space-y-4">
      {items.map((item) => {
        const pct = totalEarnings > 0 ? (item.total / totalEarnings) * 100 : 0;
        return (
          <li key={item.category} className="space-y-1.5">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium text-slate-700">
                {capitalize(item.category)}
              </span>
              <div className="flex items-center gap-3">
                <span className="text-xs text-slate-400">
                  {item.sessions} session{item.sessions !== 1 ? "s" : ""}
                </span>
                <span className="flex items-center gap-0.5 font-semibold text-slate-800">
                  <IndianRupee className="w-3.5 h-3.5 text-slate-400" strokeWidth={2.5} />
                  {fmtAmount(item.total)}
                </span>
              </div>
            </div>

            {/* Progress bar */}
            <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${pct}%` }}
                transition={{ duration: 0.6, ease: "easeOut" }}
                className="h-full rounded-full bg-gradient-to-r from-orange-400 to-orange-500"
              />
            </div>
          </li>
        );
      })}
    </ul>
  );
}

// ---------------------------------------------------------------------------
// 4. RecentTransactionsList
// ---------------------------------------------------------------------------

interface TransactionItem {
  id: string;
  customerName: string;
  category: string;
  date: string;
  amount: number;
}

export function RecentTransactionsList({
  transactions,
  emptyMessage = "No transactions yet.",
}: {
  transactions: TransactionItem[];
  emptyMessage?: string;
}) {
  if (transactions.length === 0) {
    return (
      <div className="py-10 flex flex-col items-center justify-center text-slate-400 text-sm gap-2">
        <CheckCircle className="w-8 h-8 text-slate-200" />
        <span>{emptyMessage}</span>
      </div>
    );
  }

  return (
    <ul className="divide-y divide-slate-100">
      {transactions.map((tx) => (
        <li
          key={tx.id}
          className="flex items-center gap-4 py-3 first:pt-0 last:pb-0"
        >
          {/* Avatar */}
          <span className="flex-shrink-0 flex items-center justify-center w-9 h-9 rounded-xl bg-orange-50 text-orange-500">
            <CheckCircle className="w-5 h-5" strokeWidth={2} />
          </span>

          {/* Details */}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-slate-800 truncate">
              {tx.customerName}
            </p>
            <p className="text-xs text-slate-400 truncate">
              {capitalize(tx.category)} &middot; {fmtDate(tx.date)}
            </p>
          </div>

          {/* Amount + status */}
          <div className="flex flex-col items-end gap-1 flex-shrink-0">
            <span className="flex items-center gap-0.5 text-sm font-bold text-slate-800">
              <IndianRupee className="w-3.5 h-3.5 text-slate-400" strokeWidth={2.5} />
              {fmtAmount(tx.amount)}
            </span>
            <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600">
              Completed
            </span>
          </div>
        </li>
      ))}
    </ul>
  );
}
