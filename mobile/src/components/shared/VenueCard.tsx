import React from 'react';
import { View, Text, TouchableOpacity, Image } from 'react-native';
import { useRouter } from 'expo-router';
import { Star, MapPin, ChevronRight, Users } from 'lucide-react-native';
import { Badge } from '@components/ui/Badge';
import { COLORS } from '@lib/constants';
import type { Venue } from '@/types';

interface VenueCardProps {
  venue: Venue;
  horizontal?: boolean;
}

const PLACEHOLDER_IMAGE = 'https://images.unsplash.com/photo-1587280501635-68a0e82cd5ff?w=400&q=80';

export function VenueCard({ venue, horizontal = false }: VenueCardProps) {
  const router = useRouter();
  const imageUri = venue.images?.[0] ?? PLACEHOLDER_IMAGE;

  if (horizontal) {
    return (
      <TouchableOpacity
        onPress={() => router.push(`/venues/${venue._id}`)}
        activeOpacity={0.85}
        className="w-52 bg-white rounded-2xl shadow-sm overflow-hidden mr-3"
      >
        <Image
          source={{ uri: imageUri }}
          className="w-full h-28"
          resizeMode="cover"
        />
        <View className="p-3">
          <Text className="text-sm font-bold text-foreground" numberOfLines={1}>
            {venue.name}
          </Text>
          <Text className="text-xs text-muted mt-0.5" numberOfLines={1}>
            {venue.sports?.slice(0, 2).join(' · ')}
          </Text>
          <View className="flex-row items-center justify-between mt-2">
            <View className="flex-row items-center gap-1">
              <Star size={11} color={COLORS.powerOrange} fill={COLORS.powerOrange} />
              <Text className="text-xs font-semibold text-foreground">
                {venue.rating?.toFixed(1) ?? '—'}
              </Text>
            </View>
            {venue.hourlyRate && (
              <Text className="text-xs font-bold text-power-orange">
                ₹{venue.hourlyRate}/hr
              </Text>
            )}
          </View>
        </View>
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity
      onPress={() => router.push(`/venues/${venue._id}`)}
      activeOpacity={0.85}
      className="bg-white rounded-2xl shadow-sm overflow-hidden mb-3"
    >
      <Image
        source={{ uri: imageUri }}
        className="w-full h-40"
        resizeMode="cover"
      />
      <View className="p-4">
        <View className="flex-row items-start justify-between">
          <View className="flex-1 mr-2">
            <Text className="text-base font-bold text-foreground" numberOfLines={1}>
              {venue.name}
            </Text>
            {venue.location?.city && (
              <View className="flex-row items-center gap-1 mt-1">
                <MapPin size={12} color={COLORS.muted} />
                <Text className="text-sm text-muted">{venue.location.city}</Text>
                {venue.distance != null && (
                  <Text className="text-sm text-muted"> · {venue.distance.toFixed(1)} km</Text>
                )}
              </View>
            )}
          </View>
          {venue.hourlyRate && (
            <Text className="text-base font-bold text-power-orange">
              ₹{venue.hourlyRate}/hr
            </Text>
          )}
        </View>
        <View className="flex-row items-center gap-2 mt-3 flex-wrap">
          {venue.sports?.slice(0, 3).map((sport) => (
            <Badge key={sport} variant="outline">{sport}</Badge>
          ))}
        </View>
        <View className="flex-row items-center gap-4 mt-3">
          <View className="flex-row items-center gap-1">
            <Star size={13} color={COLORS.powerOrange} fill={COLORS.powerOrange} />
            <Text className="text-sm font-semibold text-foreground">
              {venue.rating?.toFixed(1) ?? '—'}
            </Text>
            {venue.totalReviews != null && (
              <Text className="text-xs text-muted">({venue.totalReviews})</Text>
            )}
          </View>
          {venue.capacity && (
            <View className="flex-row items-center gap-1">
              <Users size={13} color={COLORS.muted} />
              <Text className="text-xs text-muted">{venue.capacity} max</Text>
            </View>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
}
