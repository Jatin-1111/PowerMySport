import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ArrowLeft, ChevronRight } from "lucide-react-native";
import { Button } from "@components/ui/Button";
import { storage } from "@/utils/storage";
import { childrenApi, ageFromDob, type Child } from "@/modules/children/services/children";
import {
  findStageForAge,
  pathwaysApi,
  type PathwayGuideSummary,
  type QuestionsBySport,
} from "@/modules/roadmap/services/pathways";
import { Body, Panel } from "@/modules/planner/components/ui";
import { COLORS } from "@lib/constants";

const AGE_KEY = "pms_pathway_child_age";

/** One question per sport at a time, round-robin, so no single sport fills the list. */
function roundRobin(all: QuestionsBySport[], limit: number) {
  const out: Array<{ question: string; stageKey: string; sportSlug: string; sportName: string }> =
    [];
  for (let i = 0; out.length < limit; i++) {
    let added = false;
    for (const sport of all) {
      const q = sport.questions[i];
      if (q && out.length < limit) {
        out.push({ ...q, sportSlug: sport.sportSlug, sportName: sport.sportName });
        added = true;
      }
    }
    if (!added) break;
  }
  return out;
}

export default function RoadmapIndexScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [guides, setGuides] = useState<PathwayGuideSummary[] | null>(null);
  const [questions, setQuestions] = useState<QuestionsBySport[]>([]);
  const [children, setChildren] = useState<Child[]>([]);
  const [failed, setFailed] = useState(false);
  const [query, setQuery] = useState("");
  const [ageText, setAgeText] = useState("");

  const load = useCallback(async () => {
    setFailed(false);
    try {
      setGuides(await pathwaysApi.guides());
    } catch {
      setFailed(true);
    }
    pathwaysApi
      .questions()
      .then(setQuestions)
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    void load();
    // The age picks where each sport's reader opens. It comes from a child's profile, or is typed
    // once and remembered on this device.
    childrenApi
      .list()
      .then(setChildren)
      .catch(() => undefined);
    storage.get<string>(AGE_KEY).then((saved) => saved && setAgeText(saved));
  }, [load]);

  const age = /^\d{1,2}$/.test(ageText) && Number(ageText) >= 1 ? Number(ageText) : null;
  const setAge = (text: string) => {
    const clean = text.replace(/\D/g, "").slice(0, 2);
    setAgeText(clean);
    void storage.set(AGE_KEY, clean);
  };

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (guides ?? []).filter((g) => !q || g.sportName.toLowerCase().includes(q));
  }, [guides, query]);

  const back = () => (router.canGoBack() ? router.back() : router.replace("/"));
  const open = (sport: string, stage?: string) =>
    router.push({
      pathname: "/roadmap/[sport]",
      params: { sport, ...(stage ? { stage } : {}), ...(age !== null ? { age: String(age) } : {}) },
    });
  const prompts = roundRobin(questions, 9);

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

      <Text className="text-ink text-3xl font-bold">Starting a sport is easy.</Text>
      <Text className="text-ink mb-3 text-3xl font-bold">Navigating the journey is not.</Text>
      <View className="mb-6">
        <Body>
          Coaches, academies, competitions, costs, education. The answers are scattered everywhere.
          We put them in one place, stage by stage.
        </Body>
      </View>

      <Text className="text-ink mb-1.5 text-sm font-medium">How old is your child?</Text>
      {children.length > 0 ? (
        <View className="mb-2 flex-row flex-wrap gap-2">
          {children.map((c) => {
            const a = c.age ?? ageFromDob(c.dob);
            if (a === null || a === undefined) return null;
            return (
              <TouchableOpacity
                key={c._id}
                onPress={() => setAge(String(a))}
                accessibilityRole="button"
                accessibilityState={{ selected: ageText === String(a) }}
                className={`rounded-button min-h-[44px] justify-center border px-4 ${ageText === String(a) ? "border-ink bg-ink" : "border-hairline bg-surface"}`}
              >
                <Text
                  className={`text-sm font-semibold ${ageText === String(a) ? "text-white" : "text-ink"}`}
                >
                  {c.name}, {a}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      ) : null}
      <TextInput
        value={ageText}
        onChangeText={setAge}
        keyboardType="number-pad"
        placeholder="Age in years"
        placeholderTextColor={COLORS.ash}
        accessibilityLabel="Age in years"
        className="rounded-button border-hairline bg-surface text-ink mb-1 h-12 w-40 border px-3 text-base"
      />
      {age !== null ? (
        <Text className="text-muted mb-4 text-xs">
          Showing where a {age}-year-old starts in each sport.
        </Text>
      ) : (
        <View className="mb-4" />
      )}

      <TextInput
        value={query}
        onChangeText={setQuery}
        placeholder={`Search ${guides?.length ?? ""} sport${guides?.length === 1 ? "" : "s"}`}
        placeholderTextColor={COLORS.ash}
        className="rounded-button border-hairline bg-surface text-ink mb-3 h-12 border px-3 text-base"
      />

      {failed ? (
        <View className="items-center py-12">
          <Text className="text-ink mb-4 text-center text-base">
            We could not load the roadmap just now.
          </Text>
          <Button onPress={load}>Try again</Button>
        </View>
      ) : !guides ? (
        <View className="items-center py-12">
          <ActivityIndicator color={COLORS.action} />
        </View>
      ) : guides.length === 0 ? (
        <Panel>
          <Body>
            No pathways are published yet. We're building them with coaches and experienced parents,
            one sport at a time. Check back shortly.
          </Body>
        </Panel>
      ) : shown.length === 0 ? (
        <Panel>
          <Text className="text-ink mb-1 text-base font-semibold">
            No pathway for "{query.trim()}" yet
          </Text>
          <Body>We write them with coaches and experienced parents, one sport at a time.</Body>
        </Panel>
      ) : (
        <View className="rounded-tile border-hairline bg-surface overflow-hidden border">
          {shown.map((g, i) => {
            const stage = findStageForAge(g.stages, age);
            const index = stage ? g.stages.findIndex((s) => s.key === stage.key) + 1 : 0;
            return (
              <TouchableOpacity
                key={g.sportSlug}
                activeOpacity={0.7}
                onPress={() => open(g.sportSlug, stage?.key)}
                className={`min-h-[64px] flex-row items-center px-4 py-3 ${i > 0 ? "border-hairline border-t" : ""}`}
              >
                <View className="flex-1">
                  <Text className="text-ink text-base font-semibold">{g.sportName}</Text>
                  <Text className="text-muted text-sm">
                    {stage
                      ? `Stage ${index}: ${stage.name}`
                      : `${g.stageCount} stage${g.stageCount === 1 ? "" : "s"}`}
                  </Text>
                </View>
                <ChevronRight size={18} color={COLORS.muted} />
              </TouchableOpacity>
            );
          })}
        </View>
      )}

      {prompts.length > 0 ? (
        <View className="mt-8">
          <Text className="text-ink mb-1 text-lg font-semibold">
            Questions other parents already asked
          </Text>
          <View className="mb-3">
            <Body muted>
              Answered inside the pathway, at the stage they come up. Open one and you land on the
              answer.
            </Body>
          </View>
          <View className="rounded-tile border-hairline bg-surface overflow-hidden border">
            {prompts.map((p, i) => (
              <TouchableOpacity
                key={`${p.sportSlug}-${p.question}`}
                activeOpacity={0.7}
                onPress={() => open(p.sportSlug, p.stageKey)}
                className={`px-4 py-3 ${i > 0 ? "border-hairline border-t" : ""}`}
              >
                <Text className="text-ink text-sm font-semibold">{p.question}</Text>
                <Text className="text-muted mt-0.5 text-xs">{p.sportName}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      ) : null}

      <Text className="text-muted mt-6 text-xs">
        More sports are being written with coaches and experienced parents, one at a time.
      </Text>
    </ScrollView>
  );
}
