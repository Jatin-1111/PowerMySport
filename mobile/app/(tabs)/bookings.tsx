import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CalendarDays, Clock, MapPin, ArrowRight, Search } from 'lucide-react-native';
import { Badge } from '@components/ui/Badge';
import { bookingApi } from '@/modules/booking/services/booking';
import { COLORS } from '@lib/constants';
import type { Booking, BookingStatus } from '@/types';
import { format } from 'date-fns';

const STATUS_TABS: { key: BookingStatus | 'all'; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'CONFIRMED', label: 'Upcoming' },
  { key: 'COMPLETED', label: 'Completed' },
  { key: 'CANCELLED', label: 'Cancelled' },
];

const STATUS_BADGE: Record<BookingStatus, { variant: 'success' | 'destructive' | 'warning' | 'default' | 'orange'; label: string }> = {
  CONFIRMED: { variant: 'success', label: 'Confirmed' },
  PENDING: { variant: 'warning', label: 'Pending' },
  COMPLETED: { variant: 'default', label: 'Completed' },
  CANCELLED: { variant: 'destructive', label: 'Cancelled' },
  NO_SHOW: { variant: 'destructive', label: 'No Show' },
};

function BookingCard({ booking }: { booking: Booking }) {
  const router = useRouter();
  const statusInfo = STATUS_BADGE[booking.status];
  const title = booking.type === 'COACH'
    ? booking.coach?.user?.name ?? 'Coach Session'
    : booking.venue?.name ?? 'Venue Booking';

  let dateStr = '';
  try {
    dateStr = format(new Date(booking.date), 'EEE, dd MMM yyyy');
  } catch {
    dateStr = booking.date;
  }

  return (
    <TouchableOpacity
      onPress={() => {}}
      activeOpacity={0.85}
      className="bg-white rounded-2xl p-4 mb-3 shadow-sm"
    >
      <View className="flex-row items-start justify-between mb-3">
        <View className="flex-1 mr-3">
          <Text className="text-base font-bold text-foreground" numberOfLines={1}>{title}</Text>
          {booking.sport && (
            <Text className="text-sm text-muted mt-0.5">{booking.sport}</Text>
          )}
        </View>
        <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>
      </View>

      <View className="gap-2">
        <View className="flex-row items-center gap-2">
          <CalendarDays size={14} color={COLORS.muted} />
          <Text className="text-sm text-muted">{dateStr}</Text>
        </View>
        <View className="flex-row items-center gap-2">
          <Clock size={14} color={COLORS.muted} />
          <Text className="text-sm text-muted">
            {booking.startTime} – {booking.endTime}
          </Text>
        </View>
      </View>

      <View className="flex-row items-center justify-between mt-3 pt-3 border-t border-border">
        <Text className="text-base font-bold text-foreground">
          ₹{booking.totalAmount.toLocaleString()}
        </Text>
        <TouchableOpacity className="flex-row items-center gap-1">
          <Text className="text-sm text-power-orange font-medium">View details</Text>
          <ArrowRight size={14} color={COLORS.powerOrange} />
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );
}

export default function BookingsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [activeTab, setActiveTab] = useState<BookingStatus | 'all'>('all');
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const status = activeTab === 'all' ? undefined : activeTab;
        const res = await bookingApi.getMyBookings(status);
        setBookings(res.data ?? []);
      } catch {
        setBookings([]);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [activeTab]);

  return (
    <View className="flex-1 bg-background">
      <View
        className="bg-white border-b border-border px-5 pb-4"
        style={{ paddingTop: insets.top + 12 }}
      >
        <Text className="text-xl font-bold text-foreground mb-4">My Bookings</Text>

        <View className="flex-row gap-2">
          {STATUS_TABS.map((tab) => (
            <TouchableOpacity
              key={tab.key}
              onPress={() => setActiveTab(tab.key)}
              className={`px-4 py-2 rounded-full ${
                activeTab === tab.key ? 'bg-deep-slate' : 'bg-gray-100'
              }`}
            >
              <Text
                className={`text-xs font-semibold ${
                  activeTab === tab.key ? 'text-white' : 'text-muted'
                }`}
              >
                {tab.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color={COLORS.powerOrange} />
        </View>
      ) : (
        <FlatList
          data={bookings}
          keyExtractor={(item) => item._id}
          contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => <BookingCard booking={item} />}
          ListEmptyComponent={
            <View className="flex-1 items-center justify-center py-20">
              <View className="w-20 h-20 rounded-full bg-gray-100 items-center justify-center mb-4">
                <CalendarDays size={36} color={COLORS.muted} />
              </View>
              <Text className="text-base font-semibold text-foreground mb-2">No bookings yet</Text>
              <Text className="text-sm text-muted text-center mb-6 px-8">
                Book a coach or venue to get started on your sports journey
              </Text>
              <TouchableOpacity
                onPress={() => router.push('/discover')}
                className="flex-row items-center gap-2 bg-power-orange rounded-xl px-5 py-3"
              >
                <Search size={16} color="#FFFFFF" />
                <Text className="text-white font-semibold text-sm">Explore</Text>
              </TouchableOpacity>
            </View>
          }
        />
      )}
    </View>
  );
}
