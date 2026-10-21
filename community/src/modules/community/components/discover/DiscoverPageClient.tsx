"use client";

import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { communityService } from "@/modules/community/services/community";
import ConnectRequestModal from "@/modules/community/components/ConnectRequestModal";
import { useConnectRequest } from "@/modules/community/hooks/useConnectRequest";
import { CommunityGroupSummary, CommunityUserSearchResult } from "@/modules/community/types";
import { redirectToMainLogin } from "@/lib/auth/redirect";
import { hasAuthToken } from "@/lib/auth/token";
import { familyLine } from "@/modules/community/components/DependentSummaryList";
import { CommunityPageHeader } from "@/modules/community/components/CommunityPageHeader";
import CreateCommunityModal from "@/modules/community/components/discover/CreateCommunityModal";
import EditCommunityModal from "@/modules/community/components/discover/EditCommunityModal";
import CommunityDetailsModal from "@/modules/community/components/discover/CommunityDetailsModal";
import PlayerDetailsModal from "@/modules/community/components/discover/PlayerDetailsModal";
import { Search, Users, User, Plus, MessageSquare, X, LogIn } from "lucide-react";
import { toast } from "sonner";
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
  const [activeTab, setActiveTab] = useState<"COMMUNITIES" | "PARENTS">(initialTab);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [groupToEdit, setGroupToEdit] = useState<CommunityGroupSummary | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const [selectedCommunity, setSelectedCommunity] = useState<CommunityGroupSummary | null>(null);
  const [isCommunityModalOpen, setIsCommunityModalOpen] = useState(false);
  const [isJoiningCommunity, setIsJoiningCommunity] = useState(false);

  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);
  const [isPlayerModalOpen, setIsPlayerModalOpen] = useState(false);

  const [photoLightbox, setPhotoLightbox] = useState<{ url: string; name: string } | null>(null);

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
    ])
  ).sort();

  const availableCities = Array.from(
    new Set(
      activeTab === "COMMUNITIES"
        ? (communities.map((c) => c.city).filter(Boolean) as string[])
        : // Every child's city, not just the first: a parent with one child in
          // Chandigarh and one in Mohali belongs under both.
          (players.flatMap((p) => p.cities ?? (p.city ? [p.city] : [])) as string[])
    )
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
      if (activeTab !== "COMMUNITIES" && !hasAuthToken()) {
        redirectToMainLogin();
        return;
      }
      setLoading(true);
      try {
        if (activeTab === "COMMUNITIES") {
          const groupsData = await communityService.listGroups(debouncedQuery);
          if (isMounted) {
            setCommunities(groupsData);
            setPlayers([]);
          }
        } else {
          const playersData = await communityService.searchPlayers(debouncedQuery, {
            role: "Parent",
          });
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

  const handleJoinGroup = async (groupId: string) => {
    if (!hasAuthToken()) {
      redirectToMainLogin();
      return;
    }
    setIsJoiningCommunity(true);
    try {
      await communityService.joinGroup(groupId);
      // Update local state to reflect membership
      setCommunities((prev) =>
        prev.map((c) =>
          c.id === groupId ? { ...c, isMember: true, memberCount: c.memberCount + 1 } : c
        )
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
      toast.error("We could not delete this community. Only an admin can delete it.");
    }
  };

  const handleEditGroup = (community: CommunityGroupSummary) => {
    setIsCommunityModalOpen(false);
    setGroupToEdit(community);
    setIsEditModalOpen(true);
  };

  const handleCommunityChat = async (groupId: string) => {
    if (!hasAuthToken()) {
      redirectToMainLogin();
      return;
    }
    try {
      const convs = await communityService.listConversationsItems(1, 100, {
        type: "GROUPS",
      });
      const groupConv = convs.find((c) => c.group?.id === groupId);
      if (groupConv) {
        router.push(`/chats?sidebar=conversations&directory=groups&conversation=${groupConv.id}`);
      } else {
        router.push("/chats?sidebar=conversations&directory=groups");
      }
    } catch (error) {
      console.error("Failed to find group conversation:", error);
      router.push("/chats?sidebar=conversations&directory=groups");
    }
  };

  // A chat opens at once for someone who accepts messages from everyone, and
  // after the request's message is sent for everyone else.
  const connect = useConnectRequest((conversation) => {
    router.push(`/chats?conversation=${conversation.id}`);
  });

  // The directory does not say who takes requests, so the dialog opens when the
  // server asks for the message rather than before.
  const handlePlayerChat = async (userId: string, name?: string) => {
    if (!hasAuthToken()) {
      redirectToMainLogin();
      return;
    }
    try {
      await connect.start(userId, name ? { name } : undefined);
    } catch (error) {
      console.error("Failed to start conversation:", error);
    }
  };

  const communityGroupRank = (c: CommunityGroupSummary): number => {
    if (c.isOwner) return 0;
    if (c.isMember) return 1;
    return 2;
  };

  const filteredCommunities = communities
    .filter((c) => {
      if (selectedSport !== "All" && c.sport !== selectedSport) return false;
      if (selectedCity !== "All" && c.city !== selectedCity) return false;
      return true;
    })
    .sort((a, b) => communityGroupRank(a) - communityGroupRank(b));

  const filteredPlayers = players.filter((p) => {
    if (activeTab !== "PARENTS") return false;
    if (p.role !== "Parent") return false;

    if (selectedSport !== "All" && !(p.sports || []).includes(selectedSport)) return false;
    if (selectedCity !== "All") {
      const cities = p.cities ?? (p.city ? [p.city] : []);
      if (!cities.includes(selectedCity)) return false;
    }
    return true;
  });

  const activeFilterCount = (selectedSport !== "All" ? 1 : 0) + (selectedCity !== "All" ? 1 : 0);
  const clearFilters = () => {
    setSelectedSport("All");
    setSelectedCity("All");
  };
  const selectClass =
    "text-ink focus:border-ink h-11 w-full rounded-md border border-[#d9d3c8] bg-white px-3 text-base outline-none transition-colors duration-200 hover:border-ink/45 sm:w-52";

  return (
    <div className="community-page-shell">
      <div className="community-content-wrap">
        <CommunityPageHeader
          title="Discover"
          subtitle="Find local sports communities and connect with other sports parents."
          badge="Explore"
          size="lg"
        />

        <div className="mt-10 flex flex-col gap-10">
          {/* Controls: tabs on the left, search on the right. Filters sit in
              the open instead of behind a toggle, so a parent can see that
              sport and city narrow the list without hunting for it. */}
          <div className="flex flex-col gap-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div
                role="tablist"
                aria-label="Browse"
                className="border-hairline flex gap-8 border-b"
              >
                {(["COMMUNITIES", "PARENTS"] as const).map((tab) => {
                  const isActive = activeTab === tab;
                  const Icon = tab === "COMMUNITIES" ? Users : User;
                  const label = tab === "COMMUNITIES" ? "Communities" : "Parents";
                  return (
                    <button
                      key={tab}
                      type="button"
                      role="tab"
                      aria-selected={isActive}
                      onClick={() => {
                        if (tab !== "COMMUNITIES" && !hasAuthToken()) {
                          redirectToMainLogin();
                          return;
                        }
                        setActiveTab(tab);
                      }}
                      className={`-mb-px inline-flex min-h-12 items-center gap-2 border-b-2 text-base font-semibold transition-colors duration-200 ${
                        isActive
                          ? "border-ink text-ink"
                          : "text-ink-muted hover:text-ink border-transparent"
                      }`}
                    >
                      <Icon size={16} strokeWidth={1.5} aria-hidden="true" />
                      {label}
                    </button>
                  );
                })}
              </div>

              <div className="group relative w-full lg:max-w-md">
                <div className="text-ink-muted pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4">
                  <Search size={18} aria-hidden="true" />
                </div>
                <input
                  type="search"
                  placeholder="Search communities and parents"
                  aria-label="Search communities and parents"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="discover-search"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery("")}
                    aria-label="Clear search"
                    className="text-ink-muted hover:text-ink absolute inset-y-0 right-0 flex w-11 items-center justify-center transition-colors duration-200"
                  >
                    <X size={16} aria-hidden="true" />
                  </button>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:flex sm:items-center">
              <label className="sr-only" htmlFor="discover-sport">
                Sport
              </label>
              <select
                id="discover-sport"
                value={selectedSport}
                onChange={(e) => setSelectedSport(e.target.value)}
                className={selectClass}
              >
                <option value="All">All sports</option>
                {availableSports.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
              <label className="sr-only" htmlFor="discover-city">
                City
              </label>
              <select
                id="discover-city"
                value={selectedCity}
                onChange={(e) => setSelectedCity(e.target.value)}
                className={selectClass}
              >
                <option value="All">All cities</option>
                {availableCities.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
              {activeFilterCount > 0 && (
                <button
                  type="button"
                  onClick={clearFilters}
                  className="text-ink decoration-ink/30 hover:decoration-ink col-span-2 w-fit text-base font-semibold underline underline-offset-4 transition-colors duration-200 sm:col-span-1"
                >
                  Clear filters
                </button>
              )}
            </div>
          </div>

          {loading ? (
            <div
              aria-busy="true"
              aria-label="Loading"
              className="grid grid-cols-1 gap-x-8 gap-y-12 sm:grid-cols-2 lg:grid-cols-3"
            >
              {[1, 2, 3].map((i) => (
                <div key={i}>
                  <div className="bg-ink/10 aspect-[4/3] w-full animate-pulse rounded-2xl" />
                  <div className="bg-ink/10 mt-5 h-6 w-2/3 animate-pulse rounded-sm" />
                  <div className="bg-ink/10 mt-3 h-4 w-full animate-pulse rounded-sm" />
                </div>
              ))}
            </div>
          ) : (
            <>
              {activeTab === "COMMUNITIES" && (
                <section aria-labelledby="discover-communities">
                  <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
                    <div>
                      <h2 id="discover-communities" className="community-section-title">
                        Communities
                      </h2>
                      <p className="text-ink-body mt-1 text-base tabular-nums">
                        {filteredCommunities.length}{" "}
                        {filteredCommunities.length === 1 ? "group" : "groups"} for parents and
                        young players
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        if (!hasAuthToken()) {
                          redirectToMainLogin();
                          return;
                        }
                        setIsCreateModalOpen(true);
                      }}
                      className="bg-power-orange-solid btn-motion inline-flex min-h-11 items-center gap-2 rounded-md px-5 text-base font-semibold text-white hover:bg-indigo-700"
                    >
                      <Plus size={16} aria-hidden="true" />
                      Create community
                    </button>
                  </div>

                  {filteredCommunities.length === 0 ? (
                    <div className="bg-paper-deep rounded-2xl px-6 py-16 text-center">
                      <p className="font-editorial text-ink text-3xl font-light">
                        {activeFilterCount > 0 || searchQuery
                          ? "No communities match."
                          : "No communities yet."}
                      </p>
                      <p className="text-ink-body mx-auto mt-3 max-w-[44ch] text-base leading-relaxed">
                        {activeFilterCount > 0 || searchQuery
                          ? "Try a different search, or clear the filters to see every group."
                          : "Start the first one for your sport and city."}
                      </p>
                      {activeFilterCount > 0 && (
                        <button
                          type="button"
                          onClick={clearFilters}
                          className="text-ink decoration-ink/30 hover:decoration-ink mt-5 text-base font-semibold underline underline-offset-4 transition-colors duration-200"
                        >
                          Clear filters
                        </button>
                      )}
                    </div>
                  ) : (
                    <ul className="grid grid-cols-1 gap-x-8 gap-y-14 sm:grid-cols-2 lg:grid-cols-3">
                      {filteredCommunities.map((group) => (
                        <li key={group.id} className="group flex flex-col">
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedCommunity(group);
                              setIsCommunityModalOpen(true);
                            }}
                            aria-label={`View ${group.name}`}
                            className="bg-paper-deep relative block aspect-[4/3] w-full overflow-hidden rounded-2xl"
                          >
                            {group.profilePicture ? (
                              <img
                                src={group.profilePicture}
                                alt=""
                                className="absolute inset-0 h-full w-full object-cover saturate-[0.85] transition-transform duration-700 ease-out group-hover:scale-[1.04]"
                              />
                            ) : (
                              <span className="font-editorial text-ink/15 absolute inset-0 flex items-center justify-center text-8xl font-light">
                                {group.name.charAt(0)}
                              </span>
                            )}
                            {group.isMember && (
                              <span className="bg-paper text-ink absolute left-3 top-3 rounded-sm px-2 py-1 text-xs font-semibold">
                                Joined
                              </span>
                            )}
                          </button>

                          <div className="mt-5 flex flex-1 flex-col">
                            <h3 className="font-editorial text-ink line-clamp-2 text-2xl font-normal leading-tight">
                              {group.name}
                            </h3>
                            <p className="text-ink-muted mt-2 text-sm tabular-nums">
                              {[
                                group.sport,
                                group.city,
                                `${group.memberCount} ${group.memberCount === 1 ? "member" : "members"}`,
                              ]
                                .filter(Boolean)
                                .join(" · ")}
                            </p>
                            <p className="text-ink-body mt-3 line-clamp-2 text-base leading-relaxed">
                              {group.description || "No description yet."}
                            </p>

                            {/* mt-auto lines the actions up across cards of
                                different description length. */}
                            <div className="mt-auto flex items-center gap-5 pt-5">
                              {group.isMember ? (
                                <button
                                  type="button"
                                  onClick={() => handleCommunityChat(group.id)}
                                  className="bg-power-orange-solid btn-motion inline-flex min-h-11 items-center gap-2 rounded-md px-5 text-base font-semibold text-white hover:bg-indigo-700"
                                >
                                  <MessageSquare size={16} aria-hidden="true" />
                                  Open chat
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => handleJoinGroup(group.id)}
                                  disabled={isJoiningCommunity}
                                  className="bg-ink btn-motion hover:bg-ink-hover inline-flex min-h-11 items-center gap-2 rounded-md px-5 text-base font-semibold text-white disabled:opacity-60"
                                >
                                  <LogIn size={16} aria-hidden="true" />
                                  Join
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedCommunity(group);
                                  setIsCommunityModalOpen(true);
                                }}
                                className="text-ink decoration-ink/30 hover:decoration-ink text-base font-semibold underline underline-offset-4 transition-colors duration-200"
                              >
                                Details
                              </button>
                            </div>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
              )}

              {activeTab !== "COMMUNITIES" && (
                <section aria-labelledby="discover-parents">
                  <div className="mb-8">
                    <h2 id="discover-parents" className="community-section-title">
                      Sports parents
                    </h2>
                    <p className="text-ink-body mt-1 text-base tabular-nums">
                      {filteredPlayers.length} {filteredPlayers.length === 1 ? "parent" : "parents"}{" "}
                      you can connect with
                    </p>
                  </div>

                  {filteredPlayers.length === 0 ? (
                    <div className="bg-paper-deep rounded-2xl px-6 py-16 text-center">
                      <p className="font-editorial text-ink text-3xl font-light">
                        No parents match.
                      </p>
                      <p className="text-ink-body mx-auto mt-3 max-w-[44ch] text-base leading-relaxed">
                        Try a different search, or clear the filters.
                      </p>
                      {activeFilterCount > 0 && (
                        <button
                          type="button"
                          onClick={clearFilters}
                          className="text-ink decoration-ink/30 hover:decoration-ink mt-5 text-base font-semibold underline underline-offset-4 transition-colors duration-200"
                        >
                          Clear filters
                        </button>
                      )}
                    </div>
                  ) : (
                    <ul className="border-hairline grid grid-cols-1 border-t lg:grid-cols-2 lg:gap-x-12">
                      {filteredPlayers.map((player) => {
                        const line = familyLine(player.dependents);
                        const sports = player.sports ?? [];
                        return (
                          <li
                            key={player.id}
                            className="border-hairline flex items-center gap-4 border-b py-5"
                          >
                            <button
                              type="button"
                              disabled={!player.photoUrl}
                              onClick={() =>
                                player.photoUrl &&
                                setPhotoLightbox({ url: player.photoUrl, name: player.displayName })
                              }
                              aria-label={
                                player.photoUrl
                                  ? `Enlarge photo of ${player.displayName}`
                                  : undefined
                              }
                              className="bg-paper-deep text-ink-muted flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-xl disabled:cursor-default"
                            >
                              {player.photoUrl ? (
                                <img
                                  src={player.photoUrl}
                                  alt=""
                                  className="h-full w-full object-cover"
                                />
                              ) : (
                                <User size={26} strokeWidth={1.5} aria-hidden="true" />
                              )}
                            </button>

                            <div className="min-w-0 flex-1">
                              <h3 className="font-editorial text-ink line-clamp-1 text-xl font-normal">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setSelectedPlayerId(player.id);
                                    setIsPlayerModalOpen(true);
                                  }}
                                  className="text-left hover:underline"
                                >
                                  {player.displayName}
                                </button>
                              </h3>
                              {/* One line each, not the full list: the Details
                                  dialog is where a parent reads every child. */}
                              {line && <p className="text-ink-body line-clamp-1 text-sm">{line}</p>}
                              {sports.length > 0 && (
                                <p className="text-ink-muted line-clamp-1 text-sm">
                                  {sports.slice(0, 3).join(" · ")}
                                  {sports.length > 3 ? ` · +${sports.length - 3}` : ""}
                                </p>
                              )}
                            </div>

                            <div className="flex shrink-0 items-center gap-4">
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedPlayerId(player.id);
                                  setIsPlayerModalOpen(true);
                                }}
                                className="text-ink decoration-ink/30 hover:decoration-ink hidden text-base font-semibold underline underline-offset-4 transition-colors duration-200 sm:inline"
                              >
                                Details
                              </button>
                              <button
                                type="button"
                                onClick={() => handlePlayerChat(player.id, player.displayName)}
                                className="bg-power-orange-solid btn-motion inline-flex min-h-11 items-center gap-2 rounded-md px-4 text-base font-semibold text-white hover:bg-indigo-700"
                              >
                                <MessageSquare size={16} aria-hidden="true" />
                                Chat
                              </button>
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </section>
              )}
            </>
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
        onChat={(userId) => handlePlayerChat(userId)}
      />

      <ConnectRequestModal request={connect} />

      {/* Photo lightbox — portalled to body so it covers the fixed header */}
      {typeof document !== "undefined" &&
        createPortal(
          <AnimatePresence>
            {photoLightbox && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="bg-ink/85 fixed inset-0 z-[200] flex items-center justify-center p-4"
                onClick={() => setPhotoLightbox(null)}
              >
                <motion.div
                  initial={{ scale: 0.85, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.85, opacity: 0 }}
                  transition={{ type: "spring", stiffness: 320, damping: 26 }}
                  className="relative flex flex-col items-center"
                  onClick={(e) => e.stopPropagation()}
                >
                  <img
                    src={photoLightbox.url}
                    alt={photoLightbox.name}
                    className="max-h-[78vh] max-w-[78vw] rounded-2xl object-contain"
                  />
                  <p className="mt-3 text-sm font-semibold text-white/90">{photoLightbox.name}</p>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>,
          document.body
        )}
    </div>
  );
}
