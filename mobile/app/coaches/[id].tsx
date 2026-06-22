import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Linking,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ArrowLeft,
  Star,
  MapPin,
  Clock,
  CheckCircle,
  BookOpen,
  Share2,
  Heart,
  Trophy,
  Phone,
} from 'lucide-react-native';
import { Avatar } from '@components/ui/Avatar';
import { Badge } from '@components/ui/Badge';
import { Button } from '@components/ui/Button';
import { discoveryApi } from '@/modules/discovery/services/discovery';
import { COLORS } from '@lib/constants';
import type { Coach } from '@/types';

const DAY_LABELS: Record<string, string> = {
  monday: 'Mon', tuesday: 'Tue', wednesday: 'Wed',
  thursday: 'Thu', friday: 'Fri', saturday: 'Sat', sunday: 'Sun',
};

export default function CoachDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [coach, setCoach] = useState<Coach | null>(null);
  const [loading, setLoading] = useState(true);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await discoveryApi.getCoachById(id);
        if (res.data) setCoach(res.data);
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

  if (!coach) {
    return (
      <View className="flex-1 bg-background items-center justify-center px-6">
        <Text className="text-base font-semibold text-foreground mb-2">Coach not found</Text>
        <TouchableOpacity onPress={() => router.back()}>
          <Text className="text-power-orange">Go back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const availableDays = coach.availability
    ?.filter((a) => a.isAvailable)
    .map((a) => DAY_LABELS[a.day.toLowerCase()] ?? a.day);

  return (
    <View className="flex-1 bg-background">
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 120 }}>
        {/* Hero */}
        <View className="bg-deep-slate" style={{ paddingTop: insets.top }}>
          {/* Topbar */}
          <View className="flex-row items-center justify-between px-4 py-3">
            <TouchableOpacity
              onPress={() => router.back()}
              className="w-9 h-9 rounded-full bg-white/10 items-center justify-center"
            >
              <ArrowLeft size={18} color="#FFFFFF" />
            </TouchableOpacity>
            <View className="flex-row gap-2">
              <TouchableOpacity
                onPress={() => setSaved((s) => !s)}
                className="w-9 h-9 rounded-full bg-white/10 items-center justify-center"
              >
                <Heart
                  size={18}
                  color={saved ? COLORS.powerOrange : '#FFFFFF'}
                  fill={saved ? COLORS.powerOrange : 'transparent'}
                />
              </TouchableOpacity>
            </View>
          </View>

          {/* Profile */}
          <View className="items-center pb-6 px-5">
            <Avatar
              src={coach.profileImage ?? coach.user?.profileImage}
              name={coach.user?.name}
              size="xl"
            />
            <Text className="text-white text-2xl font-bold mt-3">{coach.user?.name}</Text>
            {coach.isVerified && (
              <View className="flex-row items-center gap-1.5 mt-1.5">
                <CheckCircle size={14} color={COLORS.turfGreen} />
                <Text className="text-turf-green text-sm font-medium">Verified Coach</Text>
              </View>
            )}
            <View className="flex-row items-center gap-4 mt-3">
              {coach.rating != null && (
                <View className="flex-row items-center gap-1">
                  <Star size={14} color={COLORS.powerOrange} fill={COLORS.powerOrange} />
                  <Text className="text-white font-semibold">{coach.rating.toFixed(1)}</Text>
                  {coach.totalReviews != null && (
                    <Text className="text-white/60 text-sm">({coach.totalReviews})</Text>
                  )}
                </View>
              )}
              {coach.location?.city && (
                <View className="flex-row items-center gap-1">
                  <MapPin size={13} color="rgba(255,255,255,0.6)" />
                  <Text className="text-white/60 text-sm">{coach.location.city}</Text>
                </View>
              )}
            </View>
          </View>
        </View>

        {/* Content */}
        <View className="px-5">
          {/* Quick Stats */}
          <View className="flex-row bg-white rounded-2xl shadow-sm -mt-4 mb-5">
            {[
              { label: 'Hourly Rate', value: coach.hourlyRate ? `₹${coach.hourlyRate}` : '—' },
              { label: 'Experience', value: coach.experience ? `${coach.experience} yrs` : '—' },
              { label: 'Sports', value: `${coach.sports?.length ?? 0}` },
            ].map((stat, idx) => (
              <View
                key={stat.label}
                className={`flex-1 py-4 items-center ${idx < 2 ? 'border-r border-border' : ''}`}
              >
                <Text className="text-lg font-bold text-foreground">{stat.value}</Text>
                <Text className="text-xs text-muted mt-0.5">{stat.label}</Text>
              </View>
            ))}
          </View>

          {/* Sports */}
          {coach.sports && coach.sports.length > 0 && (
            <View className="mb-5">
              <Text className="text-base font-bold text-foreground mb-3">Sports</Text>
              <View className="flex-row flex-wrap gap-2">
                {coach.sports.map((sport) => (
                  <Badge key={sport} variant="orange">{sport}</Badge>
                ))}
              </View>
            </View>
          )}

          {/* Bio */}
          {coach.bio && (
            <View className="mb-5">
              <Text className="text-base font-bold text-foreground mb-2">About</Text>
              <Text className="text-muted leading-relaxed text-sm">{coach.bio}</Text>
            </View>
          )}

          {/* Availability */}
          {availableDays && availableDays.length > 0 && (
            <View className="mb-5">
              <Text className="text-base font-bold text-foreground mb-3">Availability</Text>
              <View className="flex-row gap-2 flex-wrap">
                {availableDays.map((day) => (
                  <View key={day} className="px-3 py-1.5 rounded-full bg-turf-green/10">
                    <Text className="text-turf-green text-xs font-semibold">{day}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* Certifications */}
          {coach.certifications && coach.certifications.length > 0 && (
            <View className="mb-5">
              <Text className="text-base font-bold text-foreground mb-3">Certifications</Text>
              <View className="gap-2">
                {coach.certifications.map((cert, idx) => (
                  <View key={idx} className="flex-row items-center gap-2">
                    <CheckCircle size={14} color={COLORS.turfGreen} />
                    <Text className="text-sm text-foreground">{cert}</Text>
                  </View>
                ))}
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
            <Text className="text-xs text-muted">Starting from</Text>
            <Text className="text-2xl font-bold text-foreground">
              ₹{coach.hourlyRate ?? '—'}
              <Text className="text-sm font-normal text-muted">/hr</Text>
            </Text>
          </View>
          <Button onPress={() => {}} size="lg">
            Book Session
          </Button>
        </View>
      </View>
    </View>
  );
}
