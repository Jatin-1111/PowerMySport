import React from 'react';
import { View, Text, Image } from 'react-native';
import { COLORS } from '@lib/constants';

type AvatarSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

interface AvatarProps {
  src?: string;
  name?: string;
  size?: AvatarSize;
}

const sizeMap: Record<AvatarSize, { container: string; text: string; px: number }> = {
  xs: { container: 'w-7 h-7', text: 'text-xs', px: 28 },
  sm: { container: 'w-9 h-9', text: 'text-sm', px: 36 },
  md: { container: 'w-11 h-11', text: 'text-base', px: 44 },
  lg: { container: 'w-16 h-16', text: 'text-xl', px: 64 },
  xl: { container: 'w-20 h-20', text: 'text-2xl', px: 80 },
};

function getInitials(name?: string): string {
  if (!name) return '?';
  const parts = name.trim().split(' ');
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
  }
  return parts[0].substring(0, 2).toUpperCase();
}

function getColorFromName(name?: string): string {
  const colors = [
    '#E97316', '#22C55E', '#3B82F6', '#8B5CF6',
    '#EC4899', '#F59E0B', '#10B981', '#0EA5E9',
  ];
  if (!name) return colors[0];
  const index = name.charCodeAt(0) % colors.length;
  return colors[index];
}

export function Avatar({ src, name, size = 'md' }: AvatarProps) {
  const { container, text, px } = sizeMap[size];
  const bgColor = getColorFromName(name);
  const initials = getInitials(name);

  if (src) {
    return (
      <Image
        source={{ uri: src }}
        className={`${container} rounded-full`}
        style={{ width: px, height: px, borderRadius: px / 2 }}
      />
    );
  }

  return (
    <View
      className={`${container} rounded-full items-center justify-center`}
      style={{ backgroundColor: bgColor }}
    >
      <Text className={`${text} font-bold text-white`}>{initials}</Text>
    </View>
  );
}
