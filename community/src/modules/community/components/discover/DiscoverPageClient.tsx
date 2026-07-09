"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { communityService } from "@/modules/community/services/community";
import {
  CommunityGroupSummary,
  CommunityUserSearchResult,
} from "@/modules/community/types";
import { CommunityPageHeader } from "@/modules/community/components/CommunityPageHeader";
import CreateCommunityModal from "@/modules/community/components/discover/CreateCommunityModal";
import EditCommunityModal from "@/modules/community/components/discover/EditCommunityModal";
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
  Eye,
  Filter,
  Shield,
  X,
  LogIn,
} from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";

export default function DiscoverPageClient() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const initialQuery = searchParams.get("q") || "";
  const initialSport = searchParams.get("sport") || "All";
  const initialTab = (searchParams.get("tab") as any) || "COMMUNITIES";

  const [searchQuery, setSearchQuery] = useState(initialQuery);
  const [debouncedQuery, setDebouncedQuery] = useState(initialQuery);
  const [communities, setCommunities] = useState<CommunityGroupSummary[]>([]);
  const [players, setPlayers] = useState<CommunityUserSearchResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<
    "COMMUNITIES" | "PARENTS" | "PLAYERS" | "COACHES"
  >(initialTab);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [groupToEdit, setGroupToEdit] = useState<CommunityGroupSummary | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const [selectedCommunity, setSelectedCommunity] =
    useState<CommunityGroupSummary | null>(null);
  const [isCommunityModalOpen, setIsCommunityModalOpen] = useState(false);
  const [isJoiningCommunity, setIsJoiningCommunity] = useState(false);

  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);
  const [isPlayerModalOpen, setIsPlayerModalOpen] = useState(false);

  const [showFilters, setShowFilters] = useState(false);
  const [selectedSport, setSelectedSport] = useState<string>(initialSport);
  const [selectedCity, setSelectedCity] = useState<string>("All");

  const isFirstRender = useRef(true);

  // Reset filters when tab changes
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    setSelectedSport("All");
    setSelectedCity("All");
  }, [activeTab]);

  // Derive unique filter options
  const availableSports = Array.from(
    new Set([
      ...(selectedSport !== "All" ? [selectedSport] : []),
      ...(activeTab === "COMMUNITIES"
        ? (communities.map((c) => c.sport).filter(Boolean) as string[])
        : (players.flatMap((p) => p.sports || []) as string[])),
    ]),
  ).sort();

  const availableCities = Array.from(
    new Set(
      activeTab === "COMMUNITIES"
        ? (communities.map((c) => c.city).filter(Boolean) as string[])
        : (players.map((p) => p.city).filter(Boolean) as string[]),
    ),
  ).sort();

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
          if (activeTab === "PLAYERS") filters = { userType: "Player" };
          if (activeTab === "COACHES") filters = { role: "Coach" };

          const playersData = await communityService.searchPlayers(
            debouncedQuery,
            filters,
          );
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

  const handleDeleteGroup = async (groupId: string) => {
    if (!confirm("Are you sure you want to delete this community?")) return;
    try {
      await communityService.deleteGroup(groupId);
      setCommunities((prev) => prev.filter((c) => c.id !== groupId));
      if (selectedCommunity?.id === groupId) {
        setIsCommunityModalOpen(false);
      }
    } catch (error) {
      console.error("Failed to delete group:", error);
      alert("Failed to delete community. You must be an admin.");
    }
  };

  const handleEditGroup = (community: CommunityGroupSummary) => {
    setIsCommunityModalOpen(false);
    setGroupToEdit(community);
    setIsEditModalOpen(true);
  };

  const handleCommunityChat = async (groupId: string) => {
    try {
      const convs = await communityService.listConversationsItems(1, 100, {
        type: "GROUPS",
      });
      const groupConv = convs.find((c) => c.group?.id === groupId);
      if (groupConv) {
        router.push(
          `/chats?sidebar=conversations&directory=groups&conversation=${groupConv.id}`,
        );
      } else {
        router.push("/chats?sidebar=conversations&directory=groups");
      }
    } catch (error) {
      console.error("Failed to find group conversation:", error);
      router.push("/chats?sidebar=conversations&directory=groups");
    }
  };

  const handlePlayerChat = async (userId: string) => {
    try {
      const conversation = await communityService.startConversation(userId);
      router.push(`/chats?conversation=${conversation.id}`);
    } catch (error) {
      console.error("Failed to start conversation:", error);
    }
  };

  const filteredCommunities = communities
    .filter((c) => {
      if (selectedSport !== "All" && c.sport !== selectedSport) return false;
      if (selectedCity !== "All" && c.city !== selectedCity) return false;
      return true;
    })
    .sort((a, b) => (b.isAdmin ? 1 : 0) - (a.isAdmin ? 1 : 0));

  const filteredPlayers = players.filter((p) => {
    if (activeTab === "PARENTS") {
      if (p.userType !== "Parent") return false;
    } else if (activeTab === "PLAYERS") {
      if (p.userType !== "Player") return false;
    } else if (activeTab === "COACHES") {
      if (p.role !== "Coach") return false;
    } else return false;

    if (selectedSport !== "All" && !(p.sports || []).includes(selectedSport))
      return false;
    if (selectedCity !== "All" && p.city !== selectedCity) return false;
    return true;
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
          {/* Search Bar & Filters Toggle */}
          <div className="mx-auto flex w-full max-w-2xl flex-col gap-3">
            <div className="flex w-full gap-3">
              <div className="relative flex-1 group">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4 text-slate-400 transition-colors group-focus-within:text-power-orange">
                  <Search size={18} />
                </div>
                <input
                  type="text"
                  placeholder="Search communities and parents..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="discover-search"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery("")}
                    className="absolute inset-y-0 right-0 flex items-center pr-4 text-slate-400 hover:text-power-orange transition-colors"
                  >
                    <X size={16} />
                  </button>
                )}
              </div>
              <button
                onClick={() => setShowFilters(!showFilters)}
                className={`shrink-0 flex items-center gap-2 rounded-2xl border px-4 py-3.5 text-sm font-semibold backdrop-blur transition-all duration-300 ${
                  showFilters ||
                  selectedSport !== "All" ||
                  selectedCity !== "All"
                    ? "border-power-orange/30 bg-power-orange/5 text-power-orange shadow-sm"
                    : "border-white/60 bg-white/70 text-slate-500 hover:bg-white hover:text-slate-700"
                }`}
              >
                <Filter size={18} />
                <span className="hidden sm:inline">Filters</span>
                {(selectedSport !== "All" || selectedCity !== "All") && (
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-power-orange/15 text-[10px] text-power-orange font-bold">
                    {(selectedSport !== "All" ? 1 : 0) +
                      (selectedCity !== "All" ? 1 : 0)}
                  </span>
                )}
              </button>
            </div>

            <AnimatePresence>
              {showFilters && (
                <motion.div
                  initial={{ opacity: 0, height: 0, marginTop: 0 }}
                  animate={{ opacity: 1, height: "auto", marginTop: 8 }}
                  exit={{ opacity: 0, height: 0, marginTop: 0 }}
                  transition={{ type: "spring", damping: 25, stiffness: 300 }}
                  className="overflow-hidden"
                >
                  <div className="rounded-2xl border border-slate-200/60 bg-white/80 p-5 shadow-sm backdrop-blur-md">
                    <div className="grid gap-6 sm:grid-cols-2">
                      <div>
                        <label className="mb-2 block text-[11px] font-bold uppercase tracking-wider text-slate-400">
                          Sport
                        </label>
                        <select
                          value={selectedSport}
                          onChange={(e) => setSelectedSport(e.target.value)}
                          className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-medium text-slate-800 outline-none transition-colors focus:border-power-orange/40 focus:ring-2 focus:ring-power-orange/10"
                        >
                          <option value="All">All Sports</option>
                          {availableSports.map((s) => (
                            <option key={s} value={s}>
                              {s}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="mb-2 block text-[11px] font-bold uppercase tracking-wider text-slate-400">
                          City
                        </label>
                        <select
                          value={selectedCity}
                          onChange={(e) => setSelectedCity(e.target.value)}
                          className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-medium text-slate-800 outline-none transition-colors focus:border-power-orange/40 focus:ring-2 focus:ring-power-orange/10"
                        >
                          <option value="All">All Cities</option>
                          {availableCities.map((c) => (
                            <option key={c} value={c}>
                              {c}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {(selectedSport !== "All" || selectedCity !== "All") && (
                      <div className="mt-4 flex justify-end">
                        <button
                          onClick={() => {
                            setSelectedSport("All");
                            setSelectedCity("All");
                          }}
                          className="text-xs font-semibold text-power-orange/80 hover:text-power-orange transition-colors"
                        >
                          Clear Filters
                        </button>
                      </div>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Tabs */}
          <div className="mx-auto flex w-full max-w-2xl rounded-2xl bg-slate-100/80 p-1 shadow-inner backdrop-blur-md ring-1 ring-slate-200/50">
            {["COMMUNITIES", "PARENTS", "PLAYERS", "COACHES"].map((tab) => {
              const isActive = activeTab === tab;
              const Icon =
                tab === "COMMUNITIES"
                  ? Users
                  : tab === "PARENTS"
                    ? User
                    : tab === "PLAYERS"
                      ? Users
                      : Trophy;
              const label =
                tab === "COMMUNITIES"
                  ? "Communities"
                  : tab === "PARENTS"
                    ? "Parents"
                    : tab === "PLAYERS"
                      ? "Players"
                      : "Coaches";

              return (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab as any)}
                  className={`relative flex flex-1 items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-semibold transition-colors duration-200 ${
                    isActive ? "text-power-orange" : "text-slate-400 hover:text-slate-600"
                  }`}
                >
                  {isActive && (
                    <motion.div
                      layoutId="discoverTab"
                      className="absolute inset-0 z-0 rounded-xl bg-white shadow-md ring-1 ring-slate-200/60"
                      initial={false}
                      transition={{ type: "spring", stiffness: 280, damping: 26, mass: 0.8 }}
                    />
                  )}
                  <span className="relative z-10 flex items-center gap-2">
                    <Icon size={16} />
                    <span className="hidden sm:inline">{label}</span>
                    <span className="inline sm:hidden">{label.slice(0, 4)}.</span>
                  </span>
                </button>
              );
            })}
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
                  <div className="mb-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <h2 className="community-section-title">Communities</h2>
                      <div className="flex items-center gap-2 mt-1">
                        <p className="text-sm leading-6 text-slate-500 sm:text-base">
                          Groups and squads for your favorite sports
                        </p>
                        <span className="inline-flex items-center justify-center rounded-full bg-white/80 shadow-sm border border-white px-2.5 py-0.5 text-xs font-semibold text-slate-600">
                          {filteredCommunities.length}
                        </span>
                      </div>
                    </div>
                    <button
                      onClick={() => setIsCreateModalOpen(true)}
                      className="inline-flex items-center gap-2 rounded-xl bg-power-orange/90 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-power-orange"
                    >
                      <Plus size={16} />
                      <span className="hidden sm:inline">Create Community</span>
                      <span className="inline sm:hidden">Create</span>
                    </button>
                  </div>

                  {filteredCommunities.length === 0 ? (
                    <div className="community-card flex flex-col items-center justify-center py-12 text-center bg-white/50 backdrop-blur-sm border-white/60">
                      <Users size={32} className="text-slate-300" />
                      <p className="mt-3 text-sm font-medium text-slate-900">
                        No communities found
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        Try adjusting your search or filters.
                      </p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
                      <AnimatePresence>
                        {filteredCommunities.map((group, idx) => (
                          <motion.div
                            key={group.id}
                            initial={{ opacity: 0, y: 15 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            transition={{ duration: 0.3, delay: idx * 0.05 }}
                            className="discover-card group flex flex-col p-4"
                          >
                            {/* Rectangular Logo/Cover */}
                            <div className="relative w-full aspect-[5/3] rounded-xl bg-gradient-to-br from-orange-50 to-slate-100 flex items-center justify-center mb-4 shrink-0 overflow-hidden">
                              <div className="absolute left-3 top-3 z-10 flex flex-wrap gap-1.5">
                                {group.isMember && (
                                  <span className="discover-badge text-emerald-600 border-emerald-500/30 bg-emerald-50/90 shadow-sm">
                                    Joined
                                  </span>
                                )}
                                {group.audience && group.audience !== "ALL" && (
                                  <span className="discover-badge text-amber-600 border-amber-500/30 bg-amber-50/90 shadow-sm">
                                    <Shield size={10} className="mr-0.5 text-amber-500" />
                                    {group.audience === "PLAYERS_ONLY" ? "Players Only" : "Coaches Only"}
                                  </span>
                                )}
                              </div>

                              {group.profilePicture ? (
                                <img
                                  src={group.profilePicture}
                                  alt={group.name}
                                  className="absolute inset-0 h-full w-full object-cover"
                                />
                              ) : (
                                <span className="font-title text-4xl font-bold text-power-orange/20 uppercase">
                                  {group.name.charAt(0)}
                                </span>
                              )}
                            </div>
                            
                            <div className="flex-1 flex flex-col px-2 pb-2">
                              <div className="flex-1 min-w-0 w-full text-left">
                                <h3 className="font-title text-base font-bold text-slate-900 truncate">
                                  {group.name}
                               </h3>
                                <p className="mt-1.5 text-xs leading-relaxed text-slate-500 line-clamp-2 min-h-[32px]">
                                  {group.description || "No description provided."}
                                </p>
                              </div>
                              
                              <div className="mt-4 flex flex-col gap-3 border-t border-slate-100 pt-4 w-full">
                                <div className="flex items-center gap-2 text-[11px] font-medium">
                                  <div className="flex items-center gap-1.5 rounded-full border border-sky-200/60 bg-sky-50/60 px-2.5 py-1 text-sky-700">
                                    <Users size={12} className="text-sky-500" />
                                    {group.memberCount} members
                                  </div>
                                  {group.sport && (
                                    <div className="flex items-center gap-1.5 rounded-full border border-amber-200/60 bg-amber-50/60 px-2.5 py-1 text-amber-700">
                                      <Trophy size={12} className="text-amber-500" />
                                      <span className="truncate max-w-[80px]">{group.sport}</span>
                                    </div>
                                  )}
                                </div>
                                <div className="flex w-full gap-2">
                                  <button
                                    onClick={() => {
                                      setSelectedCommunity(group);
                                      setIsCommunityModalOpen(true);
                                    }}
                                    className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-[11px] font-bold uppercase tracking-wider text-slate-600 transition hover:bg-slate-50 hover:border-slate-300"
                                  >
                                    <Eye size={14} /> Details
                                  </button>
                                  {group.isMember ? (
                                    <button
                                      onClick={() => handleCommunityChat(group.id)}
                                      className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-power-orange/85 px-3 py-2 text-[11px] font-bold uppercase tracking-wider text-white shadow-sm transition hover:bg-power-orange"
                                    >
                                      <MessageSquare size={14} /> Chat
                                    </button>
                                  ) : (
                                    <button
                                      onClick={() => handleJoinGroup(group.id)}
                                      disabled={isJoiningCommunity}
                                      className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-slate-800 px-3 py-2 text-[11px] font-bold uppercase tracking-wider text-white shadow-sm transition hover:bg-slate-700 disabled:opacity-60"
                                    >
                                      <LogIn size={14} /> Join
                                    </button>
                                  )}
                                </div>
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
                        {activeTab === "PARENTS"
                          ? "Sports Parents"
                          : activeTab === "PLAYERS"
                            ? "Athletes"
                            : "Coaches"}
                      </h2>
                      <p className="community-section-copy">
                        {activeTab === "PARENTS"
                          ? "Connect with other parents"
                          : activeTab === "PLAYERS"
                            ? "Find other athletes to play with"
                            : "Discover local sports coaches"}
                      </p>
                    </div>
                    <span className="inline-flex items-center justify-center rounded-full bg-white/80 shadow-sm border border-white px-2.5 py-0.5 text-xs font-semibold text-slate-600">
                      {filteredPlayers.length}
                    </span>
                  </div>

                  {filteredPlayers.length === 0 ? (
                    <div className="community-card flex flex-col items-center justify-center py-12 text-center bg-white/50 backdrop-blur-sm border-white/60">
                      <User size={32} className="text-slate-300" />
                      <p className="mt-3 text-sm font-medium text-slate-900">
                        No {activeTab.toLowerCase()} found
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        Try a different search term.
                      </p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                      <AnimatePresence>
                        {filteredPlayers.map((player, idx) => (
                          <motion.div
                            key={player.id}
                            initial={{ opacity: 0, y: 15 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            transition={{ duration: 0.3, delay: idx * 0.05 }}
                            className="discover-card group flex flex-col items-center p-5 text-center"
                          >
                            <div className="discover-avatar-ring mb-3 h-24 w-24 shrink-0">
                              {player.photoUrl ? (
                                <img
                                  src={player.photoUrl}
                                  alt={player.displayName}
                                  className="h-full w-full rounded-full object-cover"
                                />
                              ) : (
                                <div className="flex h-full w-full items-center justify-center rounded-full bg-slate-100 text-slate-400">
                                  <User size={36} />
                                </div>
                              )}
                            </div>
                            <h3 className="font-title text-base font-bold text-slate-900 line-clamp-1">
                              {player.displayName}
                            </h3>
                            
                            <span className="mt-1 discover-badge text-slate-600 border-slate-200 bg-slate-50">
                              {player.userType === "Parent" ? "Parent" : player.role === "Coach" ? "Coach" : "Player"}
                            </span>

                            <div className="mt-3 flex flex-wrap items-center justify-center gap-1.5 min-h-[24px]">
                              {player.sports?.slice(0, 2).map((s) => (
                                <span key={s} className="inline-flex rounded-lg bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-600 border border-slate-200/60">
                                  {s}
                                </span>
                              ))}
                              {player.sports?.length > 2 && (
                                <span className="inline-flex rounded-lg bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-600 border border-slate-200/60">
                                  +{player.sports.length - 2}
                                </span>
                              )}
                            </div>

                            <div className="mt-5 flex w-full gap-2 border-t border-slate-100/50 pt-4">
                              <button
                                onClick={() => {
                                  setSelectedPlayerId(player.id);
                                  setIsPlayerModalOpen(true);
                                }}
                                className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-2 py-2 text-[10px] font-bold uppercase tracking-wider text-slate-600 transition hover:bg-slate-50 hover:border-slate-300"
                              >
                                <Eye size={12} /> Details
                              </button>
                              <button
                                onClick={() => handlePlayerChat(player.id)}
                                className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-power-orange/85 px-2 py-2 text-[10px] font-bold uppercase tracking-wider text-white shadow-sm transition hover:bg-power-orange"
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
        onSuccess={() => setRefreshTrigger((p) => p + 1)}
      />

      {groupToEdit && (
        <EditCommunityModal
          isOpen={isEditModalOpen}
          onClose={() => {
            setIsEditModalOpen(false);
            setGroupToEdit(null);
          }}
          onSuccess={() => setRefreshTrigger((p) => p + 1)}
          initialData={groupToEdit}
        />
      )}

      {/* Detail Modals */}
      <CommunityDetailsModal
        isOpen={isCommunityModalOpen}
        onClose={() => setIsCommunityModalOpen(false)}
        community={selectedCommunity}
        onJoin={handleJoinGroup}
        onChat={handleCommunityChat}
        isJoining={isJoiningCommunity}
        onDelete={handleDeleteGroup}
        onEdit={handleEditGroup}
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
