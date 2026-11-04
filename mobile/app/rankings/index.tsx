import React, { useCallback, useEffect, useState } from "react";
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ArrowLeft, ChevronRight } from "lucide-react-native";
import { Button } from "@components/ui/Button";
import { rankingsApi, type RankingMeta } from "@/modules/rankings/services/rankings";
import { comboLabel, listDate } from "@/modules/rankings/utils/text";
import { Body } from "@/modules/planner/components/ui";
import { COLORS } from "@lib/constants";

const GROUPS: Array<{ category: string; title: string; blurb: string }> = [
  { category: "Boys", title: "Boys", blurb: "Junior age brackets, by birth year." },
  { category: "Girls", title: "Girls", blurb: "Junior age brackets, by birth year." },
  { category: "Men", title: "Men", blurb: "Open age, singles and doubles." },
  { category: "Women", title: "Women", blurb: "Open age, singles and doubles." },
];

export default function RankingsHubScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [meta, setMeta] = useState<RankingMeta | null>(null);
  const [failed, setFailed] = useState(false);

  const load = useCallback(async () => {
    setFailed(false);
    try {
      setMeta(await rankingsApi.meta());
    } catch {
      setFailed(true);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const back = () => (router.canGoBack() ? router.back() : router.replace("/"));

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
        onPress={back}
        accessibilityLabel="Go back"
        className="rounded-tile bg-surface mb-6 h-9 w-9 items-center justify-center"
      >
        <ArrowLeft size={18} color={COLORS.ink} />
      </TouchableOpacity>

      <Text className="text-ink mb-2 text-3xl font-bold">AITA Tennis rankings</Text>
      <View className="mb-6">
        <Body>
          The official All India Tennis Association lists, made searchable. Filter by state, look up
          a player by name or registration number, and see how a ranking has moved week by week,
          something the source PDFs cannot show you.
        </Body>
      </View>

      {failed ? (
        <View className="items-center py-12">
          <Text className="text-ink mb-4 text-center text-base">
            We could not load the lists just now.
          </Text>
          <Button onPress={load}>Try again</Button>
        </View>
      ) : !meta ? (
        <View className="items-center py-12">
          <ActivityIndicator color={COLORS.action} />
        </View>
      ) : (
        GROUPS.map((group) => {
          const combos = meta.combos.filter((c) => c.category === group.category);
          if (combos.length === 0) return null;
          return (
            <View key={group.category} className="mb-6">
              <Text className="text-ink text-lg font-semibold">{group.title}</Text>
              <Text className="text-muted mb-2 text-sm">{group.blurb}</Text>
              <View className="rounded-tile border-hairline bg-surface overflow-hidden border">
                {combos.map((c, i) => (
                  <TouchableOpacity
                    key={c.subcategory}
                    disabled={!c.available}
                    activeOpacity={0.7}
                    onPress={() =>
                      router.push({
                        pathname: "/rankings/list/[category]/[subcategory]",
                        params: { category: c.category, subcategory: c.subcategory },
                      })
                    }
                    className={`min-h-[56px] flex-row items-center px-4 py-3 ${i > 0 ? "border-hairline border-t" : ""} ${c.available ? "" : "opacity-50"}`}
                  >
                    <View className="flex-1">
                      <Text className="text-ink text-base font-semibold">
                        {comboLabel(c.category, c.subcategory)}
                      </Text>
                      <Text className="text-muted text-sm">
                        {c.available
                          ? `As on ${listDate(c.asOnDate)}, ${c.rowCount} players`
                          : "Not published yet"}
                      </Text>
                    </View>
                    {c.available ? <ChevronRight size={18} color={COLORS.muted} /> : null}
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          );
        })
      )}

      <Text className="text-muted mt-2 text-xs leading-relaxed">
        Rankings are published by the All India Tennis Association and mirrored here. PowerMySport
        is not affiliated with AITA.
      </Text>
    </ScrollView>
  );
}
