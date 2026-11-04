import { Tabs } from "expo-router";
import { View, Text } from "react-native";
import { Home, Users, User } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { COLORS } from "@/lib/constants";

interface TabIconProps {
  icon: React.ComponentType<{ size: number; color: string; strokeWidth?: number }>;
  label: string;
  focused: boolean;
}

function TabIcon({ icon: Icon, label, focused }: TabIconProps) {
  return (
    <View className="items-center justify-center pt-1">
      {focused && <View className="bg-action absolute -top-3 h-0.5 w-10 rounded-b-full" />}
      <Icon
        size={22}
        color={focused ? COLORS.action : COLORS.muted}
        strokeWidth={focused ? 2.5 : 2}
      />
      <Text
        className={`mt-0.5 text-[10px] ${
          focused ? "text-action font-semibold" : "text-muted font-medium"
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
          backgroundColor: "#FFFFFF",
          borderTopColor: "#E5E7EB",
          borderTopWidth: 1,
          height: 56 + insets.bottom,
          paddingBottom: insets.bottom,
          elevation: 8,
          shadowColor: "#000",
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
          tabBarIcon: ({ focused }) => <TabIcon icon={Home} label="Home" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="children"
        options={{
          tabBarIcon: ({ focused }) => <TabIcon icon={Users} label="Children" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          tabBarIcon: ({ focused }) => <TabIcon icon={User} label="Profile" focused={focused} />,
        }}
      />
    </Tabs>
  );
}
