import React, { useState } from "react";
import { View, Text, ScrollView, TouchableOpacity, Alert } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ArrowLeft, Lock } from "lucide-react-native";
import { Button } from "@components/ui/Button";
import { Input } from "@components/ui/Input";
import { authApi } from "@/modules/auth/services/auth";
import { forgetPushLocally } from "@/modules/push/services/push";
import { useAuthStore } from "@/modules/auth/store/authStore";
import { COLORS } from "@lib/constants";

export default function DeleteAccountScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { logout } = useAuthStore();
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const confirmDelete = async () => {
    setLoading(true);
    try {
      await authApi.deleteAccount(password);
      // The server already removed this phone; forget the token here too.
      await forgetPushLocally();
      await logout();
      Alert.alert(
        "Account scheduled for deletion",
        "Your account is deactivated and will be permanently deleted in 30 days. Sign in again before then to cancel."
      );
      router.replace("/(auth)/login");
    } catch (err: any) {
      Alert.alert("Could not delete account", err?.response?.data?.message || "Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handlePress = () => {
    Alert.alert(
      "Delete your account?",
      "You will be signed out now. This cannot be undone after 30 days.",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Delete account", style: "destructive", onPress: () => void confirmDelete() },
      ]
    );
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
        onPress={() => router.back()}
        accessibilityLabel="Go back"
        className="rounded-tile bg-surface mb-6 h-9 w-9 items-center justify-center"
      >
        <ArrowLeft size={18} color={COLORS.ink} />
      </TouchableOpacity>

      <Text className="text-ink mb-2 text-2xl font-bold">Delete account</Text>
      <Text className="text-body mb-4 text-base leading-relaxed">
        Your account is deactivated right away and permanently deleted after 30 days. Sign in again
        within 30 days to cancel.
      </Text>
      <View className="rounded-tile border-hairline bg-surface mb-6 border p-4">
        <Text className="text-ink mb-2 text-sm font-semibold">What is deleted</Text>
        <Text className="text-body text-sm leading-relaxed">
          Your children's profiles and everything attached to them, your chats, reminders and
          notifications.
        </Text>
        <Text className="text-ink mb-2 mt-4 text-sm font-semibold">What is kept</Text>
        <Text className="text-body text-sm leading-relaxed">
          Records of bookings, payments and orders are kept as the law requires for tax and
          disputes.
        </Text>
      </View>

      <Input
        label="Confirm with your password"
        placeholder="Your password"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        leftIcon={<Lock size={18} color={COLORS.muted} />}
        hint="Skip this if you signed up with Google and never set a password."
      />

      <Button variant="destructive" size="lg" onPress={handlePress} loading={loading}>
        Delete my account
      </Button>
    </ScrollView>
  );
}
