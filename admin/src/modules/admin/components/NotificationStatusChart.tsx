"use client";

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";

type NotificationStatusChartProps = {
  totalProcessed: number;
  totalSent: number;
  totalFailed: number;
  totalCancelled: number;
};

const COLORS = {
  sent: "#10b981",
  failed: "#ef4444",
  cancelled: "#6b7280",
};

export function NotificationStatusChart({
  totalProcessed,
  totalSent,
  totalFailed,
  totalCancelled,
}: NotificationStatusChartProps) {
  const pieChartData = [
    { name: "Sent", value: totalSent || 0, color: COLORS.sent },
    { name: "Failed", value: totalFailed || 0, color: COLORS.failed },
    { name: "Cancelled", value: totalCancelled || 0, color: COLORS.cancelled },
  ];

  return (
    <ResponsiveContainer width="100%" height={300}>
      <PieChart>
        <Pie
          data={pieChartData}
          cx="50%"
          cy="50%"
          labelLine={false}
          label={(entry) => {
            const total = totalProcessed || 1;
            const value = typeof entry.value === "number" ? entry.value : 0;
            const percentage = ((value / total) * 100).toFixed(1);
            const name = entry.name || "Unknown";
            return `${name}: ${value} (${percentage}%)`;
          }}
          outerRadius={80}
          fill="#8884d8"
          dataKey="value"
        >
          {pieChartData.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={entry.color} />
          ))}
        </Pie>
        <Tooltip />
      </PieChart>
    </ResponsiveContainer>
  );
}
