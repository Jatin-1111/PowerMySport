import React, { useCallback, useState } from "react";
import { View, Text, Alert, ActivityIndicator } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { apiMessage } from "@/modules/planner/services/planner";
import { Body, Panel, SmallButton } from "@/modules/planner/components/ui";
import { rankingsApi, type LinkedRanking } from "../services/rankings";
import { comboLabel, formatPoints, listDate, movementText, ownBracket } from "../utils/text";
import { COLORS } from "@lib/constants";

/**
 * "Federation ranking" on a child's profile. Shown for a child who plays tennis, or who already
 * has a link, since tennis is the only sport with a ranking list for now.
 */
export function RankingCard({
  childId,
  childName,
  sport,
}: {
  childId: string;
  childName: string;
  sport: string | null;
}) {
  const router = useRouter();
  const [claim, setClaim] = useState<LinkedRanking | null | undefined>(undefined);
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setFailed(false);
    try {
      const all = await rankingsApi.linked();
      setClaim(all.find((c) => c.dependentId === childId) ?? null);
    } catch {
      setFailed(true);
    }
  }, [childId]);

  // Re-read on every visit so a ranking linked on the next screen shows at once.
  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  if (claim === null && sport?.toLowerCase() !== "tennis") return null;

  const unlink = () =>
    Alert.alert(
      "Unlink this ranking?",
      `${childName}'s rank will stop showing here. Their season plan is kept.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Unlink",
          style: "destructive",
          onPress: async () => {
            if (!claim) return;
            setBusy(true);
            try {
              await rankingsApi.unlink(claim.id);
              setClaim(null);
            } catch (err) {
              Alert.alert(
                "Could not unlink",
                apiMessage(err, "Could not unlink that ranking. Please try again.")
              );
            } finally {
              setBusy(false);
            }
          },
        },
      ]
    );

  return (
    <View className="mb-6">
      <Text className="text-ink text-lg font-semibold">Federation ranking</Text>
      <Text className="text-muted mb-3 mt-0.5 text-sm">
        Their official standing, updated when a new list is published.
      </Text>
      {failed ? (
        <Panel>
          <Body>We could not load this just now.</Body>
          <View className="mt-3 flex-row">
            <SmallButton label="Try again" onPress={load} />
          </View>
        </Panel>
      ) : claim === undefined ? (
        <View className="items-start py-2">
          <ActivityIndicator color={COLORS.action} />
        </View>
      ) : claim === null ? (
        <Panel>
          <Body>
            If {childName} is on a federation ranking list, link it here to see their rank, weekly
            movement and points without going looking for the list each time.
          </Body>
          <View className="mt-3 flex-row">
            <SmallButton
              label="Link a ranking"
              variant="solid"
              onPress={() =>
                router.push({ pathname: "/planner/link", params: { childId, name: childName } })
              }
            />
          </View>
        </Panel>
      ) : (
        <Panel>
          {claim.standings.length === 0 ? (
            <Body>
              Linked to registration number {claim.regNo}, but they are not on the current list.
              Juniors often drop off between age categories; their standing reappears here as soon
              as they are published again.
            </Body>
          ) : (
            [...claim.standings]
              .sort((a, b) => {
                const home = ownBracket(claim.standings.map((x) => x.subcategory));
                return a.subcategory === home ? -1 : b.subcategory === home ? 1 : 0;
              })
              .map((s, i) => {
                const move = movementText(s.rankDelta, true);
                return (
                  <View
                    key={`${s.category}-${s.subcategory}`}
                    className={i > 0 ? "border-hairline mt-4 border-t pt-4" : ""}
                  >
                    <View className="flex-row items-baseline">
                      <Text className="text-ink text-2xl font-bold">#{s.rank}</Text>
                      <Text className="text-body ml-2 text-base">
                        {comboLabel(s.category, s.subcategory)}
                      </Text>
                    </View>
                    <Text className="text-body mt-1 text-sm">
                      {formatPoints(s.totalPoints)} points, as on {listDate(s.asOnDate)}
                    </Text>
                    {move ? (
                      <Text className="text-muted mt-0.5 text-sm">
                        {move} since the previous list
                      </Text>
                    ) : null}
                  </View>
                );
              })
          )}
          <View className="mt-4 flex-row flex-wrap gap-2">
            <SmallButton
              label="See full ranking history"
              onPress={() =>
                router.push({
                  pathname: "/rankings/player/[regNo]",
                  params: { regNo: claim.regNo },
                })
              }
            />
            <SmallButton label="Unlink" variant="danger" busy={busy} onPress={unlink} />
          </View>
        </Panel>
      )}
    </View>
  );
}
