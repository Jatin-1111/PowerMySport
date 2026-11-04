import React, { useState } from "react";
import {
  View,
  Text,
  Modal,
  ScrollView,
  TextInput,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { COLORS } from "@lib/constants";
import { apiMessage, plannerApi, type EventCost, type SeasonPlanEntry } from "../services/planner";
import { usePlannerStore } from "../store/plannerStore";
import { formatInr, formatRange, parseRupees } from "../utils/format";
import { Body, Heading, Panel, SmallButton } from "./ui";

const MAX_PART = 1_000_000;

/** What a cost line says about where its numbers came from: never "you will spend". */
function sourceLabel(cost: EventCost): string {
  const yours = [cost.travel, cost.stay].filter((m) => m?.basis === "yours").length;
  if (yours === 2) return "your figures";
  if (yours === 1) return "estimate and your figures";
  return cost.source === "rough" ? "rough estimate" : "estimate";
}

function feeText(cost: EventCost): string {
  if (cost.entryFee === null || cost.entryFee === undefined) return "entry fee not included";
  const fee = formatInr(cost.entryFee);
  if (cost.entryFeeBasis === "yours") return `includes your entry fee of ${fee}`;
  if (cost.entryFeeBasis === "fact-sheet") return `includes the ${fee} AITA entry fee`;
  return `includes the ${fee} entry fee from AITA's rules`;
}

export function costSummary(cost: EventCost | undefined): string | null {
  if (!cost) return null;
  // The server's total adds the entry fee when one is known, and exists only when both travel and
  // stay do (half a trip is never priced). The suffix says whether the fee is inside it.
  if (!cost.total) return cost.note;
  return `Travel and stay ${formatRange(cost.total.low, cost.total.high)} (${sourceLabel(cost)}, ${feeText(cost)})`;
}

// ─── One event's cost line, with the parent's own figures ───────────────────────

export function CostLine({
  slug,
  entry,
  withHow = false,
}: {
  slug: string;
  entry?: SeasonPlanEntry;
  withHow?: boolean;
}) {
  const cost = usePlannerStore((s) => s.costs?.events[slug]);
  const state = usePlannerStore((s) => s.costsState);
  const [editing, setEditing] = useState(false);
  if (entry?.status === "played") return null;

  const summary = costSummary(cost);
  return (
    <View className="mt-2">
      {state === "error" ? (
        <Text className="text-muted text-sm">Cost estimates are not available just now.</Text>
      ) : summary ? (
        <Text className="text-body text-sm">{summary}</Text>
      ) : null}
      {cost && cost.entryFee === null ? (
        <Text className="text-muted mt-0.5 text-sm">
          Entry fee: not estimated, check the fact sheet.
        </Text>
      ) : null}
      {withHow && cost?.assumptions ? (
        <Text className="text-muted mt-1 text-xs">
          {cost.assumptions} These are estimates, not quotes. Fares and rooms change with the date
          and how early you book.
        </Text>
      ) : null}
      {entry ? (
        <View className="mt-2 flex-row">
          <SmallButton label="Add or edit my figures" onPress={() => setEditing(true)} />
        </View>
      ) : (
        <Text className="text-muted mt-1 text-xs">
          Add the event to the plan to enter your own figures, including the entry fee.
        </Text>
      )}
      {entry ? (
        <FiguresModal visible={editing} onClose={() => setEditing(false)} entry={entry} />
      ) : null}
    </View>
  );
}

function FiguresModal({
  visible,
  onClose,
  entry,
}: {
  visible: boolean;
  onClose: () => void;
  entry: SeasonPlanEntry;
}) {
  const setEntryCosts = usePlannerStore((s) => s.setEntryCosts);
  const [travel, setTravel] = useState(entry.costs?.travel?.toString() ?? "");
  const [stay, setStay] = useState(entry.costs?.stay?.toString() ?? "");
  const [fee, setFee] = useState(entry.costs?.entryFee?.toString() ?? "");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const read = (label: string, text: string): number | null | undefined => {
    const n = parseRupees(text);
    if (n === null) return null; // blank clears that part
    if (Number.isNaN(n) || n > MAX_PART) {
      setError(`Enter ${label} as whole rupees up to 10,00,000.`);
      return undefined;
    }
    return n;
  };

  const save = async () => {
    setError("");
    const t = read("travel", travel);
    const s = read("stay", stay);
    const f = read("the entry fee", fee);
    if (t === undefined || s === undefined || f === undefined) return;
    setBusy(true);
    try {
      // A whole number sets that part; null clears it; every part is sent so none is left behind.
      await setEntryCosts(entry.editionSlug, {
        travel: t as number,
        stay: s as number,
        entryFee: f as number,
      });
      onClose();
    } catch (err) {
      setError(apiMessage(err, "Could not save your figures."));
    } finally {
      setBusy(false);
    }
  };

  const field = (label: string, value: string, set: (v: string) => void) => (
    <View className="mb-4">
      <Text className="text-ink mb-1.5 text-sm font-medium">{label}</Text>
      <TextInput
        value={value}
        onChangeText={set}
        keyboardType="number-pad"
        placeholder="Leave blank to use our estimate"
        placeholderTextColor={COLORS.ash}
        className="rounded-button border-hairline bg-surface text-ink h-12 border px-3 text-base"
      />
    </View>
  );

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView
          className="bg-canvas flex-1"
          contentContainerStyle={{ padding: 20, paddingTop: 48 }}
          keyboardShouldPersistTaps="handled"
        >
          <Text className="text-ink mb-1 text-2xl font-bold">My figures</Text>
          <Text className="text-body mb-5 text-sm">
            {entry.name}. Your own figure replaces our estimate for that part.
          </Text>
          {field("Travel (rupees)", travel, setTravel)}
          {field("Stay (rupees)", stay, setStay)}
          {field("Entry fee (rupees)", fee, setFee)}
          {error ? <Text className="text-danger mb-3 text-sm">{error}</Text> : null}
          <View className="gap-3">
            <SmallButton label="Save my figures" variant="solid" busy={busy} onPress={save} />
            <SmallButton label="Cancel" onPress={onClose} />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ─── Home city ──────────────────────────────────────────────────────────────────

function HomeCity() {
  const costs = usePlannerStore((s) => s.costs);
  const refreshCosts = usePlannerStore((s) => s.refreshCosts);
  const [open, setOpen] = useState(false);
  const [city, setCity] = useState("");
  const [busy, setBusy] = useState(false);
  const origin = costs?.origin;

  const save = async () => {
    setBusy(true);
    try {
      await plannerApi.setHomeCity(city.trim());
      setOpen(false);
      void refreshCosts();
    } catch (err) {
      Alert.alert("Could not save your city", apiMessage(err, "Could not save your city."));
    } finally {
      setBusy(false);
    }
  };

  const line =
    origin?.kind === "city"
      ? `Travel estimates start from ${origin.label ?? origin.city}.`
      : origin?.kind === "state"
        ? `Travel estimates start from ${origin.label ?? origin.state}, the state on the ranking list. A city gives better ones.`
        : "Add your city to estimate travel and stay.";

  return (
    <View className="mt-3">
      <Text className="text-body text-sm">{line}</Text>
      {open ? (
        <View className="mt-2">
          <Text className="text-ink mb-1.5 text-sm font-medium">Your city</Text>
          <TextInput
            value={city}
            onChangeText={setCity}
            placeholder="Pune"
            placeholderTextColor={COLORS.ash}
            maxLength={60}
            autoCapitalize="words"
            className="rounded-button border-hairline bg-surface text-ink mb-2 h-12 border px-3 text-base"
          />
          <Text className="text-muted mb-2 text-xs">
            Saved to your profile. Only the city is used, and it is shared with our AI model
            together with the venue to estimate the trip. We do not ask for an address.
          </Text>
          <View className="flex-row gap-2">
            <SmallButton
              label="Save city"
              variant="solid"
              busy={busy}
              disabled={city.trim().length < 2}
              onPress={save}
            />
            <SmallButton label="Cancel" onPress={() => setOpen(false)} />
          </View>
        </View>
      ) : (
        <View className="mt-2 flex-row">
          <SmallButton
            label={origin?.kind === "city" ? "Change city" : "Add your city"}
            onPress={() => setOpen(true)}
          />
        </View>
      )}
    </View>
  );
}

// ─── Season budget ──────────────────────────────────────────────────────────────

function BudgetEditor() {
  const overview = usePlannerStore((s) => s.overview);
  const save = usePlannerStore((s) => s.savePreferences);
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  if (!overview) return null;
  const prefs = overview.plan.preferences;

  const submit = async () => {
    const n = parseRupees(text);
    if (n === null || Number.isNaN(n) || n > 10_000_000) {
      setError("Enter the budget in whole rupees, for example 60000.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      // Preferences replace as a whole, so the other saved settings go back unchanged.
      await save({ ...prefs, budget: n === 0 ? null : n });
      setEditing(false);
    } catch (err) {
      setError(apiMessage(err, "Could not save the budget."));
    } finally {
      setBusy(false);
    }
  };

  if (!editing) {
    return (
      <View className="mt-3 flex-row items-center justify-between">
        <Text className="text-body text-sm">
          {prefs.budget ? `Budget ${formatInr(prefs.budget)}` : "No budget set"}
        </Text>
        <SmallButton
          label={prefs.budget ? "Change" : "Set a budget"}
          onPress={() => {
            setText(prefs.budget ? String(prefs.budget) : "");
            setEditing(true);
          }}
        />
      </View>
    );
  }
  return (
    <View className="mt-3">
      <Text className="text-ink mb-1.5 text-sm font-medium">Season budget (rupees)</Text>
      <TextInput
        value={text}
        onChangeText={setText}
        keyboardType="number-pad"
        placeholder="60000"
        placeholderTextColor={COLORS.ash}
        className="rounded-button border-hairline bg-surface text-ink mb-2 h-12 border px-3 text-base"
      />
      {error ? <Text className="text-danger mb-2 text-sm">{error}</Text> : null}
      <View className="flex-row gap-2">
        <SmallButton label="Save" variant="solid" busy={busy} onPress={submit} />
        <SmallButton label="Cancel" onPress={() => setEditing(false)} />
      </View>
    </View>
  );
}

const STATUS_TEXT = {
  within: "The plan is within your budget, even at the top of the range.",
  over: "The plan is over your budget even at the low end of the estimates.",
} as const;

export function CostTile() {
  const overview = usePlannerStore((s) => s.overview);
  const costs = usePlannerStore((s) => s.costs);
  const state = usePlannerStore((s) => s.costsState);
  if (!overview || overview.plan.entries.length === 0) return null;
  const season = costs?.season;

  return (
    <View className="mb-4">
      <Heading>What it may cost</Heading>
      <Panel>
        {state === "error" ? (
          <Body>Cost estimates are not available just now. Everything else still works.</Body>
        ) : !season ? (
          <Body muted>Estimating what the season may cost...</Body>
        ) : (
          <>
            <Text className="text-muted text-sm">Season travel and stay</Text>
            {season.total ? (
              <Text className="text-ink mt-1 text-2xl font-bold">
                {formatRange(season.total.low, season.total.high)}
              </Text>
            ) : (
              <Body>No travel and stay figures for the plan yet.</Body>
            )}
            {season.total ? (
              <Text className="text-muted mt-1 text-sm">
                for {season.events} event{season.events === 1 ? "" : "s"}, estimated
              </Text>
            ) : null}
            {season.status === "within" || season.status === "over" ? (
              <Text className="text-body mt-2 text-sm">{STATUS_TEXT[season.status]}</Text>
            ) : null}
            {season.status === "may-exceed" && season.total && season.budget ? (
              <Text className="text-body mt-2 text-sm">
                The plan may go over your budget: it could reach {formatInr(season.total.high)}{" "}
                against {formatInr(season.budget)}.
              </Text>
            ) : null}
            {season.withoutFigures > 0 ? (
              <Text className="text-muted mt-2 text-sm">
                {season.withoutFigures} event{season.withoutFigures === 1 ? " has" : "s have"} no
                travel and stay figure yet and {season.withoutFigures === 1 ? "is" : "are"} not in
                this total.
              </Text>
            ) : null}
            {season.missingEntryFees > 0 ? (
              <Text className="text-muted mt-2 text-sm">
                Entry fees are not included for {season.missingEntryFees} event
                {season.missingEntryFees === 1 ? "" : "s"}. AITA has not published a fee for{" "}
                {season.missingEntryFees === 1 ? "it" : "them"}, so add{" "}
                {season.missingEntryFees === 1 ? "it" : "them"} from the fact sheet to complete the
                total.
              </Text>
            ) : null}
          </>
        )}
        <BudgetEditor />
        <HomeCity />
      </Panel>
    </View>
  );
}
