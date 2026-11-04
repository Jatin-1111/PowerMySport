import React, { useMemo, useState } from "react";
import { View, Text, TouchableOpacity } from "react-native";
import type { PlannerEntry } from "@powermysport/shared-types";
import { usePlannerStore } from "../store/plannerStore";
import { deadlineState, entriesClosed, groupByMonth, longDay } from "../utils/format";
import { EventCard } from "./EventCard";
import { useRun } from "./PlanPanel";
import { Body, Collapsible, Panel, SmallButton } from "./ui";

function FilterRow({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (v: string) => void;
}) {
  if (options.length < 2) return null;
  return (
    <View className="mb-3">
      <Text className="text-ink mb-1.5 text-sm font-medium">{label}</Text>
      <View className="flex-row flex-wrap gap-2">
        {["", ...options].map((o) => (
          <TouchableOpacity
            key={o || "any"}
            onPress={() => onChange(o)}
            accessibilityRole="button"
            accessibilityState={{ selected: value === o }}
            className={`rounded-button min-h-[40px] justify-center border px-3 ${
              value === o ? "border-ink bg-ink" : "border-hairline bg-surface"
            }`}
          >
            <Text className={`text-sm font-medium ${value === o ? "text-white" : "text-ink"}`}>
              {o || "Any"}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

const uniqueSorted = (values: Array<string | null | undefined>) =>
  [...new Set(values.filter((v): v is string => Boolean(v)))].sort();

export function FinderPanel() {
  const overview = usePlannerStore((s) => s.overview);
  const addEntry = usePlannerStore((s) => s.addEntry);
  const { busy, run } = useRun();
  const [state, setState] = useState("");
  const [ladder, setLadder] = useState("");

  const shortlist = overview?.shortlist;
  const onPlan = useMemo(
    () => new Set(overview?.plan.entries.map((e) => e.editionSlug) ?? []),
    [overview]
  );

  if (!overview || !shortlist) return null;
  const { standing } = overview;

  const all = [
    ...shortlist.ownGroup,
    ...shortlist.playingUp,
    ...shortlist.unknown,
    ...shortlist.closed,
  ];
  const states = uniqueSorted(all.map((e) => e.edition.state));
  const ladders = uniqueSorted(all.map((e) => e.edition.ladder));

  // An event already on the plan is never filtered out: hiding it would hide a decision.
  const keep = (e: PlannerEntry) =>
    (e.edition.slug && onPlan.has(e.edition.slug)) ||
    ((!state || e.edition.state === state) && (!ladder || e.edition.ladder === ladder));

  const own = shortlist.ownGroup.filter(keep);
  const open = own.filter((e) => !entriesClosed(e.edition.registrationDeadlineDate));
  const shut = own.filter((e) => entriesClosed(e.edition.registrationDeadlineDate));
  const soon = open.filter(
    (e) => deadlineState(e.edition.registrationDeadlineDate).kind === "soon"
  );
  const filtering = Boolean(state || ladder);

  const rankClause = standing?.rank
    ? `ranked ${standing.rank}`
    : `not ranked in ${standing?.subcategory} yet`;
  const card = (entry: PlannerEntry, canAdd: boolean) => {
    const slug = entry.edition.slug;
    const planned = Boolean(slug && onPlan.has(slug));
    return (
      <EventCard
        key={slug ?? entry.edition.name + entry.edition.startDate}
        entry={entry}
        reach={slug ? overview.reach?.[slug] : undefined}
        onPlan={planned}
        actions={
          canAdd && slug && !planned ? (
            <View className="flex-row">
              <SmallButton
                label="Add to plan"
                variant="solid"
                busy={busy === `add-${slug}`}
                onPress={() =>
                  run(`add-${slug}`, () => addEntry(slug), "Could not add this event.")
                }
              />
            </View>
          ) : undefined
        }
      />
    );
  };

  const months = groupByMonth(open, (e) => e.edition.startDate);

  return (
    <View>
      <Body muted>
        Everything {standing?.category} {standing?.subcategory} ({rankClause}) can enter, and what
        is closed to them and why.
      </Body>

      <View className="mt-4">
        <FilterRow label="State" value={state} options={states} onChange={setState} />
        <FilterRow label="Level" value={ladder} options={ladders} onChange={setLadder} />
        {filtering ? (
          <View className="mb-3 flex-row">
            <SmallButton
              label="Clear filters"
              onPress={() => {
                setState("");
                setLadder("");
              }}
            />
          </View>
        ) : null}
      </View>

      {soon.length > 0 ? (
        <Panel tone="warm">
          <Text className="text-ink mb-1 text-sm font-semibold">Entries closing soon</Text>
          {soon.map((e) => (
            <Text key={e.edition.slug ?? e.edition.name} className="text-body text-sm">
              {e.edition.name}: closes {longDay(e.edition.registrationDeadlineDate as string)}
            </Text>
          ))}
        </Panel>
      ) : null}

      <View className="mt-3">
        {months.length === 0 ? (
          <Panel>
            <Body>
              {filtering
                ? "No tournaments match these filters."
                : shut.length > 0
                  ? "Entries have closed for every event in their own age group. New ones appear as the federation announces them."
                  : "Nothing in their own age group is open on the calendar right now. The federation publishes about ten weeks ahead, so this fills in as events are announced."}
            </Body>
          </Panel>
        ) : (
          months.map((group) => (
            <View key={group.key} className="mb-4">
              <Text className="text-ink mb-2 text-base font-semibold">{group.label}</Text>
              <View className="rounded-tile border-hairline bg-surface overflow-hidden border">
                {group.items.map((e) => card(e, true))}
              </View>
            </View>
          ))
        )}
      </View>

      <Collapsible title="Entries already closed" count={shut.length}>
        <View className="-mx-4 -my-4">{shut.map((e) => card(e, false))}</View>
      </Collapsible>
      <Collapsible
        title="Events in an older age group"
        count={shortlist.playingUp.filter(keep).length}
      >
        <View className="-mx-4 -my-4">
          {shortlist.playingUp.filter(keep).map((e) => card(e, false))}
        </View>
      </Collapsible>
      <Collapsible title="Check the fact sheet first" count={shortlist.unknown.filter(keep).length}>
        <View className="-mx-4 -my-4">
          {shortlist.unknown.filter(keep).map((e) => card(e, false))}
        </View>
      </Collapsible>
      <Collapsible title="Events they cannot enter" count={shortlist.closed.filter(keep).length}>
        <View className="-mx-4 -my-4">
          {shortlist.closed.filter(keep).map((e) => card(e, false))}
        </View>
      </Collapsible>

      <Text className="text-muted mt-2 text-xs leading-relaxed">
        Open means not barred by the published entry rules. Above Championship Series a draw is cut
        by ranking, so a place is earned rather than granted. Check each event's fact sheet before
        you travel.
      </Text>
    </View>
  );
}
