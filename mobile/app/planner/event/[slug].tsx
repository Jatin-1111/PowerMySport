import React from "react";
import { View, Text, ScrollView, TouchableOpacity, Linking } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ArrowLeft } from "lucide-react-native";
import {
  AITA_WITHDRAWAL_RULES,
  JUNIOR_LADDER,
  RULES_SOURCE,
  type PlannerEdition,
} from "@powermysport/shared-types";
import { COLORS } from "@lib/constants";
import { entriesBySlug, calendarOf, usePlannerStore } from "@/modules/planner/store/plannerStore";
import {
  NEXT_STATUS,
  NEXT_STATUS_LABEL,
  STATUS_LABEL,
  dateWindow,
  deadlineLine,
  deadlineState,
  entriesClosed,
  formatInr,
  longDay,
  todayUtc,
  warningsFor,
} from "@/modules/planner/utils/format";
import { CostLine } from "@/modules/planner/components/CostParts";
import { reachLabel, whereOf } from "@/modules/planner/components/EventCard";
import { useRun } from "@/modules/planner/components/PlanPanel";
import { Badge, Body, Collapsible, Heading, SmallButton } from "@/modules/planner/components/ui";

function Row({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <View className="mb-2 flex-row">
      <Text className="text-muted w-32 text-sm">{label}</Text>
      <Text className="text-ink flex-1 text-sm">{value}</Text>
    </View>
  );
}

const ageGroupsText = (groups?: string[]) => groups?.map((g) => g.replace("-", " ")).join(", ");

/** The fine for not turning up is stated only for the levels AITA prints one for. */
function noShowFine(edition: PlannerEdition): number | null {
  if (edition.ladder === "Talent Series")
    return AITA_WITHDRAWAL_RULES.noShowFine.talentAndChampionship7Day;
  if (edition.ladder === "Championship Series" && edition.grade === 7)
    return AITA_WITHDRAWAL_RULES.noShowFine.talentAndChampionship7Day;
  if (edition.ladder === "Championship Series" && edition.grade === 3)
    return AITA_WITHDRAWAL_RULES.noShowFine.championship3Day;
  return null;
}

