import { Tabs } from 'expo-router';
import { View, Text } from 'react-native';
import { Home, Search, CalendarDays, User } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS } from '@/lib/constants';

interface TabIconProps {
  icon: React.ComponentType<{ size: number; color: string; strokeWidth?: number }>;
  label: string;
  focused: boolean;
}

function TabIcon({ icon: Icon, label, focused }: TabIconProps) {
  return (
    <View className="items-center justify-center pt-1">
      {focused && (
        <View
          className="absolute -top-3 w-10 h-0.5 bg-power-orange rounded-b-full"
        />
      )}
      <Icon
        size={22}
        color={focused ? COLORS.powerOrange : COLORS.muted}
        strokeWidth={focused ? 2.5 : 2}
      />
      <Text
        className={`text-[10px] mt-0.5 ${
          focused ? 'text-power-orange font-semibold' : 'text-muted font-medium'
        }`}
      >
        {label}
      </Text>
    </View>
  );
}

export default function TabsLayout() {
  const insets = useSafeAreaInsets();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: '#FFFFFF',
          borderTopColor: '#E5E7EB',
          borderTopWidth: 1,
          height: 56 + insets.bottom,
          paddingBottom: insets.bottom,
          elevation: 8,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: -2 },
          shadowOpacity: 0.06,
          shadowRadius: 8,
        },
        tabBarShowLabel: false,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon icon={Home} label="Home" focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="discover"
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon icon={Search} label="Discover" focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="bookings"
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon icon={CalendarDays} label="Bookings" focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon icon={User} label="Profile" focused={focused} />
          ),
        }}
      />
    </Tabs>
  );
}
