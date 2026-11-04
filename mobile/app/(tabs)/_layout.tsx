import { Tabs } from "expo-router";
import { Text, type ColorValue } from "react-native";
import { Home, Users, CalendarDays, Award, User } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { COLORS } from "@/lib/constants";

type TabIcon = React.ComponentType<{ size: number; color: string; strokeWidth?: number }>;

// The tab bar draws its own icon and label, so each tab is laid out and centred the same way and
// the labels read as labels to a screen reader. Five tabs share the width, so labels have to be
// short: a word as long as "Opportunities" does not fit a fifth of a phone's width, which is why this
// tab is called "Apply" (its screen is titled Opportunities).
const tab = (title: string, Icon: TabIcon) => ({
  title,
  tabBarAccessibilityLabel: title,
  tabBarIcon: ({ color, focused }: { color: ColorValue; focused: boolean }) => (
    // The tab bar passes the tint as a ColorValue; at runtime it is the colour string we set.
    <Icon size={22} color={color as string} strokeWidth={focused ? 2.4 : 2} />
  ),
  tabBarLabel: ({ color, focused }: { color: ColorValue; focused: boolean }) => (
    <Text
      numberOfLines={1}
      adjustsFontSizeToFit
      minimumFontScale={0.8}
      allowFontScaling={false}
      style={{
        color,
        fontSize: 11,
        marginTop: 2,
        fontWeight: focused ? "700" : "500",
        maxWidth: "100%",
      }}
    >
      {title}
    </Text>
  ),
});

export default function TabsLayout() {
  const insets = useSafeAreaInsets();
  // Phones with gesture navigation can report no bottom inset; keep a little room anyway.
  const bottom = Math.max(insets.bottom, 8);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: COLORS.action,
        tabBarInactiveTintColor: COLORS.muted,
        tabBarHideOnKeyboard: true,
        tabBarStyle: {
          backgroundColor: COLORS.canvas,
          borderTopColor: COLORS.hairline,
          borderTopWidth: 1,
          elevation: 0,
          shadowOpacity: 0,
          height: 62 + bottom,
          paddingTop: 8,
          paddingBottom: bottom,
        },
        tabBarItemStyle: { paddingHorizontal: 2 },
      }}
    >
      <Tabs.Screen name="index" options={tab("Home", Home)} />
      <Tabs.Screen name="children" options={tab("Children", Users)} />
      <Tabs.Screen name="planner" options={tab("Planner", CalendarDays)} />
      <Tabs.Screen name="opportunities" options={tab("Apply", Award)} />
      <Tabs.Screen name="profile" options={tab("Profile", User)} />
    </Tabs>
  );
}
