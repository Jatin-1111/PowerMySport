import React, { useCallback, useState } from "react";
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ChevronRight, Plus } from "lucide-react-native";
import { Avatar } from "@components/ui/Avatar";
import { Button } from "@components/ui/Button";
import { childrenApi, ageFromDob, type Child } from "@/modules/children/services/children";
import { COLORS } from "@lib/constants";
import { PressableScale, Reveal } from "@lib/motion";

export default function ChildrenScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [children, setChildren] = useState<Child[] | null>(null);
  const [failed, setFailed] = useState(false);

  const load = useCallback(async () => {
    setFailed(false);
    try {
      setChildren(await childrenApi.list());
    } catch {
      setFailed(true);
    }
  }, []);

  // Reload each time the tab is shown, so a child added on the next screen appears at once.
  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  return (
    <ScrollView
      className="bg-canvas flex-1"
      contentContainerStyle={{
        paddingTop: insets.top + 24,
        paddingBottom: 100,
        paddingHorizontal: 20,
      }}
    >
      <View className="mb-6 flex-row items-center justify-between">
        <Text className="text-ink text-3xl font-bold">My children</Text>
        {children && children.length > 0 && (
          <TouchableOpacity
            onPress={() => router.push("/children/add")}
            accessibilityLabel="Add a child"
            className="rounded-button bg-action h-10 w-10 items-center justify-center"
          >
            <Plus size={20} color="#FFFFFF" />
          </TouchableOpacity>
        )}
      </View>

      {failed ? (
        <View className="items-center py-16">
          <Text className="text-ink mb-1 text-base font-semibold">
            Could not load your children
          </Text>
          <Text className="text-muted mb-4 text-center text-sm">
            Check your connection and try again.
          </Text>
          <Button onPress={load}>Try again</Button>
        </View>
      ) : children === null ? (
        <View className="items-center py-16">
          <ActivityIndicator color={COLORS.action} />
        </View>
      ) : children.length === 0 ? (
        <View className="rounded-tile border-hairline bg-surface border p-6">
          <Text className="text-ink mb-1 text-lg font-semibold">Add your first child</Text>
          <Text className="text-body mb-5 text-sm leading-relaxed">
            A profile lets us build a sporting record, plan the season and send reminders that fit
            your child.
          </Text>
          <Button onPress={() => router.push("/children/add")}>Add a child</Button>
        </View>
      ) : (
        <View className="rounded-tile border-hairline bg-surface overflow-hidden border">
          {children.map((child, index) => {
            const age = child.age ?? ageFromDob(child.dob);
            const detail = [
              age !== null && age !== undefined ? `${age} years` : null,
              child.sportsFocus?.[0],
            ]
              .filter(Boolean)
              .join(" · ");
            return (
              <Reveal key={child._id} index={index}>
                <PressableScale
                  onPress={() =>
                    router.push({ pathname: "/children/[id]", params: { id: child._id } })
                  }
                  className={`flex-row items-center px-4 py-4 ${index > 0 ? "border-hairline border-t" : ""}`}
                >
                  <Avatar name={child.name} size="md" />
                  <View className="ml-3 flex-1">
                    <Text className="text-ink text-base font-semibold">{child.name}</Text>
                    {detail ? <Text className="text-muted mt-0.5 text-sm">{detail}</Text> : null}
                  </View>
                  <ChevronRight size={18} color={COLORS.muted} />
                </PressableScale>
              </Reveal>
            );
          })}
        </View>
      )}
    </ScrollView>
  );
}
