"use client";

import { AdminPageHeader } from "@/modules/admin/components/AdminPageHeader";
import {
  CoachUserRow,
  CoachesAnalytics,
  PlayerUserRow,
  PlayersAnalytics,
  statsApi,
  UsersRoleSummary,
  UsersTabRole,
  VenueListerUserRow,
  VenueListersAnalytics,
} from "@/modules/analytics/services/stats";
import { Card } from "@/modules/shared/ui/Card";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { io } from "socket.io-client";

interface PaginationData {
  total: number;
  page: number;
  totalPages: number;
}

type SortBy = "joined_desc" | "joined_asc" | "name_asc" | "rating_desc";
type UsersRow = PlayerUserRow | CoachUserRow | VenueListerUserRow;

const TAB_LABELS: Record<UsersTabRole, string> = {
  PLAYER: "Players",
  COACH: "Coaches",
  VENUE_LISTER: "Venue Owners",
};

const DEFAULT_SUMMARY: UsersRoleSummary = {
  PLAYER: 0,
  COACH: 0,
  VENUE_LISTER: 0,
};

const formatDateTime = (value: string): string => {
  return new Date(value).toLocaleString();
};

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api";
const SOCKET_URL = API_URL.replace(/\/api\/?$/, "");

interface PresenceUpdateEvent {
  userId: string;
  isOnlineNow: boolean;
  lastActiveAt: string;
}

