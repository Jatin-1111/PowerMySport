import React, { useState } from "react";
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
import { Mail, Lock, User, Phone } from "lucide-react-native";
import { Button } from "@components/ui/Button";
import { Input } from "@components/ui/Input";
import { Checkbox } from "@components/ui/Checkbox";
import { authApi } from "@/modules/auth/services/auth";
import { useAuthStore } from "@/modules/auth/store/authStore";
import { COLORS, WEB_URL } from "@lib/constants";

function LegalLink({ label, path }: { label: string; path: string }) {
  return (
    <Text
      className="text-action font-semibold"
      accessibilityRole="link"
      onPress={() => void Linking.openURL(`${WEB_URL}${path}`)}
    >
      {label}
    </Text>
  );
}

export default function RegisterScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { setUser, setToken } = useAuthStore();

  const [form, setForm] = useState({ name: "", email: "", phone: "", password: "" });
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [acceptedPrivacy, setAcceptedPrivacy] = useState(false);
  const [whatsappConsent, setWhatsappConsent] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  const update = (key: keyof typeof form, value: string) => {
    setForm((f) => ({ ...f, [key]: value }));
    if (errors[key]) setErrors((e) => ({ ...e, [key]: "" }));
  };

  const validate = () => {
    const e: Record<string, string> = {};
    if (form.name.trim().length < 2) e.name = "Enter your full name";
    if (!form.email.trim()) e.email = "Email is required";
    else if (!/\S+@\S+\.\S+/.test(form.email)) e.email = "Enter a valid email";
    if (!form.phone.trim()) e.phone = "Phone number is required";
    if (!form.password) e.password = "Password is required";
    else if (form.password.length < 8) e.password = "Password must be at least 8 characters";
    if (!acceptedTerms) e.acceptedTerms = "You need to agree to the Terms of Service";
    if (!acceptedPrivacy) e.acceptedPrivacy = "You need to agree to the Privacy Policy";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleRegister = async () => {
    if (!validate()) return;
    setLoading(true);
    try {
      const res = await authApi.register({
        name: form.name.trim(),
        email: form.email.trim(),
        phone: form.phone.trim(),
        password: form.password,
        role: "Parent",
        acceptedTerms,
        acceptedPrivacy,
        whatsappConsent,
      });
      if (res.success && res.data) {
        setToken(res.data.token);
        setUser(res.data.user);
      } else {
        Alert.alert("Registration failed", res.message || "Unable to create account");
      }
    } catch (err: any) {
      Alert.alert("Registration failed", err?.response?.data?.message || "Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={{ flex: 1 }}
    >
      <ScrollView
        className="bg-canvas flex-1"
        contentContainerStyle={{ paddingTop: insets.top + 24, paddingBottom: insets.bottom + 40 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View className="px-6">
          <Text className="text-ink mb-1 text-2xl font-bold">Create your account</Text>
          <Text className="text-muted mb-8">For parents guiding a young athlete</Text>

          <Input
            label="Full name"
            placeholder="Your name"
            value={form.name}
            onChangeText={(v) => update("name", v)}
            autoComplete="name"
            autoCapitalize="words"
            error={errors.name}
            leftIcon={<User size={18} color={COLORS.muted} />}
          />
          <Input
            label="Email"
            placeholder="you@example.com"
            value={form.email}
            onChangeText={(v) => update("email", v)}
            keyboardType="email-address"
            autoComplete="email"
            error={errors.email}
            leftIcon={<Mail size={18} color={COLORS.muted} />}
          />
          <Input
            label="Phone"
            placeholder="98765 43210"
            value={form.phone}
            onChangeText={(v) => update("phone", v)}
            keyboardType="phone-pad"
            autoComplete="tel"
            error={errors.phone}
            leftIcon={<Phone size={18} color={COLORS.muted} />}
          />
          <Input
            label="Password"
            placeholder="At least 8 characters"
            value={form.password}
            onChangeText={(v) => update("password", v)}
            secureTextEntry
            error={errors.password}
            leftIcon={<Lock size={18} color={COLORS.muted} />}
          />

          <View className="rounded-tile border-hairline bg-surface mb-2 mt-2 border p-4">
            <Checkbox
              checked={acceptedTerms}
              onChange={(v) => {
                setAcceptedTerms(v);
                if (v) setErrors((e) => ({ ...e, acceptedTerms: "" }));
              }}
              error={errors.acceptedTerms}
            >
              <Text className="text-body text-sm">
                I agree to the <LegalLink label="Terms of Service" path="/terms" />
              </Text>
            </Checkbox>
            <Checkbox
              checked={acceptedPrivacy}
              onChange={(v) => {
                setAcceptedPrivacy(v);
                if (v) setErrors((e) => ({ ...e, acceptedPrivacy: "" }));
              }}
              error={errors.acceptedPrivacy}
            >
              <Text className="text-body text-sm">
                I agree to the <LegalLink label="Privacy Policy" path="/privacy" />
              </Text>
            </Checkbox>
            <Checkbox checked={whatsappConsent} onChange={setWhatsappConsent}>
              <Text className="text-body text-sm">
                Send me updates on WhatsApp.{" "}
                <Text className="text-muted">
                  Optional. We use your phone number for this, and you can turn it off any time in
                  Settings or by replying STOP.
                </Text>
              </Text>
            </Checkbox>
          </View>

          <View className="mt-4">
            <Button onPress={handleRegister} loading={loading} size="lg">
              Create account
            </Button>
          </View>

          <View className="mt-6 flex-row items-center justify-center">
            <Text className="text-muted">Already have an account? </Text>
            <TouchableOpacity onPress={() => router.push("/(auth)/login")}>
              <Text className="text-action font-semibold">Sign in</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
