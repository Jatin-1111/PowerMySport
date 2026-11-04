import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Switch,
  Linking,
  ActivityIndicator,
  Alert,
} from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ArrowLeft } from "lucide-react-native";
import { Button } from "@components/ui/Button";
import apiClient from "@lib/api/axios";
import { useAuthStore } from "@/modules/auth/store/authStore";
import { Body, Panel, SmallButton } from "@/modules/planner/components/ui";
import { apiMessage } from "@/modules/planner/services/planner";
import {
  disablePush,
  enablePush,
  isPushOn,
  pushPermission,
  pushSupport,
  type PushPermission,
} from "@/modules/push/services/push";
import { COLORS } from "@lib/constants";

// The server decides push per kind of message. Two kinds share a key (the server files opportunity
// follow alerts under the reminders key), so the labels say what each one really covers.
const KINDS: Array<{ key: string; label: string; hint: string }> = [
  {
    key: "rankingUpdates",
    label: "Ranking updates",
    hint: "When a new list is published for a child whose ranking you linked.",
  },
  {
    key: "bookingReminders",
    label: "Reminders and opportunity alerts",
    hint: "Entries you follow opening or closing, and plan reminders.",
  },
  {
    key: "admin",
    label: "Account and service notices",
    hint: "Important messages about your account.",
  },
  { key: "marketing", label: "News and offers", hint: "Off unless you turn it on." },
];

export default function NotificationSettingsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const userId = useAuthStore((s) => s.user?.id);

  const [on, setOn] = useState<boolean | null>(null);
  const [permission, setPermission] = useState<PushPermission>("undetermined");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [prefs, setPrefs] = useState<Record<string, boolean> | null>(null);
  const [prefsFailed, setPrefsFailed] = useState(false);

  const support = pushSupport();

  const refresh = useCallback(async () => {
    setPermission(await pushPermission());
    setOn(userId ? await isPushOn(userId) : false);
  }, [userId]);

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh])
  );

  const loadPrefs = useCallback(async () => {
    setPrefsFailed(false);
    try {
      const res = await apiClient.get("/notifications/preferences");
      setPrefs((res.data.data?.push ?? {}) as Record<string, boolean>);
    } catch {
      setPrefsFailed(true);
    }
  }, []);

  useEffect(() => {
    void loadPrefs();
  }, [loadPrefs]);

  const turnOn = async () => {
    if (!userId) return;
    setBusy(true);
    setError("");
    const result = await enablePush(userId);
    if (!result.ok) setError(result.message);
    await refresh();
    setBusy(false);
  };

  const turnOff = async () => {
    setBusy(true);
    await disablePush(false);
    await refresh();
    setBusy(false);
  };

  const toggle = async (key: string, value: boolean) => {
    const before = prefs;
    setPrefs({ ...(prefs ?? {}), [key]: value });
    try {
      await apiClient.patch("/notifications/preferences", { push: { [key]: value } });
    } catch (err) {
      setPrefs(before);
      Alert.alert("Could not save", apiMessage(err, "Please try again."));
    }
  };

  const back = () => (router.canGoBack() ? router.back() : router.replace("/profile"));

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

      <Text className="text-ink mb-1 text-3xl font-bold">Notifications</Text>
      <Text className="text-muted mb-6 text-sm">Choose what reaches this phone.</Text>

      <Text className="text-ink mb-2 text-lg font-semibold">On this phone</Text>
      <Panel>
        {support === "expo-go" || support === "not-a-phone" || support === "web" ? (
          <Body>
            Push notifications need the full PowerMySport app on a phone. They do not work in Expo
            Go, on an emulator or in a browser. Your notifications are still in the inbox.
          </Body>
        ) : on === null ? (
          <ActivityIndicator color={COLORS.action} />
        ) : on ? (
          <>
            <Text className="text-ink mb-1 text-base font-semibold">Notifications are on</Text>
            <Body>This phone will get the kinds of message you leave switched on below.</Body>
            <View className="mt-3 flex-row">
              <SmallButton
                label="Turn off on this phone"
                variant="danger"
                busy={busy}
                onPress={turnOff}
              />
            </View>
          </>
        ) : permission === "denied" ? (
          <>
            <Text className="text-ink mb-1 text-base font-semibold">
              Blocked in your phone's settings
            </Text>
            <Body>
              Notifications are turned off for PowerMySport. Allow them in your phone's settings,
              then come back here.
            </Body>
            <View className="mt-3 flex-row">
              <SmallButton
                label="Open phone settings"
                onPress={() => void Linking.openSettings()}
              />
            </View>
          </>
        ) : (
          <>
            <Text className="text-ink mb-1 text-base font-semibold">Get updates on this phone</Text>
            <Body>
              We will tell you when a ranking list is published for your child and when an entry you
              follow is opening or closing. You can turn this off at any time.
            </Body>
            <View className="mt-3">
              <Button onPress={turnOn} loading={busy}>
                Turn on notifications
              </Button>
            </View>
          </>
        )}
        {error ? <Text className="text-danger mt-3 text-sm">{error}</Text> : null}
      </Panel>

      <Text className="text-ink mb-2 mt-8 text-lg font-semibold">What to send</Text>
      {prefsFailed ? (
        <Panel>
          <Body>We could not load your choices just now.</Body>
          <View className="mt-3 flex-row">
            <SmallButton label="Try again" onPress={loadPrefs} />
          </View>
        </Panel>
      ) : !prefs ? (
        <ActivityIndicator color={COLORS.action} />
      ) : (
        <View className="rounded-tile border-hairline bg-surface overflow-hidden border">
          {KINDS.map((k, i) => (
            <View
              key={k.key}
              className={`flex-row items-center px-4 py-4 ${i > 0 ? "border-hairline border-t" : ""}`}
            >
              <View className="mr-3 flex-1">
                <Text className="text-ink text-base font-semibold">{k.label}</Text>
                <Text className="text-muted mt-0.5 text-sm">{k.hint}</Text>
              </View>
              <Switch
                value={
                  prefs[k.key] !== false && !(k.key === "marketing" && prefs[k.key] === undefined)
                }
                onValueChange={(v) => void toggle(k.key, v)}
                trackColor={{ true: COLORS.action, false: COLORS.hairline }}
                accessibilityLabel={k.label}
              />
            </View>
          ))}
        </View>
      )}
      <Text className="text-muted mt-3 text-xs leading-relaxed">
        These choices apply to push notifications. Email and in-app settings are unchanged.
      </Text>
    </ScrollView>
  );
}
