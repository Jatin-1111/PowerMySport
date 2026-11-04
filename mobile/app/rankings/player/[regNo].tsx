import React, { useCallback, useEffect, useState } from "react";
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ArrowLeft } from "lucide-react-native";
import { entryStatus } from "@powermysport/shared-types";
import { Button } from "@components/ui/Button";
import { Badge, Body, Heading, Panel } from "@/modules/planner/components/ui";
import {
  rankingsApi,
  type PlayerCurrentEntry,
  type PlayerHistoryPoint,
  type PlayerResult,
} from "@/modules/rankings/services/rankings";
import {
  comboLabel,
  displayName,
  formatPoints,
  isJunior,
  listDate,
  movementText,
  ownBracket,
  standingPhrase,
  tierPhrase,
} from "@/modules/rankings/utils/text";
import { ProjectionPanel } from "@/modules/rankings/components/ProjectionPanel";
import { EntryRules } from "@/modules/rankings/components/EntryRules";
import { TrajectoryChart } from "@/modules/rankings/components/TrajectoryChart";
import { COLORS } from "@lib/constants";
import { RANKINGS_HOME } from "@lib/routes";

function Row({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <View className="mt-2 flex-row justify-between">
      <Text className="text-muted text-sm">{label}</Text>
      <Text className="text-ink ml-3 flex-1 text-right text-sm">{value}</Text>
    </View>
  );
}

/** Where the player sits in the field: the left end is the best rank, the right end is the last place. */
function FieldBar({ rank, listSize }: { rank: number; listSize: number }) {
  const pos = Math.min(1, Math.max(0, rank / listSize));
  return (
    <View className="mt-3">
      <View className="rounded-button bg-canvas-deep h-2">
        <View
          style={{ left: `${pos * 100}%`, marginLeft: -6 }}
          className="rounded-button bg-action absolute -top-1 h-4 w-3"
        />
      </View>
      <View className="mt-1 flex-row justify-between">
        <Text className="text-muted text-xs">best</Text>
        <Text className="text-muted text-xs">{listSize}th</Text>
      </View>
    </View>
  );
}

function StandingCard({
  entry,
  tag,
  hasBaseline,
}: {
  entry: PlayerCurrentEntry;
  tag?: string;
  hasBaseline: boolean;
}) {
  const { insight } = entry;
  const label = comboLabel(entry.category, entry.subcategory);
  const phrase = standingPhrase(entry.rank, insight.listSize);
  const move = movementText(entry.rankDelta, hasBaseline);
  const gate = isJunior(entry.subcategory) ? entryStatus(entry.rank, entry.subcategory) : null;
  const better =
    insight.careerHigh && insight.careerHigh.rank < entry.rank ? insight.careerHigh : null;

  return (
    <View className="mb-3">
      <Panel>
        <View className="flex-row items-center justify-between">
          <Text className="text-ink text-sm font-semibold">{label}</Text>
          {tag ? <Badge label={tag} /> : null}
        </View>
        <View className="mt-1 flex-row items-baseline">
          <Text className="text-ink text-3xl font-bold">#{entry.rank}</Text>
          {insight.listSize ? (
            <Text className="text-muted ml-2 text-sm">of {insight.listSize}</Text>
          ) : null}
        </View>
        {move ? <Text className="text-muted text-sm">{move} since the previous list</Text> : null}
        {phrase ? <Text className="text-body mt-1 text-sm">{phrase}</Text> : null}
        {insight.listSize ? <FieldBar rank={entry.rank} listSize={insight.listSize} /> : null}

        <Row label="Points" value={formatPoints(entry.totalPoints)} />
        <Row
          label="Within state"
          value={
            entry.stateRank && insight.stateSize
              ? `#${entry.stateRank} of ${insight.stateSize}`
              : null
          }
        />
        <Row
          label="Best on this list"
          value={better ? `#${better.rank}, ${listDate(better.asOnDate)}` : null}
        />

        {insight.nextTier ? (
          <Text className="text-body mt-3 text-sm leading-relaxed">
            {insight.nextTier.gap} more points to reach the {tierPhrase(insight.nextTier.rank)},
            which takes {insight.nextTier.points} this week.
          </Text>
        ) : null}
        {gate ? (
          <Text className="text-body mt-2 text-sm leading-relaxed">
            {gate.closed.length > 0
              ? `At this rank: ${gate.summary.toLowerCase()}.`
              : "At this rank, every tournament level is open to enter."}
          </Text>
        ) : null}
        <Text className="text-muted mt-2 text-xs">As on {listDate(entry.asOnDate)}</Text>
      </Panel>
    </View>
  );
}

