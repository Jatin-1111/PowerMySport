import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ArrowLeft, Bell } from 'lucide-react-native';
import { COLORS } from '@lib/constants';

interface HeaderProps {
  title?: string;
  showBack?: boolean;
  showNotifications?: boolean;
  rightElement?: React.ReactNode;
  transparent?: boolean;
}

export function Header({
  title,
  showBack = false,
  showNotifications = false,
  rightElement,
  transparent = false,
}: HeaderProps) {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  return (
    <View
      className={`${transparent ? '' : 'bg-white border-b border-border'}`}
      style={{ paddingTop: insets.top }}
    >
      <View className="flex-row items-center justify-between px-4 h-14">
        <View className="flex-row items-center gap-3">
          {showBack && (
            <TouchableOpacity
              onPress={() => router.back()}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              className="w-9 h-9 rounded-full bg-gray-100 items-center justify-center"
            >
              <ArrowLeft size={18} color={COLORS.foreground} />
            </TouchableOpacity>
          )}
          {title && (
            <Text className="text-lg font-bold text-foreground">{title}</Text>
          )}
        </View>

        <View className="flex-row items-center gap-2">
          {rightElement}
          {showNotifications && (
            <TouchableOpacity
              onPress={() => router.push('/notifications')}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              className="w-9 h-9 rounded-full bg-gray-100 items-center justify-center"
            >
              <Bell size={18} color={COLORS.foreground} />
            </TouchableOpacity>
          )}
        </View>
      </View>
    </View>
  );
}
