import React, { useCallback, useMemo, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from "react-native";
import { useFocusEffect, useRouter, type Href } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Bell, BookOpen, ChevronRight, ListOrdered } from "lucide-react-native";
import { useAuthStore } from "@/modules/auth/store/authStore";
import { childrenApi, ageFromDob, type Child } from "@/modules/children/services/children";
import { notificationsApi } from "@/modules/notifications/services/notifications";
import { opportunitiesApi } from "@/modules/opportunities/services/opportunities";
import { plannerApi } from "@/modules/planner/services/planner";
import { todayUtc } from "@/modules/planner/utils/format";
import { Body, Panel, SmallButton } from "@/modules/planner/components/ui";
import { rankingsApi } from "@/modules/rankings/services/rankings";
import {
  comboLabel,
  formatPoints,
  listDate,
  movementText,
  ownBracket,
} from "@/modules/rankings/utils/text";
import { findStageForAge, pathwaysApi } from "@/modules/roadmap/services/pathways";
import { useAsync } from "@/modules/home/hooks/useAsync";
import {
  URGENT_DAYS,
  opportunityAttention,
  planAttention,
  sortAttention,
  type AttentionItem,
} from "@/modules/home/utils/attention";
import { COLORS } from "@lib/constants";
import { PressableScale, Reveal } from "@lib/motion";
import { RANKINGS_HOME, ROADMAP_HOME } from "@lib/routes";

const sportOf = (c: Child): string => c.chosenSport || c.sportsFocus?.[0] || "";
/** The planner and the ranking lists are tennis only for now; a child with no sport yet is offered them. */
const isTennisChild = (c: Child): boolean => !sportOf(c) || sportOf(c).toLowerCase() === "tennis";

function greeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <Text className="text-ink mb-2 mt-6 text-lg font-semibold">{children}</Text>;
}

function Row({
  title,
  subtitle,
  onPress,
  icon: Icon,
}: {
  title: string;
  subtitle: string;
  onPress: () => void;
  icon: React.ComponentType<{ size: number; color: string }>;
}) {
  return (
    <PressableScale
      onPress={onPress}
      accessibilityRole="button"
      className="border-hairline min-h-[64px] flex-row items-center border-t px-4 py-3"
    >
      <View className="rounded-tile bg-wash mr-3 h-10 w-10 items-center justify-center">
        <Icon size={18} color={COLORS.action} />
      </View>
      <View className="flex-1">
        <Text className="text-ink text-base font-semibold">{title}</Text>
        <Text className="text-muted mt-0.5 text-sm">{subtitle}</Text>
      </View>
      <ChevronRight size={18} color={COLORS.muted} />
    </PressableScale>
  );
}

function AttentionRow({ item, first }: { item: AttentionItem; first: boolean }) {
  const router = useRouter();
  const urgent = item.daysAway <= URGENT_DAYS;
  return (
    <PressableScale
      onPress={() => router.push(item.href)}
      accessibilityRole="button"
      className={`min-h-[64px] flex-row items-center px-4 py-3 ${first ? "" : "border-hairline border-t"}`}
    >
      <View className="mr-3 flex-1">
        <Text className={`text-xs font-semibold ${urgent ? "text-action" : "text-muted"}`}>
          {item.when}
        </Text>
        <Text className="text-ink mt-0.5 text-base font-semibold">{item.title}</Text>
        <Text className="text-body mt-0.5 text-sm">{item.line}</Text>
      </View>
      <ChevronRight size={18} color={COLORS.muted} />
    </PressableScale>
  );
}

