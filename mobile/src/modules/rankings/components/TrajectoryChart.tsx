import React, { useState } from "react";
import { View, Text, type LayoutChangeEvent } from "react-native";
import Svg, { Line, Polyline, Circle } from "react-native-svg";
import { COLORS } from "@lib/constants";
import type { PlayerHistoryPoint } from "../services/rankings";
import { comboLabel, listDate } from "../utils/text";

const HEIGHT = 150;
const PAD = { left: 8, right: 8, top: 10, bottom: 10 };

interface Series {
  label: string;
  points: PlayerHistoryPoint[];
}

/** History mixes every list and can hold two rows for one date (a corrected re-upload): keep one. */
export function seriesOf(history: PlayerHistoryPoint[], orderedLists: string[]): Series[] {
  const byList = new Map<string, Map<string, PlayerHistoryPoint>>();
  for (const h of history) {
    const key = `${h.category}|${h.subcategory}`;
    const dates = byList.get(key) ?? new Map<string, PlayerHistoryPoint>();
    dates.set(h.asOnDate.slice(0, 10), h);
    byList.set(key, dates);
  }
  return orderedLists
    .map((key) => {
      const [category, subcategory] = key.split("|");
      const points = [...(byList.get(key)?.values() ?? [])].sort((a, b) =>
        a.asOnDate.localeCompare(b.asOnDate)
      );
      return { label: comboLabel(category, subcategory), points };
    })
    .filter((s) => s.points.length >= 2);
}

function Chart({ series }: { series: Series }) {
  const [width, setWidth] = useState(0);
  const { points } = series;
  const ranks = points.map((p) => p.rank);
  const best = Math.min(...ranks);
  const worst = Math.max(...ranks);
  const t0 = new Date(points[0].asOnDate).getTime();
  const t1 = new Date(points[points.length - 1].asOnDate).getTime();
  const innerW = Math.max(1, width - PAD.left - PAD.right);
  const innerH = HEIGHT - PAD.top - PAD.bottom;

  // A better (smaller) rank is higher on the chart.
  const x = (iso: string) =>
    PAD.left + (t1 === t0 ? 0 : ((new Date(iso).getTime() - t0) / (t1 - t0)) * innerW);
  const y = (rank: number) =>
    PAD.top + (worst === best ? innerH / 2 : ((rank - best) / (worst - best)) * innerH);
  const path = points.map((p) => `${x(p.asOnDate)},${y(p.rank)}`).join(" ");
  const first = points[0];
  const last = points[points.length - 1];

  return (
    <View
      className="mb-4"
      onLayout={(e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width)}
    >
      <Text className="text-ink mb-1 text-sm font-semibold">{series.label}</Text>
      <View
        accessible
        accessibilityLabel={`${series.label} rank over time: number ${first.rank} on ${listDate(first.asOnDate)}, number ${last.rank} on ${listDate(last.asOnDate)}. Best ${best}, lowest ${worst}.`}
      >
        {width > 0 ? (
          <Svg width={width} height={HEIGHT}>
            <Line
              x1={PAD.left}
              x2={width - PAD.right}
              y1={PAD.top}
              y2={PAD.top}
              stroke={COLORS.hairline}
              strokeWidth={1}
            />
            <Line
              x1={PAD.left}
              x2={width - PAD.right}
              y1={HEIGHT - PAD.bottom}
              y2={HEIGHT - PAD.bottom}
              stroke={COLORS.hairline}
              strokeWidth={1}
            />
            <Polyline
              points={path}
              fill="none"
              stroke={COLORS.action}
              strokeWidth={2}
              strokeLinejoin="round"
            />
            <Circle cx={x(last.asOnDate)} cy={y(last.rank)} r={4} fill={COLORS.action} />
          </Svg>
        ) : (
          <View style={{ height: HEIGHT }} />
        )}
      </View>
      <View className="mt-1 flex-row justify-between">
        <Text className="text-muted text-xs">
          #{first.rank}, {listDate(first.asOnDate)}
        </Text>
        <Text className="text-muted text-xs">
          #{last.rank}, {listDate(last.asOnDate)}
        </Text>
      </View>
      <Text className="text-muted text-xs">
        Higher on the chart is a better rank (best #{best}, lowest #{worst}).
      </Text>
    </View>
  );
}

export function TrajectoryChart({
  history,
  orderedLists,
}: {
  history: PlayerHistoryPoint[];
  orderedLists: string[];
}) {
  // Up to two lists, home list first, and only lists with at least two points.
  const all = seriesOf(history, orderedLists);
  const shown = [...all].sort((a, b) => b.points.length - a.points.length).slice(0, 2);
  if (shown.length === 0) return null;
  const ordered = all.filter((s) => shown.includes(s));
  return (
    <View>
      {ordered.map((s) => (
        <Chart key={s.label} series={s} />
      ))}
    </View>
  );
}
