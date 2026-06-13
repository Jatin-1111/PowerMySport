"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import {
  friendService,
  Friend,
  FriendRequest,
  SearchUserResult,
} from "@/modules/shared/services/friend";
import { useFriendSocket } from "@/hooks/useFriendSocket";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { Button } from "@/modules/shared/ui/Button";
import {
  Card,
  CardContent,
} from "@/modules/shared/ui/Card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ListSkeleton } from "@/modules/shared/ui/Skeleton";
import { EmptyState } from "@/modules/shared/ui/EmptyState";
import { PlayerPageHeader } from "@/modules/player/components/PlayerPageHeader";
import { ProfileSectionHeader } from "@/modules/player/components/ProfileSectionHeader";
import { toast } from "sonner";
import {
  Users,
  UserPlus,
  Clock,
  Search,
  MoreVertical,
  UserX,
  Ban,
  CheckCircle,
  XCircle,
  Send,
} from "lucide-react";

const MIN_SEARCH_LENGTH = 2;
const SEARCH_DEBOUNCE_MS = 350;

export default function FriendsPage() {
  const [friends, setFriends] = useState<Friend[]>([]);
  const [pendingRequests, setPendingRequests] = useState<FriendRequest[]>([]);
  const [sentRequests, setSentRequests] = useState<FriendRequest[]>([]);
  const [searchResults, setSearchResults] = useState<SearchUserResult[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [activeTab, setActiveTab] = useState("friends");

  const { connected } = useFriendSocket();
  const latestSearchRequestIdRef = useRef(0);
  const searchDebounceTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );

  useEffect(() => {
    loadFriends();
    loadPendingRequests();
    loadSentRequests();
  }, []);

  // Refresh data when socket reconnects
  useEffect(() => {
    if (connected) {
      loadPendingRequests();
    }
  }, [connected]);

  const loadFriends = async () => {
    try {
      setLoading(true);
      const response = await friendService.getFriends();
      setFriends(response.friends);
    } catch {
      toast.error("Failed to load friends");
    } finally {
      setLoading(false);
    }
  };

  const loadPendingRequests = async () => {
    try {
      const requests = await friendService.getPendingRequests("RECEIVED");
      setPendingRequests(requests);
    } catch (error) {
      console.error("Failed to load pending requests:", error);
    }
  };

  const loadSentRequests = async () => {
    try {
      const requests = await friendService.getPendingRequests("SENT");
      setSentRequests(requests);
    } catch (error) {
      console.error("Failed to load sent requests:", error);
    }
  };

  const handleAcceptRequest = async (requestId: string) => {
    try {
      await friendService.acceptFriendRequest(requestId);
      toast.success("Friend request accepted!");
      loadFriends();
      loadPendingRequests();
    } catch {
      toast.error("Failed to accept request");
    }
  };

  const handleDeclineRequest = async (requestId: string) => {
    try {
      await friendService.declineFriendRequest(requestId);
      toast.success("Friend request declined");
      loadPendingRequests();
    } catch {
      toast.error("Failed to decline request");
    }
  };

  const handleRemoveFriend = async (friendId: string) => {
    try {
      await friendService.removeFriend(friendId);
      toast.success("Friend removed");
      loadFriends();
    } catch {
      toast.error("Failed to remove friend");
    }
  };

  const handleBlockUser = async (userId: string, userName: string) => {
    if (
      !confirm(
        `Are you sure you want to block ${userName}? They will be removed from your friends list and won't be able to send you friend requests.`,
      )
    ) {
      return;
    }

    try {
      await friendService.blockUser(userId);
      toast.success(`${userName} has been blocked`);
      loadFriends();
    } catch {
      toast.error("Failed to block user");
    }
  };

  const executeSearch = useCallback(
    async (
      query: string,
      options?: {
        showValidationToast?: boolean;
        showEmptyToast?: boolean;
      },
    ) => {
      const normalizedQuery = query.trim();
      if (normalizedQuery.length < MIN_SEARCH_LENGTH) {
        setSearchResults([]);
        setSearching(false);
        if (options?.showValidationToast) {
          toast.error(
            `Please enter at least ${MIN_SEARCH_LENGTH} characters to search`,
          );
        }
        return;
      }

      const requestId = latestSearchRequestIdRef.current + 1;
      latestSearchRequestIdRef.current = requestId;

      try {
        setSearching(true);
        const results = await friendService.searchUsers(normalizedQuery);

        if (requestId !== latestSearchRequestIdRef.current) {
          return;
        }

        setSearchResults(results);
        if (options?.showEmptyToast && results.length === 0) {
          toast.info("No users found matching your search");
        }
      } catch {
        if (requestId === latestSearchRequestIdRef.current) {
          toast.error("Search failed");
        }
      } finally {
        if (requestId === latestSearchRequestIdRef.current) {
          setSearching(false);
        }
      }
    },
    [],
  );

  useEffect(() => {
    if (activeTab !== "search") {
      return;
    }

    if (searchDebounceTimeoutRef.current) {
      clearTimeout(searchDebounceTimeoutRef.current);
      searchDebounceTimeoutRef.current = null;
    }

    const normalizedQuery = searchQuery.trim();
    if (normalizedQuery.length < MIN_SEARCH_LENGTH) {
      setSearchResults([]);
      setSearching(false);
      return;
    }

    searchDebounceTimeoutRef.current = setTimeout(() => {
      executeSearch(normalizedQuery);
    }, SEARCH_DEBOUNCE_MS);

    return () => {
      if (searchDebounceTimeoutRef.current) {
        clearTimeout(searchDebounceTimeoutRef.current);
        searchDebounceTimeoutRef.current = null;
      }
    };
  }, [activeTab, executeSearch, searchQuery]);

  const handleSearch = () => {
    executeSearch(searchQuery, {
      showValidationToast: true,
      showEmptyToast: true,
    });
  };

  const handleSendFriendRequest = async (userId: string) => {
    try {
      await friendService.sendFriendRequest(userId);
      toast.success("Friend request sent!");
      handleSearch();
      loadSentRequests();
    } catch (error: unknown) {
      const errorMessage =
        typeof error === "object" &&
        error !== null &&
        "response" in error &&
        typeof (error as { response?: { data?: { message?: string } } })
          .response?.data?.message === "string"
          ? (error as { response?: { data?: { message?: string } } }).response
              ?.data?.message
          : null;

      toast.error(errorMessage || "Failed to send friend request");
    }
  };

  return (
    <div className="space-y-6">
      <Breadcrumbs
        items={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Friends" },
        ]}
      />

      <PlayerPageHeader
        badge="Player"
        title="Friends"
        subtitle="Manage your friends and connect with other players to book together."
      />

      {/* Stats strip */}
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-slate-200/70 bg-white/70 px-4 py-3 premium-shadow shop-surface">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Friends
          </p>
          <p className="mt-1 text-2xl font-bold text-slate-900">
            {friends.length}
          </p>
        </div>
        <div className="rounded-xl border border-slate-200/70 bg-white/70 px-4 py-3 premium-shadow shop-surface">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Pending Requests
          </p>
          <p className="mt-1 text-2xl font-bold text-slate-900">
            {pendingRequests.length}
          </p>
        </div>
        <div className="rounded-xl border border-slate-200/70 bg-white/70 px-4 py-3 premium-shadow shop-surface">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Sent
          </p>
          <p className="mt-1 text-2xl font-bold text-slate-900">
            {sentRequests.length}
          </p>
        </div>
      </div>

      {loading ? (
        <ListSkeleton count={5} />
      ) : (
        <Tabs
          value={activeTab}
          onValueChange={setActiveTab}
          className="space-y-6"
        >
          <TabsList className="grid w-full grid-cols-3 shop-surface border border-slate-200/60 h-auto p-1 premium-shadow">
            <TabsTrigger
              value="friends"
              className="flex items-center gap-2 data-[state=active]:bg-power-orange data-[state=active]:text-white text-slate-700 py-2.5 text-sm"
            >
              <Users className="h-4 w-4" />
              Friends
              {friends.length > 0 && (
                <Badge
                  variant="secondary"
                  className="ml-1 bg-blue-100/70 text-blue-700 text-xs"
                >
                  {friends.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger
              value="requests"
              className="flex items-center gap-2 data-[state=active]:bg-power-orange data-[state=active]:text-white text-slate-700 py-2.5 text-sm"
            >
              <Clock className="h-4 w-4" />
              Requests
              {pendingRequests.length > 0 && (
                <Badge variant="destructive" className="ml-1 text-xs">
                  {pendingRequests.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger
              value="search"
              className="flex items-center gap-2 data-[state=active]:bg-power-orange data-[state=active]:text-white text-slate-700 py-2.5 text-sm"
            >
              <Search className="h-4 w-4" />
              Search
            </TabsTrigger>
          </TabsList>

          {/* Friends List Tab */}
          <TabsContent value="friends" className="space-y-4">
            {friends.length === 0 ? (
              <Card className="shop-surface premium-shadow">
                <EmptyState
                  icon={Users}
                  title="No friends yet"
                  description="Start connecting with other players to book together"
                  actionLabel="Find Friends"
                  onAction={() => setActiveTab("search")}
                />
              </Card>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                {friends.map((friend) => (
                  <Card
                    key={friend.id}
                    className="shop-surface premium-shadow p-0 transition-all duration-200 hover:shadow-md"
                  >
                    <CardContent className="p-5">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3 flex-1">
                          {(() => {
                            const isPublic = friend.isIdentityPublic !== false;
                            const displayName = isPublic
                              ? friend.name
                              : friend.anonymousAlias || "Anonymous Member";
                            return (
                              <>
                                <Avatar className="h-11 w-11 border border-white shadow-sm">
                                  <AvatarImage
                                    src={isPublic ? friend.photoUrl : undefined}
                                  />
                                  <AvatarFallback className="bg-power-orange/10 text-sm font-bold text-power-orange">
                                    {displayName.charAt(0).toUpperCase()}
                                  </AvatarFallback>
                                </Avatar>
                                <div className="flex-1 min-w-0">
                                  <h3 className="truncate font-semibold text-slate-900">
                                    {displayName}
                                  </h3>
                                  <p className="text-xs text-slate-500">
                                    Friends since{" "}
                                    {new Date(
                                      friend.friendsSince,
                                    ).toLocaleDateString()}
                                  </p>
                                </div>
                              </>
                            );
                          })()}
                        </div>
                        <DropdownMenu>
                          <DropdownMenuTrigger>
                            <Button variant="secondary" size="sm">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onClick={() => handleRemoveFriend(friend.id)}
                              className="cursor-pointer text-slate-700"
                            >
                              <UserX className="mr-2 h-4 w-4" />
                              Remove Friend
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() =>
                                handleBlockUser(friend.id, friend.name)
                              }
                              className="cursor-pointer text-red-600"
                            >
                              <Ban className="mr-2 h-4 w-4" />
                              Block User
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* Pending Requests Tab */}
          <TabsContent value="requests" className="space-y-6">
            {/* Received Requests */}
            <Card className="shop-surface premium-shadow overflow-hidden p-0">
              <ProfileSectionHeader
                icon={Clock}
                title="Received Requests"
                description="Friend requests waiting for your response"
              />
              <CardContent className="px-6 py-5 space-y-3">
                {pendingRequests.length === 0 ? (
                  <EmptyState
                    icon={Clock}
                    title="No pending requests"
                    description="Friend requests from other players will appear here."
                  />
                ) : (
                  pendingRequests.map((request) => (
                    <motion.div
                      key={request.id}
                      className="flex items-center justify-between rounded-xl border border-slate-200/70 bg-slate-50/40 p-4 transition-colors hover:bg-white"
                      whileHover={{ y: -2 }}
                      transition={{ duration: 0.2, ease: "easeOut" }}
                    >
                      <div className="flex items-center gap-3">
                        {(() => {
                          const isPublic =
                            request.requester.isIdentityPublic !== false;
                          const displayName = isPublic
                            ? request.requester.name
                            : request.requester.anonymousAlias ||
                              "Anonymous Member";
                          return (
                            <>
                              <Avatar className="h-10 w-10 border border-white shadow-sm">
                                <AvatarImage
                                  src={
                                    isPublic
                                      ? request.requester.photoUrl
                                      : undefined
                                  }
                                />
                                <AvatarFallback className="bg-power-orange/10 text-sm font-bold text-power-orange">
                                  {displayName.charAt(0).toUpperCase()}
                                </AvatarFallback>
                              </Avatar>
                              <div>
                                <h4 className="font-semibold text-slate-900">
                                  {displayName}
                                </h4>
                                <p className="text-xs text-slate-500">
                                  Sent you a friend request
                                </p>
                              </div>
                            </>
                          );
                        })()}
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="primary"
                          size="sm"
                          onClick={() => handleAcceptRequest(request.id)}
                          icon={<CheckCircle size={14} />}
                        >
                          Accept
                        </Button>
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => handleDeclineRequest(request.id)}
                          icon={<XCircle size={14} />}
                        >
                          Decline
                        </Button>
                      </div>
                    </motion.div>
                  ))
                )}
              </CardContent>
            </Card>

            {/* Sent Requests */}
            <Card className="shop-surface premium-shadow overflow-hidden p-0">
              <ProfileSectionHeader
                icon={Send}
                title="Sent Requests"
                description="Friend requests you've sent that are still pending"
              />
              <CardContent className="px-6 py-5 space-y-3">
                {sentRequests.length === 0 ? (
                  <EmptyState
                    icon={UserPlus}
                    title="No sent requests"
                    description="Search for players to send friend requests"
                    actionLabel="Find Friends"
                    onAction={() => setActiveTab("search")}
                  />
                ) : (
                  sentRequests.map((request) => (
                    <motion.div
                      key={request.id}
                      className="flex items-center justify-between rounded-xl border border-slate-200/70 bg-slate-50/40 p-4 transition-colors hover:bg-white"
                      whileHover={{ y: -2 }}
                      transition={{ duration: 0.2, ease: "easeOut" }}
                    >
                      <div className="flex items-center gap-3">
                        <Avatar className="h-10 w-10 border border-white shadow-sm">
                          <AvatarImage src={request.recipient.photoUrl} />
                          <AvatarFallback className="bg-blue-100 text-sm font-bold text-blue-600">
                            {request.recipient.name.charAt(0).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <h4 className="font-semibold text-slate-900">
                            {request.recipient.name}
                          </h4>
                          <p className="text-xs text-slate-500">
                            Request pending...
                          </p>
                        </div>
                      </div>
                      <Badge className="border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-50">
                        Pending
                      </Badge>
                    </motion.div>
                  ))
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Search Tab */}
          <TabsContent value="search" className="space-y-4">
            <Card className="shop-surface premium-shadow overflow-hidden p-0">
              <ProfileSectionHeader
                icon={Search}
                title="Find Friends"
                description="Search for players by name or email to add as friends"
              />
              <CardContent className="px-6 py-5 space-y-4">
                <div className="flex gap-2">
                  <Input
                    placeholder="Search by name or email (min 2 characters)..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                  />
                  <Button
                    variant="primary"
                    onClick={handleSearch}
                    disabled={
                      searching || searchQuery.trim().length < MIN_SEARCH_LENGTH
                    }
                  >
                    {searching ? (
                      <>
                        <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
                        Searching...
                      </>
                    ) : (
                      <>
                        <Search className="mr-2 h-4 w-4" />
                        Search
                      </>
                    )}
                  </Button>
                </div>

                {searchResults.length > 0 && (
                  <div className="space-y-3">
                    <p className="text-sm font-semibold text-slate-600">
                      {searchResults.length} user
                      {searchResults.length !== 1 ? "s" : ""} found
                    </p>
                    {searchResults.map((user) => (
                      <motion.div
                        key={user.id}
                        className="flex items-center justify-between rounded-xl border border-slate-200/70 bg-slate-50/40 p-4 transition-colors hover:bg-white"
                        whileHover={{ y: -2 }}
                        transition={{ duration: 0.2, ease: "easeOut" }}
                      >
                        <div className="flex items-center gap-3">
                          {(() => {
                            const isPublic = user.isIdentityPublic !== false;
                            const displayName = isPublic
                              ? user.name
                              : user.anonymousAlias || "Anonymous Member";
                            return (
                              <>
                                <Avatar className="h-10 w-10 border border-white shadow-sm">
                                  <AvatarImage
                                    src={isPublic ? user.photoUrl : undefined}
                                  />
                                  <AvatarFallback className="bg-power-orange/10 text-sm font-bold text-power-orange">
                                    {displayName.charAt(0).toUpperCase()}
                                  </AvatarFallback>
                                </Avatar>
                                <div>
                                  <h4 className="font-semibold text-slate-900">
                                    {displayName}
                                  </h4>
                                </div>
                              </>
                            );
                          })()}
                        </div>
                        <div>
                          {user.friendStatus === "FRIENDS" && (
                            <Badge className="border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-50">
                              Already Friends
                            </Badge>
                          )}
                          {user.friendStatus === "PENDING_SENT" && (
                            <Badge className="border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-50">
                              Request Sent
                            </Badge>
                          )}
                          {user.friendStatus === "PENDING_RECEIVED" && (
                            <Badge className="border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-50">
                              Pending Request
                            </Badge>
                          )}
                          {user.friendStatus === "NONE" && (
                            <Button
                              variant="primary"
                              size="sm"
                              onClick={() => handleSendFriendRequest(user.id)}
                              icon={<UserPlus size={14} />}
                            >
                              Add Friend
                            </Button>
                          )}
                        </div>
                      </motion.div>
                    ))}
                  </div>
                )}

                {searchQuery &&
                  searchResults.length === 0 &&
                  !searching && (
                    <EmptyState
                      icon={Search}
                      title="No users found"
                      description="Try searching with a different name or email"
                    />
                  )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
