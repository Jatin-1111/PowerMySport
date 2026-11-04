import React, { useCallback, useEffect, useState } from "react";
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ArrowLeft } from "lucide-react-native";
import {
  CHILD_HISTORY_SOURCE_LABELS,
  CHILD_SHARE_NOTICE,
  type ChildHistoryView,
  type ChildTimelineRow,
} from "@powermysport/shared-types";
import { Button } from "@components/ui/Button";
import { childrenApi } from "@/modules/children/services/children";
import { COLORS } from "@lib/constants";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** A parent rarely knows the day, so show only as much of the date as was recorded. */
function formatWhen(row: ChildTimelineRow): string {
  const date = new Date(row.occurredOn);
  if (Number.isNaN(date.getTime())) return "";
  const year = date.getUTCFullYear();
  if (row.datePrecision === "year") return String(year);
  const month = MONTHS[date.getUTCMonth()];
  if (row.datePrecision === "month") return `${month} ${year}`;
  return `${date.getUTCDate()} ${month} ${year}`;
}

function Stat({ label, value }: { label: string; value: number | null }) {
  return (
    <View className="flex-1 items-center py-4">
      <Text className="text-ink text-2xl font-bold">{value ?? "Not set"}</Text>
      <Text className="text-muted mt-0.5 text-xs">{label}</Text>
    </View>
  );
}

export default function ChildDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [view, setView] = useState<ChildHistoryView | null>(null);
  const [failed, setFailed] = useState(false);

  const load = useCallback(async () => {
    setFailed(false);
    try {
      setView(await childrenApi.history(id));
    } catch {
      setFailed(true);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <ScrollView
      className="bg-canvas flex-1"
      contentContainerStyle={{
        paddingTop: insets.top + 12,
        paddingBottom: insets.bottom + 40,
        paddingHorizontal: 20,
      }}
    >
      <TouchableOpacity
        onPress={() => router.back()}
        accessibilityLabel="Go back"
        className="rounded-tile bg-surface mb-6 h-9 w-9 items-center justify-center"
      >
        <ArrowLeft size={18} color={COLORS.ink} />
      </TouchableOpacity>

      {failed ? (
        <View className="items-center py-16">
          <Text className="text-ink mb-1 text-base font-semibold">Could not load this profile</Text>
          <Text className="text-muted mb-4 text-center text-sm">
            Check your connection and try again.
          </Text>
          <Button onPress={load}>Try again</Button>
        </View>
      ) : !view ? (
        <View className="items-center py-16">
          <ActivityIndicator color={COLORS.action} />
        </View>
      ) : (
        <>
          <Text className="text-ink text-3xl font-bold">{view.child.name}</Text>
          <Text className="text-muted mb-6 mt-1 text-sm">
            {[
              view.child.sport,
              view.child.level,
              view.child.sinceYear ? `Since ${view.child.sinceYear}` : null,
            ]
              .filter(Boolean)
              .join(" · ") || "No sport chosen yet"}
          </Text>

          <View className="rounded-tile border-hairline bg-surface mb-6 flex-row border">
            <Stat label="Years in sport" value={view.stats.yearsInSport} />
            <View className="bg-hairline w-px" />
            <Stat label="Tournaments" value={view.stats.tournaments} />
            <View className="bg-hairline w-px" />
            <Stat label="Awards" value={view.stats.awards} />
          </View>

          <Text className="text-ink mb-3 text-lg font-semibold">Sporting record</Text>
          {view.timeline.length === 0 ? (
            <View className="rounded-tile border-hairline bg-surface border p-5">
              <Text className="text-body text-sm leading-relaxed">
                Nothing recorded yet. Tournaments, awards, coaching and fitness tests will appear
                here as they are added.
              </Text>
            </View>
          ) : (
            <View className="rounded-tile border-hairline bg-surface overflow-hidden border">
              {view.timeline.map((row, index) => (
                <View
                  key={row.id}
                  className={`px-4 py-4 ${index > 0 ? "border-hairline border-t" : ""}`}
                >
                  <View className="flex-row items-start justify-between">
                    <Text className="text-ink mr-3 flex-1 text-base font-semibold">
                      {row.title}
                    </Text>
                    <Text className="text-muted text-xs">{formatWhen(row)}</Text>
                  </View>
                  {row.resultLabel ? (
                    <Text className="text-body mt-1 text-sm">{row.resultLabel}</Text>
                  ) : null}
                  {row.detail ? (
                    <Text className="text-body mt-1 text-sm leading-relaxed">{row.detail}</Text>
                  ) : null}
                  <Text className="text-ash mt-2 text-xs">
                    {CHILD_HISTORY_SOURCE_LABELS[row.source]}
                  </Text>
                </View>
              ))}
            </View>
          )}

          <Text className="text-muted mt-4 text-xs leading-relaxed">{CHILD_SHARE_NOTICE}</Text>
        </>
      )}
    </ScrollView>
  );
}
