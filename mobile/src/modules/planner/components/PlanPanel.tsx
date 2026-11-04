import React, { useState } from "react";
import { View, Text, TouchableOpacity, Alert, Linking } from "react-native";
import { useRouter } from "expo-router";
import { ChevronRight } from "lucide-react-native";
import type { PlannerEdition } from "@powermysport/shared-types";
import { COLORS } from "@lib/constants";
import { apiMessage, type SeasonPlanEntry } from "../services/planner";
import { usePlannerStore, calendarOf } from "../store/plannerStore";
import {
  NEXT_STATUS,
  NEXT_STATUS_LABEL,
  STATUS_LABEL,
  dateWindow,
  entriesClosed,
  longDay,
  nextUp,
  nextUpWhen,
  todayUtc,
  warningsFor,
  type NextUpItem,
} from "../utils/format";
import { whereOf } from "./EventCard";
import { Badge, Body, Panel, SmallButton } from "./ui";
import { CostLine } from "./CostParts";

/** Runs a plan change with one busy key, and tells the parent plainly when it fails. */
export function useRun() {
  const [busy, setBusy] = useState<string | null>(null);
  const run = async (key: string, fn: () => Promise<void>, failure: string) => {
    setBusy(key);
    try {
      await fn();
    } catch (err) {
      Alert.alert("Could not update", apiMessage(err, failure));
    } finally {
      setBusy(null);
    }
  };
  return { busy, run };
}

// ─── Do this next ───────────────────────────────────────────────────────────────

function headlineOf(item: NextUpItem): string {
  const time = item.time ? `, ${item.time}` : "";
  if (item.kind === "enter-by") return `Entries close ${longDay(item.date)}${time}`;
  if (item.kind === "withdraw-by") return `Last day to withdraw ${longDay(item.date)}${time}`;
  if (item.entryClosed) return "Entries have closed for this event";
  return item.underWay ? "Under way now" : `Starts ${longDay(item.date)}`;
}

export function NextUpTile() {
  const overview = usePlannerStore((s) => s.overview);
  const setStatus = usePlannerStore((s) => s.setStatus);
  const removeEntry = usePlannerStore((s) => s.removeEntry);
  const { busy, run } = useRun();
  if (!overview) return null;

  const items = nextUp({
    entries: overview.plan.entries,
    calendar: calendarOf(overview),
    today: todayUtc(),
  });
  if (items.length === 0) return null;

  return (
    <View className="mb-4">
      <Text className="text-ink mb-2 text-lg font-semibold">Do this next</Text>
      <View className="gap-3">
        {items.map((item) => (
          <Panel key={`${item.kind}-${item.slug}`} tone={item.entryClosed ? "warm" : "plain"}>
            <Text className="text-muted text-xs font-semibold">{nextUpWhen(item)}</Text>
            <Text className="text-ink mt-1 text-base font-semibold">{item.name}</Text>
            <Text className="text-body mt-0.5 text-sm">{headlineOf(item)}</Text>
            {item.kind === "withdraw-by" ? (
              <Text className="text-muted mt-1 text-sm">
                After that, withdrawing counts as a late withdrawal.
              </Text>
            ) : null}
            {item.entryClosed ? (
              <View className="mt-3 gap-2">
                <Body>Did you enter in time?</Body>
                <SmallButton
                  label="Yes, mark it entered"
                  variant="solid"
                  busy={busy === `enter-${item.slug}`}
                  onPress={() =>
                    run(
                      `enter-${item.slug}`,
                      () => setStatus(item.slug, "entered"),
                      "Please try again."
                    )
                  }
                />
                <SmallButton
                  label="No, take it off the plan"
                  busy={busy === `drop-${item.slug}`}
                  onPress={() =>
                    run(`drop-${item.slug}`, () => removeEntry(item.slug), "Please try again.")
                  }
                />
              </View>
            ) : null}
            {item.pageUrl && item.kind !== "event" ? (
              <View className="mt-3">
                <SmallButton
                  label={item.kind === "enter-by" ? "Enter on AITA" : "Open on AITA"}
                  onPress={() => void Linking.openURL(item.pageUrl as string)}
                />
              </View>
            ) : null}
          </Panel>
        ))}
      </View>
    </View>
  );
}

// ─── The plan itself ────────────────────────────────────────────────────────────

