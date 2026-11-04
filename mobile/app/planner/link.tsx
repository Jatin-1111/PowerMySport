import React, { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ArrowLeft } from "lucide-react-native";
import { Button } from "@components/ui/Button";
import { Input } from "@components/ui/Input";
import { DobFields, EMPTY_DOB, dobToIso, type DobValue } from "@components/ui/DobFields";
import { apiCode, apiMessage, plannerApi } from "@/modules/planner/services/planner";
import { usePlannerStore } from "@/modules/planner/store/plannerStore";
import { Body, Panel } from "@/modules/planner/components/ui";
import { COLORS } from "@lib/constants";

export default function LinkRankingScreen() {
  const { childId, name } = useLocalSearchParams<{ childId: string; name: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const open = usePlannerStore((s) => s.open);

  const [regNo, setRegNo] = useState("");
  const [dob, setDob] = useState<DobValue>(EMPTY_DOB);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const back = () => (router.canGoBack() ? router.back() : router.replace("/planner"));

  const submit = async () => {
    setError("");
    if (!/^\d{4,8}$/.test(regNo.trim())) {
      setError("Enter a registration number of 4 to 8 digits.");
      return;
    }
    const iso = dobToIso(dob);
    if (!iso) {
      setError("Enter the date of birth on the federation's record.");
      return;
    }
    setBusy(true);
    try {
      await plannerApi.claim({
        dependentId: childId,
        regNo: regNo.trim(),
        dob: iso,
        sportSlug: "tennis",
      });
      await open(childId);
      back();
    } catch (err) {
      // Show the server's words as they are. It says one thing for a wrong number and a wrong date
      // alike, on purpose, so we never try to say which half was wrong.
      if (apiCode(err) === "CLAIM_LIMIT_REACHED") {
        setError("Too many attempts. Please wait an hour before trying again.");
      } else {
        setError(apiMessage(err, "Could not link this ranking. Please try again."));
      }
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

        <Text className="text-ink mb-2 text-2xl font-bold">Link {name}'s ranking</Text>
        <Text className="text-body mb-6 text-base leading-relaxed">
          Once linked, {name}'s current rank, movement and points appear on their profile, and you
          can be told when a new list is published.
        </Text>

        <Input
          label="Registration number"
          placeholder="e.g. 440090"
          value={regNo}
          onChangeText={(v) => setRegNo(v.replace(/\D/g, "").slice(0, 8))}
          keyboardType="number-pad"
          hint="The number printed next to your child's name on the federation's ranking list."
        />

        <Text className="text-ink mb-1.5 text-sm font-medium">Date of birth</Text>
        <DobFields value={dob} onChange={setDob} />
        <Text className="text-muted mb-5 mt-1.5 text-xs">
          Checked against the federation's own record, then discarded. We do not store it here.
        </Text>

        <View className="mb-5">
          <Panel>
            <Body>
              The date of birth is what proves this is your child rather than someone whose name you
              found on a public list. One account can link a given ranking, and you can unlink it at
              any time.
            </Body>
          </Panel>
        </View>

        {error ? (
          <View className="rounded-tile border-danger bg-surface mb-4 border p-3">
            <Text className="text-danger text-sm">{error}</Text>
          </View>
        ) : null}

        <Button size="lg" onPress={submit} loading={busy}>
          {busy ? "Checking..." : "Link ranking"}
        </Button>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