export default function PlayerRankingScreen() {
  const { regNo } = useLocalSearchParams<{ regNo: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [data, setData] = useState<PlayerResult | null>(null);
  const [failed, setFailed] = useState<string | null>(null);

  const load = useCallback(async () => {
    setFailed(null);
    try {
      setData(await rankingsApi.player(regNo));
    } catch (err: any) {
      setFailed(err?.response?.status === 404 ? "not-found" : "error");
    }
  }, [regNo]);

  useEffect(() => {
    void load();
  }, [load]);

  const back = () => (router.canGoBack() ? router.back() : router.replace(RANKINGS_HOME));

  // The player's own age group is the youngest junior list they are on; the server does not mark it.
  const current = data?.current ?? [];
  const home = ownBracket(current.map((c) => c.subcategory));
  const ordered = [...current].sort((a, b) =>
    a.subcategory === home ? -1 : b.subcategory === home ? 1 : 0
  );
  const main = ordered[0];
  const both = ordered.length >= 2;

  const best = (() => {
    // Largest climb on any one list, from the first week we hold to the latest.
    let top: { gain: number; label: string; from: number; to: number } | null = null;
    const lists = new Map<string, PlayerHistoryPoint[]>();
    for (const h of data?.history ?? []) {
      const key = `${h.category}|${h.subcategory}`;
      lists.set(key, [...(lists.get(key) ?? []), h]);
    }
    for (const [key, rows] of lists) {
      const sorted = [...rows].sort((a, b) => a.asOnDate.localeCompare(b.asOnDate));
      if (sorted.length < 2) continue;
      const gain = sorted[0].rank - sorted[sorted.length - 1].rank;
      const [category, subcategory] = key.split("|");
      if (gain > 0 && (!top || gain > top.gain))
        top = {
          gain,
          label: comboLabel(category, subcategory),
          from: sorted[0].rank,
          to: sorted[sorted.length - 1].rank,
        };
    }
    return top;
  })();

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

      {failed ? (
        <View className="items-center py-16">
          <Text className="text-ink mb-4 text-center text-base">
            {failed === "not-found"
              ? "No ranking history is held for this registration number."
              : "We could not load this player just now."}
          </Text>
          {failed === "error" ? <Button onPress={load}>Try again</Button> : null}
        </View>
      ) : !data ? (
        <View className="items-center py-16">
          <ActivityIndicator color={COLORS.action} />
        </View>
      ) : (
        <>
          <Text className="text-ink text-3xl font-bold">{displayName(data.player.fullName)}</Text>
          <View className="mb-5 mt-2 flex-row flex-wrap gap-2">
            {data.player.state ? <Badge label={data.player.state} /> : null}
            {data.player.birthYear ? <Badge label={`Born ${data.player.birthYear}`} /> : null}
            <Badge label={`AITA #${data.player.regNo}`} />
          </View>

          {!main ? (
            <Panel>
              <Body>
                {data.history.length > 0
                  ? "Not on a current list. Players often drop off between age categories; this page updates when a new list includes them."
                  : "No ranking history held for this player."}
              </Body>
            </Panel>
          ) : (
            <>
              <Text className="text-ink mb-1 text-base leading-relaxed">
                Ranked #{main.rank}
                {main.insight.listSize ? ` of ${main.insight.listSize}` : ""} in AITA{" "}
                {comboLabel(main.category, main.subcategory)}
                {standingPhrase(main.rank, main.insight.listSize)
                  ? `, ${(standingPhrase(main.rank, main.insight.listSize) as string).replace(/^ranked /, "")}`
                  : ""}
                .
              </Text>
              {best ? (
                <Text className="text-body mb-4 text-sm">
                  Up {best.gain} places in {best.label} since we started tracking, from #{best.from}{" "}
                  to #{best.to}.
                </Text>
              ) : (
                <View className="mb-4" />
              )}

              <Heading>{both ? "Both lists" : "Current standing"}</Heading>
              {both && home ? (
                <View className="mb-3">
                  <Body muted>
                    {comboLabel(ordered[0].category, ordered[0].subcategory)} is the main list, the
                    age group this player belongs to. Entering an older group as well is normal, and
                    results there earn points on both lists.
                  </Body>
                </View>
              ) : null}
              {ordered.map((entry) => (
                <StandingCard
                  key={`${entry.category}-${entry.subcategory}`}
                  entry={entry}
                  hasBaseline={entry.rankDelta !== undefined && entry.rankDelta !== null}
                  tag={
                    both && home
                      ? entry.subcategory === home
                        ? "Own age group"
                        : "Playing up"
                      : undefined
                  }
                />
              ))}

              <View className="mt-3">
                <Heading>Progress week by week</Heading>
                <View className="mb-3">
                  <Body muted>Every list AITA has published since we started mirroring them.</Body>
                </View>
                <TrajectoryChart
                  history={data.history}
                  orderedLists={ordered.map((c) => `${c.category}|${c.subcategory}`)}
                />
              </View>

              <ProjectionPanel
                projection={main.projection}
                listLabel={comboLabel(main.category, main.subcategory)}
                junior={isJunior(main.subcategory)}
              />
              <EntryRules
                subcategory={main.subcategory}
                listLabel={comboLabel(main.category, main.subcategory)}
              />
            </>
          )}

          <Text className="text-muted mt-2 text-xs leading-relaxed">
            Rankings are published by the All India Tennis Association and mirrored here.
            PowerMySport is not affiliated with AITA.
          </Text>
        </>
      )}
    </ScrollView>
  );
}
