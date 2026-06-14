"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { communityService } from "@/modules/community/services/community";
import {
  CommunityGroupSummary,
  CommunityUserSearchResult,
} from "@/modules/community/types";
import { CommunityPageHeader } from "@/modules/community/components/CommunityPageHeader";
import CreateCommunityModal from "@/modules/community/components/discover/CreateCommunityModal";
import CommunityDetailsModal from "@/modules/community/components/discover/CommunityDetailsModal";
import PlayerDetailsModal from "@/modules/community/components/discover/PlayerDetailsModal";
import {
  Search,
  Users,
  MapPin,
  Trophy,
  Loader2,
  User,
  Plus,
  MessageSquare,
  LogIn,
  Eye,
} from "lucide-react";
import { useRouter } from "next/navigation";

export default function DiscoverPageClient() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [communities, setCommunities] = useState<CommunityGroupSummary[]>([]);
  const [players, setPlayers] = useState<CommunityUserSearchResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<
    "COMMUNITIES" | "PARENTS" | "PLAYERS" | "COACHES"
  >("COMMUNITIES");
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const [selectedCommunity, setSelectedCommunity] =
    useState<CommunityGroupSummary | null>(null);
  const [isCommunityModalOpen, setIsCommunityModalOpen] = useState(false);
  const [isJoiningCommunity, setIsJoiningCommunity] = useState(false);

  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);
  const [isPlayerModalOpen, setIsPlayerModalOpen] = useState(false);

  // Debounce search
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedQuery(searchQuery);
    }, 400);
    return () => clearTimeout(handler);
  }, [searchQuery]);

  useEffect(() => {
    let isMounted = true;
    const fetchData = async () => {
      setLoading(true);
      try {
        if (activeTab === "COMMUNITIES") {
          const groupsData = await communityService.listGroups(debouncedQuery);
          if (isMounted) {
            setCommunities(groupsData);
            setPlayers([]);
          }
        } else {
          let filters = {};
          if (activeTab === "PARENTS") filters = { userType: "Parent" };
          if (activeTab === "PLAYERS") filters = { userType: "Recreational" };
          if (activeTab === "COACHES") filters = { role: "COACH" };

          const playersData =
            await communityService.searchPlayers(debouncedQuery, filters);
          if (isMounted) {
            setPlayers(playersData);
            setCommunities([]);
          }
        }
      } catch (error) {
        console.error("Failed to fetch discover data:", error);
      } finally {
        if (isMounted) setLoading(false);
      }
    };
    fetchData();
    return () => {
      isMounted = false;
    };
  }, [debouncedQuery, refreshTrigger, activeTab]);

  const handleCommunityCreated = () => {
    setRefreshTrigger((prev) => prev + 1);
  };

  const handleJoinGroup = async (groupId: string) => {
    setIsJoiningCommunity(true);
    try {
      await communityService.joinGroup(groupId);
      // Update local state to reflect membership
      setCommunities((prev) =>
        prev.map((c) =>
          c.id === groupId
            ? { ...c, isMember: true, memberCount: c.memberCount + 1 }
            : c,
        ),
      );
      if (selectedCommunity?.id === groupId) {
        setSelectedCommunity({
          ...selectedCommunity,
          isMember: true,
          memberCount: selectedCommunity.memberCount + 1,
        });
      }
    } catch (error) {
      console.error("Failed to join community:", error);
    } finally {
      setIsJoiningCommunity(false);
    }
  };

  const handleCommunityChat = (groupId: string) => {
    router.push("/chats?sidebar=groups");
  };

  const handlePlayerChat = async (userId: string) => {
    try {
      await communityService.startConversation(userId);
      router.push("/chats");
    } catch (error) {
      console.error("Failed to start conversation:", error);
    }
  };

  const filteredPlayers = players.filter((p) => {
    if (activeTab === "PARENTS") return p.userType === "Parent";
    if (activeTab === "PLAYERS") return p.userType === "Recreational";
    if (activeTab === "COACHES") return p.role === "COACH";
    return false;
  });

  return (
    <div className="community-page-shell">
      <div className="community-content-wrap">
        <CommunityPageHeader
          title="Discover"
          subtitle="Find local sports communities, coaches, and connect with other sports parents."
          badge="Explore"
        />

        <div className="mt-8 flex flex-col gap-6">
          {/* Search Bar */}
          <div className="relative mx-auto w-full max-w-2xl">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4 text-slate-400">
              <Search size={18} />
            </div>
            <input
              type="text"
              placeholder="Search communities and parents..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-2xl border border-slate-200 bg-white/80 py-3.5 pl-11 pr-4 text-sm font-medium text-slate-900 shadow-sm backdrop-blur transition-all focus:border-power-orange/50 focus:bg-white focus:outline-none focus:ring-4 focus:ring-power-orange/10"
            />
          </div>

          {/* Tabs */}
          <div className="mx-auto flex w-full max-w-2xl rounded-xl border border-slate-200 bg-white/50 p-1 shadow-sm backdrop-blur">
            <button
              onClick={() => setActiveTab("COMMUNITIES")}
              className={`flex flex-1 items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-semibold transition-all ${
                activeTab === "COMMUNITIES"
                  ? "bg-white text-slate-900 shadow-sm ring-1 ring-slate-200"
                  : "text-slate-500 hover:text-slate-700 hover:bg-slate-50/50"
              }`}
            >
              <Users size={16} />
              Communities
            </button>
            <button
              onClick={() => setActiveTab("PARENTS")}
              className={`flex flex-1 items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-semibold transition-all ${
                activeTab === "PARENTS"
                  ? "bg-white text-slate-900 shadow-sm ring-1 ring-slate-200"
                  : "text-slate-500 hover:text-slate-700 hover:bg-slate-50/50"
              }`}
            >
              <User size={16} />
              Parents
            </button>
            <button
              onClick={() => setActiveTab("PLAYERS")}
              className={`flex flex-1 items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-semibold transition-all ${
                activeTab === "PLAYERS"
                  ? "bg-white text-slate-900 shadow-sm ring-1 ring-slate-200"
                  : "text-slate-500 hover:text-slate-700 hover:bg-slate-50/50"
              }`}
            >
              <Users size={16} />
              Players
            </button>
            <button
              onClick={() => setActiveTab("COACHES")}
              className={`flex flex-1 items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-semibold transition-all ${
                activeTab === "COACHES"
                  ? "bg-white text-slate-900 shadow-sm ring-1 ring-slate-200"
                  : "text-slate-500 hover:text-slate-700 hover:bg-slate-50/50"
              }`}
            >
              <Trophy size={16} />
              Coaches
            </button>
          </div>

          {loading ? (
            <div className="flex h-64 items-center justify-center">
              <Loader2 className="animate-spin text-power-orange" size={32} />
            </div>
          ) : (
            <div className="flex flex-col gap-12">
              {/* Communities Section */}
              {activeTab === "COMMUNITIES" && (
                <motion.section
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.2 }}
                >
                  <div className="mb-4 flex items-center justify-between">
                    <div>
                      <h2 className="community-section-title">Communities</h2>
                      <div className="flex items-center gap-2 mt-1">
                        <p className="text-sm leading-6 text-slate-500 sm:text-base">
                          Groups and squads for your favorite sports
                        </p>
                        <span className="inline-flex items-center justify-center rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-600">
                          {communities.length}
                        </span>
                      </div>
                    </div>
                    <button
                      onClick={() => setIsCreateModalOpen(true)}
                      className="inline-flex items-center gap-2 rounded-xl bg-power-orange px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-[#d96610]"
                    >
                      <Plus size={16} />
                      <span className="hidden sm:inline">Create Community</span>
                      <span className="inline sm:hidden">Create</span>
                    </button>
                  </div>

                  {communities.length === 0 ? (
                    <div className="community-card flex flex-col items-center justify-center py-12 text-center">
                      <Users size={32} className="text-slate-300" />
                      <p className="mt-3 text-sm font-medium text-slate-900">
                        No communities found
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        Try a different search term.
                      </p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                      <AnimatePresence>
                        {communities.map((group, idx) => (
                          <motion.div
                            key={group.id}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            transition={{ duration: 0.2, delay: idx * 0.05 }}
                            className="group relative flex flex-col justify-between overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-power-orange/30 hover:shadow-md hover:shadow-power-orange/5"
                          >
                            <div className="absolute inset-0 bg-gradient-to-br from-power-orange/[0.03] to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
                            <div className="relative z-10">
                              <div className="flex items-start justify-between">
                                <h3 className="font-title text-base font-bold text-slate-900 line-clamp-1">
                                  {group.name}
                                </h3>
                                {group.isMember && (
                                  <span className="inline-flex shrink-0 items-center rounded-md bg-turf-green/10 px-1.5 py-0.5 text-[10px] font-bold text-turf-green uppercase tracking-wide">
                                    Joined
                                  </span>
                                )}
                              </div>
                              <p className="mt-2 text-xs leading-relaxed text-slate-500 line-clamp-2 min-h-[32px]">
                                {group.description ||
                                  "No description provided."}
                              </p>
                            </div>
                            <div className="relative z-10 mt-5 flex flex-col gap-3 border-t border-slate-100 pt-4">
                              <div className="flex items-center gap-3 text-xs font-medium text-slate-500">
                                <div className="flex items-center gap-1">
                                  <Users
                                    size={12}
                                    className="text-power-orange"
                                  />
                                  {group.memberCount}
                                </div>
                                {group.city && (
                                  <div className="flex items-center gap-1">
                                    <MapPin
                                      size={12}
                                      className="text-turf-green"
                                    />
                                    <span className="line-clamp-1 max-w-[80px]">
                                      {group.city}
                                    </span>
                                  </div>
                                )}
                              </div>
                              <div className="flex w-full gap-2">
                                <button
                                  onClick={() => {
                                    setSelectedCommunity(group);
                                    setIsCommunityModalOpen(true);
                                  }}
                                  className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-[11px] font-bold uppercase tracking-wider text-slate-600 transition hover:bg-slate-50"
                                >
                                  <Eye size={14} /> Details
                                </button>
                                {group.isMember ? (
                                  <button
                                    onClick={() =>
                                      handleCommunityChat(group.id)
                                    }
                                    className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-slate-900 px-3 py-2 text-[11px] font-bold uppercase tracking-wider text-white transition hover:bg-slate-800"
                                  >
                                    <MessageSquare size={14} /> Chat
                                  </button>
                                ) : (
                                  <button
                                    onClick={() => handleJoinGroup(group.id)}
                                    disabled={isJoiningCommunity}
                                    className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-power-orange px-3 py-2 text-[11px] font-bold uppercase tracking-wider text-white shadow-sm transition hover:bg-[#d96610] disabled:opacity-60"
                                  >
                                    <LogIn size={14} /> Join
                                  </button>
                                )}
                              </div>
                            </div>
                          </motion.div>
                        ))}
                      </AnimatePresence>
                    </div>
                  )}
                </motion.section>
              )}

              {/* People Section */}
              {activeTab !== "COMMUNITIES" && (
                <motion.section
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.2 }}
                >
                  <div className="mb-4 flex items-center justify-between">
                    <div>
                      <h2 className="community-section-title">
                        {activeTab === "PARENTS" ? "Sports Parents" : activeTab === "PLAYERS" ? "Athletes" : "Coaches"}
                      </h2>
                      <p className="community-section-copy">
                        {activeTab === "PARENTS"
                          ? "Connect with other parents"
                          : activeTab === "PLAYERS"
                            ? "Find other athletes to play with"
                            : "Discover local sports coaches"}
                      </p>
                    </div>
                    <span className="inline-flex items-center justify-center rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-600">
                      {filteredPlayers.length}
                    </span>
                  </div>

                  {filteredPlayers.length === 0 ? (
                    <div className="community-card flex flex-col items-center justify-center py-12 text-center">
                      <User size={32} className="text-slate-300" />
                      <p className="mt-3 text-sm font-medium text-slate-900">
                        No {activeTab.toLowerCase()} found
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        Try a different search term.
                      </p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                      <AnimatePresence>
                        {filteredPlayers.map((player, idx) => (
                          <motion.div
                            key={player.id}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            transition={{ duration: 0.2, delay: idx * 0.05 }}
                            className="group flex flex-col items-center overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 text-center shadow-sm transition hover:border-power-orange/30 hover:shadow-md hover:shadow-power-orange/5"
                          >
                            <div className="relative mb-3 h-16 w-16 overflow-hidden rounded-full bg-slate-100 ring-4 ring-white shadow-sm">
                              {player.photoUrl ? (
                                <img
                                  src={player.photoUrl}
                                  alt={player.displayName}
                                  className="h-full w-full object-cover"
                                />
                              ) : (
                                <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-power-orange/20 to-amber-500/20 text-power-orange">
                                  <User size={24} />
                                </div>
                              )}
                            </div>
                            <h3 className="font-title text-sm font-bold text-slate-900 line-clamp-1">
                              {player.displayName}
                            </h3>
                            <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-wider text-power-orange">
                              {player.userType === "Parent" ? "Parent" : player.role === "COACH" ? "Coach" : "Player"}
                            </p>
                            <div className="mt-3 flex flex-wrap items-center justify-center gap-1.5">
                              {player.sports?.slice(0, 2).map((s) => (
                                <span
                                  key={s}
                                  className="inline-flex rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-600"
                                >
                                  {s}
                                </span>
                              ))}
                              {player.sports?.length > 2 && (
                                <span className="inline-flex rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-600">
                                  +{player.sports.length - 2}
                                </span>
                              )}
                            </div>

                            <div className="mt-5 flex w-full gap-2 border-t border-slate-100 pt-4">
                              <button
                                onClick={() => {
                                  setSelectedPlayerId(player.id);
                                  setIsPlayerModalOpen(true);
                                }}
                                className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2 py-2 text-[10px] font-bold uppercase tracking-wider text-slate-600 transition hover:bg-slate-50"
                              >
                                <Eye size={12} /> Details
                              </button>
                              <button
                                onClick={() => handlePlayerChat(player.id)}
                                className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-sky-500 px-2 py-2 text-[10px] font-bold uppercase tracking-wider text-white shadow-sm transition hover:bg-sky-600"
                              >
                                <MessageSquare size={12} /> Chat
                              </button>
                            </div>
                          </motion.div>
                        ))}
                      </AnimatePresence>
                    </div>
                  )}
                </motion.section>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Create Community Modal */}
      <CreateCommunityModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSuccess={handleCommunityCreated}
      />

      {/* Detail Modals */}
      <CommunityDetailsModal
        isOpen={isCommunityModalOpen}
        onClose={() => setIsCommunityModalOpen(false)}
        community={selectedCommunity}
        onJoin={handleJoinGroup}
        onChat={handleCommunityChat}
        isJoining={isJoiningCommunity}
      />

      <PlayerDetailsModal
        isOpen={isPlayerModalOpen}
        onClose={() => {
          setIsPlayerModalOpen(false);
          setTimeout(() => setSelectedPlayerId(null), 200);
        }}
        userId={selectedPlayerId!}
        onChat={handlePlayerChat}
      />
    </div>
  );
}
