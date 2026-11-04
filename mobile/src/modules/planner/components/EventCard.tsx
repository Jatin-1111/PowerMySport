import React from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { useRouter } from "expo-router";
import { ChevronRight } from "lucide-react-native";
import type { PlannerEdition, PlannerEntry, ReachVerdict } from "@powermysport/shared-types";
import { COLORS } from "@lib/constants";
import { dateWindow, deadlineLine, deadlineState, entriesClosed } from "../utils/format";
import { Badge, Body } from "./ui";

/** The short label on a card. "No evidence" says nothing here: it would only be noise. */
export function reachLabel(verdict?: ReachVerdict): string | null {
  switch (verdict?.kind) {
    case "likely":
      return "Past draws took this rank";
    case "qualifying":
      return "Past draws mostly meant the qualifying";
    case "unlikely":
      return "Past draws closed above this rank";
    default:
      return null;
  }
}

export function whereOf(e: PlannerEdition): string {
  return [e.city, e.state].filter(Boolean).join(", ");
}

interface EventCardProps {
  entry: PlannerEntry;
  reach?: ReachVerdict;
  onPlan: boolean;
  /** Rendered under the details, for the add action or whatever the caller offers. */
  actions?: React.ReactNode;
}

/** One event as a parent scans it: what, when, where, the deadline, and why it is open or not. */
export function EventCard({ entry, reach, onPlan, actions }: EventCardProps) {
  const router = useRouter();
  const { edition } = entry;
  const where = whereOf(edition);
  const reachText = reachLabel(reach);
  const closed = entriesClosed(edition.registrationDeadlineDate);
  const state = deadlineState(edition.registrationDeadlineDate);

  return (
    <View className={`border-hairline border-b px-4 py-4 ${closed ? "opacity-70" : ""}`}>
      <TouchableOpacity
        activeOpacity={0.7}
        disabled={!edition.slug}
        onPress={() =>
          edition.slug &&
          router.push({ pathname: "/planner/event/[slug]", params: { slug: edition.slug } })
        }
        accessibilityRole="button"
        accessibilityLabel={`${edition.name}, details`}
        className="flex-row items-start"
      >
        <View className="mr-2 flex-1">
          <Text className="text-ink text-base font-semibold">{edition.name}</Text>
          <Text className="text-body mt-0.5 text-sm">
            {dateWindow(edition.startDate, edition.endDate)}
          </Text>
          {where ? <Text className="text-muted text-sm">{where}</Text> : null}
        </View>
        <ChevronRight size={18} color={COLORS.muted} />
      </TouchableOpacity>

      <View className="mt-2 flex-row flex-wrap gap-2">
        {edition.ladder ? <Badge label={edition.ladder} /> : null}
        {entry.playingUp ? <Badge label="Older age group" /> : null}
        {onPlan ? <Badge label="On the plan" tone="success" /> : null}
        {!closed && state.kind === "soon" ? (
          <Badge label="Entries close soon" tone="action" />
        ) : null}
      </View>

      <Text
        className={`mt-2 text-sm ${state.kind === "soon" ? "text-action font-semibold" : "text-muted"}`}
      >
        {deadlineLine(edition.registrationDeadlineDate, edition.official?.times?.entryCloses)}
      </Text>
      {reachText ? <Text className="text-body mt-1 text-sm">{reachText}</Text> : null}

      {entry.status !== "open" ? (
        <View className="mt-2">
          <Body muted>{entry.reason}</Body>
        </View>
      ) : null}
      {entry.notes.length > 0 ? (
        <View className="mt-2 gap-1">
          {entry.notes.map((note) => (
            <Body key={note} muted>
              {note}
            </Body>
          ))}
        </View>
      ) : null}

      {actions ? <View className="mt-3">{actions}</View> : null}
    </View>
  );
}