export default function AdminUsersPage() {
  const [activeTab, setActiveTab] = useState<UsersTabRole>("PLAYER");
  const [users, setUsers] = useState<UsersRow[]>([]);
  const [summary, setSummary] = useState<UsersRoleSummary>(DEFAULT_SUMMARY);
  const [playersAnalytics, setPlayersAnalytics] =
    useState<PlayersAnalytics | null>(null);
  const [coachesAnalytics, setCoachesAnalytics] =
    useState<CoachesAnalytics | null>(null);
  const [venueListersAnalytics, setVenueListersAnalytics] =
    useState<VenueListersAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [pagination, setPagination] = useState<PaginationData>({
    total: 0,
    page: 1,
    totalPages: 1,
  });
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<SortBy>("joined_desc");
  const PAGE_SIZE = 15;

  const fetchSummary = useCallback(async () => {
    try {
      const response = await statsApi.getUsersRoleSummary();
      if (response.success && response.data) {
        setSummary(response.data);
      }
    } catch (summaryError) {
      console.error("Failed to fetch users summary:", summaryError);
    }
  }, []);

  const fetchUsersByRole = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      if (activeTab === "PLAYER") {
        const [usersResponse, analyticsResponse] = await Promise.all([
          statsApi.getPlayersUsers({
            page: currentPage,
            limit: PAGE_SIZE,
          }),
          statsApi.getPlayersAnalytics(),
        ]);

        if (!usersResponse.success || !usersResponse.data) {
          setError(usersResponse.message || "Failed to load players.");
          return;
        }

        setUsers(usersResponse.data);
        if (usersResponse.pagination) {
          setPagination(usersResponse.pagination);
        }
        if (analyticsResponse.success && analyticsResponse.data) {
          setPlayersAnalytics(analyticsResponse.data);
        }
        return;
      }

      if (activeTab === "COACH") {
        const [usersResponse, analyticsResponse] = await Promise.all([
          statsApi.getCoachUsers({
            page: currentPage,
            limit: PAGE_SIZE,
          }),
          statsApi.getCoachesAnalytics(),
        ]);

        if (!usersResponse.success || !usersResponse.data) {
          setError(usersResponse.message || "Failed to load coaches.");
          return;
        }

        setUsers(usersResponse.data);
        if (usersResponse.pagination) {
          setPagination(usersResponse.pagination);
        }
        if (analyticsResponse.success && analyticsResponse.data) {
          setCoachesAnalytics(analyticsResponse.data);
        }
        return;
      }

      const [usersResponse, analyticsResponse] = await Promise.all([
        statsApi.getVenueListerUsers({
          page: currentPage,
          limit: PAGE_SIZE,
        }),
        statsApi.getVenueListersAnalytics(),
      ]);

      if (!usersResponse.success || !usersResponse.data) {
        setError(usersResponse.message || "Failed to load venue owners.");
        return;
      }

      setUsers(usersResponse.data);
      if (usersResponse.pagination) {
        setPagination(usersResponse.pagination);
      }
      if (analyticsResponse.success && analyticsResponse.data) {
        setVenueListersAnalytics(analyticsResponse.data);
      }
    } catch (fetchError) {
      console.error("Failed to fetch users by role:", fetchError);
      setError("Failed to load users.");
    } finally {
      setLoading(false);
    }
  }, [activeTab, currentPage]);

  const switchTab = (tab: UsersTabRole): void => {
    setActiveTab(tab);
    setCurrentPage(1);
    setSearchQuery("");
    setSortBy("joined_desc");
  };

  useEffect(() => {
    fetchSummary();
  }, [fetchSummary]);

  useEffect(() => {
    fetchUsersByRole();
  }, [fetchUsersByRole]);

  useEffect(() => {
    const socket = io(SOCKET_URL, {
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
    });

    const onPresenceUpdate = (event: PresenceUpdateEvent): void => {
      if (!event?.userId) return;

      setUsers((previous) =>
        previous.map((user) => {
          if (user.id !== event.userId) {
            return user;
          }

          return {
            ...user,
            isOnlineNow: event.isOnlineNow,
            lastActiveAt: event.lastActiveAt,
          };
        }),
      );
    };

    socket.on("PRESENCE_UPDATE", onPresenceUpdate);

    return () => {
      socket.off("PRESENCE_UPDATE", onPresenceUpdate);
      socket.disconnect();
    };
  }, []);

  if (loading) {
    return <div className="text-center py-12">Loading users...</div>;
  }

  if (error) {
    return (
      <div className="space-y-6">
        <AdminPageHeader
          badge="Admin"
          title="Users"
          subtitle="View role-specific users, analytics, and health metrics."
        />
        <Card className="bg-white">
          <div className="py-10 text-center space-y-3">
            <p className="text-red-600 font-semibold">{error}</p>
            <button
              onClick={fetchUsersByRole}
              className="px-4 py-2 rounded-lg bg-slate-900 text-white hover:bg-slate-800 transition-colors"
            >
              Retry
            </button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <AdminPageHeader
        badge="Admin"
        title="Users"
        subtitle="View role-specific users, analytics, and health metrics."
      />

      <div className="flex gap-2 border-b border-slate-200">
        {(["PLAYER", "COACH", "VENUE_LISTER"] as UsersTabRole[]).map((tab) => (
          <button
            key={tab}
            onClick={() => switchTab(tab)}
            className={`px-4 py-3 font-semibold text-sm transition-colors border-b-2 ${
              activeTab === tab
                ? "border-power-orange text-power-orange"
                : "border-transparent text-slate-600 hover:text-slate-900"
            }`}
          >
            {TAB_LABELS[tab]}
            <span className="ml-2 px-2 py-0.5 rounded-full bg-slate-100 text-xs">
              {summary[tab]}
            </span>
          </button>
        ))}
      </div>

      {activeTab === "PLAYER" && playersAnalytics && (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          <Card className="bg-white">
            <p className="text-xs uppercase tracking-wide text-slate-500">
              Total
            </p>
            <p className="text-2xl font-bold text-slate-900">
              {playersAnalytics.totalPlayers}
            </p>
          </Card>
          <Card className="bg-white">
            <p className="text-xs uppercase tracking-wide text-slate-500">
              New This Month
            </p>
            <p className="text-2xl font-bold text-slate-900">
              {playersAnalytics.newThisMonth}
            </p>
          </Card>
          <Card className="bg-white">
            <p className="text-xs uppercase tracking-wide text-slate-500">
              Sports Profile
            </p>
            <p className="text-2xl font-bold text-slate-900">
              {playersAnalytics.withSportsProfile}
            </p>
          </Card>
          <Card className="bg-white">
            <p className="text-xs uppercase tracking-wide text-slate-500">
              With Dependents
            </p>
            <p className="text-2xl font-bold text-slate-900">
              {playersAnalytics.withDependents}
            </p>
          </Card>
          <Card className="bg-white">
            <p className="text-xs uppercase tracking-wide text-slate-500">
              New Accounts Last 24h
            </p>
            <p className="text-2xl font-bold text-slate-900">
              {playersAnalytics.newAccountsLast24Hours}
            </p>
          </Card>
        </div>
      )}

      {activeTab === "COACH" && coachesAnalytics && (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          <Card className="bg-white">
            <p className="text-xs uppercase tracking-wide text-slate-500">
              Total
            </p>
            <p className="text-2xl font-bold text-slate-900">
              {coachesAnalytics.totalCoaches}
            </p>
          </Card>
          <Card className="bg-white">
            <p className="text-xs uppercase tracking-wide text-slate-500">
              Verified
            </p>
            <p className="text-2xl font-bold text-slate-900">
              {coachesAnalytics.verifiedCount}
            </p>
          </Card>
          <Card className="bg-white">
            <p className="text-xs uppercase tracking-wide text-slate-500">
              Pending / Review
            </p>
            <p className="text-2xl font-bold text-slate-900">
              {coachesAnalytics.pendingOrReviewCount}
            </p>
          </Card>
          <Card className="bg-white">
            <p className="text-xs uppercase tracking-wide text-slate-500">
              Avg Rating
            </p>
            <p className="text-2xl font-bold text-slate-900">
              {coachesAnalytics.avgRating.toFixed(2)}
            </p>
          </Card>
          <Card className="bg-white">
            <p className="text-xs uppercase tracking-wide text-slate-500">
              New Accounts Last 24h
            </p>
            <p className="text-2xl font-bold text-slate-900">
              {coachesAnalytics.newAccountsLast24Hours}
            </p>
          </Card>
        </div>
      )}

      {activeTab === "VENUE_LISTER" && venueListersAnalytics && (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          <Card className="bg-white">
            <p className="text-xs uppercase tracking-wide text-slate-500">
              Total
            </p>
            <p className="text-2xl font-bold text-slate-900">
              {venueListersAnalytics.totalVenueListers}
            </p>
          </Card>
          <Card className="bg-white">
            <p className="text-xs uppercase tracking-wide text-slate-500">
              Owners With Venues
            </p>
            <p className="text-2xl font-bold text-slate-900">
              {venueListersAnalytics.withAtLeastOneVenue}
            </p>
          </Card>
          <Card className="bg-white">
            <p className="text-xs uppercase tracking-wide text-slate-500">
              Approved Venues
            </p>
            <p className="text-2xl font-bold text-slate-900">
              {venueListersAnalytics.approvedVenuesCount}
            </p>
          </Card>
          <Card className="bg-white">
            <p className="text-xs uppercase tracking-wide text-slate-500">
              Pending Venues
            </p>
            <p className="text-2xl font-bold text-slate-900">
              {venueListersAnalytics.pendingVenuesCount}
            </p>
          </Card>
          <Card className="bg-white">
            <p className="text-xs uppercase tracking-wide text-slate-500">
              New Accounts Last 24h
            </p>
            <p className="text-2xl font-bold text-slate-900">
              {venueListersAnalytics.newAccountsLast24Hours}
            </p>
          </Card>
        </div>
      )}

      <Card className="bg-white">
        <div className="grid gap-3 md:grid-cols-2">
          <input
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Search by name or email"
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
          <select
            value={sortBy}
            onChange={(event) => setSortBy(event.target.value as SortBy)}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
          >
            <option value="joined_desc">Newest joined first</option>
            <option value="joined_asc">Oldest joined first</option>
            <option value="name_asc">Name (A-Z)</option>
            {activeTab === "COACH" && (
              <option value="rating_desc">Rating (High-Low)</option>
            )}
          </select>
        </div>
      </Card>

      {(() => {
        const filteredUsers = users.filter((user) => {
          const query = searchQuery.trim().toLowerCase();
          if (!query) return true;
          return (
            user.name.toLowerCase().includes(query) ||
            user.email.toLowerCase().includes(query)
          );
        });

        const visibleUsers = [...filteredUsers].sort((left, right) => {
          if (sortBy === "name_asc") {
            return left.name.localeCompare(right.name);
          }

          if (sortBy === "joined_asc") {
            return (
              new Date(left.createdAt).getTime() -
              new Date(right.createdAt).getTime()
            );
          }

          if (
            sortBy === "rating_desc" &&
            left.role === "COACH" &&
            right.role === "COACH"
          ) {
            return right.rating - left.rating;
          }

          return (
            new Date(right.createdAt).getTime() -
            new Date(left.createdAt).getTime()
          );
        });

        return (
          <>
            <Card className="p-0 bg-white overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="min-w-230 w-full">
                  <thead className="bg-slate-100">
                    <tr>
                      <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900">
                        Name
                      </th>
                      <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900">
                        Email
                      </th>
                      {activeTab === "PLAYER" && (
                        <>
                          <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900">
                            Sports
                          </th>
                          <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900">
                            Dependents
                          </th>
                        </>
                      )}
                      {activeTab === "COACH" && (
                        <>
                          <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900">
                            Verification
                          </th>
                          <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900">
                            Service Mode
                          </th>
                          <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900">
                            Rating
                          </th>
                        </>
                      )}
                      {activeTab === "VENUE_LISTER" && (
                        <>
                          <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900">
                            Business
                          </th>
                          <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900">
                            Total Venues
                          </th>
                          <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900">
                            Approved / Pending
                          </th>
                        </>
                      )}
                      <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900">
                        Created At
                      </th>
                      <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900">
                        Last Active
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {visibleUsers.length === 0 ? (
                      <tr>
                        <td
                          colSpan={
                            activeTab === "PLAYER"
                              ? 6
                              : activeTab === "COACH"
                                ? 7
                                : 7
                          }
                          className="px-6 py-8 text-center text-slate-600"
                        >
                          {searchQuery
                            ? `No ${TAB_LABELS[activeTab].toLowerCase()} match your search`
                            : `No ${TAB_LABELS[activeTab].toLowerCase()} found`}
                        </td>
                      </tr>
                    ) : (
                      visibleUsers.map((user) => (
                        <tr key={user.id} className="hover:bg-slate-50">
                          <td className="px-6 py-4 text-slate-900 font-medium">
                            {user.name}
                          </td>
                          <td className="px-6 py-4 text-sm text-slate-600">
                            {user.email}
                          </td>

                          {user.role === "PLAYER" && (
                            <>
                              <td className="px-6 py-4 text-sm text-slate-600">
                                {user.sportsCount}
                              </td>
                              <td className="px-6 py-4 text-sm text-slate-600">
                                {user.dependentsCount}
                              </td>
                            </>
                          )}

                          {user.role === "COACH" && (
                            <>
                              <td className="px-6 py-4">
                                <span className="px-2 py-1 bg-power-orange/10 text-power-orange text-xs rounded-full font-medium">
                                  {user.verificationStatus}
                                </span>
                              </td>
                              <td className="px-6 py-4 text-sm text-slate-600">
                                {user.serviceMode || "-"}
                              </td>
                              <td className="px-6 py-4 text-sm text-slate-600">
                                {user.rating.toFixed(1)} ({user.reviewCount})
                              </td>
                            </>
                          )}

                          {user.role === "VENUE_LISTER" && (
                            <>
                              <td className="px-6 py-4 text-sm text-slate-600">
                                {user.businessName || "-"}
                              </td>
                              <td className="px-6 py-4 text-sm text-slate-600">
                                {user.venueCount}
                              </td>
                              <td className="px-6 py-4 text-sm text-slate-600">
                                {user.approvedVenueCount} /{" "}
                                {user.pendingVenueCount}
                              </td>
                            </>
                          )}

                          <td className="px-6 py-4 text-sm text-slate-600">
                            {formatDateTime(user.createdAt)}
                          </td>
                          <td className="px-6 py-4 text-sm">
                            <span
                              className={`px-2 py-1 rounded-full text-xs font-medium ${
                                user.isOnlineNow
                                  ? "bg-emerald-100 text-emerald-700"
                                  : "bg-slate-100 text-slate-600"
                              }`}
                              title={`Last active: ${formatDateTime(user.lastActiveAt)}`}
                            >
                              {user.isOnlineNow
                                ? "Online now"
                                : formatDateTime(user.lastActiveAt)}
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </Card>

            {pagination.totalPages > 1 && (
              <div className="flex flex-col gap-3 p-4 bg-white rounded-lg border border-slate-200 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm text-slate-600 text-center sm:text-left">
                  Showing {(currentPage - 1) * PAGE_SIZE + 1}-
                  {Math.min(currentPage * PAGE_SIZE, pagination.total)} of{" "}
                  {pagination.total} {TAB_LABELS[activeTab].toLowerCase()}
                </p>
                <div className="flex items-center justify-center gap-2">
                  <button
                    onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                    disabled={currentPage === 1}
                    className="p-2 rounded-lg border border-slate-300 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    <ChevronLeft size={18} />
                  </button>

                  {Array.from(
                    { length: pagination.totalPages },
                    (_, i) => i + 1,
                  )
                    .slice(
                      Math.max(0, currentPage - 2),
                      Math.min(pagination.totalPages, currentPage + 1),
                    )
                    .map((page) => (
                      <button
                        key={page}
                        onClick={() => setCurrentPage(page)}
                        className={`px-3 py-2 rounded-lg font-semibold transition-colors ${
                          currentPage === page
                            ? "bg-power-orange text-white"
                            : "border border-slate-300 text-slate-700 hover:bg-slate-50"
                        }`}
                      >
                        {page}
                      </button>
                    ))}

                  <button
                    onClick={() =>
                      setCurrentPage(
                        Math.min(pagination.totalPages, currentPage + 1),
                      )
                    }
                    disabled={currentPage === pagination.totalPages}
                    className="p-2 rounded-lg border border-slate-300 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    <ChevronRight size={18} />
                  </button>
                </div>
              </div>
            )}
          </>
        );
      })()}
    </div>
  );
}
