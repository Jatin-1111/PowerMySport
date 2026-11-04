"use client";

import { AdminPageHeader } from "@/modules/admin/components/AdminPageHeader";
import {
  CoachUserRow,
  CoachesAnalytics,
  ExpertUserRow,
  ParentUserRow,
  PlayerUserRow,
  PlayersAnalytics,
  statsApi,
  UsersRoleSummary,
  UsersTabRole,
  VenueListerUserRow,
  VenueListersAnalytics,
} from "@/modules/analytics/services/stats";
import { AdminDataTable, AdminDataTableColumn } from "@/modules/shared/ui/AdminDataTable";
import { EntityBadge } from "@/modules/shared/ui/EntityBadge";
import { MetricStrip } from "@/modules/shared/ui/Panel";
import { StatusBadge } from "@/modules/shared/ui/StatusBadge";
import { Tabs } from "@/modules/shared/ui/Tabs";
import { DetailDrawer, DetailRow, DetailSection } from "@/modules/shared/ui/DetailDrawer";
import { ExportCsvButton } from "@/modules/shared/ui/ExportCsvButton";
import { useCallback, useEffect, useMemo, useState, Suspense } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { io } from "socket.io-client";
import { ErrorNotice, SkeletonBlock } from "@/modules/shared/ui/States";

interface PaginationData {
  total: number;
  page: number;
  totalPages: number;
}

type UsersRow = PlayerUserRow | CoachUserRow | VenueListerUserRow | GenericUserRow;
type SortColumn = "name" | "joined" | "lastActive" | "rating";
type SortDirection = "asc" | "desc";

// Generic row for roles without a dedicated API (Expert, Parent)
interface GenericUserRow {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: "EXPERT" | "Parent";
  createdAt: string;
  lastActiveAt: string;
  isOnlineNow: boolean;
}

const TAB_LABELS: Record<UsersTabRole, string> = {
  EXPERT: "Experts",
  Parent: "Parents",
  Player: "Players",
  Coach: "Coaches",
  VenueLister: "Venue Owners",
};

const DEFAULT_SUMMARY: UsersRoleSummary = {
  EXPERT: 0,
  Parent: 0,
  Player: 0,
  Coach: 0,
  VenueLister: 0,
};

const formatDateTime = (value?: string): string => (value ? new Date(value).toLocaleString() : "—");

const formatDate = (value?: string): string =>
  value
    ? new Date(value).toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : "—";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api";
const SOCKET_URL = API_URL.replace(/\/api\/?$/, "");

interface PresenceUpdateEvent {
  userId: string;
  isOnlineNow: boolean;
  lastActiveAt: string;
}

