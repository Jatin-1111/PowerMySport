import React, { useCallback, useEffect, useState } from "react";
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ChevronRight } from "lucide-react-native";
import { Button } from "@components/ui/Button";
import {
  opportunitiesApi,
  windowLine,
  type CycleState,
  type Opportunity,
  type OpportunityList,
  type OpportunityTrack,
} from "@/modules/opportunities/services/opportunities";
import { COLORS } from "@lib/constants";
import { PressableScale, Reveal } from "@lib/motion";

const TRACKS: { value: OpportunityTrack; label: string }[] = [
  { value: "scholarship", label: "Scholarships" },
  { value: "admission", label: "Admissions" },
];

// Text colour per state; the words carry the meaning, the colour only helps scanning.
const STATE_COLOR: Record<CycleState, string> = {
  open: "text-success",
  upcoming: "text-action",
  rolling: "text-body",
  closed: "text-muted",
};

function titleCase(slug: string): string {
  return slug.replace(/-/g, " ").replace(/^\w/, (c) => c.toUpperCase());
}

export default function OpportunitiesScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [track, setTrack] = useState<OpportunityTrack>("scholarship");
  const [list, setList] = useState<OpportunityList | null>(null);
  const [followed, setFollowed] = useState<Set<string>>(new Set());
  const [failed, setFailed] = useState(false);

  const load = useCallback(async () => {
    setFailed(false);
    try {
      setList(await opportunitiesApi.list(track));
    } catch {
      setFailed(true);
    }
  }, [track]);

  useEffect(() => {
    setList(null);
    void load();
  }, [load]);

  // Follow state can change on the detail screen, so re-read it whenever this tab is shown.
  useFocusEffect(
    useCallback(() => {
      opportunitiesApi
        .followedSlugs()
        .then((slugs) => setFollowed(new Set(slugs)))
        .catch(() => undefined);
    }, [])
  );

  return (
    <ScrollView
      className="bg-canvas flex-1"
      contentContainerStyle={{
        paddingTop: insets.top + 24,
        paddingBottom: 100,
        paddingHorizontal: 20,
      }}
    >
      <Text className="text-ink mb-1 text-3xl font-bold">Opportunities</Text>
      <Text className="text-muted mb-5 text-sm">
        Scholarships and admissions for young athletes
      </Text>

      <View className="rounded-button border-hairline bg-surface mb-6 flex-row border p-1">
        {TRACKS.map((t) => (
          <TouchableOpacity
            key={t.value}
            onPress={() => setTrack(t.value)}
            accessibilityRole="tab"
            accessibilityState={{ selected: track === t.value }}
            className={`rounded-button flex-1 items-center py-2.5 ${track === t.value ? "bg-ink" : ""}`}
          >
            <Text
              className={`text-sm font-semibold ${track === t.value ? "text-white" : "text-ink"}`}
            >
              {t.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {failed ? (
        <View className="items-center py-16">
          <Text className="text-ink mb-1 text-base font-semibold">
            Could not load opportunities
          </Text>
          <Text className="text-muted mb-4 text-center text-sm">
            Check your connection and try again.
          </Text>
          <Button onPress={load}>Try again</Button>
        </View>
      ) : !list ? (
        <View className="items-center py-16">
          <ActivityIndicator color={COLORS.action} />
        </View>
      ) : list.items.length === 0 ? (
        <View className="rounded-tile border-hairline bg-surface border p-5">
          <Text className="text-body text-sm leading-relaxed">
            Nothing is published in this list yet. Check back soon.
          </Text>
        </View>
      ) : (
        list.categories
          .map((category) => ({
            category,
            items: list.items.filter((o: Opportunity) => o.category === category),
          }))
          .filter((group) => group.items.length > 0)
          .map((group) => (
            <View key={group.category} className="mb-6">
              <Text className="text-muted mb-2 text-sm font-semibold">
                {titleCase(group.category)}
              </Text>
              <View className="rounded-tile border-hairline bg-surface overflow-hidden border">
                {group.items.map((o, index) => (
                  <Reveal key={o.slug} index={index}>
                    <PressableScale
                      onPress={() =>
                        router.push({
                          pathname: "/opportunities/[slug]",
                          params: { slug: o.slug },
                        })
                      }
                      className={`flex-row items-center px-4 py-4 ${index > 0 ? "border-hairline border-t" : ""}`}
                    >
                      <View className="mr-3 flex-1">
                        <Text className="text-ink text-base font-semibold">{o.title}</Text>
                        {o.owner?.name ? (
                          <Text className="text-muted mt-0.5 text-sm">{o.owner.name}</Text>
                        ) : null}
                        <Text className={`mt-1.5 text-sm font-medium ${STATE_COLOR[o.cycleState]}`}>
                          {windowLine(o, list.today)}
                        </Text>
                        {followed.has(o.slug) ? (
                          <Text className="text-action mt-1 text-xs">Following</Text>
                        ) : null}
                      </View>
                      <ChevronRight size={18} color={COLORS.muted} />
                    </PressableScale>
                  </Reveal>
                ))}
              </View>
            </View>
          ))
      )}
    </ScrollView>
  );
}
