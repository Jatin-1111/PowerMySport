import React from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  User,
  Settings,
  Bell,
  Heart,
  HelpCircle,
  Shield,
  LogOut,
  ChevronRight,
  CreditCard,
  Star,
  Trophy,
} from 'lucide-react-native';
import { Avatar } from '@components/ui/Avatar';
import { Badge } from '@components/ui/Badge';
import { useAuthStore } from '@/modules/auth/store/authStore';
import { authApi } from '@/modules/auth/services/auth';
import { COLORS } from '@lib/constants';

interface MenuItemProps {
  icon: React.ComponentType<{ size: number; color: string }>;
  label: string;
  sublabel?: string;
  onPress: () => void;
  badge?: string;
  destructive?: boolean;
}

function MenuItem({ icon: Icon, label, sublabel, onPress, badge, destructive }: MenuItemProps) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      className="flex-row items-center px-4 py-4 border-b border-border last:border-b-0"
    >
      <View
        className={`w-9 h-9 rounded-xl items-center justify-center mr-3 ${
          destructive ? 'bg-error-red/10' : 'bg-gray-100'
        }`}
      >
        <Icon size={18} color={destructive ? COLORS.errorRed : COLORS.foreground} />
      </View>
      <View className="flex-1">
        <Text className={`text-sm font-medium ${destructive ? 'text-error-red' : 'text-foreground'}`}>
          {label}
        </Text>
        {sublabel && (
          <Text className="text-xs text-muted mt-0.5">{sublabel}</Text>
        )}
      </View>
      {badge ? (
        <Badge variant="orange">{badge}</Badge>
      ) : (
        <ChevronRight size={16} color={COLORS.muted} />
      )}
    </TouchableOpacity>
  );
}

const ROLE_LABELS: Record<string, string> = {
  PLAYER: 'Player',
  COACH: 'Coach',
  VENUE_LISTER: 'Venue Owner',
  ACADEMY_OWNER: 'Academy Owner',
};

export default function ProfileScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, logout } = useAuthStore();

  const handleLogout = () => {
    Alert.alert(
      'Sign out',
      'Are you sure you want to sign out?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign out',
          style: 'destructive',
          onPress: async () => {
            await authApi.logout();
            await logout();
            router.replace('/(auth)/login');
          },
        },
      ],
    );
  };

  if (!user) {
    return (
      <View className="flex-1 bg-background items-center justify-center px-6" style={{ paddingTop: insets.top }}>
        <View className="w-20 h-20 rounded-full bg-gray-100 items-center justify-center mb-4">
          <User size={36} color={COLORS.muted} />
        </View>
        <Text className="text-lg font-bold text-foreground mb-2">Not signed in</Text>
        <Text className="text-sm text-muted text-center mb-6">Sign in to access your profile</Text>
        <TouchableOpacity
          onPress={() => router.push('/(auth)/login')}
          className="bg-power-orange rounded-xl px-6 py-3"
        >
          <Text className="text-white font-semibold">Sign In</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-background">
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 100 }}
      >
        {/* Profile Header */}
        <View
          className="bg-deep-slate px-5 pb-6"
          style={{ paddingTop: insets.top + 16 }}
        >
          <View className="flex-row items-center gap-4">
            <Avatar src={user.profileImage} name={user.name} size="xl" />
            <View className="flex-1">
              <Text className="text-white text-xl font-bold">{user.name}</Text>
              <Text className="text-white/60 text-sm mt-0.5">{user.email}</Text>
              <View className="flex-row items-center gap-2 mt-2">
                <Badge variant="orange">{ROLE_LABELS[user.role] ?? user.role}</Badge>
              </View>
            </View>
          </View>
        </View>

        {/* Stats Row */}
        <View className="flex-row bg-white border-b border-border">
          {[
            { label: 'Bookings', value: '—' },
            { label: 'Reviews', value: '—' },
            { label: 'Sports', value: '—' },
          ].map((stat, idx) => (
            <View
              key={stat.label}
              className={`flex-1 py-4 items-center ${idx < 2 ? 'border-r border-border' : ''}`}
            >
              <Text className="text-xl font-bold text-foreground">{stat.value}</Text>
              <Text className="text-xs text-muted mt-0.5">{stat.label}</Text>
            </View>
          ))}
        </View>

        {/* Account Section */}
        <View className="mt-4 mx-4 bg-white rounded-2xl overflow-hidden shadow-sm">
          <Text className="text-xs font-semibold text-muted uppercase tracking-wider px-4 pt-4 pb-2">
            Account
          </Text>
          <MenuItem
            icon={User}
            label="Edit Profile"
            sublabel="Update your personal info"
            onPress={() => {}}
          />
          <MenuItem
            icon={CreditCard}
            label="Wallet & Payments"
            sublabel="Manage payment methods"
            onPress={() => {}}
          />
          <MenuItem
            icon={Heart}
            label="Saved"
            sublabel="Your bookmarked coaches & venues"
            onPress={() => {}}
          />
        </View>

        {/* Preferences Section */}
        <View className="mt-4 mx-4 bg-white rounded-2xl overflow-hidden shadow-sm">
          <Text className="text-xs font-semibold text-muted uppercase tracking-wider px-4 pt-4 pb-2">
            Preferences
          </Text>
          <MenuItem
            icon={Bell}
            label="Notifications"
            sublabel="Manage alert settings"
            onPress={() => router.push('/notifications')}
          />
          <MenuItem
            icon={Settings}
            label="Settings"
            sublabel="App settings and preferences"
            onPress={() => {}}
          />
        </View>

        {/* Support Section */}
        <View className="mt-4 mx-4 bg-white rounded-2xl overflow-hidden shadow-sm">
          <Text className="text-xs font-semibold text-muted uppercase tracking-wider px-4 pt-4 pb-2">
            Support
          </Text>
          <MenuItem
            icon={HelpCircle}
            label="Help & FAQ"
            onPress={() => {}}
          />
          <MenuItem
            icon={Shield}
            label="Privacy & Terms"
            onPress={() => {}}
          />
          <MenuItem
            icon={Star}
            label="Rate the App"
            onPress={() => {}}
          />
        </View>

        {/* Logout */}
        <View className="mt-4 mx-4 bg-white rounded-2xl overflow-hidden shadow-sm mb-4">
          <MenuItem
            icon={LogOut}
            label="Sign Out"
            onPress={handleLogout}
            destructive
          />
        </View>

        <Text className="text-center text-xs text-muted mb-4">
          PowerMySport v1.0.0
        </Text>
      </ScrollView>
    </View>
  );
}
