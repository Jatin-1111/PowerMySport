import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Image,
  FlatList,
  Dimensions,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ArrowLeft,
  Star,
  MapPin,
  Users,
  CheckCircle,
  Heart,
  Wifi,
  Car,
  Droplets,
} from 'lucide-react-native';
import { Badge } from '@components/ui/Badge';
import { Button } from '@components/ui/Button';
import { discoveryApi } from '@/modules/discovery/services/discovery';
import { COLORS } from '@lib/constants';
import type { Venue } from '@/types';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const PLACEHOLDER = 'https://images.unsplash.com/photo-1587280501635-68a0e82cd5ff?w=800&q=80';

const AMENITY_ICONS: Record<string, React.ComponentType<{ size: number; color: string }>> = {
  WiFi: Wifi,
  Parking: Car,
  'Changing Rooms': Droplets,
};

export default function VenueDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [venue, setVenue] = useState<Venue | null>(null);
  const [loading, setLoading] = useState(true);
  const [saved, setSaved] = useState(false);
  const [imageIndex, setImageIndex] = useState(0);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await discoveryApi.getVenueById(id);
        if (res.data) setVenue(res.data);
      } catch {
        // silently fail
      } finally {
        setLoading(false);
      }
    };
    if (id) load();
  }, [id]);

  if (loading) {
    return (
      <View className="flex-1 bg-background items-center justify-center">
        <ActivityIndicator size="large" color={COLORS.powerOrange} />
      </View>
    );
  }

  if (!venue) {
    return (
      <View className="flex-1 bg-background items-center justify-center px-6">
        <Text className="text-base font-semibold text-foreground mb-2">Venue not found</Text>
        <TouchableOpacity onPress={() => router.back()}>
          <Text className="text-power-orange">Go back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const images = venue.images && venue.images.length > 0 ? venue.images : [PLACEHOLDER];

  return (
    <View className="flex-1 bg-background">
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 120 }}>
        {/* Image Gallery */}
        <View className="relative">
          <ScrollView
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onScroll={(e) => {
              const idx = Math.round(e.nativeEvent.contentOffset.x / SCREEN_WIDTH);
              setImageIndex(idx);
            }}
            scrollEventThrottle={16}
          >
            {images.map((uri, idx) => (
              <Image
                key={idx}
                source={{ uri }}
                style={{ width: SCREEN_WIDTH, height: 280 }}
                resizeMode="cover"
              />
            ))}
          </ScrollView>

          {/* Gradient overlay */}
          <View className="absolute inset-0 bg-gradient-to-b from-black/40 to-transparent h-24" />

          {/* Controls */}
          <View
            className="absolute left-0 right-0 flex-row items-center justify-between px-4"
            style={{ top: insets.top + 8 }}
          >
            <TouchableOpacity
              onPress={() => router.back()}
              className="w-9 h-9 rounded-full bg-black/30 items-center justify-center"
            >
              <ArrowLeft size={18} color="#FFFFFF" />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setSaved((s) => !s)}
              className="w-9 h-9 rounded-full bg-black/30 items-center justify-center"
            >
              <Heart
                size={18}
                color={saved ? COLORS.powerOrange : '#FFFFFF'}
                fill={saved ? COLORS.powerOrange : 'transparent'}
              />
            </TouchableOpacity>
          </View>

          {/* Dots */}
          {images.length > 1 && (
            <View className="absolute bottom-3 left-0 right-0 flex-row justify-center gap-1.5">
              {images.map((_, idx) => (
                <View
                  key={idx}
                  className={`rounded-full ${
                    idx === imageIndex ? 'w-4 h-1.5 bg-white' : 'w-1.5 h-1.5 bg-white/50'
                  }`}
                />
              ))}
            </View>
          )}
        </View>

        {/* Info */}
        <View className="px-5 pt-5">
          <View className="flex-row items-start justify-between mb-2">
            <View className="flex-1 mr-3">
              <Text className="text-2xl font-bold text-foreground">{venue.name}</Text>
              {venue.location?.city && (
                <View className="flex-row items-center gap-1.5 mt-1.5">
                  <MapPin size={13} color={COLORS.muted} />
                  <Text className="text-muted text-sm">{venue.location.address ?? venue.location.city}</Text>
                </View>
              )}
            </View>
            {venue.hourlyRate && (
              <View className="items-end">
                <Text className="text-2xl font-bold text-power-orange">₹{venue.hourlyRate}</Text>
                <Text className="text-xs text-muted">/hour</Text>
              </View>
            )}
          </View>

          {/* Stats */}
          <View className="flex-row bg-white rounded-2xl shadow-sm mt-2 mb-5">
            {[
              { label: 'Rating', value: venue.rating ? `${venue.rating.toFixed(1)} ★` : '—' },
              { label: 'Reviews', value: venue.totalReviews?.toString() ?? '—' },
              { label: 'Capacity', value: venue.capacity ? `${venue.capacity}` : '—' },
            ].map((stat, idx) => (
              <View
                key={stat.label}
                className={`flex-1 py-4 items-center ${idx < 2 ? 'border-r border-border' : ''}`}
              >
                <Text className="text-base font-bold text-foreground">{stat.value}</Text>
                <Text className="text-xs text-muted mt-0.5">{stat.label}</Text>
              </View>
            ))}
          </View>

          {/* Sports */}
          {venue.sports && venue.sports.length > 0 && (
            <View className="mb-5">
              <Text className="text-base font-bold text-foreground mb-3">Sports Available</Text>
              <View className="flex-row flex-wrap gap-2">
                {venue.sports.map((sport) => (
                  <Badge key={sport} variant="orange">{sport}</Badge>
                ))}
              </View>
            </View>
          )}

          {/* Description */}
          {venue.description && (
            <View className="mb-5">
              <Text className="text-base font-bold text-foreground mb-2">About this venue</Text>
              <Text className="text-muted leading-relaxed text-sm">{venue.description}</Text>
            </View>
          )}

          {/* Amenities */}
          {venue.amenities && venue.amenities.length > 0 && (
            <View className="mb-5">
              <Text className="text-base font-bold text-foreground mb-3">Amenities</Text>
              <View className="flex-row flex-wrap gap-3">
                {venue.amenities.map((amenity) => {
                  const Icon = AMENITY_ICONS[amenity] ?? CheckCircle;
                  return (
                    <View key={amenity} className="flex-row items-center gap-2 bg-gray-50 rounded-xl px-3 py-2">
                      <Icon size={14} color={COLORS.turfGreen} />
                      <Text className="text-sm text-foreground">{amenity}</Text>
                    </View>
                  );
                })}
              </View>
            </View>
          )}
        </View>
      </ScrollView>

      {/* Book CTA */}
      <View
        className="absolute bottom-0 left-0 right-0 bg-white border-t border-border px-5 pt-4"
        style={{ paddingBottom: insets.bottom + 16 }}
      >
        <View className="flex-row items-center justify-between mb-3">
          <View>
            <Text className="text-xs text-muted">Per hour</Text>
            <Text className="text-2xl font-bold text-foreground">
              ₹{venue.hourlyRate ?? '—'}
            </Text>
          </View>
          <Button onPress={() => {}} size="lg">
            Book Slot
          </Button>
        </View>
      </View>
    </View>
  );
}
