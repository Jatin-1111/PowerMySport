import React from "react";
import { View, Text } from "react-native";
import { Body, Heading, Panel } from "@/modules/planner/components/ui";
import type { RankingProjection } from "../services/rankings";
import { listDate, tierPhrase, weeksPhrase } from "../utils/text";

function detail(m: { points: number; rank: number }): string {
  if (m.points === 0 && m.rank === 0) return "no change";
  const parts: string[] = [];
  if (m.points !== 0) parts.push(`${m.points > 0 ? "up" : "down"} ${Math.abs(m.points)} points`);
  if (m.rank !== 0) parts.push(`${m.rank > 0 ? "up" : "down"} ${Math.abs(m.rank)} places`);
  return parts.join(", ");
}

/**
 * "What happens next on this list". Everything here is worked out from the published lists we hold,
 * so the wording keeps the limits: at-risk is the most it can cost, not a forecast, and there is no
 * projected rank or date. Renders nothing when there is nothing worth saying.
 */
export function ProjectionPanel({
  projection,
  listLabel,
  junior,
}: {
  projection?: RankingProjection | null;
  listLabel: string;
  junior: boolean;
}) {
  if (!projection) return null;
  const { movement, activity, atRisk, toNextTier, window: win } = projection;
  const rows = [
    ["Last 4 weeks", movement.fourWeeks],
    ["Last 12 weeks", movement.twelveWeeks],
    ["Last 12 months", movement.fiftyTwoWeeks],
  ] as const;
  const shown = rows.filter(([, m]) => m);
  if (!movement.fourWeeks && !movement.twelveWeeks && !atRisk && !toNextTier) return null;

  const subject = junior ? "your child" : "this player";

  return (
    <View className="mb-6">
      <Heading>What happens next on the {listLabel} list</Heading>
      <View className="mb-3">
        <Body muted>
          Worked out from every published list we hold for {subject}, not from this week alone.
        </Body>
      </View>
      <Panel>
        {shown.map(([label, m], i) => (
          <View key={label} className={`flex-row justify-between ${i > 0 ? "mt-2" : ""}`}>
            <Text className="text-muted text-sm">{label}</Text>
            <Text className="text-ink ml-3 flex-1 text-right text-sm">{detail(m!)}</Text>
          </View>
        ))}
        {activity.weeksSinceLastRise !== null ? (
          <Text className="text-body mt-3 text-sm leading-relaxed">
            A new result last counted {weeksPhrase(activity.weeksSinceLastRise)} ago
            {activity.improvingWeeks > 0
              ? `. Over the past year the total rose in ${activity.improvingWeeks} week${activity.improvingWeeks === 1 ? "" : "s"}, by ${Math.round(activity.averageRise)} points on average`
              : ""}
            .
          </Text>
        ) : null}
      </Panel>

      {atRisk && atRisk.nextTwelveWeeks > 0 ? (
        <View className="mt-3">
          <Panel tone="warm">
            <Text className="text-ink mb-1 text-base font-semibold">
              Up to {atRisk.nextTwelveWeeks} points could drop off in the next three months
            </Text>
            <Body>
              {atRisk.nextFourWeeks > 0
                ? `Up to ${atRisk.nextFourWeeks} of that within four weeks. `
                : ""}
              Results stop counting a year after they were earned, so points earned last season fall
              away unless newer results replace them. This is the most it can cost, not a forecast:
              each result that drops off is replaced by the next best one, which we cannot see.
              {activity.weeksSinceLastRise !== null && activity.weeksSinceLastRise >= 12
                ? " Nothing new has counted for a while, so this is the number to watch."
                : ""}
            </Body>
          </Panel>
        </View>
      ) : null}

      {toNextTier ? (
        <View className="mt-3">
          <Body>
            The {tierPhrase(toNextTier.rank)} needs {toNextTier.points} points, {toNextTier.gap}{" "}
            more than {subject} has now.{" "}
            {toNextTier.estimatedWeeks !== null
              ? `At the rate they have gained points over the past year, that is ${weeksPhrase(toNextTier.estimatedWeeks)} of the same form.`
              : toNextTier.weeklyRate > 0
                ? "At the rate they have gained points over the past year, that is more than two years away, so it would take a different season rather than more of the same."
                : "The total has not risen in the period we hold, so there is no rate here to work from."}
          </Body>
        </View>
      ) : null}

      <Text className="text-muted mt-3 text-xs leading-relaxed">
        Based on {win.listsHeld} published lists between {listDate(win.from)} and {listDate(win.to)}
        .
        {win.coversFullCycle
          ? ""
          : " That is less than a full 52-week scoring cycle, so results earned before we began mirroring these lists are not visible here."}
      </Text>
    </View>
  );
}
