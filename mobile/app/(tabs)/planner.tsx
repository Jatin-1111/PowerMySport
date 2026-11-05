import React, { useCallback, useEffect, useState } from "react";
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Button } from "@components/ui/Button";
import { useAuthStore } from "@/modules/auth/store/authStore";
import { childrenApi, type Child } from "@/modules/children/services/children";
import { usePlannerStore } from "@/modules/planner/store/plannerStore";
import type { PlannerOverview } from "@/modules/planner/services/planner";
import { longDay } from "@/modules/planner/utils/format";
import { NextUpTile, PlanPanel } from "@/modules/planner/components/PlanPanel";
import { CostTile } from "@/modules/planner/components/CostParts";
import { FinderPanel } from "@/modules/planner/components/FinderPanel";
import { SuggestedPanel } from "@/modules/planner/components/SuggestedPanel";
import { ExpectedLater, PlannerTour } from "@/modules/planner/components/ExpectedAndTour";
import { Body, Panel, Segmented, SmallButton } from "@/modules/planner/components/ui";
import { COLORS } from "@lib/constants";
import { Reveal } from "@lib/motion";

type Tab = "plan" | "suggested" | "find";

const sportOf = (c: Child) => c.chosenSport || c.sportsFocus?.[0] || null;

/** "Boys U-12, ranked 212 on the list of 7 Sep 2026." and the sentence about how events are matched. */
function standingSentence(overview: PlannerOverview): string {
  const s = overview.standing;
  if (!s) return "";
  const head = s.rank
    ? `${s.category} ${s.subcategory}, ranked ${s.rank} on the list of ${longDay(s.asOnDate)}.`
    : `${s.category} ${s.subcategory}, not ranked in ${s.subcategory} yet.`;
  const also = s.alsoRanked.length
    ? ` Also ranked ${s.alsoRanked
        .map((a) => `${a.rank} in ${a.subcategory}`)
        .reduce(
          (acc, part, i, all) =>
            i === 0 ? part : i === all.length - 1 ? `${acc} and ${part}` : `${acc}, ${part}`,
          ""
        )}.`
    : "";
  const tail =
    s.rank && !s.alsoRanked.length
      ? " Tournaments are matched to this ranking."
      : ` Tournaments are matched to ${s.subcategory}.`;
  return head + also + tail;
}

function Board({ child }: { child: Child }) {
  const router = useRouter();
  const open = usePlannerStore((s) => s.open);
  const overview = usePlannerStore((s) => s.overview);
  const overviewState = usePlannerStore((s) => s.overviewState);
  const [tab, setTab] = useState<Tab | null>(null);
  const [replay, setReplay] = useState(false);

  // Reload on every visit so a ranking linked on the next screen shows up at once.
  useFocusEffect(
    useCallback(() => {
      void open(child._id);
    }, [open, child._id])
  );

  const entryCount = overview?.plan.entries.length ?? 0;
  useEffect(() => {
    if (overview && tab === null) setTab(entryCount > 0 ? "plan" : "suggested");
  }, [overview, tab, entryCount]);

  if (overviewState === "loading" || overviewState === "idle") {
    return (
      <View className="items-center py-16">
        <ActivityIndicator color={COLORS.action} />
      </View>
    );
  }
  if (overviewState === "error" || !overview) {
    return (
      <View className="items-center py-16">
        <Text className="text-ink mb-4 text-center text-base">
          We could not load this planner just now.
        </Text>
        <Button onPress={() => void open(child._id)}>Try again</Button>
      </View>
    );
  }

  const sport = sportOf(child);
  const name = overview.dependentName || child.name;

  if (overview.linkState === "not-linked") {
    if (sport && sport.toLowerCase() !== "tennis") {
      return (
        <Panel>
          <Text className="text-ink mb-1 text-lg font-semibold">
            The planner covers tennis for now
          </Text>
          <Body>
            {name} plays {sport}, and we do not yet hold a ranking list or entry rules for it.
          </Body>
        </Panel>
      );
    }
    return (
      <Panel>
        <Text className="text-ink mb-2 text-lg font-semibold">Link {name}'s AITA ranking</Text>
        <Body>
          The planner shows which tournaments {name} can enter, and the entry rules depend on their
          age group and their rank. Linking their ranking gives it both. You confirm it with their
          date of birth, which is checked and not stored.
        </Body>
        <View className="mt-4">
          <Button
            onPress={() =>
              router.push({ pathname: "/planner/link", params: { childId: child._id, name } })
            }
          >
            Link a ranking
          </Button>
        </View>
      </Panel>
    );
  }

  if (overview.linkState === "no-junior-standing") {
    return (
      <Panel>
        <Text className="text-ink mb-1 text-lg font-semibold">
          {name} is not on a junior ranking right now
        </Text>
        <Body>
          Their ranking is linked, but they do not appear on a current Under-12 to Under-18 ranking.
          Juniors often drop off between age categories. The entry rules the planner uses are
          written for those lists, so there is nothing to judge against until they are published
          again.
        </Body>
      </Panel>
    );
  }

  const openCount = (overview.shortlist?.ownGroup ?? []).length;
  const active = tab ?? "suggested";

  return (
    <Reveal>
      <Text className="text-ink mb-1 text-2xl font-bold">{name}'s season</Text>
      <Text className="text-body mb-3 text-sm leading-relaxed">{standingSentence(overview)}</Text>
      <View className="mb-5 flex-row flex-wrap gap-2">
        <SmallButton label="Season setup" onPress={() => router.push("/planner/setup")} />
        <SmallButton label="How this works" onPress={() => setReplay(true)} />
      </View>

      <NextUpTile />

      {entryCount === 0 ? (
        <View className="mb-4">
          <Panel>
            <Text className="text-ink mb-1 text-base font-semibold">
              Pick tournaments for {name}
            </Text>
            <Body>
              {openCount > 0
                ? `${openCount} tournament${openCount === 1 ? " is" : "s are"} open to ${name}. Ask for a suggested season, or look through them all.`
                : "Nothing is open to enter right now. AITA publishes about ten weeks ahead, so this fills in."}
            </Body>
          </Panel>
        </View>
      ) : (
        <CostTile />
      )}

      <View className="mb-4">
        <Segmented
          value={active}
          onChange={setTab}
          options={[
            { value: "plan", label: "Plan" },
            { value: "suggested", label: "Suggested" },
            { value: "find", label: "Find events" },
          ]}
        />
      </View>

      {active === "plan" ? (
        <PlanPanel />
      ) : active === "suggested" ? (
        <SuggestedPanel />
      ) : (
        <FinderPanel />
      )}

      <View className="mt-6">
        <ExpectedLater />
      </View>

      <PlannerTour replay={replay} onClose={() => setReplay(false)} />
    </Reveal>
  );
}