function OnlinePill({ online, lastActiveAt }: { online: boolean; lastActiveAt: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-md px-2 py-0.5 text-xs font-medium ${
        online
          ? "bg-emerald-50 text-emerald-800 ring-1 ring-inset ring-emerald-200"
          : "bg-slate-100 text-slate-600"
      }`}
      title={`Last active: ${formatDateTime(lastActiveAt)}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${online ? "bg-emerald-500" : "bg-slate-400"}`} />
      {online ? "Online" : formatDate(lastActiveAt)}
    </span>
  );
}

export default function AdminUsersPage() {
  return (
    <Suspense fallback={<SkeletonBlock rows={6} label="Loading users" />}>
      <AdminUsersPageContent />
    </Suspense>
  );
}

function AdminUsersPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();

  const tabParam = searchParams.get("tab") as UsersTabRole;
  const activeTab: UsersTabRole =
    tabParam === "EXPERT" ||
    tabParam === "Parent" ||
    tabParam === "Player" ||
    tabParam === "Coach" ||
    tabParam === "VenueLister"
      ? tabParam
      : "EXPERT";

  const pageParam = Number(searchParams.get("page"));
  const currentPage = !isNaN(pageParam) && pageParam > 0 ? pageParam : 1;

  const updateQueryParams = (params: Record<string, string | number | null>) => {
    const current = new URLSearchParams(Array.from(searchParams.entries()));
    Object.entries(params).forEach(([key, value]) => {
      if (value === null || value === undefined) {
        current.delete(key);
      } else {
        current.set(key, String(value));
      }
    });
    const search = current.toString();
    router.replace(`${pathname}${search ? `?${search}` : ""}`, {
      scroll: false,
    });
  };

  const setCurrentPage = (page: number) => updateQueryParams({ page });

  const [users, setUsers] = useState<UsersRow[]>([]);
  const [summary, setSummary] = useState<UsersRoleSummary>(DEFAULT_SUMMARY);
  const [playersAnalytics, setPlayersAnalytics] = useState<PlayersAnalytics | null>(null);
  const [coachesAnalytics, setCoachesAnalytics] = useState<CoachesAnalytics | null>(null);
  const [venueListersAnalytics, setVenueListersAnalytics] = useState<VenueListersAnalytics | null>(
    null
  );
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState<PaginationData>({
    total: 0,
    page: 1,
    totalPages: 1,
  });
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortColumn, setSortColumn] = useState<SortColumn>("joined");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [selectedUser, setSelectedUser] = useState<UsersRow | null>(null);
  const PAGE_SIZE = 15;

  const fetchSummary = useCallback(async () => {
    try {
      const response = await statsApi.getUsersRoleSummary();
      if (response.success && response.data) setSummary(response.data);
    } catch (summaryError) {
      console.error("Failed to fetch users summary:", summaryError);
    }
  }, []);

  const fetchUsersByRole = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      if (activeTab === "EXPERT") {
        const usersResponse = await statsApi.getExpertUsers({
          page: currentPage,
          limit: PAGE_SIZE,
        });
        if (!usersResponse.success || !usersResponse.data) {
          setError(usersResponse.message || "Failed to load experts.");
          return;
        }
        setUsers(usersResponse.data as UsersRow[]);
        if (usersResponse.pagination) setPagination(usersResponse.pagination);
        return;
      }

      if (activeTab === "Parent") {
        const usersResponse = await statsApi.getParentUsers({
          page: currentPage,
          limit: PAGE_SIZE,
        });
        if (!usersResponse.success || !usersResponse.data) {
          setError(usersResponse.message || "Failed to load parents.");
          return;
        }
        setUsers(usersResponse.data as UsersRow[]);
        if (usersResponse.pagination) setPagination(usersResponse.pagination);
        return;
      }

      if (activeTab === "Player") {
        const [usersResponse, analyticsResponse] = await Promise.all([
          statsApi.getPlayersUsers({ page: currentPage, limit: PAGE_SIZE }),
          statsApi.getPlayersAnalytics(),
        ]);
        if (!usersResponse.success || !usersResponse.data) {
          setError(usersResponse.message || "Failed to load players.");
          return;
        }
        setUsers(usersResponse.data);
        if (usersResponse.pagination) setPagination(usersResponse.pagination);
        if (analyticsResponse.success && analyticsResponse.data)
          setPlayersAnalytics(analyticsResponse.data);
        return;
      }

      if (activeTab === "Coach") {
        const [usersResponse, analyticsResponse] = await Promise.all([
          statsApi.getCoachUsers({ page: currentPage, limit: PAGE_SIZE }),
          statsApi.getCoachesAnalytics(),
        ]);
        if (!usersResponse.success || !usersResponse.data) {
          setError(usersResponse.message || "Failed to load coaches.");
          return;
        }
        setUsers(usersResponse.data);
        if (usersResponse.pagination) setPagination(usersResponse.pagination);
        if (analyticsResponse.success && analyticsResponse.data)
          setCoachesAnalytics(analyticsResponse.data);
        return;
      }

      const [usersResponse, analyticsResponse] = await Promise.all([
        statsApi.getVenueListerUsers({ page: currentPage, limit: PAGE_SIZE }),
        statsApi.getVenueListersAnalytics(),
      ]);
      if (!usersResponse.success || !usersResponse.data) {
        setError(usersResponse.message || "Failed to load venue owners.");
        return;
      }
      setUsers(usersResponse.data);
      if (usersResponse.pagination) setPagination(usersResponse.pagination);
      if (analyticsResponse.success && analyticsResponse.data)
        setVenueListersAnalytics(analyticsResponse.data);
    } catch (fetchError) {
      console.error("Failed to fetch users by role:", fetchError);
      setError("Failed to load users.");
    } finally {
      setLoading(false);
    }
  }, [activeTab, currentPage]);

  const switchTab = (tab: UsersTabRole): void => {
    updateQueryParams({ tab, page: 1 });
    setSearchQuery("");
    setSortColumn("joined");
    setSortDirection("desc");
    setSelectedUser(null);
  };

  const onSortChange = (column: string) => {
    const col = column as SortColumn;
    if (sortColumn === col) {
      setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortColumn(col);
      setSortDirection(col === "name" ? "asc" : "desc");
    }
  };

  useEffect(() => {
    fetchSummary();
  }, [fetchSummary]);

  useEffect(() => {
    fetchUsersByRole();
  }, [fetchUsersByRole]);

  useEffect(() => {
    const socket = io(SOCKET_URL, {
      transports: ["websocket"],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
    });

    const onPresenceUpdate = (event: PresenceUpdateEvent): void => {
      if (!event?.userId) return;
      setUsers((previous) =>
        previous.map((user) =>
          user.id === event.userId
            ? {
                ...user,
                isOnlineNow: event.isOnlineNow,
                lastActiveAt: event.lastActiveAt,
              }
            : user
        )
      );
    };

    socket.on("PRESENCE_UPDATE", onPresenceUpdate);
    return () => {
      socket.off("PRESENCE_UPDATE", onPresenceUpdate);
      socket.disconnect();
    };
  }, []);

  const visibleUsers = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    const filtered = users.filter((user) => {
      if (!query) return true;
      return (
        user.name.toLowerCase().includes(query) ||
        user.email.toLowerCase().includes(query) ||
        (user.phone || "").toLowerCase().includes(query)
      );
    });

    const factor = sortDirection === "asc" ? 1 : -1;
    return [...filtered].sort((left, right) => {
      if (sortColumn === "name") {
        return factor * left.name.localeCompare(right.name);
      }
      if (sortColumn === "lastActive") {
        return (
          factor * (new Date(left.lastActiveAt).getTime() - new Date(right.lastActiveAt).getTime())
        );
      }
      if (sortColumn === "rating" && left.role === "Coach" && right.role === "Coach") {
        return factor * (left.rating - right.rating);
      }
      return factor * (new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime());
    });
  }, [users, searchQuery, sortColumn, sortDirection]);

  const columns = useMemo<AdminDataTableColumn<UsersRow>[]>(() => {
    const userCol: AdminDataTableColumn<UsersRow> = {
      key: "name",
      header: "User",
      sortable: true,
      render: (u) => <EntityBadge name={u.name} email={u.email} />,
    };
    const phoneCol: AdminDataTableColumn<UsersRow> = {
      key: "phone",
      header: "Phone",
      render: (u) => <span className="whitespace-nowrap text-slate-600">{u.phone || "—"}</span>,
    };
    const joinedCol: AdminDataTableColumn<UsersRow> = {
      key: "joined",
      header: "Joined",
      sortable: true,
      render: (u) => (
        <span className="whitespace-nowrap text-slate-600">{formatDate(u.createdAt)}</span>
      ),
    };
    const activityCol: AdminDataTableColumn<UsersRow> = {
      key: "lastActive",
      header: "Activity",
      sortable: true,
      render: (u) => <OnlinePill online={u.isOnlineNow} lastActiveAt={u.lastActiveAt} />,
    };

    if (activeTab === "EXPERT") {
      return [
        userCol,
        phoneCol,
        {
          key: "specialization",
          header: "Specialization",
          render: (u) =>
            u.role === "EXPERT" ? (
              <span className="text-slate-700">{(u as ExpertUserRow).specialization || "—"}</span>
            ) : null,
        },
        {
          key: "sessionCount",
          header: "Sessions",
          render: (u) =>
            u.role === "EXPERT" ? (
              <span className="text-slate-700">{(u as ExpertUserRow).sessionCount ?? "—"}</span>
            ) : null,
        },
        joinedCol,
        activityCol,
      ];
    }

    if (activeTab === "Parent") {
      return [
        userCol,
        phoneCol,
        {
          key: "dependents",
          header: "Dependents",
          render: (u) =>
            u.role === "Parent" ? (
              <span className="text-slate-700">{(u as ParentUserRow).dependentsCount}</span>
            ) : null,
        },
        joinedCol,
        activityCol,
      ];
    }

    if (activeTab === "Player") {
      return [
        userCol,
        phoneCol,
        {
          key: "sports",
          header: "Sports",
          render: (u) =>
            u.role === "Player" ? <span className="text-slate-700">{u.sportsCount}</span> : null,
        },
        joinedCol,
        activityCol,
      ];
    }

    if (activeTab === "Coach") {
      return [
        userCol,
        phoneCol,
        {
          key: "verification",
          header: "Verification",
          render: (u) =>
            u.role === "Coach" ? <StatusBadge status={u.verificationStatus} /> : null,
        },
        {
          key: "serviceMode",
          header: "Service mode",
          render: (u) =>
            u.role === "Coach" ? (
              <span className="text-slate-600">{u.serviceMode || "—"}</span>
            ) : null,
        },
        {
          key: "rating",
          header: "Rating",
          sortable: true,
          render: (u) =>
            u.role === "Coach" ? (
              <span className="text-slate-700">
                {u.rating.toFixed(1)} <span className="text-slate-500">({u.reviewCount})</span>
              </span>
            ) : null,
        },
        joinedCol,
        activityCol,
      ];
    }

    return [
      userCol,
      phoneCol,
      {
        key: "business",
        header: "Business",
        render: (u) =>
          u.role === "VenueLister" ? (
            <span className="text-slate-700">{u.businessName || "—"}</span>
          ) : null,
      },
      {
        key: "venues",
        header: "Venues (approved / pending / total)",
        render: (u) =>
          u.role === "VenueLister" ? (
            <span className="text-slate-700">
              <span className="text-emerald-700">{u.approvedVenueCount}</span>
              {" / "}
              <span className="text-amber-700">{u.pendingVenueCount}</span>
              {" / "}
              {u.venueCount}
            </span>
          ) : null,
      },
      joinedCol,
      activityCol,
    ];
  }, [activeTab]);

  const exportColumns = useMemo(() => {
    if (activeTab === "Player") {
      return [
        { header: "Name", value: (u: UsersRow) => u.name },
        { header: "Email", value: (u: UsersRow) => u.email },
        { header: "Phone", value: (u: UsersRow) => u.phone || "" },
        {
          header: "Sports Count",
          value: (u: UsersRow) => (u.role === "Player" ? u.sportsCount : ""),
        },
        { header: "Created At", value: (u: UsersRow) => u.createdAt },
        { header: "Last Active", value: (u: UsersRow) => u.lastActiveAt },
      ];
    }
    if (activeTab === "Coach") {
      return [
        { header: "Name", value: (u: UsersRow) => u.name },
        { header: "Email", value: (u: UsersRow) => u.email },
        { header: "Phone", value: (u: UsersRow) => u.phone || "" },
        {
          header: "Verification Status",
          value: (u: UsersRow) => (u.role === "Coach" ? u.verificationStatus : ""),
        },
        {
          header: "Service mode",
          value: (u: UsersRow) => (u.role === "Coach" ? u.serviceMode || "" : ""),
        },
        {
          header: "Rating",
          value: (u: UsersRow) => (u.role === "Coach" ? u.rating : ""),
        },
        { header: "Created At", value: (u: UsersRow) => u.createdAt },
        { header: "Last Active", value: (u: UsersRow) => u.lastActiveAt },
      ];
    }
    return [
      { header: "Name", value: (u: UsersRow) => u.name },
      { header: "Email", value: (u: UsersRow) => u.email },
      { header: "Phone", value: (u: UsersRow) => u.phone || "" },
      {
        header: "Business Name",
        value: (u: UsersRow) => (u.role === "VenueLister" ? u.businessName || "" : ""),
      },
      {
        header: "Total Venues",
        value: (u: UsersRow) => (u.role === "VenueLister" ? u.venueCount : ""),
      },
      {
        header: "Approved venues",
        value: (u: UsersRow) => (u.role === "VenueLister" ? u.approvedVenueCount : ""),
      },
      {
        header: "Pending venues",
        value: (u: UsersRow) => (u.role === "VenueLister" ? u.pendingVenueCount : ""),
      },
      { header: "Created At", value: (u: UsersRow) => u.createdAt },
      { header: "Last Active", value: (u: UsersRow) => u.lastActiveAt },
    ];
  }, [activeTab]);

  const tabItems = (["EXPERT", "Parent", "Player", "Coach", "VenueLister"] as UsersTabRole[]).map(
    (tab) => ({ id: tab, label: TAB_LABELS[tab], count: summary[tab] })
  );

  return (
    <div className="space-y-6">
      <AdminPageHeader
        badge="People"
        title="Users"
        subtitle="Every account on the platform, by role. Open a row for full details."
      />

      <Tabs tabs={tabItems} value={activeTab} onChange={switchTab} label="User roles" />

      {error && <ErrorNotice message={error} onRetry={fetchUsersByRole} />}

      {activeTab === "Player" && playersAnalytics && (
        <MetricStrip
          items={[
            { label: "Total", value: String(playersAnalytics.totalPlayers) },
            { label: "New this month", value: String(playersAnalytics.newThisMonth) },
            { label: "With sports profile", value: String(playersAnalytics.withSportsProfile) },
            { label: "With dependents", value: String(playersAnalytics.withDependents) },
            { label: "New in last 24h", value: String(playersAnalytics.newAccountsLast24Hours) },
          ]}
        />
      )}

      {activeTab === "Coach" && coachesAnalytics && (
        <MetricStrip
          items={[
            { label: "Total", value: String(coachesAnalytics.totalCoaches) },
            { label: "Verified", value: String(coachesAnalytics.verifiedCount) },
            { label: "Pending or in review", value: String(coachesAnalytics.pendingOrReviewCount) },
            { label: "Average rating", value: String(coachesAnalytics.avgRating.toFixed(2)) },
            { label: "New in last 24h", value: String(coachesAnalytics.newAccountsLast24Hours) },
          ]}
        />
      )}

      {activeTab === "VenueLister" && venueListersAnalytics && (
        <MetricStrip
          items={[
            { label: "Total", value: String(venueListersAnalytics.totalVenueListers) },
            {
              label: "Owners with venues",
              value: String(venueListersAnalytics.withAtLeastOneVenue),
            },
            { label: "Approved venues", value: String(venueListersAnalytics.approvedVenuesCount) },
            { label: "Pending venues", value: String(venueListersAnalytics.pendingVenuesCount) },
            {
              label: "New in last 24h",
              value: String(venueListersAnalytics.newAccountsLast24Hours),
            },
          ]}
        />
      )}

      <AdminDataTable<UsersRow>
        columns={columns}
        rows={visibleUsers}
        getRowKey={(u) => u.id}
        loading={loading}
        emptyMessage={
          searchQuery
            ? `No ${TAB_LABELS[activeTab].toLowerCase()} match your search`
            : `No ${TAB_LABELS[activeTab].toLowerCase()} found`
        }
        onRowClick={(u) => setSelectedUser(u)}
        search={{
          value: searchQuery,
          onChange: setSearchQuery,
          placeholder: "Search this page by name, email or phone",
        }}
        sort={{
          column: sortColumn,
          direction: sortDirection,
          onChange: onSortChange,
        }}
        pagination={{
          page: currentPage,
          totalPages: pagination.totalPages,
          total: pagination.total,
          onPageChange: setCurrentPage,
        }}
        toolbarExtra={
          <ExportCsvButton
            filename={`${activeTab.toLowerCase()}-users.csv`}
            rows={visibleUsers}
            label="Export this page (CSV)"
            columns={exportColumns}
          />
        }
      />

      <DetailDrawer
        open={Boolean(selectedUser)}
        onClose={() => setSelectedUser(null)}
        title={selectedUser?.name || "User"}
        subtitle={selectedUser?.email}
        headerExtra={
          selectedUser ? (
            <OnlinePill
              online={selectedUser.isOnlineNow}
              lastActiveAt={selectedUser.lastActiveAt}
            />
          ) : null
        }
      >
        {selectedUser && (
          <>
            <DetailSection title="Account">
              <DetailRow label="Role" value={TAB_LABELS[activeTab]} />
              <DetailRow label="Email" value={selectedUser.email} />
              <DetailRow label="Phone" value={selectedUser.phone || "—"} />
              <DetailRow label="Joined" value={formatDateTime(selectedUser.createdAt)} />
              <DetailRow label="Last active" value={formatDateTime(selectedUser.lastActiveAt)} />
            </DetailSection>

            {selectedUser.role === "EXPERT" && (
              <DetailSection title="Expert profile">
                <DetailRow
                  label="Specialization"
                  value={(selectedUser as ExpertUserRow).specialization || "—"}
                />
                <DetailRow
                  label="Sessions"
                  value={(selectedUser as ExpertUserRow).sessionCount ?? "—"}
                />
              </DetailSection>
            )}

            {selectedUser.role === "Parent" && (
              <DetailSection title="Parent profile">
                <DetailRow
                  label="Dependents"
                  value={(selectedUser as ParentUserRow).dependentsCount}
                />
              </DetailSection>
            )}

            {selectedUser.role === "Player" && (
              <DetailSection title="Player profile">
                <DetailRow
                  label="Has sports profile"
                  value={selectedUser.hasSportsProfile ? "Yes" : "No"}
                />
                <DetailRow
                  label="Sports"
                  value={selectedUser.sports.length ? selectedUser.sports.join(", ") : "—"}
                />
              </DetailSection>
            )}

            {selectedUser.role === "Coach" && (
              <DetailSection title="Coach profile">
                <DetailRow
                  label="Verification"
                  value={<StatusBadge status={selectedUser.verificationStatus} />}
                />
                <DetailRow label="Service mode" value={selectedUser.serviceMode || "—"} />
                <DetailRow
                  label="Hourly rate"
                  value={selectedUser.hourlyRate != null ? `₹${selectedUser.hourlyRate}` : "—"}
                />
                <DetailRow
                  label="Rating"
                  value={`${selectedUser.rating.toFixed(1)} (${selectedUser.reviewCount} reviews)`}
                />
                <DetailRow
                  label="Sports"
                  value={selectedUser.sports.length ? selectedUser.sports.join(", ") : "—"}
                />
                <DetailRow
                  label="Profile complete"
                  value={selectedUser.profileIncomplete ? "No" : "Yes"}
                />
              </DetailSection>
            )}

            {selectedUser.role === "VenueLister" && (
              <DetailSection title="Venue owner profile">
                <DetailRow label="Business" value={selectedUser.businessName || "—"} />
                <DetailRow label="Total venues" value={selectedUser.venueCount} />
                <DetailRow label="Approved venues" value={selectedUser.approvedVenueCount} />
                <DetailRow label="Pending venues" value={selectedUser.pendingVenueCount} />
                <DetailRow
                  label="Can add more venues"
                  value={selectedUser.canAddMoreVenues ? "Yes" : "No"}
                />
              </DetailSection>
            )}
          </>
        )}
      </DetailDrawer>
    </div>
  );
}
