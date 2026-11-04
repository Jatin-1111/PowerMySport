import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Linking,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ArrowLeft, ChevronRight } from "lucide-react-native";
import { POINTS_FORMULA } from "@powermysport/shared-types";
import { Button } from "@components/ui/Button";
import { Body, Panel, SmallButton } from "@/modules/planner/components/ui";
import {
  rankingsApi,
  type RankingDate,
  type RankingListResult,
} from "@/modules/rankings/services/rankings";
import {
  comboLabel,
  displayName,
  formatPoints,
  isJunior,
  listDate,
  movementText,
} from "@/modules/rankings/utils/text";
import { COLORS } from "@lib/constants";
import { RANKINGS_HOME } from "@lib/routes";

const LIMIT = 50;

function Chips({
  label,
  value,
  options,
  onChange,
  render,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (v: string) => void;
  render?: (v: string) => string;
}) {
  return (
    <View className="mb-3">
      <Text className="text-ink mb-1.5 text-sm font-medium">{label}</Text>
      <View className="flex-row flex-wrap gap-2">
        {options.map((o) => (
          <TouchableOpacity
            key={o || "all"}
            onPress={() => onChange(o)}
            accessibilityRole="button"
            accessibilityState={{ selected: value === o }}
            className={`rounded-button min-h-[40px] justify-center border px-3 ${value === o ? "border-ink bg-ink" : "border-hairline bg-surface"}`}
          >
            <Text className={`text-sm font-medium ${value === o ? "text-white" : "text-ink"}`}>
              {render ? render(o) : o}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

export default function RankingListScreen() {
  const { category, subcategory } = useLocalSearchParams<{
    category: string;
    subcategory: string;
  }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const label = comboLabel(category, subcategory);
  const junior = isJunior(subcategory);

  const [result, setResult] = useState<RankingListResult | null>(null);
  const [failed, setFailed] = useState(false);
  const [states, setStates] = useState<string[]>([]);
  const [dates, setDates] = useState<RankingDate[]>([]);
  const [searchText, setSearchText] = useState("");
  const [search, setSearch] = useState("");
  const [state, setState] = useState("");
  const [date, setDate] = useState("");
  const [page, setPage] = useState(1);

  useEffect(() => {
    rankingsApi
      .meta()
      .then((m) => setStates(m.states))
      .catch(() => undefined);
    rankingsApi
      .dates(category, subcategory)
      .then(setDates)
      .catch(() => undefined);
  }, [category, subcategory]);

  const load = useCallback(async () => {
    setFailed(false);
    try {
      setResult(
        await rankingsApi.list({
          category,
          subcategory,
          page,
          limit: LIMIT,
          ...(state ? { state } : {}),
          ...(search ? { search } : {}),
          ...(date ? { date } : {}),
        })
      );
    } catch {
      setFailed(true);
    }
  }, [category, subcategory, page, state, search, date]);

  useEffect(() => {
    setResult(null);
    void load();
  }, [load]);

  const back = () => (router.canGoBack() ? router.back() : router.replace(RANKINGS_HOME));
  const filtering = Boolean(search || state || date);
  const snapshot = result?.snapshot;
  const hasBaseline = Boolean(snapshot?.comparedTo);
  const listSize = snapshot?.rowCount ?? null;
  const archived = Boolean(date) && dates[0] && date !== dates[0].asOnDate.slice(0, 10);

  const change = (apply: () => void) => {
    apply();
    setPage(1);
  };

  return (
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

      <Text className="text-ink text-2xl font-bold">AITA {label} ranking</Text>
      <Text className="text-body mb-1 mt-1 text-sm">
        The official All India Tennis Association ranking for {label} in India, updated most weeks.
      </Text>
      {snapshot ? (
        <Text className="text-muted mb-3 text-sm">
          As on {listDate(snapshot.asOnDate)}
          {snapshot.comparedTo ? `, movement against ${listDate(snapshot.comparedTo)}` : ""}
        </Text>
      ) : null}
      {snapshot?.sourceUrl ? (
        <View className="mb-4 flex-row">
          <SmallButton
            label="Official AITA source"
            onPress={() => void Linking.openURL(snapshot.sourceUrl as string)}
          />
        </View>
      ) : null}

      <Panel>
        <Text className="text-ink mb-1 text-sm font-semibold">How to read</Text>
        <Text className="text-body mb-1 text-sm">
          Rank: position among the {listSize ? `${listSize} ` : "every "}
          {label} players ranked in India. Rank 1 is the best.
        </Text>
        <Text className="text-body mb-1 text-sm">
          Points: {POINTS_FORMULA.replace("counted,a bad", "counted, a bad")}
        </Text>
        <Text className="text-body text-sm">
          Updated: AITA publishes a new list most weeks.
          {snapshot ? ` This one is dated ${listDate(snapshot.asOnDate)}.` : ""}
        </Text>
      </Panel>

      <View className="mt-5">
        <Text className="text-ink mb-1.5 text-sm font-medium">
          {junior ? "Find your child on this list" : "Find a player"}
        </Text>
        <View className="flex-row gap-2">
          <TextInput
            value={searchText}
            onChangeText={setSearchText}
            onSubmitEditing={() => change(() => setSearch(searchText.trim()))}
            returnKeyType="search"
            placeholder="Name or AITA registration number"
            placeholderTextColor={COLORS.ash}
            autoCapitalize="none"
            className="rounded-button border-hairline bg-surface text-ink h-12 flex-1 border px-3 text-base"
          />
          <SmallButton
            label="Search"
            variant="solid"
            onPress={() => change(() => setSearch(searchText.trim()))}
          />
        </View>

        <View className="mt-4">
          <Chips
            label="State"
            value={state}
            options={["", ...states]}
            render={(v) => v || "All states"}
            onChange={(v) => change(() => setState(v))}
          />
          {dates.length > 1 ? (
            <Chips
              label="Week"
              value={date}
              options={["", ...dates.slice(0, 6).map((d) => d.asOnDate.slice(0, 10))]}
              render={(v) => (v ? listDate(v) : "Latest")}
              onChange={(v) => change(() => setDate(v))}
            />
          ) : null}
          {filtering ? (
            <View className="mb-3 flex-row">
              <SmallButton
                label="Clear"
                onPress={() =>
                  change(() => {
                    setSearch("");
                    setSearchText("");
                    setState("");
                    setDate("");
                  })
                }
              />
            </View>
          ) : null}
        </View>
      </View>

      {archived ? (
        <View className="mb-3">
          <Body muted>You are viewing an archived week.</Body>
          <View className="mt-2 flex-row">
            <SmallButton
              label="Back to the latest list"
              onPress={() => change(() => setDate(""))}
            />
          </View>
        </View>
      ) : null}

      {failed ? (
        <View className="items-center py-12">
          <Text className="text-ink mb-4 text-center text-base">
            We could not load this list just now.
          </Text>
          <Button onPress={load}>Try again</Button>
        </View>
      ) : !result ? (
        <View className="items-center py-12">
          <ActivityIndicator color={COLORS.action} />
        </View>
      ) : result.entries.length === 0 ? (
        <Panel>
          <Text className="text-ink mb-1 text-base font-semibold">
            No players match these filters.
          </Text>
          <Body>
            Try a shorter name, the registration number on its own, or clear the state filter.
          </Body>
        </Panel>
      ) : (
        <>
          <View className="rounded-tile border-hairline bg-surface overflow-hidden border">
            {result.entries.map((e, i) => {
              const move = movementText(e.rankDelta, hasBaseline);
              const top =
                listSize && listSize >= 100
                  ? Math.max(1, Math.ceil((e.rank / listSize) * 100))
                  : null;
              return (
                <TouchableOpacity
                  key={e._id}
                  activeOpacity={0.7}
                  onPress={() =>
                    router.push({
                      pathname: "/rankings/player/[regNo]",
                      params: { regNo: e.regNo },
                    })
                  }
                  accessibilityLabel={`${displayName(e.fullName)}, rank ${e.rank}`}
                  className={`min-h-[64px] flex-row items-center px-4 py-3 ${i > 0 ? "border-hairline border-t" : ""}`}
                >
                  <View className="w-14">
                    <Text className="text-ink text-lg font-bold">#{e.rank}</Text>
                    {top ? <Text className="text-muted text-xs">Top {top}%</Text> : null}
                  </View>
                  <View className="mx-2 flex-1">
                    <Text className="text-ink text-base font-semibold">
                      {displayName(e.fullName)}
                    </Text>
                    <Text className="text-muted text-xs">
                      {[
                        e.state,
                        e.birthYear ? `Born ${e.birthYear}` : null,
                        e.stateRank ? `#${e.stateRank} in state` : null,
                      ]
                        .filter(Boolean)
                        .join(", ")}
                    </Text>
                    {move ? <Text className="text-body text-xs">{move}</Text> : null}
                  </View>
                  <Text className="text-ink mr-1 text-sm font-semibold">
                    {formatPoints(e.totalPoints)}
                  </Text>
                  <ChevronRight size={16} color={COLORS.muted} />
                </TouchableOpacity>
              );
            })}
          </View>

          <Text className="text-muted mt-3 text-center text-sm">
            Page {result.pagination.page} of {result.pagination.pages}, {result.pagination.total}{" "}
            players
          </Text>
          <View className="mt-3 flex-row justify-center gap-3">
            <SmallButton
              label="Previous"
              disabled={page <= 1}
              onPress={() => setPage((p) => Math.max(1, p - 1))}
            />
            <SmallButton
              label="Next"
              disabled={page >= result.pagination.pages}
              onPress={() => setPage((p) => p + 1)}
            />
          </View>
        </>
      )}

      <Text className="text-muted mt-6 text-xs leading-relaxed">
        Rankings are published by the All India Tennis Association and mirrored here. PowerMySport
        is not affiliated with AITA.
      </Text>
    </ScrollView>
  );
}
