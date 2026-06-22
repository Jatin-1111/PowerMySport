import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Search,
  MapPin,
  Trophy,
  Users,
  Building2,
  GraduationCap,
  ArrowRight,
  Bell,
  Zap,
  Star,
  ChevronRight,
} from 'lucide-react-native';
import { CoachCard } from '@components/shared/CoachCard';
import { VenueCard } from '@components/shared/VenueCard';
import { Badge } from '@components/ui/Badge';
import { discoveryApi } from '@/modules/discovery/services/discovery';
import { useAuthStore } from '@/modules/auth/store/authStore';
import { COLORS, SPORTS } from '@lib/constants';
import type { Coach, Venue } from '@/types';

const QUICK_ACTIONS = [
  {
    label: 'Find Coaches',
    sublabel: 'Personal training',
    icon: Users,
    route: '/discover',
    bg: 'bg-deep-slate',
    iconColor: COLORS.powerOrange,
  },
  {
    label: 'Book Venues',
    sublabel: 'Courts & grounds',
    icon: Building2,
    route: '/discover',
    bg: 'bg-power-orange',
    iconColor: '#FFFFFF',
  },
  {
    label: 'Academies',
    sublabel: 'Structured training',
    icon: GraduationCap,
    route: '/discover',
    bg: 'bg-turf-green',
    iconColor: '#FFFFFF',
  },
];

const HOW_IT_WORKS = [
  { step: '01', title: 'Discover', desc: 'Browse coaches and venues near you' },
  { step: '02', title: 'Book', desc: 'Pick a slot and pay securely' },
  { step: '03', title: 'Train', desc: 'Show up and level up your game' },
];

