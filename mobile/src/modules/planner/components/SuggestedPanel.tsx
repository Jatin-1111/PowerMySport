import React, { useState } from "react";
import { View, Text, Alert } from "react-native";
import type { PlannerEntry } from "@powermysport/shared-types";
import { apiMessage, type Recommendations, type RecommendationItem } from "../services/planner";
import { entriesBySlug, usePlannerStore } from "../store/plannerStore";
import { dateWindow, deadlineState, entriesClosed, longDay } from "../utils/format";
import { CostLine } from "./CostParts";
import { EventCard, reachLabel, whereOf } from "./EventCard";
import { useRun } from "./PlanPanel";
import { Badge, Body, Heading, Panel, SmallButton } from "./ui";

const FALLBACK_TEXT = (cap: number) => ({
  "daily-limit": `You have used today's ${cap} fresh suggestions, so these come from the planner's own rules. Fresh suggestions return tomorrow.`,
  "ai-unavailable":
    "The AI model could not be reached just now, so these come from the planner's own rules. Try again in a few minutes.",
  "invalid-output":
    "The AI model's answer did not pass our checks, so these come from the planner's own rules.",
});

const TIERS: Array<{ tier: RecommendationItem["tier"]; title: string; sub?: string }> = [
  { tier: "recommended", title: "Suggested" },
  { tier: "consider", title: "Worth considering" },
  {
    tier: "reach",
    title: "A stretch",
    sub: "Past draws of these closed above this rank. They are here so you know about them, not as picks.",
  },
];

function Suggestion({ item, entry }: { item: RecommendationItem; entry: PlannerEntry }) {
  const overview = usePlannerStore((s) => s.overview);
  const addEntry = usePlannerStore((s) => s.addEntry);
  const dismiss = usePlannerStore((s) => s.dismiss);
  const { busy, run } = useRun();
  const { edition } = entry;
  const planned = overview?.plan.entries.some((e) => e.editionSlug === item.slug) ?? false;
  const closed = entriesClosed(edition.registrationDeadlineDate);
  const reach = reachLabel(overview?.reach?.[item.slug]);
  const state = deadlineState(edition.registrationDeadlineDate);

  return (
    <View className="rounded-tile border-hairline bg-surface mb-3 border p-4">
      <Text className="text-ink text-base font-semibold">{edition.name}</Text>
      <Text className="text-body mt-0.5 text-sm">
        {dateWindow(edition.startDate, edition.endDate)}
      </Text>
      {whereOf(edition) ? <Text className="text-muted text-sm">{whereOf(edition)}</Text> : null}
      <Text className="text-body mt-2 text-sm leading-relaxed">{item.reason}</Text>
      {reach && item.tier !== "reach" ? (
        <Text className="text-body mt-1 text-sm">{reach}</Text>
      ) : null}
      {state.kind !== "unpublished" && !closed ? (
        <View className="mt-2 flex-row flex-wrap items-center gap-2">
          <Text className="text-muted text-sm">Entries close {longDay(state.date)}</Text>
          {item.urgent ? <Badge label="Closes soon" tone="action" /> : null}
        </View>
      ) : null}
      <CostLine slug={item.slug} />
      <View className="mt-3 flex-row flex-wrap gap-2">
        {planned ? (
          <Badge label="On the plan" tone="success" />
        ) : (
          <>
            {!closed ? (
              <SmallButton
                label="Add to plan"
                variant="solid"
                busy={busy === `add-${item.slug}`}
                onPress={() =>
                  run(`add-${item.slug}`, () => addEntry(item.slug), "Could not add this event.")
                }
              />
            ) : null}
            <SmallButton
              label="Not for us"
              busy={busy === `no-${item.slug}`}
              onPress={() =>
                run(`no-${item.slug}`, () => dismiss(item.slug), "Could not save that.")
              }
            />
          </>
        )}
      </View>
    </View>
  );
}

