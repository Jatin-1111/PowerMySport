import React from "react";
import { View, Text, ScrollView, TouchableOpacity, Alert } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  User,
  Settings,
  Bell,
  Heart,
  HelpCircle,
  Shield,
  LogOut,
  ChevronRight,
  CreditCard,
  Star,
  Trophy,
} from "lucide-react-native";
import { Avatar } from "@components/ui/Avatar";
import { Badge } from "@components/ui/Badge";
import { useAuthStore } from "@/modules/auth/store/authStore";
import { authApi } from "@/modules/auth/services/auth";
import { COLORS } from "@lib/constants";

interface MenuItemProps {
  icon: React.ComponentType<{ size: number; color: string }>;
  label: string;
  sublabel?: string;
  onPress: () => void;
  badge?: string;
  destructive?: boolean;
}

function MenuItem({ icon: Icon, label, sublabel, onPress, badge, destructive }: MenuItemProps) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      className="border-border flex-row items-center border-b px-4 py-4 last:border-b-0"
    >
      <View
        className={`mr-3 h-9 w-9 items-center justify-center rounded-xl ${
          destructive ? "bg-error-red/10" : "bg-gray-100"
        }`}
      >
        <Icon size={18} color={destructive ? COLORS.errorRed : COLORS.foreground} />
      </View>
      <View className="flex-1">
        <Text
          className={`text-sm font-medium ${destructive ? "text-error-red" : "text-foreground"}`}
        >
          {label}
        </Text>
        {sublabel && <Text className="text-muted mt-0.5 text-xs">{sublabel}</Text>}
      </View>
      {badge ? (
        <Badge variant="orange">{badge}</Badge>
      ) : (
        <ChevronRight size={16} color={COLORS.muted} />
      )}
    </TouchableOpacity>
  );
}

const ROLE_LABELS: Record<string, string> = {
  Parent: "Parent",
};

export default function ProfileScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, logout } = useAuthStore();

  const handleLogout = () => {
    Alert.alert("Sign out", "Are you sure you want to sign out?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Sign out",
        style: "destructive",
        onPress: async () => {
          await authApi.logout();
          await logout();
          router.replace("/(auth)/login");
        },
      },
    ]);
  };

  if (!user) {
    return (
      <View
        className="bg-background flex-1 items-center justify-center px-6"
        style={{ paddingTop: insets.top }}
      >
        <View className="mb-4 h-20 w-20 items-center justify-center rounded-full bg-gray-100">
          <User size={36} color={COLORS.muted} />
        </View>
        <Text className="text-foreground mb-2 text-lg font-bold">Not signed in</Text>
        <Text className="text-muted mb-6 text-center text-sm">Sign in to access your profile</Text>
        <TouchableOpacity
          onPress={() => router.push("/(auth)/login")}
          className="bg-power-orange rounded-xl px-6 py-3"
        >
          <Text className="font-semibold text-white">Sign In</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View className="bg-background flex-1">
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 100 }}
      >
        {/* Profile Header */}
        <View className="bg-deep-slate px-5 pb-6" style={{ paddingTop: insets.top + 16 }}>
          <View className="flex-row items-center gap-4">
            <Avatar src={user.photoUrl} name={user.name} size="xl" />
            <View className="flex-1">
              <Text className="text-xl font-bold text-white">{user.name}</Text>
              <Text className="mt-0.5 text-sm text-white/60">{user.email}</Text>
              <View className="mt-2 flex-row items-center gap-2">
                <Badge variant="orange">{ROLE_LABELS[user.role] ?? user.role}</Badge>
              </View>
            </View>
          </View>
        </View>

        {/* Preferences Section */}
        <View className="mx-4 mt-4 overflow-hidden rounded-2xl bg-white shadow-sm">
          <Text className="text-muted px-4 pb-2 pt-4 text-xs font-semibold uppercase tracking-wider">
            Preferences
          </Text>
          <MenuItem
            icon={Bell}
            label="Notifications"
            sublabel="Your inbox"
            onPress={() => router.push("/notifications")}
          />
        </View>

        {/* Logout */}
        <View className="mx-4 mb-4 mt-4 overflow-hidden rounded-2xl bg-white shadow-sm">
          <MenuItem icon={LogOut} label="Sign Out" onPress={handleLogout} destructive />
        </View>

        <Text className="text-muted mb-4 text-center text-xs">PowerMySport v1.0.0</Text>
      </ScrollView>
    </View>
  );
}
