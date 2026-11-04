import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  FlatList,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import { useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Search, X, SlidersHorizontal } from "lucide-react-native";
import { CoachCard } from "@components/shared/CoachCard";
import { VenueCard } from "@components/shared/VenueCard";
import { Badge } from "@components/ui/Badge";
import { discoveryApi } from "@/modules/discovery/services/discovery";
import { COLORS, SPORTS } from "@lib/constants";
import type { Coach, Venue, Academy } from "@/types";

type Tab = "coaches" | "venues" | "academies";

const TABS: { key: Tab; label: string }[] = [
  { key: "coaches", label: "Coaches" },
  { key: "venues", label: "Venues" },
  { key: "academies", label: "Academies" },
];

export default function DiscoverScreen() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ q?: string; sport?: string }>();

  const [activeTab, setActiveTab] = useState<Tab>("coaches");
  const [query, setQuery] = useState(params.q ?? "");
  const [selectedSport, setSelectedSport] = useState(params.sport ?? "");
  const [coaches, setCoaches] = useState<Coach[]>([]);
  const [venues, setVenues] = useState<Venue[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);

  const loadData = useCallback(
    async (reset = false) => {
      setLoading(true);
      const currentPage = reset ? 1 : page;
      try {
        const filters = {
          search: query,
          sport: selectedSport,
          page: currentPage,
          limit: 10,
        };

        if (activeTab === "coaches") {
          const res = await discoveryApi.getCoaches(filters);
          const data = res.data ?? [];
          setCoaches(reset ? data : (prev) => [...prev, ...data]);
          setHasMore(data.length === 10);
        } else if (activeTab === "venues") {
          const res = await discoveryApi.getVenues(filters);
          const data = res.data ?? [];
          setVenues(reset ? data : (prev) => [...prev, ...data]);
          setHasMore(data.length === 10);
        }
      } catch {
        // silently fail
      } finally {
        setLoading(false);
      }
    },
    [activeTab, query, selectedSport, page]
  );

  useEffect(() => {
    setPage(1);
    loadData(true);
  }, [activeTab, selectedSport]);

  const handleSearch = () => {
    setPage(1);
    loadData(true);
  };

  const clearSearch = () => {
    setQuery("");
    setPage(1);
    loadData(true);
  };

  const EmptyState = ({ tab }: { tab: Tab }) => (
    <View className="flex-1 items-center justify-center py-20">
      <Text className="mb-3 text-4xl">🔍</Text>
      <Text className="text-foreground mb-1 text-base font-semibold">No {tab} found</Text>
      <Text className="text-muted px-8 text-center text-sm">
        Try adjusting your filters or search query
      </Text>
    </View>
  );

  return (
    <View className="bg-background flex-1">
      {/* Header */}
      <View
        className="border-border border-b bg-white px-5 pb-4"
        style={{ paddingTop: insets.top + 12 }}
      >
        <Text className="text-foreground mb-4 text-xl font-bold">Discover</Text>

        {/* Search */}
        <View className="h-12 flex-row items-center gap-3 rounded-2xl bg-gray-100 px-4">
          <Search size={18} color={COLORS.muted} />
          <TextInput
            className="text-foreground flex-1 text-base"
            placeholder="Search coaches, venues..."
            placeholderTextColor={COLORS.muted}
            value={query}
            onChangeText={setQuery}
            onSubmitEditing={handleSearch}
            returnKeyType="search"
          />
          {query.length > 0 && (
            <TouchableOpacity
              onPress={clearSearch}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <X size={16} color={COLORS.muted} />
            </TouchableOpacity>
          )}
        </View>

        {/* Tabs */}
        <View className="mt-4 flex-row gap-2">
          {TABS.map((tab) => (
            <TouchableOpacity
              key={tab.key}
              onPress={() => setActiveTab(tab.key)}
              className={`rounded-full px-4 py-2 ${
                activeTab === tab.key ? "bg-deep-slate" : "bg-gray-100"
              }`}
            >
              <Text
                className={`text-sm font-semibold ${
                  activeTab === tab.key ? "text-white" : "text-muted"
                }`}
              >
                {tab.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Sports Filter */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        className="border-border border-b bg-white"
        contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 10, gap: 8 }}
      >
        <TouchableOpacity
          onPress={() => setSelectedSport("")}
          className={`rounded-full px-3 py-1.5 ${
            !selectedSport ? "bg-power-orange" : "bg-gray-100"
          }`}
        >
          <Text
            className={`text-xs font-medium ${!selectedSport ? "text-white" : "text-foreground"}`}
          >
            All
          </Text>
        </TouchableOpacity>
        {SPORTS.map((sport) => (
          <TouchableOpacity
            key={sport}
            onPress={() => setSelectedSport(selectedSport === sport ? "" : sport)}
            className={`rounded-full px-3 py-1.5 ${
              selectedSport === sport ? "bg-power-orange" : "bg-gray-100"
            }`}
          >
            <Text
              className={`text-xs font-medium ${
                selectedSport === sport ? "text-white" : "text-foreground"
              }`}
            >
              {sport}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Results */}
      {loading && page === 1 ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color={COLORS.powerOrange} />
        </View>
      ) : (
        <FlatList<Coach | Venue>
          data={activeTab === "coaches" ? coaches : activeTab === "venues" ? venues : []}
          keyExtractor={(item) => item._id}
          contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={<EmptyState tab={activeTab} />}
          renderItem={({ item }) => {
            if (activeTab === "coaches") {
              return <CoachCard coach={item as Coach} />;
            }
            if (activeTab === "venues") {
              return <VenueCard venue={item as Venue} />;
            }
            return null;
          }}
          ListFooterComponent={
            loading && page > 1 ? (
              <ActivityIndicator color={COLORS.powerOrange} style={{ marginVertical: 16 }} />
            ) : activeTab === "academies" ? (
              <View className="items-center py-20">
                <Text className="mb-3 text-4xl">🏫</Text>
                <Text className="text-foreground mb-1 text-base font-semibold">
                  Academies coming soon
                </Text>
                <Text className="text-muted px-8 text-center text-sm">
                  Academy listings are launching shortly
                </Text>
              </View>
            ) : undefined
          }
          onEndReached={() => {
            if (hasMore && !loading) {
              setPage((p) => p + 1);
              loadData();
            }
          }}
          onEndReachedThreshold={0.3}
        />
      )}
    </View>
  );
}
