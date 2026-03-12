"use client";

import { AdminPageHeader } from "@/modules/admin/components/AdminPageHeader";
import { UserSafetyRecord, adminApi } from "@/modules/admin/services/admin";
import { Card } from "@/modules/shared/ui/Card";
import { useCallback, useEffect, useState } from "react";

export default function AdminUserSafetyPage() {
  const [users, setUsers] = useState<UserSafetyRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<
    "ALL" | "ACTIVE" | "SUSPENDED"
  >("ALL");
  const [busyUserId, setBusyUserId] = useState<string | null>(null);

  const loadUsers = useCallback(async () => {
    setLoading(true);
    try {
      const response = await adminApi.getUserSafetyList({
        status: statusFilter === "ALL" ? undefined : statusFilter,
        limit: 100,
      });
      if (response.success && response.data) {
        setUsers(response.data);
      }
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

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
        <div className="flex items-center gap-2">
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
        </div>

        {loading ? (
          <div className="py-10 text-center text-slate-500">
            Loading users...
          </div>
        ) : users.length === 0 ? (
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
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {users.map((user) => (
                  <tr key={user.id}>
                    <td className="px-4 py-3 text-sm text-slate-700">
                      <div className="font-medium">{user.name}</div>
                      <div className="text-xs text-slate-500">{user.email}</div>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-700">
                      {user.role}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-700">
                      {user.isActive ? "ACTIVE" : "SUSPENDED"}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-700 max-w-sm">
                      {user.suspensionReason || "-"}
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
      </Card>
    </div>
  );
}
