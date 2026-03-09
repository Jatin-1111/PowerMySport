"use client";

import { useEffect, useState } from "react";
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
  CardDescription,
  CardHeader,
  CardTitle,
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
import { toast } from "sonner";
import {
  Users,
  UserPlus,
  Clock,
  Search,
  MoreVertical,
  UserX,
  Ban,
} from "lucide-react";

export default function FriendsPage() {
  const [friends, setFriends] = useState<Friend[]>([]);
  const [pendingRequests, setPendingRequests] = useState<FriendRequest[]>([]);
  const [sentRequests, setSentRequests] = useState<FriendRequest[]>([]);
  const [searchResults, setSearchResults] = useState<SearchUserResult[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [activeTab, setActiveTab] = useState("friends");

  const { connected, refreshFriends: socketRefreshFriends } = useFriendSocket();

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
    } catch (error) {
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
    } catch (error) {
      toast.error("Failed to accept request");
    }
  };

  const handleDeclineRequest = async (requestId: string) => {
    try {
      await friendService.declineFriendRequest(requestId);
      toast.success("Friend request declined");
      loadPendingRequests();
    } catch (error) {
      toast.error("Failed to decline request");
    }
  };

  const handleRemoveFriend = async (friendId: string) => {
    try {
      await friendService.removeFriend(friendId);
      toast.success("Friend removed");
      loadFriends();
    } catch (error) {
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
    } catch (error) {
      toast.error("Failed to block user");
    }
  };

  const handleSearch = async () => {
    if (searchQuery.trim().length < 2) {
      toast.error("Please enter at least 2 characters to search");
      return;
    }
    try {
      setSearching(true);
      const results = await friendService.searchUsers(searchQuery);
      setSearchResults(results);
      if (results.length === 0) {
        toast.info("No users found matching your search");
      }
    } catch (error) {
      toast.error("Search failed");
    } finally {
      setSearching(false);
    }
  };

  const handleSendFriendRequest = async (userId: string) => {
    try {
      await friendService.sendFriendRequest(userId);
      toast.success("Friend request sent!");
      // Refresh search results to update status
      handleSearch();
      loadSentRequests();
    } catch (error: any) {
      toast.error(
        error?.response?.data?.message || "Failed to send friend request",
      );
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

      {loading ? (
        <ListSkeleton count={5} />
      ) : (
        <Tabs
          value={activeTab}
          onValueChange={setActiveTab}
          className="space-y-6"
        >
          <TabsList className="grid w-full grid-cols-3 bg-white border border-slate-200 h-auto p-1">
            <TabsTrigger
              value="friends"
              className="flex items-center gap-2 data-[state=active]:bg-power-orange data-[state=active]:text-white text-slate-700 py-3"
            >
              <Users className="h-4 w-4" />
              Friends
              {friends.length > 0 && (
                <Badge
                  variant="secondary"
                  className="ml-1 bg-slate-200 text-slate-700"
                >
                  {friends.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger
              value="requests"
              className="flex items-center gap-2 data-[state=active]:bg-power-orange data-[state=active]:text-white text-slate-700 py-3"
            >
              <Clock className="h-4 w-4" />
              Requests
              {pendingRequests.length > 0 && (
                <Badge variant="destructive" className="ml-1">
                  {pendingRequests.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger
              value="search"
              className="flex items-center gap-2 data-[state=active]:bg-power-orange data-[state=active]:text-white text-slate-700 py-3"
            >
              <Search className="h-4 w-4" />
              Search
            </TabsTrigger>
          </TabsList>

          {/* Friends List Tab */}
          <TabsContent value="friends" className="space-y-4">
            {friends.length === 0 ? (
              <Card className="bg-white">
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
                    className="bg-white hover:shadow-lg transition-shadow"
                  >
                    <CardContent className="p-6">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4 flex-1">
                          <Avatar className="h-12 w-12">
                            <AvatarImage src={friend.photoUrl} />
                            <AvatarFallback>
                              {friend.name.charAt(0).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1">
                            <h3 className="font-semibold text-slate-900">
                              {friend.name}
                            </h3>
                            <p className="text-sm text-slate-600">
                              Friends since{" "}
                              {new Date(
                                friend.friendsSince,
                              ).toLocaleDateString()}
                            </p>
                          </div>
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
                              className="text-slate-700 cursor-pointer"
                            >
                              <UserX className="h-4 w-4 mr-2" />
                              Remove Friend
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() =>
                                handleBlockUser(friend.id, friend.name)
                              }
                              className="text-red-600 cursor-pointer"
                            >
                              <Ban className="h-4 w-4 mr-2" />
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
            <Card className="bg-white">
              <CardHeader>
                <CardTitle>Received Requests</CardTitle>
                <CardDescription>
                  Friend requests waiting for your response
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {pendingRequests.length === 0 ? (
                  <div className="text-center py-8">
                    <Clock className="h-12 w-12 mx-auto mb-4 text-slate-400" />
                    <h3 className="font-semibold text-lg mb-2 text-slate-900">
                      No pending requests
                    </h3>
                    <p className="text-slate-600">
                      Friend requests will appear here
                    </p>
                  </div>
                ) : (
                  pendingRequests.map((request) => (
                    <div
                      key={request.id}
                      className="flex items-center justify-between p-4 border rounded-lg hover:bg-slate-50 transition-colors"
                    >
                      <div className="flex items-center gap-4">
                        <Avatar>
                          <AvatarImage src={request.requester.photoUrl} />
                          <AvatarFallback>
                            {request.requester.name.charAt(0).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <h4 className="font-semibold text-slate-900">
                            {request.requester.name}
                          </h4>
                          <p className="text-sm text-slate-600">
                            {request.requester.email}
                          </p>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="primary"
                          size="sm"
                          onClick={() => handleAcceptRequest(request.id)}
                        >
                          Accept
                        </Button>
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => handleDeclineRequest(request.id)}
                        >
                          Decline
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>

            <Card className="bg-white">
              <CardHeader>
                <CardTitle>Sent Requests</CardTitle>
                <CardDescription>Friend requests you've sent</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {sentRequests.length === 0 ? (
                  <div className="text-center py-8">
                    <UserPlus className="h-12 w-12 mx-auto mb-4 text-slate-400" />
                    <h3 className="font-semibold text-lg mb-2 text-slate-900">
                      No sent requests
                    </h3>
                    <p className="text-slate-600">
                      Search for players to send friend requests
                    </p>
                  </div>
                ) : (
                  sentRequests.map((request) => (
                    <div
                      key={request.id}
                      className="flex items-center justify-between p-4 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
                    >
                      <div className="flex items-center gap-4">
                        <Avatar>
                          <AvatarImage src={request.recipient.photoUrl} />
                          <AvatarFallback>
                            {request.recipient.name.charAt(0).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <h4 className="font-semibold text-slate-900">
                            {request.recipient.name}
                          </h4>
                          <p className="text-sm text-slate-600">Pending...</p>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Search Tab */}
          <TabsContent value="search" className="space-y-4">
            <Card className="bg-white">
              <CardHeader>
                <CardTitle>Find Friends</CardTitle>
                <CardDescription>
                  Search for players by name or email to add as friends
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
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
                    disabled={searching}
                  >
                    {searching ? (
                      <>
                        <div className="h-4 w-4 mr-2 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
                        Searching...
                      </>
                    ) : (
                      <>
                        <Search className="h-4 w-4 mr-2" />
                        Search
                      </>
                    )}
                  </Button>
                </div>

                {searchResults.length > 0 && (
                  <div className="space-y-2 mt-4">
                    <p className="text-sm text-slate-600 mb-2">
                      {searchResults.length} user
                      {searchResults.length !== 1 ? "s" : ""} found
                    </p>
                    {searchResults.map((user) => (
                      <div
                        key={user.id}
                        className="flex items-center justify-between p-4 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
                      >
                        <div className="flex items-center gap-4">
                          <Avatar>
                            <AvatarImage src={user.photoUrl} />
                            <AvatarFallback>
                              {user.name.charAt(0).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <h4 className="font-semibold text-slate-900">
                              {user.name}
                            </h4>
                            <p className="text-sm text-slate-600">
                              {user.email}
                            </p>
                          </div>
                        </div>
                        <div>
                          {user.friendStatus === "FRIENDS" && (
                            <Badge variant="secondary">Already Friends</Badge>
                          )}
                          {user.friendStatus === "PENDING_SENT" && (
                            <Badge variant="outline">Request Sent</Badge>
                          )}
                          {user.friendStatus === "PENDING_RECEIVED" && (
                            <Badge variant="outline">Pending Request</Badge>
                          )}
                          {user.friendStatus === "NONE" && (
                            <Button
                              variant="primary"
                              size="sm"
                              onClick={() => handleSendFriendRequest(user.id)}
                            >
                              <UserPlus className="h-4 w-4 mr-2" />
                              Add Friend
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {searchQuery && searchResults.length === 0 && !searching && (
                  <div className="text-center py-8">
                    <Search className="h-12 w-12 mx-auto mb-4 text-slate-400" />
                    ",
                    <h3 className="font-semibold text-lg mb-2 text-slate-900">
                      No users found
                    </h3>
                    <p className="text-slate-600">
                      Try searching with a different name or email
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