export default function HomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuthStore();

  const [featuredCoaches, setFeaturedCoaches] = useState<Coach[]>([]);
  const [featuredVenues, setFeaturedVenues] = useState<Venue[]>([]);
  const [loadingCoaches, setLoadingCoaches] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    const load = async () => {
      try {
        const [coachRes, venueRes] = await Promise.all([
          discoveryApi.getCoaches({ limit: 6 }),
          discoveryApi.getVenues({ limit: 4 }),
        ]);
        if (coachRes.data) setFeaturedCoaches(coachRes.data);
        if (venueRes.data) setFeaturedVenues(venueRes.data);
      } catch {
        // silently fail
      } finally {
        setLoadingCoaches(false);
      }
    };
    load();
  }, []);

  const handleSearch = () => {
    if (searchQuery.trim()) {
      router.push(`/discover?q=${encodeURIComponent(searchQuery)}`);
    }
  };

  const greeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  };

  return (
    <View className="flex-1 bg-background">
      {/* Header */}
      <View
        className="bg-deep-slate px-5 pb-6"
        style={{ paddingTop: insets.top + 16 }}
      >
        <View className="flex-row items-center justify-between mb-5">
          <View className="flex-row items-center gap-2">
            <View className="w-8 h-8 rounded-lg bg-power-orange/20 items-center justify-center">
              <Zap size={16} color={COLORS.powerOrange} fill={COLORS.powerOrange} />
            </View>
            <Text className="text-white font-bold text-lg">PowerMySport</Text>
          </View>
          <TouchableOpacity
            onPress={() => router.push('/notifications')}
            className="w-9 h-9 rounded-full bg-white/10 items-center justify-center"
          >
            <Bell size={18} color="#FFFFFF" />
          </TouchableOpacity>
        </View>

        <Text className="text-white/70 text-sm mb-0.5">
          {greeting()}{user?.name ? `, ${user.name.split(' ')[0]}` : ''}!
        </Text>
        <Text className="text-white text-2xl font-bold mb-5 leading-tight">
          Find your perfect{'\n'}sports partner
        </Text>

        {/* Search Bar */}
        <TouchableOpacity
          onPress={() => router.push('/discover')}
          className="flex-row items-center bg-white rounded-2xl px-4 h-12 gap-3"
          activeOpacity={0.9}
        >
          <Search size={18} color={COLORS.muted} />
          <Text className="text-muted flex-1 text-base">Search coaches, venues...</Text>
          <MapPin size={16} color={COLORS.powerOrange} />
        </TouchableOpacity>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 100 }}
      >
        {/* Quick Actions */}
        <View className="px-5 py-5">
          <Text className="text-lg font-bold text-foreground mb-4">What are you looking for?</Text>
          <View className="flex-row gap-3">
            {QUICK_ACTIONS.map((action) => {
              const Icon = action.icon;
              return (
                <TouchableOpacity
                  key={action.label}
                  onPress={() => router.push(action.route as any)}
                  activeOpacity={0.85}
                  className={`flex-1 ${action.bg} rounded-2xl p-4`}
                >
                  <View className="w-10 h-10 rounded-xl bg-white/15 items-center justify-center mb-3">
                    <Icon size={20} color={action.iconColor} />
                  </View>
                  <Text className="text-white font-bold text-sm leading-tight">{action.label}</Text>
                  <Text className="text-white/70 text-xs mt-0.5">{action.sublabel}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Sports Categories */}
        <View className="mb-5">
          <Text className="text-lg font-bold text-foreground px-5 mb-3">Sports</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 20, gap: 8 }}
          >
            {SPORTS.map((sport) => (
              <TouchableOpacity
                key={sport}
                onPress={() => router.push(`/discover?sport=${sport}` as any)}
                className="px-4 py-2 rounded-full bg-white border border-border"
              >
                <Text className="text-sm font-medium text-foreground">{sport}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Featured Coaches */}
        <View className="mb-5">
          <View className="flex-row items-center justify-between px-5 mb-3">
            <Text className="text-lg font-bold text-foreground">Top Coaches</Text>
            <TouchableOpacity
              onPress={() => router.push('/discover')}
              className="flex-row items-center gap-1"
            >
              <Text className="text-sm text-power-orange font-medium">See all</Text>
              <ArrowRight size={14} color={COLORS.powerOrange} />
            </TouchableOpacity>
          </View>
          {loadingCoaches ? (
            <ActivityIndicator color={COLORS.powerOrange} style={{ marginVertical: 24 }} />
          ) : featuredCoaches.length > 0 ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingHorizontal: 20 }}
            >
              {featuredCoaches.map((coach) => (
                <CoachCard key={coach._id} coach={coach} horizontal />
              ))}
            </ScrollView>
          ) : (
            <View className="mx-5 py-8 bg-white rounded-2xl items-center">
              <Users size={32} color={COLORS.muted} />
              <Text className="text-muted text-sm mt-2">No coaches available yet</Text>
            </View>
          )}
        </View>

        {/* Featured Venues */}
        {featuredVenues.length > 0 && (
          <View className="px-5 mb-5">
            <View className="flex-row items-center justify-between mb-3">
              <Text className="text-lg font-bold text-foreground">Nearby Venues</Text>
              <TouchableOpacity onPress={() => router.push('/discover')} className="flex-row items-center gap-1">
                <Text className="text-sm text-power-orange font-medium">See all</Text>
                <ArrowRight size={14} color={COLORS.powerOrange} />
              </TouchableOpacity>
            </View>
            {featuredVenues.slice(0, 2).map((venue) => (
              <VenueCard key={venue._id} venue={venue} />
            ))}
          </View>
        )}

        {/* How it works */}
        <View className="mx-5 bg-deep-slate rounded-3xl p-5 mb-5">
          <View className="flex-row items-center gap-2 mb-4">
            <Trophy size={18} color={COLORS.powerOrange} />
            <Text className="text-white font-bold text-base">How it works</Text>
          </View>
          {HOW_IT_WORKS.map((step, idx) => (
            <View key={step.step} className={`flex-row items-start gap-4 ${idx < 2 ? 'mb-4' : ''}`}>
              <View className="w-9 h-9 rounded-xl bg-power-orange/20 items-center justify-center shrink-0">
                <Text className="text-power-orange font-bold text-sm">{step.step}</Text>
              </View>
              <View className="flex-1">
                <Text className="text-white font-semibold text-sm">{step.title}</Text>
                <Text className="text-white/60 text-xs mt-0.5 leading-relaxed">{step.desc}</Text>
              </View>
            </View>
          ))}
        </View>

        {/* CTA Banner */}
        <View className="mx-5 bg-power-orange/10 border border-power-orange/20 rounded-2xl p-5">
          <Text className="text-lg font-bold text-foreground mb-1">Ready to level up?</Text>
          <Text className="text-muted text-sm mb-4">Join thousands of athletes across India</Text>
          <TouchableOpacity
            onPress={() => router.push('/discover')}
            className="flex-row items-center gap-2 bg-power-orange rounded-xl px-5 py-3 self-start"
          >
            <Text className="text-white font-semibold text-sm">Explore Now</Text>
            <ArrowRight size={16} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}
