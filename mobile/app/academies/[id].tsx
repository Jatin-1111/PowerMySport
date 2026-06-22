import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Image,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowLeft, Star, MapPin, Users, CheckCircle, Heart, GraduationCap } from 'lucide-react-native';
import { Badge } from '@components/ui/Badge';
import { Button } from '@components/ui/Button';
import { discoveryApi } from '@/modules/discovery/services/discovery';
import { COLORS } from '@lib/constants';
import type { Academy } from '@/types';

const PLACEHOLDER = 'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=800&q=80';

export default function AcademyDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [academy, setAcademy] = useState<Academy | null>(null);
  const [loading, setLoading] = useState(true);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await discoveryApi.getAcademyById(id);
        if (res.data) setAcademy(res.data);
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

  if (!academy) {
    return (
      <View className="flex-1 bg-background items-center justify-center px-6">
        <Text className="text-base font-semibold text-foreground mb-2">Academy not found</Text>
        <TouchableOpacity onPress={() => router.back()}>
          <Text className="text-power-orange">Go back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const coverImage = academy.images?.[0] ?? PLACEHOLDER;

  return (
    <View className="flex-1 bg-background">
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 120 }}>
        {/* Cover Image */}
        <View className="relative">
          <Image
            source={{ uri: coverImage }}
            style={{ width: '100%', height: 240 }}
            resizeMode="cover"
          />
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
        </View>

        <View className="px-5 pt-5">
          {/* Title */}
          <View className="flex-row items-start justify-between mb-2">
            <View className="flex-1 mr-3">
              <Text className="text-2xl font-bold text-foreground">{academy.name}</Text>
              {academy.location?.city && (
                <View className="flex-row items-center gap-1.5 mt-1.5">
                  <MapPin size={13} color={COLORS.muted} />
                  <Text className="text-muted text-sm">{academy.location.city}</Text>
                </View>
              )}
            </View>
            {academy.monthlyFee && (
              <View className="items-end">
                <Text className="text-xl font-bold text-power-orange">₹{academy.monthlyFee}</Text>
                <Text className="text-xs text-muted">/month</Text>
              </View>
            )}
          </View>

          {/* Stats */}
          <View className="flex-row bg-white rounded-2xl shadow-sm mt-2 mb-5">
            {[
              { label: 'Rating', value: academy.rating ? `${academy.rating.toFixed(1)} ★` : '—' },
              { label: 'Coaches', value: academy.coaches?.length?.toString() ?? '—' },
              { label: 'Sports', value: academy.sports?.length?.toString() ?? '—' },
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
          {academy.sports && academy.sports.length > 0 && (
            <View className="mb-5">
              <Text className="text-base font-bold text-foreground mb-3">Sports Offered</Text>
              <View className="flex-row flex-wrap gap-2">
                {academy.sports.map((sport) => (
                  <Badge key={sport} variant="orange">{sport}</Badge>
                ))}
              </View>
            </View>
          )}

          {/* Age Groups */}
          {academy.ageGroups && academy.ageGroups.length > 0 && (
            <View className="mb-5">
              <Text className="text-base font-bold text-foreground mb-3">Age Groups</Text>
              <View className="flex-row flex-wrap gap-2">
                {academy.ageGroups.map((group) => (
                  <Badge key={group} variant="default">{group}</Badge>
                ))}
              </View>
            </View>
          )}

          {/* Description */}
          {academy.description && (
            <View className="mb-5">
              <Text className="text-base font-bold text-foreground mb-2">About</Text>
              <Text className="text-muted leading-relaxed text-sm">{academy.description}</Text>
            </View>
          )}

          {/* Coaches */}
          {academy.coaches && academy.coaches.length > 0 && (
            <View className="mb-5">
              <Text className="text-base font-bold text-foreground mb-3">
                Our Coaches ({academy.coaches.length})
              </Text>
              <View className="gap-3">
                {academy.coaches.slice(0, 3).map((coach) => (
                  <TouchableOpacity
                    key={coach._id}
                    onPress={() => router.push(`/coaches/${coach._id}`)}
                    className="flex-row items-center gap-3 bg-white rounded-xl p-3 shadow-sm"
                  >
                    <View className="w-10 h-10 rounded-full bg-deep-slate/10 items-center justify-center">
                      <GraduationCap size={18} color={COLORS.muted} />
                    </View>
                    <View className="flex-1">
                      <Text className="text-sm font-semibold text-foreground">{coach.user?.name}</Text>
                      <Text className="text-xs text-muted">{coach.sports?.slice(0, 2).join(', ')}</Text>
                    </View>
                    {coach.rating && (
                      <View className="flex-row items-center gap-1">
                        <Star size={11} color={COLORS.powerOrange} fill={COLORS.powerOrange} />
                        <Text className="text-xs font-semibold">{coach.rating.toFixed(1)}</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}
        </View>
      </ScrollView>

      {/* Enroll CTA */}
      <View
        className="absolute bottom-0 left-0 right-0 bg-white border-t border-border px-5 pt-4"
        style={{ paddingBottom: insets.bottom + 16 }}
      >
        <View className="flex-row items-center justify-between">
          <View>
            <Text className="text-xs text-muted">Monthly fee</Text>
            <Text className="text-2xl font-bold text-foreground">
              ₹{academy.monthlyFee ?? '—'}
            </Text>
          </View>
          <Button onPress={() => {}} size="lg">
            Enroll Now
          </Button>
        </View>
      </View>
    </View>
  );
}
