import React, { useCallback, useState } from "react";
import { View, Text, ScrollView, TouchableOpacity } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Bell, ChevronRight } from "lucide-react-native";
import { notificationsApi } from "@/modules/notifications/services/notifications";
import { useAuthStore } from "@/modules/auth/store/authStore";
import { COLORS } from "@lib/constants";

function greeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

export default function HomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuthStore();
  const [unread, setUnread] = useState<number | null>(null);

  // Refresh whenever the tab is shown, so the count is right after reading notifications.
  useFocusEffect(
    useCallback(() => {
      notificationsApi
        .unreadCount()
        .then(setUnread)
        .catch(() => setUnread(null));
    }, [])
  );

  const firstName = user?.name?.split(" ")[0];

  return (
    <ScrollView
      className="bg-canvas flex-1"
      contentContainerStyle={{
        paddingTop: insets.top + 24,
        paddingBottom: 100,
        paddingHorizontal: 20,
      }}
    >
      <Text className="text-muted text-sm">
        {greeting()}
        {firstName ? `, ${firstName}` : ""}
      </Text>
      <Text className="text-ink mb-6 mt-1 text-3xl font-bold">PowerMySport</Text>

      <TouchableOpacity
        onPress={() => router.push("/notifications")}
        activeOpacity={0.7}
        className="rounded-tile border-hairline bg-surface flex-row items-center border p-4"
      >
        <View className="rounded-tile bg-wash mr-3 h-10 w-10 items-center justify-center">
          <Bell size={18} color={COLORS.action} />
        </View>
        <View className="flex-1">
          <Text className="text-ink text-base font-semibold">Notifications</Text>
          <Text className="text-muted mt-0.5 text-sm">
            {unread === null
              ? "Open your inbox"
              : unread === 0
                ? "You are all caught up"
                : `${unread} unread`}
          </Text>
        </View>
        <ChevronRight size={18} color={COLORS.muted} />
      </TouchableOpacity>
    </ScrollView>
  );
}