export default function PlannerScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const [children, setChildren] = useState<Child[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);

  const load = useCallback(async () => {
    setFailed(false);
    try {
      const list = await childrenApi.list();
      setChildren(list);
      // Default to the first child who plays tennis, else the first.
      setSelected(
        (current) =>
          current ??
          (list.find((c) => sportOf(c)?.toLowerCase() === "tennis") ?? list[0])?._id ??
          null
      );
    } catch {
      setFailed(true);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  const allowed = user?.role === "Parent" || user?.role === "Player";
  const child = children?.find((c) => c._id === selected) ?? null;

  return (
    <ScrollView
      className="bg-canvas flex-1"
      contentContainerStyle={{
        paddingTop: insets.top + 24,
        paddingBottom: 100,
        paddingHorizontal: 20,
      }}
    >
      <Text className="text-ink mb-1 text-3xl font-bold">Season planner</Text>
      <Text className="text-muted mb-5 text-sm">Tennis only for now</Text>

      {!allowed ? (
        <Panel>
          <Body>
            The planner is built for parents and players planning a child's season. Your account is
            a different kind, so there is nothing to plan here.
          </Body>
        </Panel>
      ) : failed ? (
        <View className="items-center py-16">
          <Text className="text-ink mb-4 text-base">Could not load your children.</Text>
          <Button onPress={load}>Try again</Button>
        </View>
      ) : children === null ? (
        <View className="items-center py-16">
          <ActivityIndicator color={COLORS.action} />
        </View>
      ) : children.length === 0 ? (
        <Panel>
          <Text className="text-ink mb-1 text-lg font-semibold">Add a player first</Text>
          <Body>
            The planner uses a child's age group and ranking, so it needs a player profile.
          </Body>
          <View className="mt-4">
            <Button onPress={() => router.push("/children/add")}>Add a child</Button>
          </View>
        </Panel>
      ) : (
        <>
          {children.length > 1 ? (
            <View className="mb-5 flex-row flex-wrap gap-2">
              {children.map((c) => (
                <TouchableOpacity
                  key={c._id}
                  onPress={() => setSelected(c._id)}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: c._id === selected }}
                  className={`rounded-button min-h-[44px] justify-center border px-4 ${
                    c._id === selected ? "border-ink bg-ink" : "border-hairline bg-surface"
                  }`}
                >
                  <Text
                    className={`text-sm font-semibold ${c._id === selected ? "text-white" : "text-ink"}`}
                  >
                    {c.name}
                  </Text>
                  <Text className={`text-xs ${c._id === selected ? "text-white" : "text-muted"}`}>
                    {sportOf(c) ?? "Sport not chosen"}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          ) : null}
          {child ? <Board key={child._id} child={child} /> : null}
        </>
      )}
    </ScrollView>
  );
}