function PlanRow({
  entry,
  live,
  warning,
}: {
  entry: SeasonPlanEntry;
  live?: PlannerEdition;
  warning?: string;
}) {
  const router = useRouter();
  const setStatus = usePlannerStore((s) => s.setStatus);
  const removeEntry = usePlannerStore((s) => s.removeEntry);
  const { busy, run } = useRun();

  const next = NEXT_STATUS[entry.status];
  const closedNotice =
    entry.status === "shortlisted" && live && entriesClosed(live.registrationDeadlineDate)
      ? `Entries closed on ${longDay(live.registrationDeadlineDate as string)}. If you entered in time, mark it entered. If not, you can no longer enter, so take it off the plan.`
      : null;

  const confirmRemove = () =>
    Alert.alert("Remove from the plan?", entry.name, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: () =>
          void run(
            `rm-${entry.editionSlug}`,
            () => removeEntry(entry.editionSlug),
            "Please try again."
          ),
      },
    ]);

  return (
    <View className="border-hairline border-b px-4 py-4">
      <TouchableOpacity
        activeOpacity={0.7}
        onPress={() =>
          router.push({ pathname: "/planner/event/[slug]", params: { slug: entry.editionSlug } })
        }
        accessibilityRole="button"
        accessibilityLabel={`${entry.name}, details`}
        className="flex-row items-start"
      >
        <View className="mr-2 flex-1">
          <Text className="text-ink text-base font-semibold">{entry.name}</Text>
          <Text className="text-body mt-0.5 text-sm">
            {dateWindow(entry.startDate, live?.endDate)}
          </Text>
          {live && whereOf(live) ? (
            <Text className="text-muted text-sm">{whereOf(live)}</Text>
          ) : null}
        </View>
        <ChevronRight size={18} color={COLORS.muted} />
      </TouchableOpacity>

      <View className="mt-2 flex-row">
        <Badge
          label={STATUS_LABEL[entry.status]}
          tone={entry.status === "shortlisted" ? "neutral" : "success"}
        />
      </View>
      {entry.note ? <Text className="text-body mt-2 text-sm">{entry.note}</Text> : null}
      {warning ? <Text className="text-action mt-2 text-sm font-medium">{warning}</Text> : null}
      {closedNotice ? <Text className="text-body mt-2 text-sm">{closedNotice}</Text> : null}
      {entry.status === "shortlisted" && !closedNotice && !warning ? (
        <Text className="text-muted mt-2 text-sm">
          Entries are made on AITA. Mark it entered here once you have.
        </Text>
      ) : null}

      <CostLine slug={entry.editionSlug} entry={entry} />

      <View className="mt-3 flex-row flex-wrap gap-2">
        {next ? (
          <SmallButton
            label={NEXT_STATUS_LABEL[entry.status]}
            variant="solid"
            busy={busy === `st-${entry.editionSlug}`}
            onPress={() =>
              run(
                `st-${entry.editionSlug}`,
                () => setStatus(entry.editionSlug, next),
                "Please try again."
              )
            }
          />
        ) : null}
        <SmallButton
          label="Remove"
          variant="danger"
          busy={busy === `rm-${entry.editionSlug}`}
          onPress={confirmRemove}
        />
      </View>
    </View>
  );
}

export function PlanPanel() {
  const overview = usePlannerStore((s) => s.overview);
  if (!overview) return null;

  const { entries } = overview.plan;
  const calendar = calendarOf(overview);
  const warnings = warningsFor(entries, calendar);
  const year = new Date().getUTCFullYear();
  const thisYear = entries.filter((e) => new Date(e.startDate).getUTCFullYear() === year).length;
  const cap = overview.annualEntryCap;
  const group = overview.standing?.subcategory;
  const plural = (n: number) => (n === 1 ? "is" : "are");

  if (entries.length === 0) {
    return (
      <Panel>
        <Body>
          Nothing planned yet. Add events from the suggestions or the calendar and they appear here,
          in the order they happen.
        </Body>
      </Panel>
    );
  }

  return (
    <View>
      <View className="mb-3">
        <Body muted>
          {cap
            ? `AITA lets a player in ${group} play up to ${cap} events a year. ${thisYear} ${plural(thisYear)} on this plan. Events in an older age group count towards this too.`
            : `${thisYear} event${thisYear === 1 ? "" : "s"} on this plan for ${year}.`}
        </Body>
      </View>
      <View className="rounded-tile border-hairline bg-surface overflow-hidden border">
        {entries.map((entry) => (
          <PlanRow
            key={entry.editionSlug}
            entry={entry}
            live={calendar.get(entry.editionSlug)}
            warning={warnings.get(entry.editionSlug)}
          />
        ))}
      </View>
    </View>
  );
}
