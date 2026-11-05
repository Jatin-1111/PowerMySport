import React, { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Mail, Lock, Zap } from "lucide-react-native";
import { Button } from "@components/ui/Button";
import { GoogleButton } from "@/modules/auth/components/GoogleButton";
import { googleAvailable } from "@/modules/auth/services/google";
import { Input } from "@components/ui/Input";
import { authApi } from "@/modules/auth/services/auth";
import { useAuthStore } from "@/modules/auth/store/authStore";
import { COLORS } from "@lib/constants";

export default function LoginScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { setUser, setToken } = useAuthStore();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  const validate = () => {
    const newErrors: Record<string, string> = {};
    if (!email.trim()) newErrors.email = "Email is required";
    else if (!/\S+@\S+\.\S+/.test(email)) newErrors.email = "Enter a valid email";
    if (!password) newErrors.password = "Password is required";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleLogin = async () => {
    if (!validate()) return;
    setLoading(true);
    try {
      const res = await authApi.login({ email: email.trim(), password });
      if (res.success && res.data) {
        setToken(res.data.token);
        setUser(res.data.user);
        if (res.data.deletionCancelled) {
          Alert.alert("Welcome back", "Your account deletion has been cancelled.");
        }
      } else {
        Alert.alert("Login Failed", res.message || "Invalid credentials");
      }
    } catch (err: any) {
      Alert.alert("Error", err?.response?.data?.message || "Login failed. Please try again.");
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
        className="bg-background flex-1"
        contentContainerStyle={{ paddingTop: insets.top + 24, paddingBottom: insets.bottom + 40 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View className="px-6">
          {/* Logo */}
          <View className="mb-10 items-center">
            <View className="bg-deep-slate mb-4 h-16 w-16 items-center justify-center rounded-2xl">
              <Zap size={32} color={COLORS.powerOrange} fill={COLORS.powerOrange} />
            </View>
            <Text className="text-deep-slate text-3xl font-bold">PowerMySport</Text>
            <Text className="text-muted mt-1 text-base">India's Sports Platform</Text>
          </View>

          {/* Heading */}
          <Text className="text-foreground mb-1 text-2xl font-bold">Welcome back</Text>
          <Text className="text-muted mb-8">Sign in to your account</Text>

          {/* Form */}
          <Input
            label="Email"
            placeholder="you@example.com"
            value={email}
            onChangeText={(v) => {
              setEmail(v);
              if (errors.email) setErrors((e) => ({ ...e, email: "" }));
            }}
            keyboardType="email-address"
            autoComplete="email"
            error={errors.email}
            leftIcon={<Mail size={18} color={COLORS.muted} />}
          />

          <Input
            label="Password"
            placeholder="••••••••"
            value={password}
            onChangeText={(v) => {
              setPassword(v);
              if (errors.password) setErrors((e) => ({ ...e, password: "" }));
            }}
            secureTextEntry
            autoComplete="password"
            error={errors.password}
            leftIcon={<Lock size={18} color={COLORS.muted} />}
          />

          <TouchableOpacity
            className="-mt-2 mb-6 self-end"
            onPress={() => router.push("/(auth)/forgot-password")}
          >
            <Text className="text-power-orange text-sm font-medium">Forgot password?</Text>
          </TouchableOpacity>

          <Button onPress={handleLogin} loading={loading} size="lg">
            Sign In
          </Button>

          {googleAvailable() ? (
            <>
              <View className="my-6 flex-row items-center">
                <View className="bg-hairline h-px flex-1" />
                <Text className="text-muted mx-4 text-sm">or</Text>
                <View className="bg-hairline h-px flex-1" />
              </View>
              <GoogleButton mode="login" />
            </>
          ) : null}

          {/* Register link */}
          <View className="mt-8 flex-row items-center justify-center">
            <Text className="text-muted">Don't have an account? </Text>
            <TouchableOpacity onPress={() => router.push("/(auth)/register")}>
              <Text className="text-power-orange font-semibold">Sign up</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
