import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  Alert,
  Linking,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ArrowLeft } from "lucide-react-native";
import { CHILD_GENDERS, type ChildGender } from "@powermysport/shared-types";
import { Button } from "@components/ui/Button";
import { Input } from "@components/ui/Input";
import { Checkbox } from "@components/ui/Checkbox";
import { DobFields, EMPTY_DOB, dobToIso, type DobValue } from "@components/ui/DobFields";
import { childrenApi, RELATIONS, ageFromDob } from "@/modules/children/services/children";
import { COLORS, WEB_URL } from "@lib/constants";

const GENDER_LABELS: Record<ChildGender, string> = { MALE: "Boy", FEMALE: "Girl", OTHER: "Other" };

function Chip({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      className={`rounded-button border px-4 py-2.5 ${
        selected ? "border-ink bg-ink" : "border-hairline bg-surface"
      }`}
    >
      <Text className={`text-sm font-medium ${selected ? "text-white" : "text-ink"}`}>{label}</Text>
    </TouchableOpacity>
  );
}

export default function AddChildScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [name, setName] = useState("");
  const [dob, setDob] = useState<DobValue>(EMPTY_DOB);
  const [gender, setGender] = useState<ChildGender | undefined>();
  const [relation, setRelation] = useState("CHILD");
  const [consentNeeded, setConsentNeeded] = useState(false);
  const [consent, setConsent] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  // The parent agrees to the Parental Consent policy once; after that the box is not shown again.
  // If this check fails we ask for consent anyway, rather than skipping a legal step.
  useEffect(() => {
    childrenApi
      .hasCurrentConsent()
      .then((current) => setConsentNeeded(!current))
      .catch(() => setConsentNeeded(true));
  }, []);

  const validate = (): string | null => {
    const e: Record<string, string> = {};
    if (!name.trim()) e.name = "Enter your child's name";
    const iso = dobToIso(dob);
    if (!iso) e.dob = "Enter a valid date of birth";
    else {
      const age = ageFromDob(iso);
      if (age === null || age < 0) e.dob = "Date of birth cannot be in the future";
      else if (age >= 18) e.dob = "A child profile is for someone under 18";
    }
    if (consentNeeded && !consent) e.consent = "You need to agree to continue";
    setErrors(e);
    return Object.keys(e).length === 0 ? iso : null;
  };

  const handleSave = async () => {
    const iso = validate();
    if (!iso) return;
    setSaving(true);
    try {
      await childrenApi.add({
        name: name.trim(),
        dob: iso,
        gender,
        relation,
        ...(consentNeeded ? { parentalConsent: true } : {}),
      });
      if (router.canGoBack()) router.back();
      else router.replace("/children");
    } catch (err: any) {
      Alert.alert("Could not add child", err?.response?.data?.message || "Please try again.");
    } finally {
      setSaving(false);
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
          onPress={() => router.back()}
          accessibilityLabel="Go back"
          className="rounded-tile bg-surface mb-6 h-9 w-9 items-center justify-center"
        >
          <ArrowLeft size={18} color={COLORS.ink} />
        </TouchableOpacity>

        <Text className="text-ink mb-1 text-2xl font-bold">Add a child</Text>
        <Text className="text-muted mb-6">You can add more detail later.</Text>

        <Input
          label="Name"
          placeholder="e.g. Riya Sharma"
          value={name}
          onChangeText={(v) => {
            setName(v);
            if (errors.name) setErrors((e) => ({ ...e, name: "" }));
          }}
          autoCapitalize="words"
          error={errors.name}
        />

        <Text className="text-ink mb-1.5 text-sm font-medium">Date of birth</Text>
        <View className="mb-1">
          <DobFields value={dob} onChange={setDob} />
        </View>
        {errors.dob ? (
          <Text className="text-danger mb-3 text-xs">{errors.dob}</Text>
        ) : (
          <View className="mb-4" />
        )}

        <Text className="text-ink mb-2 text-sm font-medium">Gender</Text>
        <View className="mb-5 flex-row flex-wrap gap-2">
          {CHILD_GENDERS.map((g) => (
            <Chip
              key={g}
              label={GENDER_LABELS[g]}
              selected={gender === g}
              onPress={() => setGender(gender === g ? undefined : g)}
            />
          ))}
        </View>

        <Text className="text-ink mb-2 text-sm font-medium">Your relation</Text>
        <View className="mb-6 flex-row flex-wrap gap-2">
          {RELATIONS.map((r) => (
            <Chip
              key={r.value}
              label={r.label}
              selected={relation === r.value}
              onPress={() => setRelation(r.value)}
            />
          ))}
        </View>

        {consentNeeded && (
          <View className="rounded-tile border-hairline bg-surface mb-6 border p-4">
            <Checkbox
              checked={consent}
              onChange={(v) => {
                setConsent(v);
                if (v) setErrors((e) => ({ ...e, consent: "" }));
              }}
              error={errors.consent}
            >
              <Text className="text-body text-sm">
                I am this child's parent or legal guardian, and I agree to the{" "}
                <Text
                  className="text-action font-semibold"
                  accessibilityRole="link"
                  onPress={() => void Linking.openURL(`${WEB_URL}/parental-consent`)}
                >
                  Parental Consent policy
                </Text>
                .
              </Text>
            </Checkbox>
          </View>
        )}

        <Button size="lg" onPress={handleSave} loading={saving}>
          Add child
        </Button>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
