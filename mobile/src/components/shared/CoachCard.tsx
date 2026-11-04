import React from "react";
import { View, Text, TouchableOpacity, Image } from "react-native";
import { useRouter } from "expo-router";
import { Star, MapPin, ChevronRight } from "lucide-react-native";
import { Avatar } from "@components/ui/Avatar";
import { Badge } from "@components/ui/Badge";
import { COLORS } from "@lib/constants";
import type { Coach } from "@/types";

interface CoachCardProps {
  coach: Coach;
  horizontal?: boolean;
}

export function CoachCard({ coach, horizontal = false }: CoachCardProps) {
  const router = useRouter();

  if (horizontal) {
    return (
      <TouchableOpacity
        onPress={() => router.push(`/coaches/${coach._id}`)}
        activeOpacity={0.85}
        className="mr-3 w-48 overflow-hidden rounded-2xl bg-white shadow-sm"
      >
        <View className="bg-deep-slate/10 h-24 items-center justify-center">
          <Avatar
            src={coach.profileImage || coach.user?.photoUrl}
            name={coach.user?.name}
            size="lg"
          />
        </View>
        <View className="p-3">
          <Text className="text-foreground text-sm font-bold" numberOfLines={1}>
            {coach.user?.name}
          </Text>
          <Text className="text-muted mt-0.5 text-xs" numberOfLines={1}>
            {coach.sports?.slice(0, 2).join(" · ")}
          </Text>
          <View className="mt-2 flex-row items-center justify-between">
            <View className="flex-row items-center gap-1">
              <Star size={11} color={COLORS.powerOrange} fill={COLORS.powerOrange} />
              <Text className="text-foreground text-xs font-semibold">
                {coach.rating?.toFixed(1) ?? "—"}
              </Text>
            </View>
            {coach.hourlyRate && (
              <Text className="text-power-orange text-xs font-bold">₹{coach.hourlyRate}/hr</Text>
            )}
          </View>
        </View>
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity
      onPress={() => router.push(`/coaches/${coach._id}`)}
      activeOpacity={0.85}
      className="mb-3 flex-row overflow-hidden rounded-2xl bg-white shadow-sm"
    >
      <View className="bg-deep-slate/10 w-24 items-center justify-center">
        <Avatar
          src={coach.profileImage || coach.user?.photoUrl}
          name={coach.user?.name}
          size="lg"
        />
      </View>
      <View className="flex-1 p-3">
        <View className="flex-row items-center justify-between">
          <Text className="text-foreground mr-2 flex-1 text-base font-bold" numberOfLines={1}>
            {coach.user?.name}
          </Text>
          {coach.isVerified && <Badge variant="success">Verified</Badge>}
        </View>
        <Text className="text-muted mt-0.5 text-sm" numberOfLines={1}>
          {coach.sports?.join(" · ")}
        </Text>
        {coach.location?.city && (
          <View className="mt-1 flex-row items-center gap-1">
            <MapPin size={11} color={COLORS.muted} />
            <Text className="text-muted text-xs">{coach.location.city}</Text>
            {coach.distance != null && (
              <Text className="text-muted text-xs"> · {coach.distance.toFixed(1)} km</Text>
            )}
          </View>
        )}
        <View className="mt-2 flex-row items-center justify-between">
          <View className="flex-row items-center gap-1">
            <Star size={12} color={COLORS.powerOrange} fill={COLORS.powerOrange} />
            <Text className="text-foreground text-sm font-semibold">
              {coach.rating?.toFixed(1) ?? "—"}
            </Text>
            {coach.totalReviews != null && (
              <Text className="text-muted text-xs">({coach.totalReviews})</Text>
            )}
          </View>
          {coach.hourlyRate && (
            <Text className="text-power-orange text-sm font-bold">₹{coach.hourlyRate}/hr</Text>
          )}
        </View>
      </View>
      <View className="items-center justify-center pr-3">
        <ChevronRight size={16} color={COLORS.muted} />
      </View>
    </TouchableOpacity>
  );
}
