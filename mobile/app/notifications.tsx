import React, { useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ArrowLeft, Bell, CheckCheck } from 'lucide-react-native';
import { COLORS } from '@lib/constants';

interface Notification {
  id: string;
  title: string;
  message: string;
  time: string;
  read: boolean;
  type: 'booking' | 'system' | 'reminder';
}

const MOCK_NOTIFICATIONS: Notification[] = [
  {
    id: '1',
    title: 'Booking Confirmed',
    message: 'Your session with Coach Rahul on Dec 25 at 9:00 AM is confirmed.',
    time: '2 hrs ago',
    read: false,
    type: 'booking',
  },
  {
    id: '2',
    title: 'Session Reminder',
    message: 'You have a cricket coaching session tomorrow at 7:00 AM.',
    time: '5 hrs ago',
    read: false,
    type: 'reminder',
  },
  {
    id: '3',
    title: 'Welcome to PowerMySport!',
    message: 'Discover coaches and venues near you and start your sports journey today.',
    time: '1 day ago',
    read: true,
    type: 'system',
  },
];

const TYPE_COLORS: Record<string, string> = {
  booking: COLORS.turfGreen,
  system: COLORS.powerOrange,
  reminder: '#3B82F6',
};

function NotificationItem({
  notification,
  onPress,
}: {
  notification: Notification;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      className={`flex-row gap-3 px-5 py-4 border-b border-border ${
        !notification.read ? 'bg-power-orange/5' : 'bg-white'
      }`}
    >
      <View
        className="w-10 h-10 rounded-full items-center justify-center shrink-0 mt-0.5"
        style={{ backgroundColor: `${TYPE_COLORS[notification.type]}20` }}
      >
        <Bell size={18} color={TYPE_COLORS[notification.type]} />
      </View>
      <View className="flex-1">
        <View className="flex-row items-center justify-between">
          <Text className="text-sm font-semibold text-foreground flex-1 mr-2" numberOfLines={1}>
            {notification.title}
          </Text>
          <Text className="text-xs text-muted">{notification.time}</Text>
        </View>
        <Text className="text-sm text-muted mt-1 leading-relaxed" numberOfLines={2}>
          {notification.message}
        </Text>
      </View>
      {!notification.read && (
        <View className="w-2 h-2 rounded-full bg-power-orange mt-2 shrink-0" />
      )}
    </TouchableOpacity>
  );
}

export default function NotificationsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [notifications, setNotifications] = useState(MOCK_NOTIFICATIONS);

  const unreadCount = notifications.filter((n) => !n.read).length;

  const markAllRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  const markRead = (id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n)),
    );
  };

  return (
    <View className="flex-1 bg-white">
      {/* Header */}
      <View
        className="bg-white border-b border-border px-5 pb-4"
        style={{ paddingTop: insets.top + 12 }}
      >
        <View className="flex-row items-center justify-between">
          <View className="flex-row items-center gap-3">
            <TouchableOpacity
              onPress={() => router.back()}
              className="w-9 h-9 rounded-full bg-gray-100 items-center justify-center"
            >
              <ArrowLeft size={18} color={COLORS.foreground} />
            </TouchableOpacity>
            <View>
              <Text className="text-xl font-bold text-foreground">Notifications</Text>
              {unreadCount > 0 && (
                <Text className="text-xs text-muted">{unreadCount} unread</Text>
              )}
            </View>
          </View>
          {unreadCount > 0 && (
            <TouchableOpacity
              onPress={markAllRead}
              className="flex-row items-center gap-1.5"
            >
              <CheckCheck size={16} color={COLORS.powerOrange} />
              <Text className="text-sm text-power-orange font-medium">Mark all read</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      <FlatList
        data={notifications}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <NotificationItem
            notification={item}
            onPress={() => markRead(item.id)}
          />
        )}
        ListEmptyComponent={
          <View className="flex-1 items-center justify-center py-20">
            <View className="w-20 h-20 rounded-full bg-gray-100 items-center justify-center mb-4">
              <Bell size={36} color={COLORS.muted} />
            </View>
            <Text className="text-base font-semibold text-foreground mb-1">All caught up!</Text>
            <Text className="text-sm text-muted">No notifications right now.</Text>
          </View>
        }
      />
    </View>
  );
}