export default function EventDetailScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const overview = usePlannerStore((s) => s.overview);
  const addEntry = usePlannerStore((s) => s.addEntry);
  const setStatus = usePlannerStore((s) => s.setStatus);
  const removeEntry = usePlannerStore((s) => s.removeEntry);
  const { busy, run } = useRun();

  const back = () => (router.canGoBack() ? router.back() : router.replace("/planner"));
  const judged = entriesBySlug(overview).get(slug);
  const planEntry = overview?.plan.entries.find((e) => e.editionSlug === slug);
  const edition = judged?.edition;

  // A played event can leave the calendar; it still shows, with what the plan kept.
  if (!overview || (!judged && !planEntry)) {
    return (
      <View className="bg-canvas flex-1 items-center justify-center px-8">
        <Text className="text-ink mb-4 text-center text-base">
          This event is not on the calendar any more.
        </Text>
        <SmallButton label="Go back" onPress={back} />
      </View>
    );
  }

  const name = edition?.name ?? planEntry?.name ?? slug;
  const start = edition?.startDate ?? planEntry?.startDate ?? "";
  const official = edition?.official;
  const closed = entriesClosed(edition?.registrationDeadlineDate);
  const planned = Boolean(planEntry);
  const canAdd =
    !planned && Boolean(judged && judged.status === "open" && !judged.playingUp && !closed);
  const clash = planEntry
    ? warningsFor(overview.plan.entries, calendarOf(overview)).get(slug)
    : undefined;
  const reach = overview.reach?.[slug];
  const withdraw = official?.withdrawalDeadline;
  const withdrawState = deadlineState(withdraw);
  const fine = edition ? noShowFine(edition) : null;
  const ladderGloss = JUNIOR_LADDER.find((l) => l.name === edition?.ladder)?.plain;
  const next = planEntry ? NEXT_STATUS[planEntry.status] : null;
  const hideEntries = planEntry?.status === "entered" || planEntry?.status === "played";

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

      <Text className="text-ink text-2xl font-bold">{name}</Text>
      <View className="mb-4 mt-2 flex-row flex-wrap gap-2">
        {planEntry ? (
          <Badge
            label={`On the plan, ${STATUS_LABEL[planEntry.status].toLowerCase()}`}
            tone="success"
          />
        ) : null}
        {edition?.ladder ? <Badge label={edition.ladder} /> : null}
        {judged?.playingUp ? <Badge label="Older age group" /> : null}
      </View>
      {ladderGloss ? (
        <Text className="text-muted mb-4 text-sm">
          {edition?.ladder}: {ladderGloss}.
        </Text>
      ) : null}

      <Row label="Dates" value={dateWindow(start, edition?.endDate)} />
      <Row
        label="Where"
        value={edition ? [edition.venue, whereOf(edition)].filter(Boolean).join(", ") : null}
      />
      <Row label="Age groups" value={ageGroupsText(edition?.ageGroups)} />
      {edition && !hideEntries ? (
        <Row
          label="Entries"
          value={deadlineLine(edition.registrationDeadlineDate, official?.times?.entryCloses)}
        />
      ) : null}
      {clash ? <Text className="text-action mb-2 mt-1 text-sm font-medium">{clash}</Text> : null}

      {judged ? (
        <View className="mt-4">
          <Heading>Entry rules</Heading>
          <Body>{judged.reason}</Body>
          {judged.notes.map((note) => (
            <View key={note} className="mt-1.5">
              <Body muted>{note}</Body>
            </View>
          ))}
        </View>
      ) : null}

      {reach ? (
        <View className="mt-5">
          <Heading>Who got in before</Heading>
          {reachLabel(reach) ? (
            <Text className="text-ink mb-1 text-sm font-semibold">{reachLabel(reach)}</Text>
          ) : null}
          <Body>{reach.text}</Body>
        </View>
      ) : null}

      {official ? (
        <View className="mt-5">
          <Heading>From AITA</Heading>
          <Row
            label="Entries open"
            value={official.entryOpens ? longDay(official.entryOpens) : null}
          />
          <Row
            label="Withdraw by"
            value={
              withdraw
                ? `${longDay(withdraw)}${official.times?.withdrawal ? `, ${official.times.withdrawal}` : ""}`
                : null
            }
          />
          <Row
            label="Draw is fixed"
            value={
              official.freezeDeadline
                ? `${longDay(official.freezeDeadline)}${official.times?.freeze ? `, ${official.times.freeze}` : ""}`
                : null
            }
          />
          <Row
            label="Main draw starts"
            value={official.mainDrawStart ? longDay(official.mainDrawStart) : null}
          />
          <Row
            label="Entry fee"
            value={
              official.feeSingles
                ? `${formatInr(official.feeSingles)} singles${official.feeDoubles ? `, ${formatInr(official.feeDoubles)} doubles per pair` : ""}`
                : null
            }
          />
          <Row
            label="Daily allowance"
            value={
              official.dailyAllowance ? `${formatInr(official.dailyAllowance)} (main round)` : null
            }
          />
          <Row label="Surface" value={official.surface} />
          <Text className="text-muted mt-1 text-xs leading-relaxed">
            {official.source === "factSheet"
              ? `Read from AITA's page for this event${official.checkedAt ? ` on ${longDay(official.checkedAt)}` : ""}. Dates and fees can change, so check it before you enter.`
              : "From AITA's 2026 rules for this level and these dates. This event's own page could not be read, so check it before you enter."}
          </Text>
          {planEntry?.status === "entered" && withdraw ? (
            <Text className="text-body mt-2 text-sm">
              {withdrawState.kind === "passed"
                ? "The withdrawal deadline has passed. Withdrawing now counts as a late withdrawal."
                : `To withdraw without it counting as a late withdrawal, do it by ${longDay(withdraw)}.`}
            </Text>
          ) : null}
          {official.pageUrl ? (
            <View className="mt-3 flex-row">
              <SmallButton
                label="Event page on AITA"
                onPress={() => void Linking.openURL(official.pageUrl as string)}
              />
            </View>
          ) : null}
        </View>
      ) : null}

      <View className="mt-5">
        <Heading>Cost</Heading>
        <CostLine slug={slug} entry={planEntry} withHow />
      </View>

      <View className="mt-6 gap-3">
        {canAdd ? (
          <SmallButton
            label="Add to plan"
            variant="solid"
            busy={busy === "add"}
            onPress={() => run("add", () => addEntry(slug), "Could not add this event.")}
          />
        ) : null}
        {planEntry && next ? (
          <SmallButton
            label={NEXT_STATUS_LABEL[planEntry.status]}
            variant="solid"
            busy={busy === "status"}
            onPress={() => run("status", () => setStatus(slug, next), "Please try again.")}
          />
        ) : null}
        {planEntry ? (
          <SmallButton
            label="Remove from plan"
            variant="danger"
            busy={busy === "remove"}
            onPress={() =>
              run(
                "remove",
                async () => {
                  await removeEntry(slug);
                  back();
                },
                "Please try again."
              )
            }
          />
        ) : null}
      </View>

      <View className="mt-6">
        <Collapsible title="If you withdraw late or do not turn up">
          <View className="gap-2">
            <Body>
              Withdrawing after the withdrawal deadline withdraws the player from every event at the
              tournament.
            </Body>
            <Body>
              Late withdrawals are limited to {AITA_WITHDRAWAL_RULES.lateWithdrawalsPerYear} a
              calendar year, whatever the reason.
            </Body>
            {fine ? (
              <Body>
                A player who has signed in and does not turn up for a match is fined{" "}
                {formatInr(fine)}.
              </Body>
            ) : null}
            <Body>The entry fee is not refunded to a player who does not turn up.</Body>
            <Text className="text-muted text-xs">
              From {RULES_SOURCE.label}. Check them for the full wording.
            </Text>
            <View className="mt-1 flex-row">
              <SmallButton
                label="Open the AITA rules"
                onPress={() => void Linking.openURL(RULES_SOURCE.href)}
              />
            </View>
          </View>
        </Collapsible>
      </View>
    </ScrollView>
  );
}