export default function HomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const user = useAuthStore((s) => s.user);

  // 0 means "not asked yet". The first focus bumps it, so everything loads once, and every later
  // focus (coming back from linking a ranking, say) and every pull to refresh reloads.
  const [refreshKey, setRefreshKey] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [pickedId, setPickedId] = useState<string | null>(null);
  useFocusEffect(
    useCallback(() => {
      setRefreshKey((k) => k + 1);
    }, [])
  );
  const onRefresh = () => {
    setRefreshing(true);
    setRefreshKey((k) => k + 1);
    setTimeout(() => setRefreshing(false), 900);
  };

  const children = useAsync(() => childrenApi.list(), [], { refreshKey });
  const list = children.data ?? [];
  // Whoever the parent picked; otherwise a child who plays tennis (they have the most to show), then
  // one with no sport chosen yet, then the first.
  const child =
    list.find((c) => c._id === pickedId) ??
    list.find((c) => sportOf(c).toLowerCase() === "tennis") ??
    list.find(isTennisChild) ??
    list[0] ??
    null;
  const tennis = child ? isTennisChild(child) : false;

  const unread = useAsync(() => notificationsApi.unreadCount(), [], { refreshKey });
  const plan = useAsync(() => plannerApi.overview(child!._id), [child?._id], {
    enabled: Boolean(child) && tennis,
    refreshKey,
  });
  const ranking = useAsync(() => rankingsApi.linked(), [], {
    enabled: Boolean(child) && tennis,
    refreshKey,
  });
  const follows = useAsync(
    async () => {
      const slugs = await opportunitiesApi.followedSlugs();
      // Nothing followed means nothing to look up.
      if (slugs.length === 0) return { slugs: new Set<string>(), lists: [] };
      const lists = await Promise.all([
        opportunitiesApi.list("scholarship"),
        opportunitiesApi.list("admission"),
      ]);
      return { slugs: new Set(slugs), lists };
    },
    [],
    { refreshKey }
  );
  const guides = useAsync(() => pathwaysApi.guides(), [], { enabled: Boolean(child), refreshKey });

  const attention = useMemo(() => {
    const items: AttentionItem[] = [];
    if (plan.data) items.push(...planAttention(plan.data, todayUtc()));
    if (follows.data) {
      for (const l of follows.data.lists)
        items.push(...opportunityAttention(l.items, follows.data.slugs, l.today));
    }
    return sortAttention(items).slice(0, 4);
  }, [plan.data, follows.data]);

  const firstName = user?.name?.split(" ")[0];
  const age = child ? (child.age ?? ageFromDob(child.dob)) : null;

  // The standings of the linked ranking for this child, own age group first.
  const claim = child ? ranking.data?.find((c) => c.dependentId === child._id) : undefined;
  const home = claim ? ownBracket(claim.standings.map((s) => s.subcategory)) : null;
  const standing = claim
    ? [...claim.standings].sort((a, b) =>
        a.subcategory === home ? -1 : b.subcategory === home ? 1 : 0
      )[0]
    : undefined;

  const sport = child ? sportOf(child) : "";
  const guide = guides.data?.find((g) => g.sportSlug === sport.toLowerCase().replace(/\s+/g, "-"));
  const stage = guide && age !== null ? findStageForAge(guide.stages, age) : null;
  const stageNumber = guide && stage ? guide.stages.findIndex((s) => s.key === stage.key) + 1 : 0;

  const attentionLoading =
    follows.status === "loading" || (tennis && child && plan.status === "loading");
  const attentionFailed =
    attention.length === 0 && follows.status === "error" && (!tennis || plan.status === "error");

  return (
    <ScrollView
      className="bg-canvas flex-1"
      contentContainerStyle={{
        paddingTop: insets.top + 24,
        paddingBottom: 100,
        paddingHorizontal: 20,
      }}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[COLORS.action]} />
      }
    >
      <View className="flex-row items-start justify-between">
        <View className="mr-3 flex-1">
          <Text className="text-muted text-sm">
            {greeting()}
            {firstName ? `, ${firstName}` : ""}
          </Text>
          <Text className="text-ink mt-1 text-3xl font-bold">PowerMySport</Text>
        </View>
        <PressableScale
          onPress={() => router.push("/notifications")}
          accessibilityRole="button"
          accessibilityLabel={
            unread.data ? `Notifications, ${unread.data} unread` : "Notifications"
          }
          className="rounded-tile border-hairline bg-surface h-11 w-11 items-center justify-center border"
        >
          <Bell size={20} color={COLORS.ink} />
          {unread.data ? (
            <View className="bg-action absolute -right-1 -top-1 min-w-[18px] items-center rounded-full px-1">
              <Text className="text-xs font-semibold text-white">
                {unread.data > 9 ? "9+" : unread.data}
              </Text>
            </View>
          ) : null}
        </PressableScale>
      </View>

      {children.status === "error" && !children.data ? (
        <View className="mt-6">
          <Panel>
            <Body>We could not load your account just now. Pull down to try again.</Body>
          </Panel>
        </View>
      ) : children.status === "idle" || (children.status === "loading" && !children.data) ? (
        <View className="items-center py-16">
          <ActivityIndicator color={COLORS.action} />
        </View>
      ) : !child ? (
        <View className="mt-6">
          <Panel>
            <Text className="text-ink mb-1 text-lg font-semibold">Add your first child</Text>
            <Body>
              A profile lets us show where they stand, what is coming up and which deadlines matter.
              It takes a minute.
            </Body>
            <View className="mt-4 flex-row">
              <SmallButton
                label="Add a child"
                variant="solid"
                onPress={() => router.push("/children/add")}
              />
            </View>
          </Panel>
        </View>
      ) : (
        <Reveal key={child._id}>
          {list.length > 1 ? (
            <View className="mt-5 flex-row flex-wrap gap-2">
              {list.map((c) => (
                <TouchableOpacity
                  key={c._id}
                  onPress={() => setPickedId(c._id)}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: c._id === child._id }}
                  className={`rounded-button min-h-[44px] justify-center border px-4 ${
                    c._id === child._id ? "border-ink bg-ink" : "border-hairline bg-surface"
                  }`}
                >
                  <Text
                    className={`text-sm font-semibold ${c._id === child._id ? "text-white" : "text-ink"}`}
                  >
                    {c.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          ) : null}

          <SectionTitle>Coming up</SectionTitle>
          {attention.length > 0 ? (
            <View className="border-hairline bg-surface rounded-tile overflow-hidden border">
              {attention.map((item, i) => (
                <AttentionRow key={item.id} item={item} first={i === 0} />
              ))}
            </View>
          ) : attentionLoading ? (
            <View className="items-start py-2">
              <ActivityIndicator color={COLORS.action} />
            </View>
          ) : attentionFailed ? (
            <Panel>
              <Body>We could not load this just now. Pull down to try again.</Body>
            </Panel>
          ) : (
            <Panel>
              <Text className="text-ink mb-1 text-base font-semibold">
                Nothing needs you right now
              </Text>
              <Body>
                {follows.data && follows.data.slugs.size === 0
                  ? "Follow a scholarship or admission and it appears here when its window is about to open or close."
                  : "Deadlines from your season plan and the entries you follow show up here as they get close."}
              </Body>
              <View className="mt-3 flex-row gap-2">
                <SmallButton
                  label="Browse opportunities"
                  onPress={() => router.push("/opportunities")}
                />
                {tennis ? (
                  <SmallButton label="Open the planner" onPress={() => router.push("/planner")} />
                ) : null}
              </View>
            </Panel>
          )}

          <SectionTitle>{child.name}</SectionTitle>
          <Panel>
            <TouchableOpacity
              onPress={() => router.push({ pathname: "/children/[id]", params: { id: child._id } })}
              accessibilityRole="button"
              activeOpacity={0.7}
              className="min-h-[44px] flex-row items-center justify-between"
            >
              <Text className="text-body text-sm">
                {[age !== null ? `${age} years` : null, sport || "No sport chosen yet"]
                  .filter(Boolean)
                  .join(", ")}
              </Text>
              <Text className="text-action text-sm font-semibold">Profile</Text>
            </TouchableOpacity>

            {tennis ? (
              <View className="border-hairline mt-2 border-t pt-3">
                {ranking.status === "loading" && !ranking.data ? (
                  <ActivityIndicator color={COLORS.action} />
                ) : claim && standing ? (
                  <TouchableOpacity
                    onPress={() =>
                      router.push({
                        pathname: "/rankings/player/[regNo]",
                        params: { regNo: claim.regNo },
                      })
                    }
                    accessibilityRole="button"
                    activeOpacity={0.7}
                  >
                    <View className="flex-row items-baseline">
                      <Text className="text-ink text-2xl font-bold">#{standing.rank}</Text>
                      <Text className="text-body ml-2 text-base">
                        {comboLabel(standing.category, standing.subcategory)}
                      </Text>
                    </View>
                    <Text className="text-body mt-1 text-sm">
                      {formatPoints(standing.totalPoints)} points, as on{" "}
                      {listDate(standing.asOnDate)}
                    </Text>
                    {movementText(standing.rankDelta, true) ? (
                      <Text className="text-muted mt-0.5 text-sm">
                        {movementText(standing.rankDelta, true)} since the previous list
                      </Text>
                    ) : null}
                  </TouchableOpacity>
                ) : claim ? (
                  <Body>
                    Linked, but not on the current list. Juniors often drop off between age groups.
                  </Body>
                ) : ranking.status === "error" ? (
                  <Body muted>The ranking could not be loaded just now.</Body>
                ) : (
                  <>
                    <Body>
                      Link {child.name}'s AITA ranking to see their rank and movement here, and to
                      unlock the season planner.
                    </Body>
                    <View className="mt-3 flex-row">
                      <SmallButton
                        label="Link a ranking"
                        variant="solid"
                        onPress={() =>
                          router.push({
                            pathname: "/planner/link",
                            params: { childId: child._id, name: child.name },
                          })
                        }
                      />
                    </View>
                  </>
                )}
              </View>
            ) : null}
          </Panel>

          {guide && stage ? (
            <>
              <SectionTitle>Where {child.name} is on the roadmap</SectionTitle>
              <TouchableOpacity
                onPress={() =>
                  router.push({
                    pathname: "/roadmap/[sport]",
                    params: {
                      sport: guide.sportSlug,
                      stage: stage.key,
                      ...(age !== null ? { age: String(age) } : {}),
                    },
                  })
                }
                accessibilityRole="button"
                activeOpacity={0.7}
              >
                <Panel>
                  <Text className="text-muted text-xs font-semibold">
                    {guide.sportName}, stage {stageNumber} of {guide.stages.length}
                  </Text>
                  <Text className="text-ink mt-1 text-base font-semibold">{stage.name}</Text>
                  <Text className="text-body mt-1 text-sm">{stage.coreQuestion}</Text>
                  <Text className="text-action mt-3 text-sm font-semibold">Read this stage</Text>
                </Panel>
              </TouchableOpacity>
            </>
          ) : null}
        </Reveal>
      )}

      <SectionTitle>Explore</SectionTitle>
      <View className="border-hairline bg-surface rounded-tile overflow-hidden border">
        <PressableScale
          onPress={() => router.push(ROADMAP_HOME as Href)}
          accessibilityRole="button"
          className="min-h-[64px] flex-row items-center px-4 py-3"
        >
          <View className="rounded-tile bg-wash mr-3 h-10 w-10 items-center justify-center">
            <BookOpen size={18} color={COLORS.action} />
          </View>
          <View className="flex-1">
            <Text className="text-ink text-base font-semibold">Roadmap</Text>
            <Text className="text-muted mt-0.5 text-sm">The path in a sport, stage by stage</Text>
          </View>
          <ChevronRight size={18} color={COLORS.muted} />
        </PressableScale>
        <Row
          icon={ListOrdered}
          title="Rankings"
          subtitle="Official AITA tennis lists, searchable"
          onPress={() => router.push(RANKINGS_HOME as Href)}
        />
      </View>
    </ScrollView>
  );
}
