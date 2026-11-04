import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Linking,
  Alert,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ArrowLeft } from "lucide-react-native";
import { Button } from "@components/ui/Button";
import {
  opportunitiesApi,
  formatDay,
  windowLine,
  type Opportunity,
} from "@/modules/opportunities/services/opportunities";
import { COLORS } from "@lib/constants";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View className="mb-6">
      <Text className="text-ink mb-2 text-lg font-semibold">{title}</Text>
      {children}
    </View>
  );
}

function Line({ children }: { children: React.ReactNode }) {
  return <Text className="text-body mb-1.5 text-base leading-relaxed">{children}</Text>;
}

function formatMoney(value: number, currency: "INR" | "USD"): string {
  return currency === "INR"
    ? `Rs ${value.toLocaleString("en-IN")}`
    : `USD ${value.toLocaleString("en-US")}`;
}

function eligibilityLines(o: Opportunity): string[] {
  const e = o.eligibility;
  if (!e) return [];
  const lines: string[] = [];
  if (e.summary) lines.push(e.summary);
  if (e.ageMin !== undefined && e.ageMax !== undefined)
    lines.push(`Age ${e.ageMin} to ${e.ageMax}`);
  else if (e.ageMax !== undefined) lines.push(`Age up to ${e.ageMax}`);
  else if (e.ageMin !== undefined) lines.push(`Age ${e.ageMin} and over`);
  if (e.ageNote) lines.push(e.ageNote);
  if (e.gender) lines.push(`Gender: ${e.gender}`);
  if (e.level) lines.push(`Level: ${e.level}`);
  if (e.academic) lines.push(`Academic: ${e.academic}`);
  if (e.income) lines.push(`Income: ${e.income}`);
  return lines;
}

export default function OpportunityDetailScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [item, setItem] = useState<Opportunity | null>(null);
  const [today, setToday] = useState<string>("");
  const [failed, setFailed] = useState(false);
  const [following, setFollowing] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setFailed(false);
    try {
      const [detail, followed] = await Promise.all([
        opportunitiesApi.get(slug),
        opportunitiesApi.followedSlugs().catch(() => [] as string[]),
      ]);
      setItem(detail);
      setFollowing(followed.includes(slug));
      setToday(new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" }));
    } catch {
      setFailed(true);
    }
  }, [slug]);

  useEffect(() => {
    void load();
  }, [load]);

  const toggleFollow = async () => {
    setBusy(true);
    const next = !following;
    try {
      if (next) await opportunitiesApi.follow(slug);
      else await opportunitiesApi.unfollow(slug);
      setFollowing(next);
    } catch (err: any) {
      Alert.alert("Could not update", err?.response?.data?.message || "Please try again.");
    } finally {
      setBusy(false);
    }
  };

  const eligibility = item ? eligibilityLines(item) : [];

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
        onPress={() => (router.canGoBack() ? router.back() : router.replace("/opportunities"))}
        accessibilityLabel="Go back"
        className="rounded-tile bg-surface mb-6 h-9 w-9 items-center justify-center"
      >
        <ArrowLeft size={18} color={COLORS.ink} />
      </TouchableOpacity>

      {failed ? (
        <View className="items-center py-16">
          <Text className="text-ink mb-1 text-base font-semibold">Could not load this entry</Text>
          <Text className="text-muted mb-4 text-center text-sm">
            Check your connection and try again.
          </Text>
          <Button onPress={load}>Try again</Button>
        </View>
      ) : !item ? (
        <View className="items-center py-16">
          <ActivityIndicator color={COLORS.action} />
        </View>
      ) : (
        <>
          <Text className="text-ink text-3xl font-bold">{item.title}</Text>
          {item.owner?.name ? (
            <Text className="text-muted mt-1 text-base">{item.owner.name}</Text>
          ) : null}
          <Text className="text-action mb-5 mt-3 text-base font-semibold">
            {windowLine(item, today)}
          </Text>

          <View className="mb-6">
            <Button
              variant={following ? "outline" : "primary"}
              size="lg"
              loading={busy}
              onPress={toggleFollow}
            >
              {following ? "Following" : "Follow this entry"}
            </Button>
            <Text className="text-muted mt-2 text-xs">
              {following
                ? "Tap again to stop following."
                : "Follow to be told when the window opens or is about to close."}
            </Text>
          </View>

          {item.stale ? (
            <View className="rounded-tile border-hairline bg-wash mb-6 border p-4">
              <Text className="text-body text-sm leading-relaxed">
                This entry is overdue for a re-check. Confirm the details with the source before you
                rely on them.
              </Text>
            </View>
          ) : null}

          {item.summary ? (
            <Text className="text-body mb-6 text-base leading-relaxed">{item.summary}</Text>
          ) : null}

          {eligibility.length > 0 && (
            <Section title="Who it is for">
              {eligibility.map((line) => (
                <Line key={line}>{line}</Line>
              ))}
            </Section>
          )}

          {item.benefit && (
            <Section title="What you get">
              <Line>{item.benefit.summary}</Line>
              {item.benefit.amount ? (
                <Line>
                  {formatMoney(item.benefit.amount.value, item.benefit.amount.currency)} per{" "}
                  {item.benefit.amount.period}
                  {item.benefit.amount.note ? `. ${item.benefit.amount.note}` : ""}
                </Line>
              ) : null}
            </Section>
          )}

          {item.cost && (
            <Section title="Cost to apply">
              <Line>
                {item.cost.kind === "free"
                  ? "Free"
                  : item.cost.kind === "fee" && item.cost.amount !== undefined
                    ? formatMoney(item.cost.amount, item.cost.currency ?? "INR")
                    : "Varies"}
                {item.cost.note ? `. ${item.cost.note}` : ""}
              </Line>
            </Section>
          )}

          {(item.cycle?.opensOn || item.cycle?.closesOn || item.cycle?.keyDates?.length) && (
            <Section title="Key dates">
              {item.cycle?.opensOn ? <Line>Opens: {formatDay(item.cycle.opensOn)}</Line> : null}
              {item.cycle?.closesOn ? <Line>Closes: {formatDay(item.cycle.closesOn)}</Line> : null}
              {item.cycle?.keyDates?.map((k) => (
                <Line key={`${k.label}-${k.date}`}>
                  {k.label}: {formatDay(k.date)}
                </Line>
              ))}
            </Section>
          )}

          {item.steps && item.steps.length > 0 && (
            <Section title="How to apply">
              {item.steps.map((step, i) => (
                <Line key={step}>
                  {i + 1}. {step}
                </Line>
              ))}
            </Section>
          )}

          {item.keyFacts && item.keyFacts.length > 0 && (
            <Section title="Good to know">
              {item.keyFacts.map((fact) => (
                <Line key={fact}>{fact}</Line>
              ))}
            </Section>
          )}

          {item.applyUrl ? (
            <View className="mb-6">
              <Button
                variant="secondary"
                size="lg"
                onPress={() => void Linking.openURL(item.applyUrl as string)}
              >
                Go to the official page
              </Button>
            </View>
          ) : null}

          {item.sources && item.sources.length > 0 && (
            <Section title="Sources">
              {item.sources.map((s) => (
                <Text
                  key={s.url}
                  accessibilityRole="link"
                  onPress={() => void Linking.openURL(s.url)}
                  className="text-action mb-1.5 text-base underline"
                >
                  {s.label}
                </Text>
              ))}
            </Section>
          )}

          {item.lastVerifiedOn ? (
            <Text className="text-muted text-xs">
              Last checked {formatDay(item.lastVerifiedOn)}
            </Text>
          ) : null}
        </>
      )}
    </ScrollView>
  );
}
