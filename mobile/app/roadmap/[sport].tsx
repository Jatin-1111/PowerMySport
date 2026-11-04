import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  Linking,
  type ScrollViewInstance,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ArrowLeft } from "lucide-react-native";
import { Button } from "@components/ui/Button";
import { Markdown } from "@components/ui/Markdown";
import { Badge, Body, Panel, SmallButton } from "@/modules/planner/components/ui";
import {
  findStageForAge,
  isAvailableAction,
  pathwaysApi,
  resolveHref,
  type PathwayGuide,
  type PathwayStage,
} from "@/modules/roadmap/services/pathways";
import { COLORS, WEB_URL } from "@lib/constants";
import { ROADMAP_HOME } from "@lib/routes";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function dateLine(guide: PathwayGuide): string | null {
  if (guide.reviewedOn) return guide.reviewedOn;
  if (!guide.updatedAt) return null;
  // Asia/Kolkata is UTC+5:30, so shift before reading the calendar day.
  const d = new Date(new Date(guide.updatedAt).getTime() + 5.5 * 3600 * 1000);
  return `Last updated ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

function Section({
  num,
  title,
  blurb,
  onLayout,
  children,
}: {
  num: string;
  title: string;
  blurb?: string;
  onLayout: (y: number) => void;
  children: React.ReactNode;
}) {
  return (
    <View className="mb-8" onLayout={(e) => onLayout(e.nativeEvent.layout.y)}>
      <Text className="text-muted text-xs font-semibold">{num}</Text>
      <Text className="text-ink mb-0.5 text-xl font-bold">{title}</Text>
      {blurb ? <Text className="text-muted mb-3 text-sm">{blurb}</Text> : <View className="mb-3" />}
      {children}
    </View>
  );
}

function openHref(href: string | undefined) {
  const url = resolveHref(href, WEB_URL);
  if (url) void Linking.openURL(url);
}

export default function RoadmapGuideScreen() {
  const {
    sport,
    stage: stageParam,
    age: ageParam,
  } = useLocalSearchParams<{ sport: string; stage?: string; age?: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const scroll = useRef<ScrollViewInstance>(null);
  const [panelY, setPanelY] = useState(0);
  const ys = useRef<Record<string, number>>({});

  const [guide, setGuide] = useState<PathwayGuide | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "missing" | "error">("loading");
  const [index, setIndex] = useState(0);
  const [sheet, setSheet] = useState(false);

  const age = ageParam && /^\d{1,2}$/.test(ageParam) ? Number(ageParam) : null;

  const load = useCallback(async () => {
    setState("loading");
    try {
      const g = await pathwaysApi.guide(sport);
      if (!g.stages?.length) {
        setState("missing");
        return;
      }
      setGuide(g);
      const byParam = g.stages.findIndex((s) => s.key === stageParam);
      const here = findStageForAge(g.stages, age);
      setIndex(byParam >= 0 ? byParam : here ? g.stages.findIndex((s) => s.key === here.key) : 0);
      setState("ready");
    } catch (err: any) {
      setState(err?.response?.status === 404 ? "missing" : "error");
    }
  }, [sport, stageParam, age]);

  useEffect(() => {
    void load();
  }, [load]);

  const back = () => (router.canGoBack() ? router.back() : router.replace(ROADMAP_HOME));
  const jump = (key: string) =>
    scroll.current?.scrollTo({ y: panelY + (ys.current[key] ?? 0) - 8, animated: true });
  const goTo = (i: number) => {
    setIndex(i);
    ys.current = {};
    scroll.current?.scrollTo({ y: 0, animated: false });
  };

  const stages = guide?.stages ?? [];
  const stage: PathwayStage | undefined = stages[index];
  const here = findStageForAge(stages, age);
  const isHere = Boolean(stage && here && here.key === stage.key);

  // Only sections that have content appear, in the order the guide is built.
  const answered = stage?.questions.filter((q) => q.answer?.trim()) ?? [];
  const sections = stage
    ? [
        { key: "overview", nav: "Overview", show: Boolean(stage.overview?.trim()) },
        { key: "questions", nav: "Your questions", show: answered.length > 0 },
        { key: "signals", nav: "What to look for", show: stage.signals.length > 0 },
        { key: "decisions", nav: "Decisions", show: stage.decisions.length > 0 },
        {
          key: "next",
          nav: "Next step",
          show: stage.nextSteps.length > 0 || Boolean(stage.primaryAction),
        },
      ].filter((s) => s.show)
    : [];
  const help = (stage?.helpLinks ?? []).filter(isAvailableAction);
  const primary =
    isAvailableAction(stage?.primaryAction) && resolveHref(stage?.primaryAction?.href, WEB_URL)
      ? stage?.primaryAction
      : undefined;

  return (
    <View className="bg-canvas flex-1">
      <ScrollView
        ref={scroll}
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

        {state === "loading" ? (
          <View className="items-center py-16">
            <ActivityIndicator color={COLORS.action} />
          </View>
        ) : state === "missing" ? (
          <Panel>
            <Text className="text-ink mb-1 text-lg font-semibold">
              This pathway is not ready yet
            </Text>
            <Body>We write them with coaches and experienced parents, one sport at a time.</Body>
            <View className="mt-3 flex-row">
              <SmallButton
                label="See the other sports"
                onPress={() => router.replace(ROADMAP_HOME)}
              />
            </View>
          </Panel>
        ) : state === "error" || !guide || !stage ? (
          <View className="items-center py-16">
            <Text className="text-ink mb-4 text-center text-base">
              We could not load this pathway just now.
            </Text>
            <Button onPress={load}>Try again</Button>
          </View>
        ) : (
          <>
            <Text className="text-muted mb-1 text-xs font-semibold">
              {guide.intro.eyebrow || `${guide.sportName} pathway, for parents`}
            </Text>
            <Text className="text-ink mb-2 text-3xl font-bold">
              {guide.intro.headline || "Understand. Question. Observe. Decide. Act."}
            </Text>
            {guide.intro.description ? (
              <View className="mb-5">
                <Body>{guide.intro.description}</Body>
              </View>
            ) : null}

            {guide.sportIntro.length > 0 ? (
              <View className="mb-6">
                <Text className="text-ink mb-2 text-lg font-semibold">About {guide.sportName}</Text>
                <Text className="text-ink mb-2 text-base leading-relaxed">
                  {guide.sportIntro[0]}
                </Text>
                {guide.sportIntro.slice(1).map((p) => (
                  <Text key={p} className="text-body mb-2 text-sm leading-relaxed">
                    {p}
                  </Text>
                ))}
              </View>
            ) : null}

            <TouchableOpacity
              onPress={() => setSheet(true)}
              accessibilityRole="button"
              accessibilityLabel="Change stage"
              className="rounded-tile border-hairline bg-surface mb-4 min-h-[52px] flex-row items-center justify-between border px-4"
            >
              <Text className="text-ink text-base font-semibold">
                Stage {index + 1} of {stages.length}
              </Text>
              <Text className="text-action text-sm font-semibold">Change</Text>
            </TouchableOpacity>

            <View onLayout={(e) => setPanelY(e.nativeEvent.layout.y)}>
              <View className="mb-1 flex-row flex-wrap items-center gap-2">
                <Badge label={`Stage ${index + 1} of ${stages.length}`} />
                {isHere ? <Badge label="Your child is here" tone="action" /> : null}
              </View>
              <Text className="text-ink mt-2 text-2xl font-bold">{stage.name}</Text>
              <Text className="text-body mt-1 text-base">{stage.coreQuestion}</Text>
              <Text className="text-muted mb-1 mt-2 text-sm">Typical age: {stage.ageRange}</Text>
              {age !== null && !here ? (
                <Text className="text-muted text-sm">No stage covers age {age} yet.</Text>
              ) : null}

              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                className="my-4"
                contentContainerStyle={{ gap: 8 }}
              >
                {sections.map((s) => (
                  <TouchableOpacity
                    key={s.key}
                    onPress={() => jump(s.key)}
                    accessibilityRole="button"
                    className="rounded-button border-hairline bg-surface min-h-[40px] justify-center border px-3"
                  >
                    <Text className="text-ink text-sm font-medium">{s.nav}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              {stage.overview?.trim() ? (
                <Section
                  num="01"
                  title="Where you are"
                  blurb="What this stage means and what matters in it."
                  onLayout={(y) => (ys.current.overview = y)}
                >
                  <Markdown variant="overview">{stage.overview}</Markdown>
                </Section>
              ) : null}

              {answered.length > 0 ? (
                <Section
                  num="02"
                  title="What parents usually ask here"
                  blurb="The answers parents ask for most at this stage."
                  onLayout={(y) => (ys.current.questions = y)}
                >
                  {answered.map((q) => (
                    <View
                      key={q.question}
                      className="rounded-tile border-hairline bg-surface mb-3 border p-4"
                    >
                      <Text className="text-ink mb-2 text-base font-bold">{q.question}</Text>
                      <Markdown>{q.answer}</Markdown>
                    </View>
                  ))}
                </Section>
              ) : null}

              {stage.signals.length > 0 ? (
                <Section
                  num="03"
                  title="What to look for"
                  blurb="In your child, the coach and the environment."
                  onLayout={(y) => (ys.current.signals = y)}
                >
                  {stage.signals.map((s, i) => (
                    <View key={s.title} className="mb-3 flex-row">
                      <Text className="text-muted mr-3 w-6 text-sm font-semibold">
                        {String(i + 1).padStart(2, "0")}
                      </Text>
                      <View className="flex-1">
                        <Text className="text-ink text-base font-bold">{s.title}</Text>
                        <Markdown>{s.detail}</Markdown>
                      </View>
                    </View>
                  ))}
                </Section>
              ) : null}

              {stage.decisions.length > 0 ? (
                <Section
                  num="04"
                  title="Decisions"
                  blurb="Choices this stage may put in front of you."
                  onLayout={(y) => (ys.current.decisions = y)}
                >
                  {stage.decisions.map((d) => (
                    <View key={d.title} className="mb-3">
                      <Text className="text-ink text-base font-bold">{d.title}</Text>
                      <Markdown>{d.detail}</Markdown>
                    </View>
                  ))}
                  {help.length > 0 ? (
                    <Panel>
                      <Text className="text-ink mb-2 text-sm font-semibold">
                        Get help with this
                      </Text>
                      <View className="flex-row flex-wrap gap-2">
                        {help.map((h) =>
                          resolveHref(h.href, WEB_URL) ? (
                            <SmallButton
                              key={h.label}
                              label={h.label}
                              onPress={() => openHref(h.href)}
                            />
                          ) : (
                            <Badge key={h.label} label={h.label} />
                          )
                        )}
                      </View>
                    </Panel>
                  ) : null}
                </Section>
              ) : null}

              {stage.nextSteps.length > 0 || primary ? (
                <Section
                  num="05"
                  title="What should I actually do now?"
                  onLayout={(y) => (ys.current.next = y)}
                >
                  <Text className="text-body mb-3 text-base">
                    {stage.nextStepLead || "Pick the line that describes where you are today."}
                  </Text>
                  {stage.nextSteps.map((n, i) => (
                    <View key={`${n.when}-${i}`} className="mb-3 flex-row items-start">
                      <View className="mr-3 mt-0.5">
                        <Badge label={n.when} />
                      </View>
                      <Text className="text-body flex-1 text-sm leading-relaxed">{n.action}</Text>
                    </View>
                  ))}
                  {primary ? (
                    <View className="mt-1 flex-row">
                      <SmallButton
                        label={primary.label}
                        variant="solid"
                        onPress={() => openHref(primary.href)}
                      />
                    </View>
                  ) : null}
                </Section>
              ) : null}
            </View>

            <View className="mb-6 flex-row items-center justify-between">
              <SmallButton
                label="Previous"
                disabled={index === 0}
                onPress={() => goTo(index - 1)}
              />
              <Text className="text-muted text-sm">
                {index + 1} / {stages.length}
              </Text>
              <SmallButton
                label={index < stages.length - 1 ? `Next: ${stages[index + 1].name}` : "Next"}
                disabled={index >= stages.length - 1}
                onPress={() => goTo(index + 1)}
              />
            </View>

            {guide.contributor ? (
              <Panel>
                <Text className="text-muted text-xs">{guide.sportName} pathway contributed by</Text>
                <Text className="text-ink mt-1 text-base font-semibold">
                  {guide.contributor.name}
                </Text>
                {guide.contributor.organisation ? (
                  <Text
                    className={`text-sm ${guide.contributor.url ? "text-action underline" : "text-body"}`}
                    onPress={
                      guide.contributor.url
                        ? () => void Linking.openURL(guide.contributor!.url as string)
                        : undefined
                    }
                  >
                    {guide.contributor.organisation}
                  </Text>
                ) : null}
                {guide.contributor.blurb ? (
                  <Text className="text-body mt-1 text-sm">{guide.contributor.blurb}</Text>
                ) : null}
                {guide.contributor.profile ? (
                  <View className="mt-3">
                    <Badge label="Verified on PowerMySport" tone="success" />
                    <View className="mt-2 flex-row">
                      <SmallButton
                        label={guide.contributor.profile.ctaLabel}
                        onPress={() => openHref(guide.contributor!.profile!.href)}
                      />
                    </View>
                  </View>
                ) : null}
              </Panel>
            ) : null}

            {dateLine(guide) ? (
              <Text className="text-muted mt-4 text-xs">{dateLine(guide)}</Text>
            ) : null}
          </>
        )}
      </ScrollView>

      <Modal
        visible={sheet}
        transparent
        animationType="slide"
        onRequestClose={() => setSheet(false)}
      >
        <View className="flex-1 justify-end bg-black/40">
          <View className="rounded-t-panel bg-canvas max-h-[75%] p-5 pb-8">
            <Text className="text-ink mb-3 text-lg font-bold">{stages.length} stages</Text>
            <ScrollView>
              {stages.map((s, i) => (
                <TouchableOpacity
                  key={s.key}
                  onPress={() => {
                    goTo(i);
                    setSheet(false);
                  }}
                  accessibilityRole="button"
                  accessibilityState={{ selected: i === index }}
                  className={`rounded-tile mb-2 min-h-[56px] justify-center border px-4 py-2 ${i === index ? "border-ink bg-surface" : "border-hairline bg-surface"}`}
                >
                  <View className="flex-row items-center justify-between">
                    <Text className="text-ink mr-2 flex-1 text-base font-semibold">
                      {i + 1}. {s.name}
                    </Text>
                    {here && here.key === s.key ? (
                      <Badge label="You are here" tone="action" />
                    ) : null}
                  </View>
                  <Text className="text-muted text-sm">{s.ageRange}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <View className="mt-2">
              <SmallButton label="Close" onPress={() => setSheet(false)} />
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}
