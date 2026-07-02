"use client";

import { AdminPageHeader } from "@/modules/admin/components/AdminPageHeader";
import { UserSafetyRecord, adminApi } from "@/modules/admin/services/admin";
import { Card } from "@/modules/shared/ui/Card";
import { useCallback, useEffect, useState } from "react";

const formatDate = (value?: string | null): string =>
  value ? new Date(value).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "—";

export default function AdminUserSafetyPage() {
  const [users, setUsers] = useState<UserSafetyRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<
    "ALL" | "ACTIVE" | "SUSPENDED"
  >("ALL");
  const [busyUserId, setBusyUserId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const PAGE_SIZE = 20;

  const loadUsers = useCallback(async () => {
    setLoading(true);
    try {
      const response = await adminApi.getUserSafetyList({
        status: statusFilter === "ALL" ? undefined : statusFilter,
        page,
        limit: PAGE_SIZE,
      });
      if (response.success && response.data) {
        setUsers(response.data);
        setTotalPages(response.pagination?.totalPages || 1);
        setTotal(response.pagination?.total || response.data.length);
      }
    } finally {
      setLoading(false);
    }
  }, [statusFilter, page]);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  useEffect(() => {
    setPage(1);
  }, [statusFilter]);

  const visibleUsers = users.filter((user) => {
    const query = search.trim().toLowerCase();
    if (!query) return true;
    return (
      user.name.toLowerCase().includes(query) ||
      user.email.toLowerCase().includes(query)
    );
  });

  const updateSafety = async (
    userId: string,
    action: "SUSPEND" | "REACTIVATE" | "DEACTIVATE",
  ) => {
    setBusyUserId(userId);
    try {
      const reason =
        action === "SUSPEND" || action === "DEACTIVATE"
          ? window.prompt("Reason (required):") || ""
          : undefined;

      if (
        (action === "SUSPEND" || action === "DEACTIVATE") &&
        !(reason || "").trim()
      ) {
        return;
      }

      await adminApi.updateUserSafety(userId, { action, reason });
      await loadUsers();
    } finally {
      setBusyUserId(null);
    }
  };

  return (
    <div className="space-y-6">
      <AdminPageHeader
        badge="Admin"
        title="User Safety"
        subtitle="Suspend, reactivate, or deactivate accounts with audit-friendly reasons."
      />

      <Card className="bg-white space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-sm font-medium text-slate-700">Filter:</span>
          <select
            value={statusFilter}
            onChange={(event) =>
              setStatusFilter(event.target.value as typeof statusFilter)
            }
            className="rounded border border-slate-300 px-3 py-1.5 text-sm"
          >
            <option value="ALL">All</option>
            <option value="ACTIVE">Active</option>
            <option value="SUSPENDED">Suspended</option>
          </select>
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search this page by name or email"
            className="ml-auto rounded border border-slate-300 px-3 py-1.5 text-sm"
          />
        </div>

        {loading ? (
          <div className="py-10 text-center text-slate-500">
            Loading users...
          </div>
        ) : visibleUsers.length === 0 ? (
          <div className="py-10 text-center text-slate-500">
            No users found.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-slate-500">
                    Name
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-slate-500">
                    Role
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-slate-500">
                    Status
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-slate-500">
                    Reason
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-slate-500">
                    Last Active
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-slate-500">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {visibleUsers.map((user) => (
                  <tr key={user.id}>
                    <td className="px-4 py-3 text-sm text-slate-700">
                      <div className="font-medium">{user.name}</div>
                      <div className="text-xs text-slate-500">{user.email}</div>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-700">
                      {user.role}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-700">
                      <div>{user.isActive ? "ACTIVE" : "SUSPENDED"}</div>
                      {!user.isActive && (user.suspendedAt || user.deactivatedAt) && (
                        <div className="text-xs text-slate-400">
                          since {formatDate(user.suspendedAt || user.deactivatedAt)}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-700 max-w-sm">
                      {user.suspensionReason || "-"}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-500">
                      {formatDate(user.lastActiveAt)}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <div className="flex gap-2">
                        {user.isActive ? (
                          <>
                            <button
                              disabled={busyUserId === user.id}
                              onClick={() => updateSafety(user.id, "SUSPEND")}
                              className="rounded bg-amber-100 px-2 py-1 text-amber-800 hover:bg-amber-200"
                            >
                              Suspend
                            </button>
                            <button
                              disabled={busyUserId === user.id}
                              onClick={() =>
                                updateSafety(user.id, "DEACTIVATE")
                              }
                              className="rounded bg-red-100 px-2 py-1 text-red-800 hover:bg-red-200"
                            >
                              Deactivate
                            </button>
                          </>
                        ) : (
                          <button
                            disabled={busyUserId === user.id}
                            onClick={() => updateSafety(user.id, "REACTIVATE")}
                            className="rounded bg-green-100 px-2 py-1 text-green-800 hover:bg-green-200"
                          >
                            Reactivate
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {totalPages > 1 && (
          <div className="flex items-center justify-between gap-2 pt-2">
            <p className="text-xs text-slate-500">
              Page {page} of {totalPages} · {total} total
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                disabled={page <= 1}
                className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-semibold text-slate-700 disabled:opacity-50"
              >
                Previous
              </button>
              <button
                onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
                disabled={page >= totalPages}
                className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-semibold text-slate-700 disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
