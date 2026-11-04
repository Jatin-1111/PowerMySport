import React, { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ArrowLeft } from "lucide-react-native";
import { Button } from "@components/ui/Button";
import { Checkbox } from "@components/ui/Checkbox";
import { DobFields, EMPTY_DOB, dobToIso, type DobValue } from "@components/ui/DobFields";
import { apiMessage, type BlockedRange, type SeasonGoal } from "@/modules/planner/services/planner";
import { usePlannerStore } from "@/modules/planner/store/plannerStore";
import { GOAL_OPTIONS, parseRupees } from "@/modules/planner/utils/format";
import { Body, SmallButton } from "@/modules/planner/components/ui";
import { COLORS } from "@lib/constants";

interface Row {
  from: DobValue;
  to: DobValue;
  label: string;
}

const MAX_RANGES = 5;

const toFields = (iso: string): DobValue => {
  const [year, month, day] = iso.split("-");
  return { day: String(Number(day)), month: String(Number(month)), year };
};

const isEmptyRow = (r: Row) =>
  !r.label.trim() && Object.values(r.from).every((v) => !v) && Object.values(r.to).every((v) => !v);

export default function SeasonSetupScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const overview = usePlannerStore((s) => s.overview);
  const save = usePlannerStore((s) => s.savePreferences);

  const prefs = overview?.plan.preferences;
  const homeState = overview?.standing?.state ?? null;

  const [goal, setGoal] = useState<SeasonGoal>(prefs?.goal ?? "points");
  const [older, setOlder] = useState(prefs?.includeOlderGroup ?? false);
  const [budget, setBudget] = useState(prefs?.budget ? String(prefs.budget) : "");
  const [rows, setRows] = useState<Row[]>(
    (prefs?.blockedRanges ?? []).map((r) => ({
      from: toFields(r.from),
      to: toFields(r.to),
      label: r.label ?? "",
    }))
  );
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const back = () => (router.canGoBack() ? router.back() : router.replace("/planner"));

  if (!overview || !prefs) {
    return (
      <View className="bg-canvas flex-1 items-center justify-center px-8">
        <Text className="text-ink mb-4 text-center text-base">
          Open the planner first, then come back to set up the season.
        </Text>
        <Button onPress={back}>Go back</Button>
      </View>
    );
  }

  const update = (i: number, patch: Partial<Row>) =>
    setRows((all) => all.map((r, j) => (j === i ? { ...r, ...patch } : r)));

  const submit = async () => {
    setError("");
    const blockedRanges: BlockedRange[] = [];
    for (const row of rows.filter((r) => !isEmptyRow(r))) {
      const from = dobToIso(row.from);
      const to = dobToIso(row.to);
      if (!from || !to) {
        setError("Choose both a start and an end date.");
        return;
      }
      if (to < from) {
        setError("The end date is before the start date.");
        return;
      }
      blockedRanges.push({ from, to, ...(row.label.trim() ? { label: row.label.trim() } : {}) });
    }
    const amount = parseRupees(budget);
    if (amount !== null && (Number.isNaN(amount) || amount > 10_000_000)) {
      setError("Enter the budget in whole rupees, for example 60000.");
      return;
    }
    setBusy(true);
    try {
      // The server replaces the whole preferences object, so every field is sent.
      await save({
        goal: goal === "home" && !homeState ? "experience" : goal,
        blockedRanges,
        budget: amount === null || amount === 0 ? null : amount,
        includeOlderGroup: older,
      });
      back();
    } catch (err) {
      setError(apiMessage(err, "Could not save the setup."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={{ flex: 1 }}
    >
      <ScrollView
        className="bg-canvas flex-1"
        contentContainerStyle={{
          paddingTop: insets.top + 12,
          paddingBottom: insets.bottom + 40,
          paddingHorizontal: 20,
        }}
        keyboardShouldPersistTaps="handled"
      >
        <TouchableOpacity
          onPress={back}
          accessibilityLabel="Go back"
          className="rounded-tile bg-surface mb-6 h-9 w-9 items-center justify-center"
        >
          <ArrowLeft size={18} color={COLORS.ink} />
        </TouchableOpacity>

        <Text className="text-ink mb-6 text-2xl font-bold">Season setup</Text>

        <Text className="text-ink mb-2 text-base font-semibold">What is this season for?</Text>
        <View className="mb-6 gap-2">
          {GOAL_OPTIONS.map((o) => {
            const disabled = o.value === "home" && !homeState;
            const selected = goal === o.value;
            return (
              <TouchableOpacity
                key={o.value}
                disabled={disabled}
                onPress={() => setGoal(o.value)}
                accessibilityRole="radio"
                accessibilityState={{ selected, disabled }}
                className={`rounded-tile border p-4 ${selected ? "border-ink bg-surface" : "border-hairline bg-surface"} ${disabled ? "opacity-50" : ""}`}
              >
                <Text className="text-ink text-base font-semibold">{o.label}</Text>
                <Text className="text-body mt-0.5 text-sm">
                  {o.value === "home"
                    ? homeState
                      ? `Favours events in ${homeState}.`
                      : "Their home state is not on the ranking list, so this is not available yet."
                    : o.hint}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <Checkbox checked={older} onChange={setOlder}>
          <Text className="text-body text-sm">
            Also show events in an older age group.{" "}
            <Text className="text-muted">
              They use the same yearly entries as their own age group, so they are only ever
              options, never picks.
            </Text>
          </Text>
        </Checkbox>

        <Text className="text-ink mb-1 mt-4 text-base font-semibold">Dates they cannot play</Text>
        <View className="mb-3">
          <Body muted>
            Exams, holidays or anything else. Events that run into these dates are left out of the
            suggestions.
          </Body>
        </View>
        {rows.map((row, i) => (
          <View key={i} className="rounded-tile border-hairline bg-surface mb-3 border p-4">
            <Text className="text-ink mb-1 text-sm font-medium">From</Text>
            <DobFields value={row.from} onChange={(from) => update(i, { from })} />
            <Text className="text-ink mb-1 mt-3 text-sm font-medium">To</Text>
            <DobFields value={row.to} onChange={(to) => update(i, { to })} />
            <Text className="text-ink mb-1.5 mt-3 text-sm font-medium">Note (optional)</Text>
            <TextInput
              value={row.label}
              onChangeText={(label) => update(i, { label: label.slice(0, 40) })}
              placeholder="Board exams"
              placeholderTextColor={COLORS.ash}
              className="rounded-button border-hairline bg-canvas text-ink mb-3 h-12 border px-3 text-base"
            />
            <View className="flex-row">
              <SmallButton
                label="Remove"
                variant="danger"
                onPress={() => setRows((all) => all.filter((_, j) => j !== i))}
              />
            </View>
          </View>
        ))}
        {rows.length < MAX_RANGES ? (
          <View className="mb-6 flex-row">
            <SmallButton
              label="Add dates"
              onPress={() =>
                setRows((all) => [...all, { from: EMPTY_DOB, to: EMPTY_DOB, label: "" }])
              }
            />
          </View>
        ) : null}

        <Text className="text-ink mb-1 text-base font-semibold">Season budget (optional)</Text>
        <View className="mb-2">
          <Body muted>
            What you want the plan to stay within, for travel and stay. The planner shows the plan
            against it.
          </Body>
        </View>
        <TextInput
          value={budget}
          onChangeText={setBudget}
          keyboardType="number-pad"
          placeholder="60000"
          placeholderTextColor={COLORS.ash}
          className="rounded-button border-hairline bg-surface text-ink mb-6 h-12 border px-3 text-base"
        />

        {error ? <Text className="text-danger mb-4 text-sm">{error}</Text> : null}
        <Button size="lg" onPress={submit} loading={busy}>
          Save setup
        </Button>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
