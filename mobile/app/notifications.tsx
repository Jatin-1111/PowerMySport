import React, { useCallback, useEffect, useState } from "react";
import { View, Text, FlatList, TouchableOpacity, ActivityIndicator } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { ArrowLeft, Bell, CheckCheck } from "lucide-react-native";
import {
  notificationsApi,
  type AppNotification,
} from "@/modules/notifications/services/notifications";
import { COLORS } from "@lib/constants";

function timeAgo(iso: string): string {
  const minutes = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hr ago`;
  const days = Math.round(hours / 24);
  return days === 1 ? "Yesterday" : `${days} days ago`;
}

function NotificationItem({
  notification,
  onPress,
}: {
  notification: AppNotification;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      className={`border-hairline flex-row gap-3 border-b px-5 py-4 ${
        notification.isRead ? "bg-canvas" : "bg-wash"
      }`}
    >
      <View className="rounded-tile bg-surface mt-0.5 h-10 w-10 shrink-0 items-center justify-center">
        <Bell size={18} color={COLORS.action} />
      </View>
      <View className="flex-1">
        <View className="flex-row items-center justify-between">
          <Text className="text-ink mr-2 flex-1 text-sm font-semibold" numberOfLines={1}>
            {notification.title}
          </Text>
          <Text className="text-muted text-xs">{timeAgo(notification.createdAt)}</Text>
        </View>
        <Text className="text-body mt-1 text-sm leading-relaxed" numberOfLines={3}>
          {notification.message}
        </Text>
      </View>
      {!notification.isRead && <View className="bg-action mt-2 h-2 w-2 shrink-0 rounded-full" />}
    </TouchableOpacity>
  );
}

export default function NotificationsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setFailed(false);
    try {
      const res = await notificationsApi.list();
      setNotifications(res.data);
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  const markAllRead = async () => {
    const before = notifications;
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    try {
      await notificationsApi.markAllRead();
    } catch {
      setNotifications(before);
    }
  };

  const markRead = async (id: string) => {
    const before = notifications;
    setNotifications((prev) => prev.map((n) => (n._id === id ? { ...n, isRead: true } : n)));
    try {
      await notificationsApi.markRead(id);
    } catch {
      setNotifications(before);
    }
  };

  return (
    <View className="bg-canvas flex-1">
      <View
        className="border-hairline bg-canvas border-b px-5 pb-4"
        style={{ paddingTop: insets.top + 12 }}
      >
        <View className="flex-row items-center justify-between">
          <View className="flex-row items-center gap-3">
            <TouchableOpacity
              onPress={() => router.back()}
              accessibilityLabel="Go back"
              className="rounded-tile bg-surface h-9 w-9 items-center justify-center"
            >
              <ArrowLeft size={18} color={COLORS.ink} />
            </TouchableOpacity>
            <View>
              <Text className="text-ink text-xl font-bold">Notifications</Text>
              {unreadCount > 0 && <Text className="text-muted text-xs">{unreadCount} unread</Text>}
            </View>
          </View>
          {unreadCount > 0 && (
            <TouchableOpacity onPress={markAllRead} className="flex-row items-center gap-1.5">
              <CheckCheck size={16} color={COLORS.action} />
              <Text className="text-action text-sm font-medium">Mark all read</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color={COLORS.action} />
        </View>
      ) : failed ? (
        <View className="flex-1 items-center justify-center px-8">
          <Text className="text-ink mb-1 text-base font-semibold">
            Could not load notifications
          </Text>
          <Text className="text-muted mb-4 text-center text-sm">
            Check your connection and try again.
          </Text>
          <TouchableOpacity onPress={load} className="rounded-button bg-action px-5 py-3">
            <Text className="font-semibold text-white">Try again</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={notifications}
          keyExtractor={(item) => item._id}
          renderItem={({ item }) => (
            <NotificationItem notification={item} onPress={() => markRead(item._id)} />
          )}
          ListEmptyComponent={
            <View className="items-center px-8 py-20">
              <Text className="text-ink mb-1 text-base font-semibold">Nothing new</Text>
              <Text className="text-muted text-center text-sm">
                Reminders and updates about your child will show up here.
              </Text>
            </View>
          }
        />
      )}
    </View>
  );
}