function Saved({ recs, usage }: { recs: Recommendations; usage: { used: number; cap: number } }) {
  const overview = usePlannerStore((s) => s.overview);
  const suggest = usePlannerStore((s) => s.suggest);
  const [busy, setBusy] = useState<"update" | "again" | null>(null);
  const bySlug = entriesBySlug(overview);

  const ask = async (force: boolean, which: "update" | "again") => {
    setBusy(which);
    try {
      await suggest(force);
    } catch (err) {
      Alert.alert(
        "Could not make suggestions",
        apiMessage(err, "Could not make suggestions just now.")
      );
    } finally {
      setBusy(null);
    }
  };

  // A suggestion can name an event that has left the calendar; drop it rather than draw half a card.
  const items = recs.items.filter((i) => bySlug.has(i.slug));
  const made = new Date(recs.generatedAt);

  return (
    <View>
      {recs.stale ? (
        <Panel tone="warm">
          <Body>Their plan, ranking list or preferences have changed since these were made.</Body>
          <View className="mt-3 flex-row">
            <SmallButton
              label="Update suggestions"
              busy={busy === "update"}
              onPress={() => ask(false, "update")}
            />
          </View>
        </Panel>
      ) : null}
      {recs.unchanged ? (
        <View className="mb-3">
          <Body muted>
            Nothing has changed since these were made, so they are the same, and no fresh suggestion
            was used. Change your setup or your plan and ask again.
          </Body>
        </View>
      ) : null}
      {recs.fallbackReason ? (
        <View className="mb-3">
          <Body muted>{FALLBACK_TEXT(usage.cap)[recs.fallbackReason]}</Body>
        </View>
      ) : null}

      {recs.summary ? (
        <Text className="text-ink mb-4 mt-1 text-base leading-relaxed">{recs.summary}</Text>
      ) : null}

      {items.length === 0 ? (
        <Panel>
          <Body>No open event fits right now.</Body>
        </Panel>
      ) : (
        TIERS.map(({ tier, title, sub }) => {
          const group = items.filter((i) => i.tier === tier);
          if (group.length === 0) return null;
          return (
            <View key={tier} className="mb-2">
              <Heading>{title}</Heading>
              {sub ? (
                <View className="-mt-1 mb-2">
                  <Body muted>{sub}</Body>
                </View>
              ) : null}
              {group.map((item) => (
                <Suggestion
                  key={item.slug}
                  item={item}
                  entry={bySlug.get(item.slug) as PlannerEntry}
                />
              ))}
            </View>
          );
        })
      )}

      {recs.notes.length > 0 ? (
        <View className="mb-3 gap-1">
          {recs.notes.map((note) => (
            <Body key={note} muted>
              {note}
            </Body>
          ))}
        </View>
      ) : null}

      <Text className="text-muted mb-3 text-xs leading-relaxed">
        {recs.source === "ai"
          ? "The events were chosen by the planner's rules from what this child can enter. An AI model wrote the explanations, and each was checked against the data."
          : "Chosen by the planner's own rules from the events this child can enter."}{" "}
        Made {longDay(made.toISOString())}. {usage.used} of {usage.cap} fresh suggestions used
        today.
      </Text>
      <View className="flex-row">
        <SmallButton
          label="Suggest again"
          busy={busy === "again"}
          disabled={usage.used >= usage.cap}
          onPress={() => ask(true, "again")}
        />
      </View>
    </View>
  );
}

function Dismissed() {
  const overview = usePlannerStore((s) => s.overview);
  const restore = usePlannerStore((s) => s.restore);
  const { busy, run } = useRun();
  const [open, setOpen] = useState(false);
  const slugs = overview?.plan.dismissed ?? [];
  if (!overview || slugs.length === 0) return null;
  const bySlug = entriesBySlug(overview);

  return (
    <View className="mt-5">
      <Text
        accessibilityRole="button"
        onPress={() => setOpen((v) => !v)}
        className="text-action text-sm font-medium"
      >
        {slugs.length} left out as not for us ({open ? "hide" : "show"})
      </Text>
      {open ? (
        <View className="mt-2 gap-2">
          {slugs.map((slug) => (
            <View
              key={slug}
              className="rounded-tile border-hairline bg-surface flex-row items-center justify-between border p-3"
            >
              <Text className="text-body mr-2 flex-1 text-sm">
                {bySlug.get(slug)?.edition.name ?? slug}
              </Text>
              <SmallButton
                label="Show again"
                busy={busy === slug}
                onPress={() => run(slug, () => restore(slug), "Could not restore it.")}
              />
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

export function SuggestedPanel() {
  const overview = usePlannerStore((s) => s.overview);
  const recsState = usePlannerStore((s) => s.recsState);
  const response = usePlannerStore((s) => s.recs);
  const suggest = usePlannerStore((s) => s.suggest);
  const addEntry = usePlannerStore((s) => s.addEntry);
  const [asking, setAsking] = useState(false);
  const { busy, run } = useRun();

  if (!overview) return null;

  if (recsState === "error") {
    return (
      <Panel>
        <Body>We could not load the suggestions just now.</Body>
      </Panel>
    );
  }
  if (!response) {
    return (
      <Panel>
        <Body muted>Loading suggestions...</Body>
      </Panel>
    );
  }

  const ask = async () => {
    setAsking(true);
    try {
      await suggest(false);
    } catch (err) {
      Alert.alert(
        "Could not make suggestions",
        apiMessage(err, "Could not make suggestions just now.")
      );
    } finally {
      setAsking(false);
    }
  };

  if (!response.recommendations) {
    const open = (overview.shortlist?.ownGroup ?? []).filter(
      (e) => !entriesClosed(e.edition.registrationDeadlineDate)
    );
    const soon = open.slice(0, 4);
    const onPlan = new Set(overview.plan.entries.map((e) => e.editionSlug));
    return (
      <View>
        <Panel>
          <Body>
            Want a short list built for you? It fits around your plan, the rest days between events,
            the yearly entries left and your budget, and leaves out events whose past draws closed
            above this rank. An AI model then writes why each one suits them.
          </Body>
          <View className="mt-3 flex-row">
            <SmallButton
              label={asking ? "Working on it..." : "Suggest my season"}
              variant="solid"
              busy={asking}
              onPress={ask}
            />
          </View>
        </Panel>
        {soon.length > 0 ? (
          <View className="mt-5">
            <Heading>
              {open.length > 4 ? `Open to enter soon (4 of ${open.length})` : "Open to enter soon"}
            </Heading>
            <View className="rounded-tile border-hairline bg-surface overflow-hidden border">
              {soon.map((e) => {
                const slug = e.edition.slug;
                const planned = Boolean(slug && onPlan.has(slug));
                return (
                  <EventCard
                    key={slug ?? e.edition.name}
                    entry={e}
                    reach={slug ? overview.reach?.[slug] : undefined}
                    onPlan={planned}
                    actions={
                      slug && !planned ? (
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
              })}
            </View>
          </View>
        ) : null}
        <Dismissed />
      </View>
    );
  }

  return (
    <View>
      <Saved recs={response.recommendations} usage={response.usage} />
      <Dismissed />
    </View>
  );
}
