import React, { useCallback, useState } from "react";
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator } from "react-native";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ArrowLeft, Plus } from "lucide-react-native";
import {
  CHILD_HISTORY_SOURCE_LABELS,
  CHILD_SHARE_NOTICE,
  type ChildHistoryView,
} from "@powermysport/shared-types";
import { Button } from "@components/ui/Button";
import { childrenApi } from "@/modules/children/services/children";
import { formatWhen } from "@/modules/children/utils/entries";
import { RankingCard } from "@/modules/rankings/components/RankingCard";
import { COLORS } from "@lib/constants";
import { entryScreen } from "@lib/routes";

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

  // Reload each time the screen is shown, so an entry added or edited on the next screen appears
  // at once.
  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

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

          <RankingCard childId={id} childName={view.child.name} sport={view.child.sport} />

          <View className="mb-3 flex-row items-center justify-between">
            <Text className="text-ink text-lg font-semibold">Sporting record</Text>
            <TouchableOpacity
              onPress={() => router.push(entryScreen({ childId: id }))}
              accessibilityRole="button"
              accessibilityLabel="Add an entry"
              className="rounded-button bg-action min-h-[44px] flex-row items-center px-4"
            >
              <Plus size={16} color="#FFFFFF" />
              <Text className="ml-1.5 text-sm font-semibold text-white">Add</Text>
            </TouchableOpacity>
          </View>
          {view.timeline.length === 0 ? (
            <View className="rounded-tile border-hairline bg-surface border p-5">
              <Text className="text-body text-sm leading-relaxed">
                Nothing recorded yet. Add a tournament result, an award, a fitness test or a school
                result, and it appears here.
              </Text>
            </View>
          ) : (
            <View className="rounded-tile border-hairline bg-surface overflow-hidden border">
              {view.timeline.map((row, index) => {
                const body = (
                  <>
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
                    <View className="mt-2 flex-row items-center justify-between">
                      <Text className="text-ash text-xs">
                        {CHILD_HISTORY_SOURCE_LABELS[row.source]}
                        {row.hasPhoto ? " · Photo attached" : ""}
                      </Text>
                      {row.editable ? (
                        <Text className="text-action text-xs font-semibold">Edit</Text>
                      ) : null}
                    </View>
                  </>
                );
                const wrap = `px-4 py-4 ${index > 0 ? "border-hairline border-t" : ""}`;
                return (
                  <View key={row.id}>
                    {row.editable ? (
                      <TouchableOpacity
                        activeOpacity={0.7}
                        accessibilityRole="button"
                        accessibilityLabel={`Edit ${row.title}`}
                        onPress={() => router.push(entryScreen({ childId: id, entryId: row.id }))}
                        className={wrap}
                      >
                        {body}
                      </TouchableOpacity>
                    ) : (
                      <View className={wrap}>
                        {body}
                        {row.canAddResult && row.editionSlug ? (
                          <TouchableOpacity
                            accessibilityRole="button"
                            onPress={() =>
                              router.push(
                                entryScreen({
                                  childId: id,
                                  editionSlug: row.editionSlug,
                                  title: row.title,
                                })
                              )
                            }
                            className="mt-2 min-h-[44px] justify-center"
                          >
                            <Text className="text-action text-sm font-semibold">Add result</Text>
                          </TouchableOpacity>
                        ) : null}
                      </View>
                    )}
                  </View>
                );
              })}
            </View>
          )}

          <Text className="text-muted mt-4 text-xs leading-relaxed">{CHILD_SHARE_NOTICE}</Text>
        </>
      )}
    </ScrollView>
  );
}
