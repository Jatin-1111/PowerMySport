import React from 'react';
import { View, Text, TouchableOpacity, Image } from 'react-native';
import { useRouter } from 'expo-router';
import { Star, MapPin, ChevronRight } from 'lucide-react-native';
import { Avatar } from '@components/ui/Avatar';
import { Badge } from '@components/ui/Badge';
import { COLORS } from '@lib/constants';
import type { Coach } from '@/types';

interface CoachCardProps {
  coach: Coach;
  horizontal?: boolean;
}

export function CoachCard({ coach, horizontal = false }: CoachCardProps) {
  const router = useRouter();

  if (horizontal) {
    return (
      <TouchableOpacity
        onPress={() => router.push(`/coaches/${coach._id}`)}
        activeOpacity={0.85}
        className="w-48 bg-white rounded-2xl shadow-sm overflow-hidden mr-3"
      >
        <View className="h-24 bg-deep-slate/10 items-center justify-center">
          <Avatar
            src={coach.profileImage || coach.user?.profileImage}
            name={coach.user?.name}
            size="lg"
          />
        </View>
        <View className="p-3">
          <Text className="text-sm font-bold text-foreground" numberOfLines={1}>
            {coach.user?.name}
          </Text>
          <Text className="text-xs text-muted mt-0.5" numberOfLines={1}>
            {coach.sports?.slice(0, 2).join(' · ')}
          </Text>
          <View className="flex-row items-center justify-between mt-2">
            <View className="flex-row items-center gap-1">
              <Star size={11} color={COLORS.powerOrange} fill={COLORS.powerOrange} />
              <Text className="text-xs font-semibold text-foreground">
                {coach.rating?.toFixed(1) ?? '—'}
              </Text>
            </View>
            {coach.hourlyRate && (
              <Text className="text-xs font-bold text-power-orange">
                ₹{coach.hourlyRate}/hr
              </Text>
            )}
          </View>
        </View>
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity
      onPress={() => router.push(`/coaches/${coach._id}`)}
      activeOpacity={0.85}
      className="bg-white rounded-2xl shadow-sm overflow-hidden mb-3 flex-row"
    >
      <View className="w-24 bg-deep-slate/10 items-center justify-center">
        <Avatar
          src={coach.profileImage || coach.user?.profileImage}
          name={coach.user?.name}
          size="lg"
        />
      </View>
      <View className="flex-1 p-3">
        <View className="flex-row items-center justify-between">
          <Text className="text-base font-bold text-foreground flex-1 mr-2" numberOfLines={1}>
            {coach.user?.name}
          </Text>
          {coach.isVerified && (
            <Badge variant="success">Verified</Badge>
          )}
        </View>
        <Text className="text-sm text-muted mt-0.5" numberOfLines={1}>
          {coach.sports?.join(' · ')}
        </Text>
        {coach.location?.city && (
          <View className="flex-row items-center gap-1 mt-1">
            <MapPin size={11} color={COLORS.muted} />
            <Text className="text-xs text-muted">{coach.location.city}</Text>
            {coach.distance != null && (
              <Text className="text-xs text-muted"> · {coach.distance.toFixed(1)} km</Text>
            )}
          </View>
        )}
        <View className="flex-row items-center justify-between mt-2">
          <View className="flex-row items-center gap-1">
            <Star size={12} color={COLORS.powerOrange} fill={COLORS.powerOrange} />
            <Text className="text-sm font-semibold text-foreground">
              {coach.rating?.toFixed(1) ?? '—'}
            </Text>
            {coach.totalReviews != null && (
              <Text className="text-xs text-muted">({coach.totalReviews})</Text>
            )}
          </View>
          {coach.hourlyRate && (
            <Text className="text-sm font-bold text-power-orange">
              ₹{coach.hourlyRate}/hr
            </Text>
          )}
        </View>
      </View>
      <View className="items-center justify-center pr-3">
        <ChevronRight size={16} color={COLORS.muted} />
      </View>
    </TouchableOpacity>
  );
}
